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

  const { baseUrl, imageModel, isXai } = resolveApiConfig(apiKey);

  try {
    const payload: Record<string, unknown> = {
      model: imageModel,
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
      return Response.json(
        {
          error: `Зургийн API ажилласангүй (${response.status}): ${sanitizeApiError(raw) || response.statusText}. Энэ түлхүүр/загвар зураг үүсгэхийг дэмжихгүй байж болно.`,
        },
        { status: 502 }
      );
    }

    const data = JSON.parse(raw) as {
      data?: Array<{ url?: string; b64_json?: string }>;
    };
    const first = data.data?.[0];
    const imageUrl =
      first?.url ||
      (first?.b64_json ? `data:image/png;base64,${first.b64_json}` : null);

    if (!imageUrl) {
      return Response.json(
        { error: "Зургийн API хариу хоосон байна." },
        { status: 502 }
      );
    }

    return Response.json({ ok: true, imageUrl, model: imageModel });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Зураг үүсгэж чадсангүй.";
    return Response.json(
      { error: sanitizeApiError(message) },
      { status: 500 }
    );
  }
}
