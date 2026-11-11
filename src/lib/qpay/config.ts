/**
 * QPay Merchant V2 config.
 * Official docs: https://developer.qpay.mn/mn/docs/merchant?version=2.0.0
 *
 * Domestic merchant fee is typically ~1% (confirm in your QPay contract).
 * Without credentials the app stays in mock/disabled mode (no live charges).
 */

export type QPayConfig = {
  configured: boolean;
  mock: boolean;
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  invoiceCode: string;
  callbackUrl: string;
  amountMnt: number;
};

import { PAID_PLAN } from "@/lib/plans";
import { publicAppUrl } from "@/lib/usage/session";

export function qpayAmountMnt(): number {
  const raw = process.env.QPAY_AMOUNT_MNT?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return PAID_PLAN.priceMnt;
}

export function isQPayConfigured(): boolean {
  return Boolean(
    process.env.QPAY_CLIENT_ID?.trim() &&
      process.env.QPAY_CLIENT_SECRET?.trim() &&
      process.env.QPAY_INVOICE_CODE?.trim()
  );
}

export function resolveQPayConfig(request?: Request): QPayConfig {
  const clientId = process.env.QPAY_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.QPAY_CLIENT_SECRET?.trim() || "";
  const invoiceCode = process.env.QPAY_INVOICE_CODE?.trim() || "";
  const configured = Boolean(clientId && clientSecret && invoiceCode);
  const baseUrl = (
    process.env.QPAY_BASE_URL?.trim() ||
    (process.env.QPAY_SANDBOX === "1"
      ? "https://merchant-sandbox.qpay.mn"
      : "https://merchant.qpay.mn")
  ).replace(/\/$/, "");

  const callbackFromEnv = process.env.QPAY_CALLBACK_URL?.trim();
  const callbackUrl =
    callbackFromEnv ||
    `${publicAppUrl(request)}/api/billing/qpay/callback`;

  return {
    configured,
    mock: !configured,
    baseUrl,
    clientId,
    clientSecret,
    invoiceCode,
    callbackUrl,
    amountMnt: qpayAmountMnt(),
  };
}
