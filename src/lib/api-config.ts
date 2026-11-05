export function getApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY?.trim() || process.env.AP?.trim();
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

export function resolveApiConfig(apiKey: string): {
  baseUrl: string;
  model: string;
  imageModel: string;
  imageModelCandidates: string[];
  isXai: boolean;
} {
  const isXai = apiKey.startsWith("xai-");
  const baseUrl =
    process.env.OPENAI_BASE_URL?.replace(/\/$/, "") ||
    (isXai ? "https://api.x.ai/v1" : "https://api.openai.com/v1");
  // Strongest public xAI chat model (GPT-5.2-class target quality).
  const model =
    process.env.OPENAI_MODEL || (isXai ? "grok-4.7" : "gpt-4o");
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
