import { checkQPayPayment, isQPayPaymentPaid } from "@/lib/qpay/client";
import { resolveQPayConfig } from "@/lib/qpay/config";
import { fulfillPaidInvoice } from "@/lib/qpay/fulfill";
import { findInvoiceByQpayId } from "@/lib/usage/db";

/**
 * QPay payment callback.
 * Never trust the body alone: always verify with POST /v2/payment/check.
 * Official: https://developer.qpay.mn/mn/docs/merchant?version=2.0.0
 */
export async function POST(request: Request) {
  let invoiceId: string | undefined;
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { invoice_id?: string };
      invoiceId = body.invoice_id?.trim();
    } else {
      const text = await request.text();
      try {
        const body = JSON.parse(text) as { invoice_id?: string };
        invoiceId = body.invoice_id?.trim();
      } catch {
        const params = new URLSearchParams(text);
        invoiceId =
          params.get("invoice_id")?.trim() ||
          new URL(request.url).searchParams.get("invoice_id")?.trim() ||
          undefined;
      }
    }
  } catch {
    invoiceId = new URL(request.url).searchParams.get("invoice_id")?.trim() || undefined;
  }

  if (!invoiceId) {
    return Response.json(
      { ok: false, error: "invoice_id дутуу байна." },
      { status: 400 }
    );
  }

  const local = await findInvoiceByQpayId(invoiceId);
  if (!local) {
    // Acknowledge unknown ids with 200 so QPay does not retry forever during misconfig.
    return Response.json({ ok: true, ignored: true });
  }

  if (local.status === "paid") {
    return Response.json({ ok: true, alreadyPaid: true });
  }

  const config = resolveQPayConfig(request);

  if (local.mock || config.mock) {
    // Mock invoices are completed via /api/billing/qpay/mock-complete, not spoofed callbacks.
    return Response.json({ ok: true, mock: true, pending: true });
  }

  try {
    const check = await checkQPayPayment(invoiceId, config);
    if (!isQPayPaymentPaid(check)) {
      return Response.json({ ok: true, paid: false });
    }
    const fulfilled = await fulfillPaidInvoice({ qpayInvoiceId: invoiceId });
    return Response.json({
      ok: true,
      paid: true,
      alreadyPaid: fulfilled?.alreadyPaid || false,
      paidUntil: fulfilled?.user?.paidUntil || null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "check failed";
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}

/** Some QPay setups ping callback with GET + query. */
export async function GET(request: Request) {
  return POST(request);
}
