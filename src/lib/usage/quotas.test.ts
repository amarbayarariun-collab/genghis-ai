import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  monthResetsAtFromPeriod,
  monthResetsAtUtc,
} from "@/lib/usage/period";
import {
  buildImageLimitCopy,
  buildMessageLimitCopy,
  imageLimitBlock,
  messageLimitBlock,
} from "@/lib/usage/quota-messages";
import type { PlanUsageSnapshot } from "@/lib/usage/types";

function snap(
  partial: Partial<PlanUsageSnapshot> & Pick<PlanUsageSnapshot, "tier">
): PlanUsageSnapshot {
  const period = partial.period || "2026-11";
  return {
    tier: partial.tier,
    messagesUsed: partial.messagesUsed ?? 0,
    messagesLimit: partial.messagesLimit ?? (partial.tier === "paid" ? 500 : 30),
    imagesUsed: partial.imagesUsed ?? 0,
    imagesLimit: partial.imagesLimit ?? (partial.tier === "paid" ? 10 : 0),
    model: partial.model || (partial.tier === "paid" ? "grok-4.7" : "grok-4.3"),
    paidUntil: partial.paidUntil ?? null,
    period,
    resetsAt: partial.resetsAt || monthResetsAtFromPeriod(period),
  };
}

describe("period reset helpers", () => {
  it("computes next UTC month start from period key", () => {
    assert.equal(monthResetsAtFromPeriod("2026-11"), "2026-12-01");
    assert.equal(monthResetsAtFromPeriod("2026-12"), "2027-01-01");
  });

  it("monthResetsAtUtc matches from-period for now", () => {
    const now = new Date("2026-11-11T05:00:00.000Z");
    assert.equal(monthResetsAtUtc(now), "2026-12-01");
  });
});

describe("quota limit copy", () => {
  it("Free message limit promotes Pro (MN Cyrillic, no em dash)", () => {
    const usage = snap({ tier: "free", messagesUsed: 30 });
    const copy = buildMessageLimitCopy(usage);
    assert.match(copy.error, /Үнэгүй багц/);
    assert.match(copy.error, /Pro/);
    assert.doesNotMatch(copy.error, /\u2014/);
    const block = messageLimitBlock(usage);
    assert.equal(block.upgradePath, "/pricing");
    assert.equal(block.code, "MESSAGE_LIMIT");
  });

  it("Pro message limit includes reset date and skips upgradePath", () => {
    const usage = snap({
      tier: "paid",
      messagesUsed: 500,
      period: "2026-11",
      resetsAt: "2026-12-01",
    });
    const copy = buildMessageLimitCopy(usage);
    assert.match(copy.error, /Хязгаарт хүрлээ/);
    assert.match(copy.error, /2026-12-01/);
    assert.match(copy.error, /шинэчлэгдэнэ/);
    assert.doesNotMatch(copy.error, /\u2014/);
    const block = messageLimitBlock(usage);
    assert.equal(block.upgradePath, undefined);
  });

  it("Free images are not allowed", () => {
    const usage = snap({ tier: "free" });
    const copy = buildImageLimitCopy(usage);
    assert.equal(copy.code, "IMAGE_NOT_ALLOWED");
    assert.match(copy.error, /зураг/);
    const block = imageLimitBlock(usage);
    assert.equal(block.upgradePath, "/pricing");
  });

  it("Pro image cap includes reset date", () => {
    const usage = snap({
      tier: "paid",
      imagesUsed: 10,
      imagesLimit: 10,
      resetsAt: "2026-12-01",
    });
    const copy = buildImageLimitCopy(usage);
    assert.equal(copy.code, "IMAGE_LIMIT");
    assert.match(copy.error, /2026-12-01/);
    const block = imageLimitBlock(usage);
    assert.equal(block.upgradePath, undefined);
  });
});
