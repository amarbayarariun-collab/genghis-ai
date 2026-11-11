import {
  listImageApiConfigs,
  resolveImageProviderPreference,
  sanitizeApiError,
  type ImageApiConfig,
} from "@/lib/api-config";

function missingKeyError(preference: ReturnType<typeof resolveImageProviderPreference>): string {
  if (preference === "xai") {
    return "Зураг үүсгэхэд xAI түлхүүр хэрэгтэй. Vercel дээр OPENAI_API_KEY эсвэл AP (xai-…) тохируулаад Production Redeploy хийнэ үү. IMAGE_PROVIDER=xai.";
  }
  if (preference === "openai") {
    return "Зураг үүсгэхэд OpenAI image түлхүүр хэрэгтэй. Vercel дээр OPENAI_IMAGE_API_KEY тохируулаад Production Redeploy хийнэ үү. IMAGE_PROVIDER=openai.";
  }
  return "Зураг үүсгэхэд API түлхүүр хэрэгтэй. xAI-д OPENAI_API_KEY / AP (xai-…) эсвэл OpenAI-д OPENAI_IMAGE_API_KEY тохируулаад Production Redeploy хийнэ үү.";
}

function allFailedError(configs: ImageApiConfig[]): string {
  const triedXai = configs.some((c) => c.provider === "xai");
  const triedOpenAI = configs.some((c) => c.provider === "openai");

  if (triedXai && triedOpenAI) {
    return "Зураг үүсгэж чадсангүй. OpenAI image болон xAI Imagine (grok-imagine-image) аль аль нь амжилтгүй. IMAGE_PROVIDER=xai (зөвхөн одоогийн xAI түлхүүр) эсвэл openai сонгоод, model/эрхээ шалгаад Redeploy хийнэ үү.";
  }
  if (triedXai) {
    return "Зураг үүсгэж чадсангүй. xAI Imagine model (grok-imagine-image) эсвэл түлхүүрийн эрх буруу байна. OPENAI_API_KEY / AP (xai-…) болон IMAGE_PROVIDER=xai шалгаад Production Redeploy хийнэ үү.";
  }
  return "Зураг үүсгэж чадсангүй. OpenAI image model эрх/billing эсвэл загварын нэр буруу байна. dall-e-3 болон gpt-image-1 retired. OPENAI_IMAGE_API_KEY + OPENAI_IMAGE_MODEL=gpt-image-2.5-flare тавиад credits шалгаад Redeploy хийнэ үү. Эсвэл IMAGE_PROVIDER=xai гэж xAI түлхүүрээр зураг үүсгэнэ.";
}

async function tryGenerateWithConfig(
  config: ImageApiConfig,
  prompt: string,
  signal: AbortSignal
): Promise<{ imageUrl: string; model: string } | { errors: string[] }> {
  const errors: string[] = [];

  for (const model of config.imageModelCandidates) {
    const payload: Record<string, unknown> = {
      model,
      prompt,
      n: 1,
    };
    if (!config.isXai) {
      // OpenAI Images API rejects response_format on current models.
      payload.size = "1024x1024";
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

    return { imageUrl, model };
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
        return Response.json({
          ok: true,
          imageUrl: result.imageUrl,
          model: result.model,
          provider: config.provider,
          usingDedicatedImageKey: config.usingDedicatedImageKey,
        });
      }
      errors.push(...result.errors);
    }

    return Response.json(
      {
        error: allFailedError(configs),
        detail: sanitizeApiError(errors.join(" · ")),
        imageProvider: preference,
        triedProviders: configs.map((c) => c.provider),
        usingDedicatedImageKey: configs.some((c) => c.usingDedicatedImageKey),
      },
      { status: 502 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Зураг үүсгэж чадсангүй.";
    return Response.json(
      { error: sanitizeApiError(message) },
      { status: 500 }
    );
  }
}
