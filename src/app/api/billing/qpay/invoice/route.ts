import {
  createQPayInvoice,
} from "@/lib/qpay/client";
import { resolveQPayConfig } from "@/lib/qpay/config";
import { createInvoiceRecord, findUserById } from "@/lib/usage/db";
import { newId } from "@/lib/usage/ids";
import { readSession } from "@/lib/usage/session";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session?.sub) {
    return Response.json(
      { error: "Төлбөр төлөхийн тулд нэвтэрнэ үү.", code: "AUTH_REQUIRED" },
      { status: 401 }
    );
  }

  const user = await findUserById(session.sub);
  if (!user || user.provider === "guest") {
    return Response.json(
      {
        error: "Pro төлбөрт имэйлээр нэвтэрсэн хэрэглэгч хэрэгтэй.",
        code: "AUTH_REQUIRED",
      },
      { status: 401 }
    );
  }

  const config = resolveQPayConfig(request);
  const senderInvoiceNo = `genghis-${Date.now()}-${newId("pay").slice(-8)}`;
  const description = "Genghis AI Pro · 30 хоног";

  if (config.mock) {
    const record = await createInvoiceRecord({
      userId: user.id,
      senderInvoiceNo,
      qpayInvoiceId: `mock_${senderInvoiceNo}`,
      amountMnt: config.amountMnt,
      mock: true,
    });

    return Response.json({
      ok: true,
      mock: true,
      mode: "mock",
      notice:
        "QPay env тохируулаагүй тул mock горим. Бодит төлбөр авагдахгүй. Domestic fee ~1% (гэрээгээр).",
      invoice: {
        id: record.id,
        senderInvoiceNo: record.senderInvoiceNo,
        qpayInvoiceId: record.qpayInvoiceId,
        amountMnt: record.amountMnt,
        status: record.status,
      },
      qrText: `MOCK-QPAY:${record.id}`,
      qrImage: null,
      shortUrl: null,
      urls: [],
      feeNote: "QPay domestic merchant fee typically ~1% (confirm in contract).",
    });
  }

  try {
    const created = await createQPayInvoice({
      senderInvoiceNo,
      amountMnt: config.amountMnt,
      description,
      callbackUrl: config.callbackUrl,
      receiverCode: user.email,
      config,
    });

    const record = await createInvoiceRecord({
      userId: user.id,
      senderInvoiceNo,
      qpayInvoiceId: created.invoice_id,
      amountMnt: config.amountMnt,
      mock: false,
    });

    return Response.json({
      ok: true,
      mock: false,
      mode: "live",
      invoice: {
        id: record.id,
        senderInvoiceNo: record.senderInvoiceNo,
        qpayInvoiceId: record.qpayInvoiceId,
        amountMnt: record.amountMnt,
        status: record.status,
      },
      qrText: created.qr_text || null,
      qrImage: created.qr_image || null,
      shortUrl: created.qPay_shortUrl || null,
      urls: created.urls || [],
      feeNote: "QPay domestic merchant fee typically ~1% (confirm in contract).",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "QPay алдаа";
    return Response.json({ error: message }, { status: 502 });
  }
}
