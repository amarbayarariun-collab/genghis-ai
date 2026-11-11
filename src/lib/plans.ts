/**
 * Launch plan tiers + cost-control knobs for Genghis AI.
 * Quotas are calendar-month UTC. Paid access is wall-clock (paid_until).
 */

export type PlanTier = "free" | "paid";

export type PlanDefinition = {
  tier: PlanTier;
  /** Chat model id sent to the OpenAI-compatible provider. */
  chatModel: string;
  /** Max chat messages per UTC calendar month. */
  messagesPerMonth: number;
  /** Max image generations per UTC calendar month. */
  imagesPerMonth: number;
  /** Display price (USD). */
  priceUsd: number;
  /** Display price (MNT, approximate). */
  priceMnt: number;
  /** Paid tier uses explicit low reasoning to control spend. */
  reasoningEffort: "low" | "medium" | "high" | null;
};

export const FREE_PLAN: PlanDefinition = {
  tier: "free",
  chatModel: "grok-4.3",
  messagesPerMonth: 30,
  imagesPerMonth: 0,
  priceUsd: 0,
  priceMnt: 0,
  reasoningEffort: "low",
};

export const PAID_PLAN: PlanDefinition = {
  tier: "paid",
  chatModel: "grok-4.7",
  messagesPerMonth: 500,
  imagesPerMonth: 10,
  priceUsd: 20,
  priceMnt: 72_000,
  reasoningEffort: "low",
};

export function planForTier(tier: PlanTier): PlanDefinition {
  return tier === "paid" ? PAID_PLAN : FREE_PLAN;
}

export function resolvePlanTier(paidUntil: string | Date | null | undefined): PlanTier {
  if (!paidUntil) return "free";
  const ends = paidUntil instanceof Date ? paidUntil : new Date(paidUntil);
  if (Number.isNaN(ends.getTime())) return "free";
  return ends.getTime() > Date.now() ? "paid" : "free";
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function floatEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Max prior+current chat messages sent to the model (system prompt kept separate). */
export function chatHistoryLimit(): number {
  return intEnv("CHAT_HISTORY_LIMIT", 16);
}

/** Completion budget per reply. */
export function chatMaxTokens(): number {
  return intEnv("CHAT_MAX_TOKENS", 1500);
}

/** Soft cap for attached document text (chars). */
export function attachTextLimit(): number {
  return intEnv("ATTACH_TEXT_LIMIT", 15_000);
}

/**
 * Rough admin cost estimates (USD per 1M tokens). Override via env; not billing.
 * Defaults are conservative placeholders for grok-class models.
 */
export function tokenPriceUsdPerMillion(): {
  input: number;
  output: number;
  cachedInput: number;
  reasoning: number;
} {
  return {
    input: floatEnv("XAI_USD_PER_MTOK_INPUT", 3),
    output: floatEnv("XAI_USD_PER_MTOK_OUTPUT", 15),
    cachedInput: floatEnv("XAI_USD_PER_MTOK_CACHED_INPUT", 0.75),
    reasoning: floatEnv("XAI_USD_PER_MTOK_REASONING", 15),
  };
}

export function estimateCostUsd(usage: {
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
}): number {
  const prices = tokenPriceUsdPerMillion();
  const uncachedPrompt = Math.max(0, usage.promptTokens - usage.cachedTokens);
  const promptCost =
    (uncachedPrompt / 1_000_000) * prices.input +
    (usage.cachedTokens / 1_000_000) * prices.cachedInput;
  // completion_tokens usually includes reasoning on xAI; prefer explicit reasoning split when present.
  const visibleCompletion = Math.max(
    0,
    usage.completionTokens - usage.reasoningTokens
  );
  const completionCost =
    (visibleCompletion / 1_000_000) * prices.output +
    (usage.reasoningTokens / 1_000_000) * prices.reasoning;
  return promptCost + completionCost;
}

export const PAID_DURATION_DAYS = 30;
