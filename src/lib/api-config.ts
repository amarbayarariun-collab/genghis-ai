import type { ImageQuality } from "@/lib/image-pricing";

export function getApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY?.trim() || process.env.AP?.trim();
}

export function getImageApiKey(): string | undefined {
  return process.env.OPENAI_IMAGE_API_KEY?.trim();
}

/**
 * Real OpenAI chat key for image generation only.
 * Never treat the xAI key mapped into OPENAI_API_KEY / AP as OpenAI.
 */
export function getOpenAIKeyForImages(): string | undefined {
  const dedicated = getImageApiKey();
  if (dedicated) return dedicated;
  const chat = process.env.OPENAI_API_KEY?.trim();
  if (chat && !chat.startsWith("xai-")) return chat;
  return undefined;
}

/** xAI chat key (OPENAI_API_KEY or AP) when it is actually an xai- key. */
export function getXaiKeyForImages(): string | undefined {
  const key = getApiKey();
  if (key?.startsWith("xai-")) return key;
  return undefined;
}

const OPENAI_IMAGE_BASE_URL = "https://api.openai.com/v1";
const XAI_BASE_URL = "https://api.x.ai/v1";

/** Retired OpenAI Images models — skip even if OPENAI_IMAGE_MODEL still names them. */
const RETIRED_OPENAI_IMAGE_MODELS = new Set([
  "dall-e-2",
  "dall-e-3",
  "gpt-image-1",
]);

/** Current OpenAI Images defaults (primary → fallbacks). */
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
  /** OpenAI only — cost-control defaults. */
  quality: ImageQuality | null;
  size: string | null;
};

/** IMAGE_PROVIDER=auto|openai|xai (default auto = xAI primary; OpenAI opt-in). */
export function resolveImageProviderPreference(
  raw = process.env.IMAGE_PROVIDER
): ImageProviderPreference {
  const value = raw?.trim().toLowerCase();
  if (value === "openai" || value === "xai") return value;
  return "auto";
}

export function resolveOpenAIImageQuality(
  raw = process.env.OPENAI_IMAGE_QUALITY
): ImageQuality {
  const value = raw?.trim().toLowerCase();
  if (
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "xhigh" ||
    value === "max" ||
    value === "auto"
  ) {
    return value;
  }
  // Cost control default.
  return "low";
}

export function resolveOpenAIImageSize(
  raw = process.env.OPENAI_IMAGE_SIZE
): string {
  const value = raw?.trim();
  if (value && /^\d{2,5}x\d{2,5}$/i.test(value)) return value;
  return "1024x1024";
}

export function openaiImageModelCandidates(
  preferredModel = process.env.OPENAI_IMAGE_MODEL
): string[] {
  const preferred = preferredModel?.trim();
  // Ignore xAI model names when building OpenAI candidates.
  const preferredForOpenAI =
    preferred && !preferred.startsWith("grok-") ? preferred : undefined;
  return Array.from(
    new Set(
      [preferredForOpenAI, ...DEFAULT_OPENAI_IMAGE_MODELS]
        .filter((model): model is string => Boolean(model))
        .filter((model) => !RETIRED_OPENAI_IMAGE_MODELS.has(model))
    )
  );
}

export function xaiImageModelCandidates(
  preferredModel = process.env.OPENAI_IMAGE_MODEL
): string[] {
  const preferred = preferredModel?.trim();
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

function buildDedicatedOpenAIImageConfig(): ImageApiConfig | null {
  const imageKey = getImageApiKey();
  if (!imageKey) return null;
  return {
    provider: "openai",
    apiKey: imageKey,
    baseUrl: OPENAI_IMAGE_BASE_URL,
    imageModelCandidates: openaiImageModelCandidates(),
    isXai: false,
    usingDedicatedImageKey: true,
    quality: resolveOpenAIImageQuality(),
    size: resolveOpenAIImageSize(),
  };
}

function buildSharedOpenAIChatImageConfig(): ImageApiConfig | null {
  // Only a real OpenAI OPENAI_API_KEY — never the xAI key mapped into AP / OPENAI_API_KEY.
  const chat = process.env.OPENAI_API_KEY?.trim();
  if (!chat || chat.startsWith("xai-")) return null;
  if (getImageApiKey()) return null; // dedicated key already covers OpenAI
  return {
    provider: "openai",
    apiKey: chat,
    baseUrl: OPENAI_IMAGE_BASE_URL,
    imageModelCandidates: openaiImageModelCandidates(),
    isXai: false,
    usingDedicatedImageKey: false,
    quality: resolveOpenAIImageQuality(),
    size: resolveOpenAIImageSize(),
  };
}

function buildXaiImageConfig(): ImageApiConfig | null {
  const apiKey = getXaiKeyForImages();
  if (!apiKey) return null;

  const configured = process.env.OPENAI_BASE_URL?.replace(/\/$/, "");
  const baseUrl =
    configured && configured.includes("x.ai") ? configured : XAI_BASE_URL;

  return {
    provider: "xai",
    apiKey,
    baseUrl,
    imageModelCandidates: xaiImageModelCandidates(),
    isXai: true,
    usingDedicatedImageKey: false,
    quality: null,
    size: null,
  };
}

/**
 * Ordered image backends to try.
 * - auto (default when IMAGE_PROVIDER unset): xAI grok-imagine-image PRIMARY
 *   via chat key (OPENAI_API_KEY / AP). OpenAI GPT Image is opt-in FALLBACK
 *   only when OPENAI_IMAGE_API_KEY (or a real OpenAI OPENAI_API_KEY) is set.
 * - openai: OpenAI keys only (explicit opt-in)
 * - xai: xAI chat key only
 */
export function listImageApiConfigs(
  preference = resolveImageProviderPreference()
): ImageApiConfig[] {
  const dedicated = buildDedicatedOpenAIImageConfig();
  const sharedOpenAI = buildSharedOpenAIChatImageConfig();
  const xai = buildXaiImageConfig();

  if (preference === "openai") {
    return [dedicated, sharedOpenAI].filter(Boolean) as ImageApiConfig[];
  }
  if (preference === "xai") {
    return xai ? [xai] : [];
  }

  // auto: xAI primary; OpenAI only when opted in via OPENAI_IMAGE_API_KEY / real sk- key
  const configs: ImageApiConfig[] = [];
  if (xai) configs.push(xai);
  if (dedicated) configs.push(dedicated);
  else if (sharedOpenAI) configs.push(sharedOpenAI);
  return configs;
}

/** Image generation: prefer xAI Imagine; OpenAI only when opted in via env. */
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
