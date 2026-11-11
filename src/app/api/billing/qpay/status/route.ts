import { checkQPayPayment, isQPayPaymentPaid } from "@/lib/qpay/client";
import { resolveQPayConfig } from "@/lib/qpay/config";
import { fulfillPaidInvoice } from "@/lib/qpay/fulfill";
import { findInvoiceById, findUserById, getPlanUsage } from "@/lib/usage/db";
import { readSession } from "@/lib/usage/session";

export async function GET(request: Request) {
  const session = await readSession();
  if (!session?.sub) {
    return Response.json({ error: "Нэвтрээгүй байна." }, { status: 401 });
  }

  const invoiceId = new URL(request.url).searchParams.get("invoiceId")?.trim();
  if (!invoiceId) {
    return Response.json(
      { error: "Нэхэмжлэхийн дугаар (invoiceId) шаардлагатай." },
      { status: 400 }
    );
  }

  const invoice = await findInvoiceById(invoiceId);
  if (!invoice || invoice.userId !== session.sub) {
    return Response.json({ error: "Нэхэмжлэх олдсонгүй." }, { status: 404 });
  }

  const config = resolveQPayConfig(request);

  if (invoice.status !== "paid" && !invoice.mock && config.configured && invoice.qpayInvoiceId) {
    try {
      const check = await checkQPayPayment(invoice.qpayInvoiceId, config);
      if (isQPayPaymentPaid(check)) {
        await fulfillPaidInvoice({ invoiceId: invoice.id });
      }
    } catch {
      // status poll should still return local state
    }
  }

  const fresh = (await findInvoiceById(invoiceId)) || invoice;
  const user = await findUserById(session.sub);
  const usage = await getPlanUsage(session.sub);

  return Response.json({
    ok: true,
    invoice: {
      id: fresh.id,
      status: fresh.status,
      amountMnt: fresh.amountMnt,
      mock: fresh.mock,
      paidAt: fresh.paidAt,
    },
    plan: {
      tier: usage.tier,
      paidUntil: user?.paidUntil || null,
    },
  });
}
