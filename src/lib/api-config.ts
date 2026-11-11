export function getApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY?.trim() || process.env.AP?.trim();
}

export function getImageApiKey(): string | undefined {
  return process.env.OPENAI_IMAGE_API_KEY?.trim();
}

const OPENAI_IMAGE_BASE_URL = "https://api.openai.com/v1";
const XAI_BASE_URL = "https://api.x.ai/v1";

/** Retired OpenAI Images models — skip even if OPENAI_IMAGE_MODEL still names them. */
const RETIRED_OPENAI_IMAGE_MODELS = new Set([
  "dall-e-2",
  "dall-e-3",
  "gpt-image-1",
]);

/** Current OpenAI Images defaults (cheapest everyday first). */
const DEFAULT_OPENAI_IMAGE_MODELS = [
  "gpt-image-2.5-flare",
  "gpt-image-2",
  "gpt-image-1.5",
  "gpt-image-1-mini",
] as const;

/**
 * Current xAI Imagine models (docs.x.ai).
 * Prefer grok-imagine-image (~$0.02). Do not use retired grok-2-image*.
 */
const DEFAULT_XAI_IMAGE_MODELS = ["grok-imagine-image"] as const;

const RETIRED_XAI_IMAGE_MODELS = new Set([
  "grok-2-image",
  "grok-2-image-1212",
]);

export type ImageProviderPreference = "auto" | "openai" | "xai";
export type ImageProviderId = "openai" | "xai";

export type ImageApiConfig = {
  provider: ImageProviderId;
  apiKey: string;
  baseUrl: string;
  imageModelCandidates: string[];
  isXai: boolean;
  usingDedicatedImageKey: boolean;
};

/** IMAGE_PROVIDER=auto|openai|xai (default auto). */
export function resolveImageProviderPreference(
  raw = process.env.IMAGE_PROVIDER
): ImageProviderPreference {
  const value = raw?.trim().toLowerCase();
  if (value === "openai" || value === "xai") return value;
  return "auto";
}

export function openaiImageModelCandidates(
  preferredModel = process.env.OPENAI_IMAGE_MODEL
): string[] {
  const preferred = preferredModel?.trim();
  return Array.from(
    new Set(
      [preferred, ...DEFAULT_OPENAI_IMAGE_MODELS]
        .filter((model): model is string => Boolean(model))
        .filter((model) => !RETIRED_OPENAI_IMAGE_MODELS.has(model))
    )
  );
}

export function xaiImageModelCandidates(
  preferredModel = process.env.OPENAI_IMAGE_MODEL
): string[] {
  const preferred = preferredModel?.trim();
  // Only honor OPENAI_IMAGE_MODEL for xAI when it looks like an Imagine model.
  const preferredForXai =
    preferred &&
    preferred.startsWith("grok-imagine-image") &&
    !RETIRED_XAI_IMAGE_MODELS.has(preferred)
      ? preferred
      : undefined;
  return Array.from(
    new Set(
      [preferredForXai, ...DEFAULT_XAI_IMAGE_MODELS]
        .filter((model): model is string => Boolean(model))
        .filter((model) => !RETIRED_XAI_IMAGE_MODELS.has(model))
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
    (isXai ? XAI_BASE_URL : "https://api.openai.com/v1");
  // Strongest public xAI chat model (GPT-5.2-class target quality).
  const model =
    process.env.OPENAI_MODEL || (isXai ? "grok-4.7" : "gpt-4o");
  const imageModelCandidates = isXai
    ? xaiImageModelCandidates()
    : openaiImageModelCandidates();
  const imageModel =
    imageModelCandidates[0] ||
    (isXai ? DEFAULT_XAI_IMAGE_MODELS[0] : DEFAULT_OPENAI_IMAGE_MODELS[0]);
  return { baseUrl, model, imageModel, imageModelCandidates, isXai };
}

function buildOpenAIImageConfig(): ImageApiConfig | null {
  const imageKey = getImageApiKey();
  if (!imageKey) return null;
  return {
    provider: "openai",
    apiKey: imageKey,
    baseUrl: OPENAI_IMAGE_BASE_URL,
    imageModelCandidates: openaiImageModelCandidates(),
    isXai: false,
    usingDedicatedImageKey: true,
  };
}

function buildXaiImageConfig(): ImageApiConfig | null {
  const apiKey = getApiKey();
  if (!apiKey || !apiKey.startsWith("xai-")) return null;

  const baseUrl =
    process.env.OPENAI_BASE_URL?.replace(/\/$/, "") || XAI_BASE_URL;

  return {
    provider: "xai",
    apiKey,
    baseUrl,
    imageModelCandidates: xaiImageModelCandidates(),
    isXai: true,
    usingDedicatedImageKey: false,
  };
}

function buildSharedOpenAIChatImageConfig(): ImageApiConfig | null {
  const apiKey = getApiKey();
  if (!apiKey || apiKey.startsWith("xai-")) return null;
  const { baseUrl, imageModelCandidates, isXai } = resolveApiConfig(apiKey);
  return {
    provider: "openai",
    apiKey,
    baseUrl,
    imageModelCandidates,
    isXai,
    usingDedicatedImageKey: false,
  };
}

/**
 * Ordered image backends to try.
 * - auto: dedicated OpenAI key first (if set), then xAI chat key (AP / OPENAI_API_KEY)
 * - openai: dedicated OpenAI image key only
 * - xai: existing xAI chat key only (no OpenAI image spend)
 */
export function listImageApiConfigs(
  preference = resolveImageProviderPreference()
): ImageApiConfig[] {
  const openai = buildOpenAIImageConfig();
  const xai = buildXaiImageConfig();
  const sharedOpenAI = buildSharedOpenAIChatImageConfig();

  if (preference === "openai") {
    return openai ? [openai] : [];
  }
  if (preference === "xai") {
    return xai ? [xai] : [];
  }

  // auto
  const configs: ImageApiConfig[] = [];
  if (openai) configs.push(openai);
  if (xai) configs.push(xai);
  else if (!openai && sharedOpenAI) configs.push(sharedOpenAI);
  return configs;
}

/** Image generation: prefer dedicated OpenAI key; else shared chat key. */
export function resolveImageApiConfig(): ImageApiConfig | null {
  return listImageApiConfigs()[0] ?? null;
}

export function sanitizeApiError(detail: string): string {
  return detail
    .replace(/xai-[A-Za-z0-9_-]+/g, "xai-<redacted>")
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-<redacted>")
    .replace(/Bearer\s+\S+/gi, "Bearer <redacted>")
    .slice(0, 480);
}
