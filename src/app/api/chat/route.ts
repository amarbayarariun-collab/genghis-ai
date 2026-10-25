import { streamMockReply } from "@/lib/mock-chat";

type IncomingMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

function encoderStream(
  generator: AsyncGenerator<string>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generator) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

function resolveApiConfig(apiKey: string): { baseUrl: string; model: string } {
  const isXai = apiKey.startsWith("xai-");
  const baseUrl =
    process.env.OPENAI_BASE_URL?.replace(/\/$/, "") ||
    (isXai ? "https://api.x.ai/v1" : "https://api.openai.com/v1");
  const model =
    process.env.OPENAI_MODEL || (isXai ? "grok-4.3" : "gpt-4o-mini");
  return { baseUrl, model };
}

/** Strip anything that looks like a credential from upstream error text. */
function sanitizeApiError(detail: string): string {
  return detail
    .replace(/xai-[A-Za-z0-9_-]+/g, "xai-<redacted>")
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-<redacted>")
    .replace(/Bearer\s+\S+/gi, "Bearer <redacted>")
    .slice(0, 200);
}

async function* streamOpenAI(
  messages: IncomingMessage[],
  apiKey: string,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const { baseUrl, model } = resolveApiConfig(apiKey);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        {
          role: "system",
          content:
            "Чи Genghis AI — Монголын анхны ChatGPT шиг AI туслах. Монгол хэлээр (кирилл) тод, найрсаг хариул. Шаардлагатай үед англиар товч нэмж болно. Богино, хэрэгтэй хариултыг илүүд үз.",
        },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `OpenAI API алдаа (${response.status}): ${sanitizeApiError(detail) || response.statusText}`
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const json = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const token = json.choices?.[0]?.delta?.content;
        if (token) yield token;
      } catch {
        // skip malformed SSE chunks
      }
    }
  }
}

export async function POST(request: Request) {
  let body: { messages?: IncomingMessage[] };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Буруу JSON илгээлээ." },
      { status: 400 }
    );
  }

  const messages = body.messages?.filter(
    (m) =>
      m &&
      typeof m.content === "string" &&
      (m.role === "user" || m.role === "assistant" || m.role === "system")
  );

  if (!messages?.length) {
    return Response.json(
      { error: "Мессеж хоосон байна." },
      { status: 400 }
    );
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const prompt = lastUser?.content ?? "";
  // Febbas secret is currently named `AP`; prefer OPENAI_API_KEY when set.
  const apiKey =
    process.env.OPENAI_API_KEY?.trim() || process.env.AP?.trim();

  try {
    if (apiKey) {
      const stream = encoderStream(streamOpenAI(messages, apiKey, request.signal));
      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Genghis-Mode": "openai",
        },
      });
    }

    const stream = encoderStream(streamMockReply(prompt, request.signal));
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Genghis-Mode": "mock",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Тодорхойгүй алдаа гарлаа.";
    // Fall back to mock if live API fails so the demo still works
    if (apiKey) {
      const stream = encoderStream(
        (async function* () {
          yield `⚠️ Жинхэнэ API ажилласангүй (${message}). Демо горим руу шилжлээ.\n\n`;
          for await (const chunk of streamMockReply(prompt, request.signal)) {
            yield chunk;
          }
        })()
      );
      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Genghis-Mode": "mock-fallback",
        },
      });
    }

    return Response.json({ error: message }, { status: 500 });
  }
}
