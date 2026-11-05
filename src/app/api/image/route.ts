import {
  resolveImageApiConfig,
  sanitizeApiError,
} from "@/lib/api-config";

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

  const config = resolveImageApiConfig();
  if (!config) {
    return Response.json(
      {
        error:
          "Зураг үүсгэхэд API түлхүүр хэрэгтэй. Vercel дээр OPENAI_IMAGE_API_KEY тохируулаад Production Redeploy хийнэ үү (эсвэл OPENAI_API_KEY / AP).",
      },
      { status: 503 }
    );
  }

  const {
    apiKey,
    baseUrl,
    imageModelCandidates,
    isXai,
    usingDedicatedImageKey,
  } = config;
  const errors: string[] = [];

  try {
    for (const model of imageModelCandidates) {
      const payload: Record<string, unknown> = {
        model,
        prompt,
        n: 1,
      };
      if (!isXai) {
        payload.size = "1024x1024";
        payload.response_format = "url";
      }

      const response = await fetch(`${baseUrl}/images/generations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: request.signal,
      });

      const raw = await response.text();
      if (!response.ok) {
        errors.push(`${model}: ${sanitizeApiError(raw) || response.statusText}`);
        continue;
      }

      let data: { data?: Array<{ url?: string; b64_json?: string }> };
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        errors.push(`${model}: буруу JSON хариу`);
        continue;
      }

      const first = data.data?.[0];
      const imageUrl =
        first?.url ||
        (first?.b64_json ? `data:image/png;base64,${first.b64_json}` : null);

      if (!imageUrl) {
        errors.push(`${model}: хоосон хариу`);
        continue;
      }

      return Response.json({ ok: true, imageUrl, model });
    }

    const error = !usingDedicatedImageKey
      ? "Зураг үүсгэж чадсангүй. OPENAI_IMAGE_API_KEY Vercel дээр тохируулаагүй (эсвэл Redeploy хийгээгүй) байна. Env нэрийг яг OPENAI_IMAGE_API_KEY гэж тавиад Production Redeploy хийнэ үү."
      : "Зураг үүсгэж чадсангүй. OpenAI image model эрх/billing эсвэл загварын нэр буруу байна. Vercel дээр OPENAI_IMAGE_MODEL=dall-e-3 тавиад Redeploy хийнэ үү.";

    return Response.json(
      {
        error,
        detail: sanitizeApiError(errors.join(" · ")),
        usingDedicatedImageKey,
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
