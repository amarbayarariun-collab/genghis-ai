/**
 * Estimated per-image USD costs for usage logs / admin (not live billing).
 * OpenAI figures from official docs (image generation guide + pricing page).
 * xAI grok-imagine-image is a flat $0.02 / image (docs.x.ai).
 */

export type ImageQuality = "low" | "medium" | "high" | "xhigh" | "max" | "auto";

export type ImageCostEstimate = {
  estimatedCostUsd: number;
  /** How the estimate was derived. */
  basis: string;
};

/** Official OpenAI per-image table (1024x1024) from image generation guide. */
const OPENAI_FLAT_1024: Record<string, Partial<Record<"low" | "medium" | "high", number>>> = {
  "gpt-image-2": { low: 0.006, medium: 0.053, high: 0.211 },
  "gpt-image-1.5": { low: 0.009, medium: 0.034, high: 0.133 },
  "gpt-image-1-mini": { low: 0.005, medium: 0.011, high: 0.036 },
};

/**
 * gpt-image-2.5-flare bills image output tokens ($30 / 1M on Standard).
 * Approximate 1024x1024 output costs from OpenAI calculator-style estimates
 * published alongside the model (not a flat rate card).
 */
const FLARE_APPROX_1024: Partial<Record<"low" | "medium" | "high", number>> = {
  low: 0.00588,
  medium: 0.01317,
  high: 0.05268,
};

const XAI_GROK_IMAGINE_USD = 0.02;

function normalizeQuality(quality: string | null | undefined): "low" | "medium" | "high" {
  const q = (quality || "low").toLowerCase();
  if (q === "medium") return "medium";
  if (q === "high" || q === "xhigh" || q === "max") return "high";
  return "low";
}

export function estimateImageCostUsd(input: {
  provider: "openai" | "xai";
  model: string;
  quality?: string | null;
  size?: string | null;
}): ImageCostEstimate {
  if (input.provider === "xai") {
    return {
      estimatedCostUsd: XAI_GROK_IMAGINE_USD,
      basis: "xAI grok-imagine-image flat $0.02/image (docs.x.ai)",
    };
  }

  const quality = normalizeQuality(input.quality);
  const model = input.model.trim();
  const size = (input.size || "1024x1024").trim();

  if (model.startsWith("gpt-image-2.5-flare") || model.startsWith("gpt-image-2.5-sunburst")) {
    const approx = FLARE_APPROX_1024[quality] ?? FLARE_APPROX_1024.low!;
    return {
      estimatedCostUsd: approx,
      basis: `OpenAI ${model} token billing (~$${approx} est. @ ${quality} ${size}; $30/1M image output tokens)`,
    };
  }

  const flat = OPENAI_FLAT_1024[model];
  if (flat && size === "1024x1024") {
    const price = flat[quality] ?? flat.low ?? 0.006;
    return {
      estimatedCostUsd: price,
      basis: `OpenAI official per-image table: ${model} ${quality} ${size} = $${price}`,
    };
  }

  // Unknown OpenAI model: conservative medium gpt-image-2 square estimate.
  return {
    estimatedCostUsd: 0.053,
    basis: `OpenAI fallback estimate (gpt-image-2 medium 1024x1024) for model=${model}`,
  };
}
