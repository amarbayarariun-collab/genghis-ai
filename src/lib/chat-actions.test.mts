import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  lastAssistantMessageIndex,
  lastUserMessageIndex,
  messageCopyText,
  prepareEditResend,
  prepareRegenerate,
  renameChatTitle,
  renameSession,
} from "./chat-actions.ts";
import type { ChatMessage, ChatSession } from "./types.ts";

function msg(
  role: ChatMessage["role"],
  content: string,
  id = `${role}_${content}`
): ChatMessage {
  return { id, role, content };
}

describe("chat-actions indices", () => {
  it("finds last user and assistant", () => {
    const messages = [
      msg("user", "a"),
      msg("assistant", "b"),
      msg("user", "c"),
      msg("assistant", "d"),
    ];
    assert.equal(lastUserMessageIndex(messages), 2);
    assert.equal(lastAssistantMessageIndex(messages), 3);
  });
});

describe("prepareRegenerate", () => {
  it("keeps through last user and drops trailing assistant", () => {
    const messages = [
      msg("user", "сайн уу"),
      msg("assistant", "сайн"),
      msg("user", "дахин"),
      msg("assistant", "хуучин хариу"),
    ];
    const prep = prepareRegenerate(messages);
    assert.ok(prep);
    assert.equal(prep.kept.length, 3);
    assert.equal(prep.kept[2].content, "дахин");
    assert.equal(prep.user.content, "дахин");
  });

  it("returns null without an assistant reply", () => {
    assert.equal(prepareRegenerate([msg("user", "only")]), null);
  });
});

describe("prepareEditResend", () => {
  it("rewrites last user and drops following assistant", () => {
    const messages = [
      msg("user", "хуучин"),
      msg("assistant", "хариу"),
    ];
    const prep = prepareEditResend(messages, "  шинэ асуулт  ");
    assert.ok(prep);
    assert.equal(prep.kept.length, 1);
    assert.equal(prep.user.content, "шинэ асуулт");
    assert.equal(prep.kept[0].id, messages[0].id);
  });

  it("rejects empty edit without attachments", () => {
    assert.equal(prepareEditResend([msg("user", "x")], "   "), null);
  });
});

describe("rename + copy", () => {
  it("sanitizes titles", () => {
    assert.equal(renameChatTitle("  Сайн уу  ", "Шинэ чат"), "Сайн уу");
    assert.equal(renameChatTitle("   ", "Шинэ чат"), "Шинэ чат");
    assert.equal(renameChatTitle("a".repeat(80), "x").endsWith("…"), true);
  });

  it("renames a session by id", () => {
    const sessions: ChatSession[] = [
      { id: "1", title: "A", messages: [], updatedAt: 1 },
      { id: "2", title: "B", messages: [], updatedAt: 2 },
    ];
    const next = renameSession(sessions, "2", "Шинэ нэр", "Шинэ чат");
    assert.equal(next[1].title, "Шинэ нэр");
    assert.equal(next[0].title, "A");
  });

  it("builds clipboard text from content", () => {
    assert.equal(
      messageCopyText({
        id: "1",
        role: "assistant",
        content: "Сайн байна уу!",
      }),
      "Сайн байна уу!"
    );
  });
});
