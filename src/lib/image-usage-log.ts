import { estimateImageCostUsd } from "@/lib/image-pricing";

export type ImageUsageLogEntry = {
  provider: "openai" | "xai";
  model: string;
  quality: string | null;
  size: string | null;
  estimatedCostUsd: number;
  costBasis: string;
  usingDedicatedImageKey: boolean;
  at: string;
};

/**
 * Lean image usage log for #42.
 * Always emits a structured console line. Full DB persistence (genghis_token_usage /
 * image events, 10 images/month quota) lives on #38 / #44 — wire there after merge
 * without blocking this PR. Never throws.
 */
export async function logImageGeneration(input: {
  provider: "openai" | "xai";
  model: string;
  quality?: string | null;
  size?: string | null;
  usingDedicatedImageKey: boolean;
}): Promise<ImageUsageLogEntry> {
  const { estimatedCostUsd, basis } = estimateImageCostUsd({
    provider: input.provider,
    model: input.model,
    quality: input.quality,
    size: input.size,
  });

  const entry: ImageUsageLogEntry = {
    provider: input.provider,
    model: input.model,
    quality: input.quality ?? null,
    size: input.size ?? null,
    estimatedCostUsd,
    costBasis: basis,
    usingDedicatedImageKey: input.usingDedicatedImageKey,
    at: new Date().toISOString(),
  };

  try {
    console.info("[genghis-image-usage]", JSON.stringify(entry));
  } catch {
    // ignore logging failures
  }

  return entry;
}
