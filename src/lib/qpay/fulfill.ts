import { PAID_DURATION_DAYS } from "@/lib/plans";
import {
  findInvoiceById,
  findInvoiceByQpayId,
  markInvoicePaid,
  markUserPaid,
} from "@/lib/usage/db";
import type { InvoiceRecord, UserRecord } from "@/lib/usage/types";

export type FulfillResult = {
  invoice: InvoiceRecord;
  user: UserRecord | null;
  alreadyPaid: boolean;
};

/** Mark invoice paid and extend the user's Pro window by 30 days. */
export async function fulfillPaidInvoice(input: {
  invoiceId?: string;
  qpayInvoiceId?: string;
}): Promise<FulfillResult | null> {
  const invoice = input.invoiceId
    ? await findInvoiceById(input.invoiceId)
    : input.qpayInvoiceId
      ? await findInvoiceByQpayId(input.qpayInvoiceId)
      : null;
  if (!invoice) return null;

  const alreadyPaid = invoice.status === "paid";
  const paidInvoice = alreadyPaid
    ? invoice
    : (await markInvoicePaid(invoice.id)) || invoice;

  const user = await markUserPaid(paidInvoice.userId, PAID_DURATION_DAYS);
  return { invoice: paidInvoice, user, alreadyPaid };
}
