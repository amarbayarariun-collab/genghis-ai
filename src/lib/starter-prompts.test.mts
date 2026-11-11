import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  STARTER_PROMPTS,
  STARTER_PROMPT_SUBSET_SIZE,
  pickStarterPrompts,
  shuffleSubset,
} from "./starter-prompts.ts";

describe("STARTER_PROMPTS data", () => {
  it("has 6–8 editable MN Cyrillic prompts with ids", () => {
    assert.ok(STARTER_PROMPTS.length >= 6);
    assert.ok(STARTER_PROMPTS.length <= 8);
    const ids = new Set(STARTER_PROMPTS.map((p) => p.id));
    assert.equal(ids.size, STARTER_PROMPTS.length);
    for (const p of STARTER_PROMPTS) {
      assert.ok(p.title.trim().length > 0);
      assert.ok(p.prompt.trim().length > 0);
      // Cyrillic letter present in prompt body
      assert.match(p.prompt, /[\u0400-\u04FF]/);
    }
  });

  it("covers the required topic ids", () => {
    const ids = STARTER_PROMPTS.map((p) => p.id);
    for (const need of [
      "eesh",
      "translate",
      "business",
      "cv",
      "letter",
      "history",
      "travel",
      "homework",
    ]) {
      assert.ok(ids.includes(need), `missing ${need}`);
    }
  });
});

describe("shuffleSubset / pickStarterPrompts", () => {
  it("returns a deterministic subset with a fixed RNG", () => {
    let i = 0;
    const seq = [0.9, 0.1, 0.5, 0.2, 0.8, 0.3, 0.7, 0.4];
    const random = () => seq[i++ % seq.length]!;
    const a = pickStarterPrompts(STARTER_PROMPT_SUBSET_SIZE, random);
    assert.equal(a.length, STARTER_PROMPT_SUBSET_SIZE);
    const ids = a.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("never exceeds the pool or requested count", () => {
    assert.deepEqual(shuffleSubset([1, 2, 3], 0), []);
    assert.equal(shuffleSubset([1, 2, 3], 10).length, 3);
    assert.equal(shuffleSubset([], 4).length, 0);
  });
});
