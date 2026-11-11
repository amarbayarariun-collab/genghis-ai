import type { ChatMessage, ChatSession } from "@/lib/types";

/** Index of the last user message, or -1. */
export function lastUserMessageIndex(messages: ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "user") return i;
  }
  return -1;
}

/** Index of the last assistant message, or -1. */
export function lastAssistantMessageIndex(messages: ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "assistant") return i;
  }
  return -1;
}

/**
 * Drop the trailing assistant reply so it can be regenerated.
 * Keeps the preceding user turn intact. Counts as a new /api/chat call
 * against plan message limits when streamed.
 */
export function prepareRegenerate(
  messages: ChatMessage[]
): { kept: ChatMessage[]; user: ChatMessage } | null {
  const aIdx = lastAssistantMessageIndex(messages);
  if (aIdx < 0) return null;
  let uIdx = -1;
  for (let i = aIdx - 1; i >= 0; i -= 1) {
    if (messages[i].role === "user") {
      uIdx = i;
      break;
    }
  }
  if (uIdx < 0) return null;
  return {
    kept: messages.slice(0, aIdx),
    user: messages[uIdx],
  };
}

/**
 * Replace the last user message content and drop everything after it
 * (including the prior assistant reply) for edit-and-resend.
 * Counts as a new /api/chat call against plan message limits when streamed.
 */
export function prepareEditResend(
  messages: ChatMessage[],
  newContent: string
): { kept: ChatMessage[]; user: ChatMessage } | null {
  const uIdx = lastUserMessageIndex(messages);
  if (uIdx < 0) return null;
  const previous = messages[uIdx];
  const content = newContent.replace(/\s+/g, " ").trim();
  if (!content && !(previous.attachments?.length)) return null;
  const user: ChatMessage = {
    ...previous,
    content:
      content ||
      previous.content ||
      "",
  };
  return {
    kept: [...messages.slice(0, uIdx), user],
    user,
  };
}

/** Sanitize a sidebar chat title for rename / localStorage. */
export function renameChatTitle(title: string, fallback: string): string {
  const clean = title.replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  return clean.length > 60 ? `${clean.slice(0, 60)}…` : clean;
}

export function renameSession(
  sessions: ChatSession[],
  id: string,
  title: string,
  fallback: string
): ChatSession[] {
  const nextTitle = renameChatTitle(title, fallback);
  return sessions.map((s) =>
    s.id === id ? { ...s, title: nextTitle, updatedAt: Date.now() } : s
  );
}

/** Plain text suitable for clipboard copy (message body only). */
export function messageCopyText(message: ChatMessage): string {
  const parts: string[] = [];
  if (message.content?.trim()) parts.push(message.content.trim());
  if (message.imageUrl) parts.push(message.imageUrl);
  if (message.attachments?.length) {
    for (const att of message.attachments) {
      parts.push(att.name);
    }
  }
  return parts.join("\n").trim();
}
