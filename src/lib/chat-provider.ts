/**
 * Chat model provider abstraction.
 *
 * Lets the backend swap third-party APIs (xAI / OpenAI) for a self-hosted
 * OpenAI-compatible server (vLLM, Ollama, TGI, etc.) without rewriting the UI.
 *
 * Priority:
 *   CHAT_* vars → legacy OPENAI_* / AP → auto-detect from key prefix
 *
 * Image generation stays on resolveImageApiConfig() in api-config.ts.
 */

export type ChatProviderId = "xai" | "openai" | "self";

export type ChatProviderConfig = {
  /** False when no chat backend is configured → mock streaming. */
  configured: boolean;
  provider: ChatProviderId;
  apiKey?: string;
  baseUrl: string;
  model: string;
  isXai: boolean;
  /** Value for X-Genghis-Mode response header (when live). */
  modeHeader: string;
};

function trimUrl(value: string | undefined): string | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  return v.replace(/\/$/, "");
}

function readProviderEnv(): string {
  return (process.env.CHAT_PROVIDER || "").trim().toLowerCase();
}

function legacyChatKey(): string | undefined {
  return process.env.OPENAI_API_KEY?.trim() || process.env.AP?.trim() || undefined;
}

function looksLikeXaiBase(baseUrl: string): boolean {
  return /api\.x\.ai/i.test(baseUrl);
}

/**
 * Resolve where /api/chat should send OpenAI-compatible chat completions.
 * Self-hosted: set CHAT_PROVIDER=self and CHAT_BASE_URL=https://host/v1
 * (CHAT_API_KEY optional for trusted local networks).
 */
export function resolveChatProvider(): ChatProviderConfig {
  const explicit = readProviderEnv();
  const chatKey = process.env.CHAT_API_KEY?.trim() || undefined;
  const apiKey = chatKey || legacyChatKey();
  const chatBase = trimUrl(process.env.CHAT_BASE_URL);
  const legacyBase = trimUrl(process.env.OPENAI_BASE_URL);
  const chatModel = process.env.CHAT_MODEL?.trim() || undefined;
  const legacyModel = process.env.OPENAI_MODEL?.trim() || undefined;

  let provider: ChatProviderId;
  if (explicit === "self" || explicit === "xai" || explicit === "openai") {
    provider = explicit;
  } else if (chatBase) {
    provider = looksLikeXaiBase(chatBase) ? "xai" : "self";
  } else if (apiKey?.startsWith("xai-")) {
    provider = "xai";
  } else if (apiKey) {
    provider = "openai";
  } else {
    return {
      configured: false,
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
      isXai: false,
      modeHeader: "mock",
    };
  }

  let baseUrl = chatBase || legacyBase;
  if (!baseUrl) {
    if (provider === "xai") baseUrl = "https://api.x.ai/v1";
    else if (provider === "openai") baseUrl = "https://api.openai.com/v1";
    else {
      // self without URL cannot call anything
      return {
        configured: false,
        provider: "self",
        apiKey,
        baseUrl: "",
        model: chatModel || legacyModel || "genghis-mn",
        isXai: false,
        modeHeader: "mock",
      };
    }
  }

  const isXai = provider === "xai" || looksLikeXaiBase(baseUrl);
  const model =
    chatModel ||
    legacyModel ||
    (isXai ? "grok-4.7" : provider === "self" ? "genghis-mn" : "gpt-4o");

  const configured =
    provider === "self" ? Boolean(baseUrl) : Boolean(apiKey && baseUrl);

  return {
    configured,
    provider: isXai ? "xai" : provider,
    apiKey,
    baseUrl,
    model,
    isXai,
    modeHeader: configured
      ? provider === "self"
        ? "self"
        : isXai
          ? "xai"
          : "openai"
      : "mock",
  };
}
