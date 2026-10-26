import {
  getApiKey,
  resolveApiConfig,
  sanitizeApiError,
} from "@/lib/api-config";
import { streamMockReply } from "@/lib/mock-chat";
import { systemPromptForMode } from "@/lib/tools";
import type { ApiAttachment, ToolMode } from "@/lib/types";

type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image_url"; image_url: { url: string } };
type ContentPart = TextPart | ImagePart;

type IncomingMessage = {
  role: "user" | "assistant" | "system";
  content: string | ContentPart[];
};

type ChatBody = {
  messages?: IncomingMessage[];
  mode?: ToolMode;
  attachments?: ApiAttachment[];
  webContext?: string;
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

function buildUserContent(
  text: string,
  attachments?: ApiAttachment[]
): string | ContentPart[] {
  const images = (attachments || []).filter(
    (a) => a.kind === "image" && a.dataUrl
  );
  const docs = (attachments || []).filter((a) => a.kind === "file");

  let prompt = text;
  if (docs.length) {
    const blocks = docs.map((d) => {
      const body = (d.text || "").slice(0, 60_000);
      return `--- Файл: ${d.name} (${d.mime}) ---\n${body}`;
    });
    prompt = `${text}\n\n[Хавсралт баримтууд]\n${blocks.join("\n\n")}`;
  }

  if (!images.length) return prompt;

  const parts: ContentPart[] = [{ type: "text", text: prompt || "Энэ зургийг харж тайлбарла / асуултад хариул." }];
  for (const img of images.slice(0, 4)) {
    if (img.dataUrl) {
      parts.push({ type: "image_url", image_url: { url: img.dataUrl } });
    }
  }
  return parts;
}

function lastUserText(messages: IncomingMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    if (typeof m.content === "string") return m.content;
    const text = m.content
      .filter((p): p is TextPart => p.type === "text")
      .map((p) => p.text)
      .join("\n");
    return text;
  }
  return "";
}

async function* streamOpenAI(
  messages: IncomingMessage[],
  apiKey: string,
  mode: ToolMode,
  webContext: string | undefined,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const { baseUrl, model } = resolveApiConfig(apiKey);
  let system = systemPromptForMode(mode);
  if (webContext) {
    system += `\n\n[Вэб хайлтын үр дүн]\n${webContext}`;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [{ role: "system", content: system }, ...messages],
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `API алдаа (${response.status}): ${sanitizeApiError(detail) || response.statusText}`
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
        // Never surface em/en dashes in assistant UI copy.
        if (token) yield token.replace(/\u2014/g, ",").replace(/\u2013/g, "-");
      } catch {
        // skip
      }
    }
  }
}

export async function POST(request: Request) {
  let body: ChatBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Буруу JSON илгээлээ." }, { status: 400 });
  }

  const mode: ToolMode = body.mode || "chat";
  const attachments = body.attachments || [];
  const webContext = body.webContext?.trim();

  const rawMessages = (body.messages || []).filter(
    (m) =>
      m &&
      (m.role === "user" || m.role === "assistant" || m.role === "system") &&
      (typeof m.content === "string" || Array.isArray(m.content))
  );

  if (!rawMessages.length && !attachments.length) {
    return Response.json({ error: "Мессеж хоосон байна." }, { status: 400 });
  }

  // Inject attachments into the last user message
  const messages: IncomingMessage[] = rawMessages.map((m, idx) => {
    const isLastUser =
      m.role === "user" &&
      idx === rawMessages.map((x) => x.role).lastIndexOf("user");
    if (!isLastUser || !attachments.length) return m;
    const text = typeof m.content === "string" ? m.content : lastUserText([m]);
    return { role: "user", content: buildUserContent(text, attachments) };
  });

  if (!messages.length) {
    messages.push({
      role: "user",
      content: buildUserContent("", attachments),
    });
  }

  const prompt = lastUserText(messages);
  const apiKey = getApiKey();

  try {
    if (apiKey) {
      const stream = encoderStream(
        streamOpenAI(messages, apiKey, mode, webContext, request.signal)
      );
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
    if (apiKey) {
      const stream = encoderStream(
        (async function* () {
          yield `⚠️ Жинхэнэ API ажилласангүй (${sanitizeApiError(message)}). Демо горим руу шилжлээ.\n\n`;
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
