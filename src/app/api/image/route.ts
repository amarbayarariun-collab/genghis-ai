import {
  getApiKey,
  resolveApiConfig,
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

  const apiKey = getApiKey();
  if (!apiKey) {
    return Response.json(
      {
        error:
          "Зураг үүсгэхэд API түлхүүр хэрэгтэй. OPENAI_API_KEY / AP тохируулаагүй байна.",
      },
      { status: 503 }
    );
  }

  const { baseUrl, imageModelCandidates, isXai } = resolveApiConfig(apiKey);
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

    return Response.json(
      {
        error:
          "Зураг үүсгэж чадсангүй. Энэ түлхүүр одоогоор image model-д хандах эрхгүй эсвэл загварын нэр буруу байна. Vercel дээр OPENAI_IMAGE_MODEL тохируулж болно.",
        detail: sanitizeApiError(errors.join(" · ")),
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
