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
          "Жинхэнэ QPay тохируулсан тул mock төлбөрийг ашиглах боломжгүй.",
        code: "LIVE_QPAY",
      },
      { status: 403 }
    );
  }

  const session = await readSession();
  if (!session?.sub) {
    return Response.json({ error: "Нэвтрээгүй байна." }, { status: 401 });
  }

  let body: { invoiceId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Буруу JSON илгээлээ." }, { status: 400 });
  }

  const invoiceId = body.invoiceId?.trim();
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
  if (!invoice.mock) {
    return Response.json(
      { error: "Зөвхөн mock нэхэмжлэхийг mock-complete-ээр дуусгана." },
      { status: 400 }
    );
  }

  const fulfilled = await fulfillPaidInvoice({ invoiceId });
  return Response.json({
    ok: true,
    mock: true,
    alreadyPaid: fulfilled?.alreadyPaid || false,
    paidUntil: fulfilled?.user?.paidUntil || null,
    notice: "Mock төлбөр амжилттай. Жинхэнэ QPay төлбөр аваагүй.",
  });
}
