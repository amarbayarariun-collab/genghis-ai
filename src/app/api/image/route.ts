import {
  listImageApiConfigs,
  resolveImageProviderPreference,
  sanitizeApiError,
  type ImageApiConfig,
} from "@/lib/api-config";
import { logImageGeneration } from "@/lib/image-usage-log";

function missingKeyError(
  preference: ReturnType<typeof resolveImageProviderPreference>
): string {
  if (preference === "xai") {
    return "Зураг үүсгэхэд xAI түлхүүр хэрэгтэй. Vercel дээр OPENAI_API_KEY эсвэл AP (xai-…) тохируулаад Production Redeploy хийнэ үү.";
  }
  if (preference === "openai") {
    return "Зураг үүсгэхэд OpenAI image түлхүүр хэрэгтэй. Vercel дээр OPENAI_IMAGE_API_KEY (эсвэл жинхэнэ OpenAI OPENAI_API_KEY, xai- биш) тохируулаад Production Redeploy хийнэ үү.";
  }
  return "Зураг үүсгэхэд API түлхүүр хэрэгтэй. Гол зам: xAI AP / OPENAI_API_KEY (xai-…). OpenAI нөөц: OPENAI_IMAGE_API_KEY + IMAGE_PROVIDER=openai. Production Redeploy хийнэ үү.";
}

function looksLikeCreditsIssue(detail: string): boolean {
  return /billing|credit|quota|insufficient|payment|balance|no cre/i.test(detail);
}

function allFailedError(configs: ImageApiConfig[], detail: string): string {
  const triedXai = configs.some((c) => c.provider === "xai");
  const triedOpenAI = configs.some((c) => c.provider === "openai");
  const credits = looksLikeCreditsIssue(detail);

  if (triedXai && triedOpenAI) {
    return credits
      ? "Зураг үүсгэж чадсангүй. xAI (grok-imagine-image) амжилтгүй; OpenAI нөөц credits/billing ч хүрэлцэхгүй. xAI AP эрхээ шалгаад Redeploy хийнэ үү, эсвэл OpenAI prepaid credits цэнэглэнэ үү."
      : "Зураг үүсгэж чадсангүй. xAI (grok-imagine-image) болон OpenAI GPT Image нөөц аль аль нь амжилтгүй. AP / OPENAI_API_KEY (xai-…) болон OPENAI_IMAGE_API_KEY шалгаад Redeploy хийнэ үү.";
  }
  if (triedXai) {
    return "Зураг үүсгэж чадсангүй. xAI (grok-imagine-image) амжилтгүй. AP / OPENAI_API_KEY (xai-…) эрхээ шалгана уу. OpenAI нөөцөд OPENAI_IMAGE_API_KEY нэмээд IMAGE_PROVIDER=openai туршина уу.";
  }
  if (credits) {
    return "Зураг үүсгэж чадсангүй. OpenAI image credits/billing хүрэлцэхгүй байна. Prepaid credits цэнэглээд Production Redeploy хийнэ үү. Үндсэн замд IMAGE_PROVIDER unset / auto үлдээж AP (xai-…) ашиглана уу.";
  }
  return "Зураг үүсгэж чадсангүй. OpenAI image model эсвэл түлхүүр буруу байна. dall-e-3 / gpt-image-1 retired — OPENAI_IMAGE_MODEL=gpt-image-2.5-flare, OPENAI_IMAGE_QUALITY=low, OPENAI_IMAGE_SIZE=1024x1024 тавина уу. Эсвэл IMAGE_PROVIDER unset үлдээж xAI ашиглана уу.";
}

async function tryGenerateWithConfig(
  config: ImageApiConfig,
  prompt: string,
  signal: AbortSignal
): Promise<
  | { imageUrl: string; model: string; quality: string | null; size: string | null }
  | { errors: string[] }
> {
  const errors: string[] = [];

  for (const model of config.imageModelCandidates) {
    const payload: Record<string, unknown> = {
      model,
      prompt,
      n: 1,
    };
    if (!config.isXai) {
      // Cost-control defaults for OpenAI GPT Image.
      payload.size = config.size || "1024x1024";
      if (config.quality) payload.quality = config.quality;
    }

    const response = await fetch(`${config.baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal,
    });

    const raw = await response.text();
    if (!response.ok) {
      errors.push(
        `${config.provider}/${model}: ${sanitizeApiError(raw) || response.statusText}`
      );
      continue;
    }

    let data: { data?: Array<{ url?: string; b64_json?: string }> };
    try {
      data = JSON.parse(raw) as typeof data;
    } catch {
      errors.push(`${config.provider}/${model}: буруу JSON хариу`);
      continue;
    }

    const first = data.data?.[0];
    const imageUrl =
      first?.url ||
      (first?.b64_json ? `data:image/png;base64,${first.b64_json}` : null);

    if (!imageUrl) {
      errors.push(`${config.provider}/${model}: хоосон хариу`);
      continue;
    }

    return {
      imageUrl,
      model,
      quality: config.quality,
      size: config.size,
    };
  }

  return { errors };
}

export async function POST(request: Request) {
  let body: { prompt?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Буруу JSON." }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return Response.json(
      { error: "Зургийн тайлбар (prompt) хоосон байна." },
      { status: 400 }
    );
  }

  const preference = resolveImageProviderPreference();
  const configs = listImageApiConfigs(preference);
  if (!configs.length) {
    return Response.json(
      { error: missingKeyError(preference), imageProvider: preference },
      { status: 503 }
    );
  }

  const errors: string[] = [];

  try {
    for (const config of configs) {
      const result = await tryGenerateWithConfig(config, prompt, request.signal);
      if ("imageUrl" in result) {
        const usageLog = await logImageGeneration({
          provider: config.provider,
          model: result.model,
          quality: result.quality,
          size: result.size,
          usingDedicatedImageKey: config.usingDedicatedImageKey,
        });

        return Response.json({
          ok: true,
          imageUrl: result.imageUrl,
          model: result.model,
          provider: config.provider,
          quality: result.quality,
          size: result.size,
          usingDedicatedImageKey: config.usingDedicatedImageKey,
          usageLog,
        });
      }
      errors.push(...result.errors);
    }

    const detail = sanitizeApiError(errors.join(" · "));
    // Never return opaque 502s — surface clear Mongolian guidance instead.
    return Response.json(
      {
        ok: false,
        error: allFailedError(configs, detail),
        detail,
        imageProvider: preference,
        triedProviders: configs.map((c) => c.provider),
        usingDedicatedImageKey: configs.some((c) => c.usingDedicatedImageKey),
      },
      { status: 503 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Зураг үүсгэж чадсангүй.";
    return Response.json(
      {
        ok: false,
        error:
          "Зураг үүсгэх үед алдаа гарлаа. Дахин оролдоно уу. Хэрэв үргэлжилбэл OPENAI_IMAGE_API_KEY эсвэл xAI AP тохиргоогоо шалгана уу.",
        detail: sanitizeApiError(message),
      },
      { status: 503 }
    );
  }
}
