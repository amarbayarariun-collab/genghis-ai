/**
 * Legacy shared chat key (OPENAI_API_KEY / AP).
 * Prefer resolveChatProvider() from @/lib/chat-provider for /api/chat.
 */
export function getApiKey(): string | undefined {
  return (
    process.env.CHAT_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.AP?.trim()
  );
}

export function getImageApiKey(): string | undefined {
  return process.env.OPENAI_IMAGE_API_KEY?.trim();
}

const OPENAI_IMAGE_BASE_URL = "https://api.openai.com/v1";

function openaiImageModelCandidates(): string[] {
  return Array.from(
    new Set(
      [process.env.OPENAI_IMAGE_MODEL, "dall-e-3", "gpt-image-1"].filter(
        Boolean
      ) as string[]
    )
  );
}

/**
 * Resolve OpenAI-compatible endpoints for callers that still pass a raw key
 * (mainly image fallback). Chat should use resolveChatProvider() instead so
 * CHAT_PROVIDER / CHAT_BASE_URL / CHAT_MODEL work for self-hosted cutover.
 */
export function resolveApiConfig(apiKey: string): {
  baseUrl: string;
  model: string;
  imageModel: string;
  imageModelCandidates: string[];
  isXai: boolean;
} {
  const chatBase =
    process.env.CHAT_BASE_URL?.replace(/\/$/, "").trim() ||
    process.env.OPENAI_BASE_URL?.replace(/\/$/, "").trim();
  const isXai =
    apiKey.startsWith("xai-") ||
    (process.env.CHAT_PROVIDER || "").trim().toLowerCase() === "xai" ||
    /api\.x\.ai/i.test(chatBase || "");
  const baseUrl =
    chatBase || (isXai ? "https://api.x.ai/v1" : "https://api.openai.com/v1");
  // Strongest public xAI chat model (GPT-5.2-class target quality).
  const model =
    process.env.CHAT_MODEL ||
    process.env.OPENAI_MODEL ||
    (isXai ? "grok-4.7" : "gpt-4o");
  const imageModel =
    process.env.OPENAI_IMAGE_MODEL ||
    (isXai ? "grok-2-image-1212" : "dall-e-3");
  const imageModelCandidates = isXai
    ? Array.from(
        new Set(
          [
            process.env.OPENAI_IMAGE_MODEL,
            "grok-2-image-1212",
            "grok-2-image",
          ].filter(Boolean) as string[]
        )
      )
    : openaiImageModelCandidates();
  return { baseUrl, model, imageModel, imageModelCandidates, isXai };
}

/** Image generation: prefer dedicated OpenAI key; else shared chat key. */
export function resolveImageApiConfig(): {
  apiKey: string;
  baseUrl: string;
  imageModelCandidates: string[];
  isXai: boolean;
  usingDedicatedImageKey: boolean;
} | null {
  const imageKey = getImageApiKey();
  if (imageKey) {
    return {
      apiKey: imageKey,
      baseUrl: OPENAI_IMAGE_BASE_URL,
      imageModelCandidates: openaiImageModelCandidates(),
      isXai: false,
      usingDedicatedImageKey: true,
    };
  }

  const apiKey = getApiKey();
  if (!apiKey) return null;

  const { baseUrl, imageModelCandidates, isXai } = resolveApiConfig(apiKey);
  return {
    apiKey,
    baseUrl,
    imageModelCandidates,
    isXai,
    usingDedicatedImageKey: false,
  };
}

export function sanitizeApiError(detail: string): string {
  return detail
    .replace(/xai-[A-Za-z0-9_-]+/g, "xai-<redacted>")
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-<redacted>")
    .replace(/Bearer\s+\S+/gi, "Bearer <redacted>")
    .slice(0, 240);
}
