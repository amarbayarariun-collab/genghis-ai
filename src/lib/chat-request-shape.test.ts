import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  shapeChatCompletionRequest,
  stablePromptCacheKey,
  trimChatHistory,
} from "@/lib/chat-request-shape";

afterEach(() => {
  delete process.env.CHAT_HISTORY_LIMIT;
  delete process.env.CHAT_MAX_TOKENS;
});

describe("trimChatHistory", () => {
  it("keeps the last N messages", () => {
    const msgs = Array.from({ length: 20 }, (_, i) => ({
      role: "user" as const,
      content: `m${i}`,
    }));
    const trimmed = trimChatHistory(msgs, 5);
    assert.equal(trimmed.length, 5);
    assert.equal(trimmed[0].content, "m15");
    assert.equal(trimmed[4].content, "m19");
  });

  it("returns all when under limit", () => {
    const msgs = [{ role: "user" as const, content: "hi" }];
    assert.deepEqual(trimChatHistory(msgs, 16), msgs);
  });
});

describe("stablePromptCacheKey", () => {
  it("prefers userId:conversationId", () => {
    assert.equal(
      stablePromptCacheKey({ userId: "u1", conversationId: "c1" }),
      "u1:c1"
    );
  });

  it("falls back to conversation or user alone", () => {
    assert.equal(
      stablePromptCacheKey({ conversationId: "conv-only" }),
      "conv-only"
    );
    assert.equal(stablePromptCacheKey({ userId: "user-only" }), "user-only");
    assert.equal(stablePromptCacheKey({}), undefined);
  });
});

describe("shapeChatCompletionRequest", () => {
  it("prepends system, trims history, sets max_tokens + low reasoning", () => {
    process.env.CHAT_HISTORY_LIMIT = "3";
    process.env.CHAT_MAX_TOKENS = "1200";
    const msgs = [
      { role: "user" as const, content: "a" },
      { role: "assistant" as const, content: "b" },
      { role: "user" as const, content: "c" },
      { role: "assistant" as const, content: "d" },
      { role: "user" as const, content: "e" },
    ];
    const shaped = shapeChatCompletionRequest({
      model: "grok-4.7",
      system: "SYS",
      messages: msgs,
      isXai: true,
      conversationId: "chat_1",
      userId: "usr_1",
      reasoningEffort: "low",
    });

    const bodyMessages = shaped.body.messages as Array<{
      role: string;
      content: string;
    }>;
    assert.equal(bodyMessages[0].role, "system");
    assert.equal(bodyMessages[0].content, "SYS");
    assert.equal(bodyMessages.length, 4); // system + last 3
    assert.equal(bodyMessages[1].content, "c");
    assert.equal(shaped.body.max_tokens, 1200);
    assert.equal(shaped.body.reasoning_effort, "low");
    assert.equal(shaped.body.prompt_cache_key, "usr_1:chat_1");
    assert.equal(shaped.headers["x-grok-conv-id"], "usr_1:chat_1");
    assert.equal(shaped.cacheKey, "usr_1:chat_1");
  });

  it("omits xAI cache fields for non-xAI providers", () => {
    const shaped = shapeChatCompletionRequest({
      model: "gpt-4o",
      system: "SYS",
      messages: [{ role: "user", content: "hi" }],
      isXai: false,
      conversationId: "chat_1",
      userId: "usr_1",
      reasoningEffort: null,
    });
    assert.equal(shaped.body.prompt_cache_key, undefined);
    assert.equal(shaped.headers["x-grok-conv-id"], undefined);
    assert.equal(shaped.body.reasoning_effort, undefined);
  });
});
