/**
 * Free/local checks for /api/image provider resolution (no paid API calls).
 * Run: node --experimental-strip-types is not needed; we import via tsx.
 */
import {
  listImageApiConfigs,
  openaiImageModelCandidates,
  resolveApiConfig,
  resolveOpenAIImageQuality,
  resolveOpenAIImageSize,
  xaiImageModelCandidates,
  getOpenAIKeyForImages,
} from "../src/lib/api-config.ts";
import { estimateImageCostUsd } from "../src/lib/image-pricing.ts";
import { logImageGeneration } from "../src/lib/image-usage-log.ts";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  for (const k of [
    "OPENAI_API_KEY",
    "AP",
    "OPENAI_IMAGE_API_KEY",
    "IMAGE_PROVIDER",
    "OPENAI_IMAGE_MODEL",
    "OPENAI_IMAGE_QUALITY",
    "OPENAI_IMAGE_SIZE",
    "OPENAI_BASE_URL",
    "OPENAI_MODEL",
  ]) {
    delete process.env[k];
  }

  assert(resolveOpenAIImageQuality() === "low", "default quality low");
  assert(resolveOpenAIImageSize() === "1024x1024", "default size");

  const models = openaiImageModelCandidates();
  assert(models[0] === "gpt-image-2.5-flare", "flare first");
  assert(!models.includes("dall-e-3") && !models.includes("gpt-image-1"), "retired skipped");
  assert(xaiImageModelCandidates()[0] === "grok-imagine-image", "xai model");
  assert(
    !xaiImageModelCandidates("grok-2-image-1212").includes("grok-2-image-1212"),
    "no grok-2-image"
  );

  // IMAGE_PROVIDER unset + xAI chat key → xAI primary (only)
  process.env.OPENAI_API_KEY = "xai-chat-key";
  assert(getOpenAIKeyForImages() === undefined, "xai key not OpenAI");
  let cfgs = listImageApiConfigs("auto");
  assert(cfgs.length === 1 && cfgs[0].provider === "xai", "default xAI primary");
  assert(cfgs[0].imageModelCandidates[0] === "grok-imagine-image", "imagine model");

  // OPENAI_IMAGE_API_KEY set → xAI still primary; OpenAI opt-in fallback
  process.env.OPENAI_IMAGE_API_KEY = "sk-image-dedicated";
  cfgs = listImageApiConfigs("auto");
  assert(cfgs.length === 2, "xai+openai");
  assert(cfgs[0].provider === "xai", "xai primary");
  assert(cfgs[1].provider === "openai" && cfgs[1].usingDedicatedImageKey, "openai opt-in fallback");
  assert(cfgs[1].quality === "low" && cfgs[1].size === "1024x1024", "cost defaults");

  // Explicit IMAGE_PROVIDER=openai → OpenAI only
  cfgs = listImageApiConfigs("openai");
  assert(cfgs.length === 1 && cfgs[0].provider === "openai", "openai opt-in only");

  // Explicit IMAGE_PROVIDER=xai → xAI only even with OpenAI key present
  cfgs = listImageApiConfigs("xai");
  assert(cfgs.length === 1 && cfgs[0].provider === "xai", "xai force");

  const chat = resolveApiConfig("xai-chat-key");
  assert(chat.isXai && chat.baseUrl === "https://api.x.ai/v1" && chat.model === "grok-4.7", "chat ok");

  assert(
    estimateImageCostUsd({
      provider: "openai",
      model: "gpt-image-2.5-flare",
      quality: "low",
      size: "1024x1024",
    }).estimatedCostUsd === 0.00588,
    "flare low"
  );
  assert(
    estimateImageCostUsd({
      provider: "openai",
      model: "gpt-image-2",
      quality: "medium",
      size: "1024x1024",
    }).estimatedCostUsd === 0.053,
    "gpt-image-2 medium"
  );
  assert(
    estimateImageCostUsd({ provider: "xai", model: "grok-imagine-image" })
      .estimatedCostUsd === 0.02,
    "xai 0.02"
  );

  const log = await logImageGeneration({
    provider: "xai",
    model: "grok-imagine-image",
    quality: null,
    size: null,
    usingDedicatedImageKey: false,
  });
  assert(log.estimatedCostUsd === 0.02, "usage log");

  console.log("OK verify-image-config");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
