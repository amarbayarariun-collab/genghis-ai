/**
 * Pure chat request shaping for xAI cost controls.
 * Kept free of Next/route deps so unit tests can import it.
 */

import { chatHistoryLimit, chatMaxTokens } from "@/lib/plans";

export type ChatRoleMessage = {
  role: "user" | "assistant" | "system";
  content: unknown;
};

/**
 * Keep the system prompt separate (caller prepends it).
 * Truncate to the last N user/assistant turns (env CHAT_HISTORY_LIMIT).
 */
export function trimChatHistory<T>(
  messages: T[],
  limit: number = chatHistoryLimit()
): T[] {
  const n = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 16;
  if (messages.length <= n) return messages;
  return messages.slice(-n);
}

/**
 * Stable xAI prompt-cache / sticky-routing key for a user+conversation.
 * Prefer userId:conversationId when both exist (cache reuse across devices).
 */
export function stablePromptCacheKey(options: {
  conversationId?: string | null;
  userId?: string | null;
}): string | undefined {
  const conv = options.conversationId?.trim().slice(0, 64) || "";
  const user = options.userId?.trim().slice(0, 64) || "";
  if (user && conv) return `${user}:${conv}`.slice(0, 128);
  if (conv) return conv.slice(0, 128);
  if (user) return user.slice(0, 128);
  return undefined;
}

export type ChatShapeOptions = {
  model: string;
  system: string;
  messages: ChatRoleMessage[];
  isXai: boolean;
  conversationId?: string | null;
  userId?: string | null;
  reasoningEffort?: "low" | "medium" | "high" | null;
  maxTokens?: number;
  stream?: boolean;
};

export type ShapedChatRequest = {
  headers: Record<string, string>;
  body: Record<string, unknown>;
  cacheKey?: string;
};

/** Build headers + body fields for OpenAI-compatible chat completions. */
export function shapeChatCompletionRequest(
  options: ChatShapeOptions
): ShapedChatRequest {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const cacheKey = options.isXai
    ? stablePromptCacheKey({
        conversationId: options.conversationId,
        userId: options.userId,
      })
    : undefined;

  if (cacheKey) {
    headers["x-grok-conv-id"] = cacheKey;
  }

  const history = trimChatHistory(options.messages);
  const body: Record<string, unknown> = {
    model: options.model,
    stream: options.stream !== false,
    stream_options: { include_usage: true },
    max_tokens: options.maxTokens ?? chatMaxTokens(),
    messages: [{ role: "system", content: options.system }, ...history],
  };

  if (options.reasoningEffort) {
    body.reasoning_effort = options.reasoningEffort;
  }
  if (cacheKey) {
    body.prompt_cache_key = cacheKey;
  }

  return { headers, body, cacheKey };
}
