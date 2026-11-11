import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FREE_PLAN, PAID_PLAN } from "@/lib/plans";
import { UI } from "@/lib/locale";

describe("MN pricing / upgrade comparison", () => {
  it("Free is 30 msgs/mo with no images", () => {
    assert.equal(FREE_PLAN.messagesPerMonth, 30);
    assert.equal(FREE_PLAN.imagesPerMonth, 0);
    assert.equal(FREE_PLAN.priceMnt, 0);
  });

  it("Pro is 72,000₮ (~$20) with 500 msgs + 10 images", () => {
    assert.equal(PAID_PLAN.messagesPerMonth, 500);
    assert.equal(PAID_PLAN.imagesPerMonth, 10);
    assert.equal(PAID_PLAN.priceMnt, 72_000);
    assert.equal(PAID_PLAN.priceUsd, 20);
  });

  it("landing copy keeps tagline and Free/Pro numbers (MN Cyrillic)", () => {
    assert.equal(UI.mn.tagline, "Монголоос дэлхийтэй холбогд");
    assert.match(UI.mn.pricingHero, /30/);
    assert.match(UI.mn.pricingHero, /72,000₮/);
    assert.match(UI.mn.pricingHero, /500/);
    assert.match(UI.mn.pricingHero, /10/);
    assert.doesNotMatch(UI.mn.tagline, /\u2014/);
    assert.doesNotMatch(UI.mn.pricingHero, /\u2014/);
    assert.doesNotMatch(UI.mn.pricingHero, /ChatGPT/);
    assert.doesNotMatch(UI.mn.valueProp, /Монголын анхны ChatGPT/);
  });
});
