import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  FREE_PLAN,
  PAID_PLAN,
  chatHistoryLimit,
  chatMaxTokens,
  estimateCostUsd,
  planForTier,
  resolvePlanTier,
} from "@/lib/plans";

const ENV_KEYS = [
  "CHAT_HISTORY_LIMIT",
  "CHAT_MAX_TOKENS",
  "ATTACH_TEXT_LIMIT",
] as const;

const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> =
  {};

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (key in saved) {
      const v = saved[key];
      if (v === undefined) delete process.env[key];
      else process.env[key] = v;
      delete saved[key];
    }
  }
});

function setEnv(key: (typeof ENV_KEYS)[number], value: string | undefined) {
  if (!(key in saved)) saved[key] = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

describe("plan tiers", () => {
  it("defines Free 30 msgs / no images / grok-4.3", () => {
    assert.equal(FREE_PLAN.messagesPerMonth, 30);
    assert.equal(FREE_PLAN.imagesPerMonth, 0);
    assert.equal(FREE_PLAN.chatModel, "grok-4.3");
    assert.equal(FREE_PLAN.reasoningEffort, null);
  });

  it("defines Pro 500 msgs + 10 images / grok-4.7 / low reasoning", () => {
    assert.equal(PAID_PLAN.messagesPerMonth, 500);
    assert.equal(PAID_PLAN.imagesPerMonth, 10);
    assert.equal(PAID_PLAN.chatModel, "grok-4.7");
    assert.equal(PAID_PLAN.reasoningEffort, "low");
    assert.equal(PAID_PLAN.priceMnt, 72_000);
    assert.equal(PAID_PLAN.priceUsd, 20);
  });

  it("resolves paid_until wall clock", () => {
    assert.equal(resolvePlanTier(null), "free");
    assert.equal(resolvePlanTier("not-a-date"), "free");
    assert.equal(planForTier("free").tier, "free");
    assert.equal(planForTier("paid").tier, "paid");
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    assert.equal(resolvePlanTier(future), "paid");
    assert.equal(resolvePlanTier(past), "free");
  });
});

describe("cost-control env knobs", () => {
  it("defaults history 16 and max_tokens 1500", () => {
    setEnv("CHAT_HISTORY_LIMIT", undefined);
    setEnv("CHAT_MAX_TOKENS", undefined);
    assert.equal(chatHistoryLimit(), 16);
    assert.equal(chatMaxTokens(), 1500);
  });

  it("reads positive env overrides", () => {
    setEnv("CHAT_HISTORY_LIMIT", "8");
    setEnv("CHAT_MAX_TOKENS", "900");
    assert.equal(chatHistoryLimit(), 8);
    assert.equal(chatMaxTokens(), 900);
  });

  it("ignores invalid overrides", () => {
    setEnv("CHAT_HISTORY_LIMIT", "0");
    setEnv("CHAT_MAX_TOKENS", "-3");
    assert.equal(chatHistoryLimit(), 16);
    assert.equal(chatMaxTokens(), 1500);
  });
});

describe("estimateCostUsd", () => {
  it("charges uncached prompt + completion", () => {
    const cost = estimateCostUsd({
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
      reasoningTokens: 0,
      cachedTokens: 0,
    });
    // defaults: input 3 + output 15
    assert.equal(cost, 18);
  });

  it("uses cached input rate when present", () => {
    const cost = estimateCostUsd({
      promptTokens: 1_000_000,
      completionTokens: 0,
      reasoningTokens: 0,
      cachedTokens: 1_000_000,
    });
    assert.equal(cost, 0.75);
  });
});
