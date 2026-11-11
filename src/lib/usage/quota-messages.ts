import { planForTier } from "@/lib/plans";
import { monthResetsAtFromPeriod } from "@/lib/usage/period";
import type { PlanUsageSnapshot } from "@/lib/usage/types";

export type QuotaBlock = {
  code: "MESSAGE_LIMIT" | "IMAGE_LIMIT" | "IMAGE_NOT_ALLOWED";
  status: 402;
  error: string;
  errorEn: string;
  usage: PlanUsageSnapshot;
  /** Free users get upgrade CTA; Pro users only see reset copy. */
  upgradePath?: "/pricing";
};

function resetsOn(usage: PlanUsageSnapshot): string {
  return usage.resetsAt || monthResetsAtFromPeriod(usage.period);
}

/** Pure MN/EN copy for plan limit responses (unit-tested). */
export function buildMessageLimitCopy(usage: PlanUsageSnapshot): {
  error: string;
  errorEn: string;
} {
  const plan = planForTier(usage.tier);
  const reset = resetsOn(usage);
  if (usage.tier === "paid") {
    return {
      error: `Хязгаарт хүрлээ (${usage.messagesUsed}/${plan.messagesPerMonth} мессеж). Хязгаар ${reset} өдөр шинэчлэгдэнэ.`,
      errorEn: `Limit reached (${usage.messagesUsed}/${plan.messagesPerMonth} messages). Resets on ${reset}.`,
    };
  }
  return {
    error: `Үнэгүй багцын сарын хязгаарт хүрлээ (${usage.messagesUsed}/${plan.messagesPerMonth} мессеж). Үргэлжлүүлэхийн тулд Pro руу шилжээрэй.`,
    errorEn: `Free monthly message limit reached (${usage.messagesUsed}/${plan.messagesPerMonth}). Upgrade to Pro to continue.`,
  };
}

export function buildImageLimitCopy(usage: PlanUsageSnapshot): {
  code: "IMAGE_LIMIT" | "IMAGE_NOT_ALLOWED";
  error: string;
  errorEn: string;
} {
  const plan = planForTier(usage.tier);
  if (plan.imagesPerMonth <= 0) {
    return {
      code: "IMAGE_NOT_ALLOWED",
      error:
        "Үнэгүй багцад зураг үүсгэх боломжгүй. Pro ($20/сар · ~72,000₮) дээр сард 10 зураг ашиглана.",
      errorEn:
        "Image generation is not included on Free. Upgrade to Pro ($20/mo) for 10 images/month.",
    };
  }
  const reset = resetsOn(usage);
  if (usage.tier === "paid") {
    return {
      code: "IMAGE_LIMIT",
      error: `Хязгаарт хүрлээ (${usage.imagesUsed}/${plan.imagesPerMonth} зураг). Хязгаар ${reset} өдөр шинэчлэгдэнэ.`,
      errorEn: `Limit reached (${usage.imagesUsed}/${plan.imagesPerMonth} images). Resets on ${reset}.`,
    };
  }
  return {
    code: "IMAGE_LIMIT",
    error: `Энэ сарын зургийн хязгаарт хүрлээ (${usage.imagesUsed}/${plan.imagesPerMonth}).`,
    errorEn: `Monthly image limit reached (${usage.imagesUsed}/${plan.imagesPerMonth}).`,
  };
}

export function messageLimitBlock(usage: PlanUsageSnapshot): QuotaBlock {
  const copy = buildMessageLimitCopy(usage);
  return {
    code: "MESSAGE_LIMIT",
    status: 402,
    error: copy.error,
    errorEn: copy.errorEn,
    usage,
    ...(usage.tier === "free" ? { upgradePath: "/pricing" as const } : {}),
  };
}

export function imageLimitBlock(usage: PlanUsageSnapshot): QuotaBlock {
  const copy = buildImageLimitCopy(usage);
  return {
    code: copy.code,
    status: 402,
    error: copy.error,
    errorEn: copy.errorEn,
    usage,
    ...(usage.tier === "free" || copy.code === "IMAGE_NOT_ALLOWED"
      ? { upgradePath: "/pricing" as const }
      : {}),
  };
}
