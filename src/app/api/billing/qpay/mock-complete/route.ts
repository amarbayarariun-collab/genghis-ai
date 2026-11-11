import { resolveQPayConfig } from "@/lib/qpay/config";
import { fulfillPaidInvoice } from "@/lib/qpay/fulfill";
import { findInvoiceById } from "@/lib/usage/db";
import { readSession } from "@/lib/usage/session";

/**
 * Dev/demo only: complete a mock invoice when QPay credentials are not set.
 * Never charges money. Refuses when live QPay env is configured.
 */
export async function POST(request: Request) {
  const config = resolveQPayConfig(request);
  if (config.configured) {
    return Response.json(
      {
        error:
          "Live QPay credentials are set. Mock complete is disabled.",
        code: "LIVE_QPAY",
      },
      { status: 403 }
    );
  }

  const session = await readSession();
  if (!session?.sub) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { invoiceId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Буруу JSON" }, { status: 400 });
  }

  const invoiceId = body.invoiceId?.trim();
  if (!invoiceId) {
    return Response.json({ error: "invoiceId required" }, { status: 400 });
  }

  const invoice = await findInvoiceById(invoiceId);
  if (!invoice || invoice.userId !== session.sub) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!invoice.mock) {
    return Response.json(
      { error: "Only mock invoices can use mock-complete." },
      { status: 400 }
    );
  }

  const fulfilled = await fulfillPaidInvoice({ invoiceId });
  return Response.json({
    ok: true,
    mock: true,
    alreadyPaid: fulfilled?.alreadyPaid || false,
    paidUntil: fulfilled?.user?.paidUntil || null,
    notice: "Mock payment only. No real QPay charge.",
  });
}
