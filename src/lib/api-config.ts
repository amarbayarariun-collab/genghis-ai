export function getApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY?.trim() || process.env.AP?.trim();
}

export function resolveApiConfig(apiKey: string): {
  baseUrl: string;
  model: string;
  imageModel: string;
  isXai: boolean;
} {
  const isXai = apiKey.startsWith("xai-");
  const baseUrl =
    process.env.OPENAI_BASE_URL?.replace(/\/$/, "") ||
    (isXai ? "https://api.x.ai/v1" : "https://api.openai.com/v1");
  const model =
    process.env.OPENAI_MODEL || (isXai ? "grok-4.3" : "gpt-4o-mini");
  const imageModel =
    process.env.OPENAI_IMAGE_MODEL ||
    (isXai ? "grok-2-image" : "dall-e-3");
  return { baseUrl, model, imageModel, isXai };
}

export function sanitizeApiError(detail: string): string {
  return detail
    .replace(/xai-[A-Za-z0-9_-]+/g, "xai-<redacted>")
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-<redacted>")
    .replace(/Bearer\s+\S+/gi, "Bearer <redacted>")
    .slice(0, 240);
}
