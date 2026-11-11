import { resolveQPayConfig, type QPayConfig } from "@/lib/qpay/config";

type TokenCache = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
};

declare global {
  var __genghisQpayToken: TokenCache | undefined;
}

export type QPayInvoiceCreateResult = {
  invoice_id: string;
  qr_text?: string;
  qr_image?: string;
  qPay_shortUrl?: string;
  urls?: Array<{
    name?: string;
    description?: string;
    logo?: string;
    link?: string;
  }>;
};

export type QPayPaymentCheckResult = {
  count: number;
  paid_amount: number;
  rows: Array<{
    payment_id?: string;
    payment_status?: string;
    payment_amount?: string;
  }>;
};

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

export async function getQPayAccessToken(
  config: QPayConfig = resolveQPayConfig()
): Promise<string> {
  if (!config.configured) {
    throw new Error("QPAY_NOT_CONFIGURED");
  }

  const cached = globalThis.__genghisQpayToken;
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return cached.accessToken;
  }

  const basic = Buffer.from(
    `${config.clientId}:${config.clientSecret}`
  ).toString("base64");

  const res = await fetch(`${config.baseUrl}/v2/auth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
  });
  const data = (await readJson(res)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  } | null;

  if (!res.ok || !data?.access_token) {
    throw new Error(
      `QPAY_AUTH_FAILED: ${data?.error || res.statusText || res.status}`
    );
  }

  const expiresIn = Number(data.expires_in || 3600);
  globalThis.__genghisQpayToken = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + Math.max(60, expiresIn) * 1000,
  };
  return data.access_token;
}

export async function createQPayInvoice(input: {
  senderInvoiceNo: string;
  amountMnt: number;
  description: string;
  callbackUrl: string;
  receiverCode?: string;
  config?: QPayConfig;
}): Promise<QPayInvoiceCreateResult> {
  const config = input.config || resolveQPayConfig();
  if (!config.configured) throw new Error("QPAY_NOT_CONFIGURED");

  const token = await getQPayAccessToken(config);
  const res = await fetch(`${config.baseUrl}/v2/invoice`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      invoice_code: config.invoiceCode,
      sender_invoice_no: input.senderInvoiceNo,
      invoice_receiver_code: input.receiverCode || "terminal",
      invoice_description: input.description,
      amount: input.amountMnt,
      callback_url: input.callbackUrl,
    }),
  });

  const data = (await readJson(res)) as QPayInvoiceCreateResult & {
    error?: string;
    message?: string;
  };

  if (!res.ok || !data?.invoice_id) {
    throw new Error(
      `QPAY_INVOICE_FAILED: ${data?.error || data?.message || res.statusText}`
    );
  }
  return data;
}

export async function checkQPayPayment(
  qpayInvoiceId: string,
  config: QPayConfig = resolveQPayConfig()
): Promise<QPayPaymentCheckResult> {
  if (!config.configured) throw new Error("QPAY_NOT_CONFIGURED");
  const token = await getQPayAccessToken(config);
  const res = await fetch(`${config.baseUrl}/v2/payment/check`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      object_type: "INVOICE",
      object_id: qpayInvoiceId,
      offset: { page_number: 1, page_limit: 10 },
    }),
  });

  const data = (await readJson(res)) as QPayPaymentCheckResult & {
    error?: string;
  };

  if (!res.ok) {
    throw new Error(
      `QPAY_CHECK_FAILED: ${data?.error || res.statusText || res.status}`
    );
  }

  return {
    count: Number(data?.count || 0),
    paid_amount: Number(data?.paid_amount || 0),
    rows: Array.isArray(data?.rows) ? data.rows : [],
  };
}

export function isQPayPaymentPaid(check: QPayPaymentCheckResult): boolean {
  if (check.count <= 0) return false;
  return check.rows.some(
    (r) => !r.payment_status || r.payment_status === "PAID"
  );
}
