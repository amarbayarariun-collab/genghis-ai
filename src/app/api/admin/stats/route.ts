import {
  getTokenUsageTotals,
  getUsageStats,
  isDatabaseConfigured,
} from "@/lib/usage/db";
import {
  adminSecret,
  googleOAuthConfigured,
  isAdminRequest,
  isAuthSecretConfigured,
} from "@/lib/usage/session";
import { FREE_PLAN, PAID_PLAN, tokenPriceUsdPerMillion } from "@/lib/plans";
import { isQPayConfigured } from "@/lib/qpay/config";

export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [stats, tokens] = await Promise.all([
    getUsageStats(),
    getTokenUsageTotals(),
  ]);

  return Response.json({
    ok: true,
    stats,
    tokens,
    plans: {
      free: {
        model: FREE_PLAN.chatModel,
        messagesPerMonth: FREE_PLAN.messagesPerMonth,
        imagesPerMonth: FREE_PLAN.imagesPerMonth,
      },
      paid: {
        model: PAID_PLAN.chatModel,
        messagesPerMonth: PAID_PLAN.messagesPerMonth,
        imagesPerMonth: PAID_PLAN.imagesPerMonth,
        priceUsd: PAID_PLAN.priceUsd,
        priceMnt: PAID_PLAN.priceMnt,
        reasoningEffort: PAID_PLAN.reasoningEffort,
      },
    },
    costEstimateRates: tokenPriceUsdPerMillion(),
    setup: {
      database: isDatabaseConfigured(),
      authSecret: isAuthSecretConfigured(),
      adminSecret: Boolean(adminSecret()),
      googleOAuth: googleOAuthConfigured(),
      qpay: isQPayConfigured(),
    },
  });
}
