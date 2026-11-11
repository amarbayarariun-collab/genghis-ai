import { sanitizeApiError } from "@/lib/api-config";
import {
  resolveChatProvider,
  type ChatProviderConfig,
} from "@/lib/chat-provider";
import { shapeChatCompletionRequest } from "@/lib/chat-request-shape";
import { isLocale, type Locale } from "@/lib/locale";
import { streamMockReply } from "@/lib/mock-chat";
import {
  attachTextLimit,
  estimateCostUsd,
  planForTier,
} from "@/lib/plans";
import { systemPromptForMode } from "@/lib/tools";
import type { ApiAttachment, ToolMode } from "@/lib/types";
import { recordTokenUsage } from "@/lib/usage/db";
import {
  assertCanSendMessage,
  trackMessageForUser,
} from "@/lib/usage/quotas";

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
  locale?: Locale;
  attachments?: ApiAttachment[];
  webContext?: string;
  /** Client conversation id for xAI prompt-cache sticky routing. */
  conversationId?: string;
};

type StreamUsage = {
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  totalTokens: number;
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
  attachments: ApiAttachment[] | undefined,
  locale: Locale
): string | ContentPart[] {
  const images = (attachments || []).filter(
    (a) => a.kind === "image" && a.dataUrl
  );
  const docs = (attachments || []).filter((a) => a.kind === "file");
  const limit = attachTextLimit();

  let prompt = text;
  if (docs.length) {
    const notices: string[] = [];
    const blocks = docs.map((d) => {
      const raw = d.text || "";
      const truncated = raw.length > limit;
      const body = raw.slice(0, limit);
      if (truncated) {
        notices.push(
          locale === "en"
            ? `Attachment "${d.name}" was truncated to ${limit} characters.`
            : `"${d.name}" файлын текст ${limit} тэмдэгтээр хязгаарлагдлаа.`
        );
      }
      return `--- Файл: ${d.name} (${d.mime}) ---\n${body}`;
    });
    const noticeBlock = notices.length
      ? `\n\n[${locale === "en" ? "Notice" : "Анхааруулга"}]\n${notices.join("\n")}`
      : "";
    prompt = `${text}\n\n[Хавсралт баримтууд]\n${blocks.join("\n\n")}${noticeBlock}`;
  }

  if (!images.length) return prompt;

  const parts: ContentPart[] = [
    {
      type: "text",
      text: prompt || "Энэ зургийг харж тайлбарла / асуултад хариул.",
    },
  ];
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

function parseUsage(raw: unknown): StreamUsage | null {
  if (!raw || typeof raw !== "object") return null;
  const u = raw as Record<string, unknown>;
  const promptTokens = Number(u.prompt_tokens ?? u.input_tokens ?? 0);
  const completionTokens = Number(u.completion_tokens ?? u.output_tokens ?? 0);
  const totalTokens = Number(
    u.total_tokens ?? promptTokens + completionTokens
  );
  const promptDetails =
    (u.prompt_tokens_details as Record<string, unknown> | undefined) ||
    (u.input_tokens_details as Record<string, unknown> | undefined) ||
    {};
  const completionDetails =
    (u.completion_tokens_details as Record<string, unknown> | undefined) ||
    (u.output_tokens_details as Record<string, unknown> | undefined) ||
    {};
  const cachedTokens = Number(promptDetails.cached_tokens ?? 0);
  const reasoningTokens = Number(completionDetails.reasoning_tokens ?? 0);
  if (
    !Number.isFinite(promptTokens) &&
    !Number.isFinite(completionTokens)
  ) {
    return null;
  }
  return {
    promptTokens: Math.max(0, promptTokens || 0),
    completionTokens: Math.max(0, completionTokens || 0),
    reasoningTokens: Math.max(0, reasoningTokens || 0),
    cachedTokens: Math.max(0, cachedTokens || 0),
    totalTokens: Math.max(0, totalTokens || 0),
  };
}

async function* streamChatCompletion(
  messages: IncomingMessage[],
  chat: ChatProviderConfig,
  mode: ToolMode,
  webContext: string | undefined,
  locale: Locale,
  options: {
    reasoningEffort: "low" | "medium" | "high" | null;
    conversationId?: string;
    userId?: string;
    signal?: AbortSignal;
  }
): AsyncGenerator<string> {
  const { baseUrl, model, apiKey, isXai } = chat;
  let system = systemPromptForMode(mode, locale);
  if (webContext) {
    system +=
      locale === "en"
        ? `\n\n[Web search results]\n${webContext}`
        : `\n\n[Вэб хайлтын үр дүн]\n${webContext}`;
  }

  const shaped = shapeChatCompletionRequest({
    model,
    system,
    messages,
    isXai,
    conversationId: options.conversationId,
    userId: options.userId,
    reasoningEffort: options.reasoningEffort,
  });
  const headers = { ...shaped.headers };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(shaped.body),
    signal: options.signal,
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
  let usage: StreamUsage | null = null;

  try {
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
        if (data === "[DONE]") continue;
        try {
          const json = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>;
            usage?: unknown;
          };
          const parsed = parseUsage(json.usage);
          if (parsed) usage = parsed;
          const token = json.choices?.[0]?.delta?.content;
          // Never surface em/en dashes in assistant UI copy.
          if (token) yield token.replace(/\u2014/g, ",").replace(/\u2013/g, "-");
        } catch {
          // skip
        }
      }
    }
  } finally {
    if (usage) {
      void recordTokenUsage({
        userId: options.userId || null,
        model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        reasoningTokens: usage.reasoningTokens,
        cachedTokens: usage.cachedTokens,
        totalTokens: usage.totalTokens,
        estimatedCostUsd: estimateCostUsd(usage),
      });
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
  const locale: Locale = isLocale(body.locale) ? body.locale : "mn";
  const attachments = body.attachments || [];
  const webContext = body.webContext?.trim();
  const conversationId = body.conversationId?.trim() || undefined;

  const rawMessages = (body.messages || []).filter(
    (m) =>
      m &&
      (m.role === "user" || m.role === "assistant" || m.role === "system") &&
      (typeof m.content === "string" || Array.isArray(m.content))
  );

  if (!rawMessages.length && !attachments.length) {
    return Response.json({ error: "Мессеж хоосон байна." }, { status: 400 });
  }

  const quota = await assertCanSendMessage();
  if (!quota.ok) {
    return Response.json(
      {
        error: locale === "en" ? quota.block.errorEn : quota.block.error,
        code: quota.block.code,
        usage: quota.block.usage,
        ...(quota.block.upgradePath
          ? { upgradePath: quota.block.upgradePath }
          : {}),
      },
      { status: quota.block.status }
    );
  }

  await trackMessageForUser(quota.subject.user.id);

  const plan = planForTier(quota.subject.usage.tier);

  // Inject attachments into the last user message
  const messages: IncomingMessage[] = rawMessages.map((m, idx) => {
    const isLastUser =
      m.role === "user" &&
      idx === rawMessages.map((x) => x.role).lastIndexOf("user");
    if (!isLastUser || !attachments.length) return m;
    const text = typeof m.content === "string" ? m.content : lastUserText([m]);
    return { role: "user", content: buildUserContent(text, attachments, locale) };
  });

  if (!messages.length) {
    messages.push({
      role: "user",
      content: buildUserContent("", attachments, locale),
    });
  }

  const prompt = lastUserText(messages);
  const chat = resolveChatProvider({ modelOverride: plan.chatModel });

  try {
    if (chat.configured) {
      const stream = encoderStream(
        streamChatCompletion(messages, chat, mode, webContext, locale, {
          reasoningEffort: plan.reasoningEffort,
          conversationId,
          userId: quota.subject.user.id,
          signal: request.signal,
        })
      );
      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Genghis-Mode": chat.modeHeader,
          "X-Genghis-Provider": chat.provider,
          "X-Genghis-Model": chat.model,
          "X-Genghis-Plan": plan.tier,
        },
      });
    }

    const stream = encoderStream(streamMockReply(prompt, request.signal));
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Genghis-Mode": "mock",
        "X-Genghis-Plan": plan.tier,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Тодорхойгүй алдаа гарлаа.";
    if (chat.configured) {
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
          "X-Genghis-Plan": plan.tier,
        },
      });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
