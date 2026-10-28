"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { HomeHero } from "@/components/chat/home-hero";
import { MessageList } from "@/components/chat/message-list";
import { ThemeToggle } from "@/components/chat/theme-toggle";
import { createId } from "@/lib/id";
import { TOOL_LABELS } from "@/lib/tools";
import type {
  ChatAttachment,
  ChatMessage,
  ChatSession,
  ThinkingTrace,
  ToolMode,
} from "@/lib/types";

const STORAGE_KEY = "genghis-ai-sessions-v3";
const BOOTSTRAP_SESSION_ID = "chat_bootstrap";

function titleFromPrompt(prompt: string, mode: ToolMode): string {
  const clean = prompt.replace(/\s+/g, " ").trim();
  if (!clean) return mode === "chat" ? "Шинэ чат" : TOOL_LABELS[mode];
  return clean.length > 42 ? `${clean.slice(0, 42)}…` : clean;
}

function createSession(partial?: Partial<ChatSession>): ChatSession {
  return {
    id: createId("chat"),
    title: "Шинэ чат",
    messages: [],
    updatedAt: Date.now(),
    ...partial,
  };
}

const BOOTSTRAP_SESSION: ChatSession = {
  id: BOOTSTRAP_SESSION_ID,
  title: "Шинэ чат",
  messages: [],
  updatedAt: 0,
};

type SubmitMeta = { mode: ToolMode; attachments: ChatAttachment[] };

export function ChatApp() {
  const [sessions, setSessions] = useState<ChatSession[]>([BOOTSTRAP_SESSION]);
  const [activeId, setActiveId] = useState(BOOTSTRAP_SESSION_ID);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<ToolMode>("chat");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const loadingRef = useRef(false);
  const activeIdRef = useRef(activeId);
  const sessionsRef = useRef(sessions);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    loadingRef.current = false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          sessions?: ChatSession[];
          activeId?: string;
        };
        if (parsed.sessions?.length) {
          setSessions(parsed.sessions);
          setActiveId(
            parsed.activeId &&
              parsed.sessions.some((s) => s.id === parsed.activeId)
              ? parsed.activeId
              : parsed.sessions[0].id
          );
          setHydrated(true);
          return;
        }
      }
    } catch {
      // ignore
    }
    const fresh = createSession();
    setSessions([fresh]);
    setActiveId(fresh.id);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ sessions, activeId })
    );
  }, [sessions, activeId, hydrated]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? sessions[0],
    [sessions, activeId]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    loadingRef.current = false;
    setIsLoading(false);
    setStreamingId(null);
  }, []);

  const handleThinkingCommit = useCallback(
    (messageId: string, thinking: ThinkingTrace) => {
      setSessions((prev) =>
        prev.map((s) => ({
          ...s,
          messages: s.messages.map((m) =>
            m.id === messageId ? { ...m, thinking } : m
          ),
        }))
      );
    },
    []
  );

  const sendMessage = useCallback(
    async (raw: string, meta?: SubmitMeta) => {
      const content = raw.trim();
      const activeMode = meta?.mode || mode;
      const activeAttachments = meta?.attachments ?? attachments;
      if (
        (!content && activeAttachments.length === 0) ||
        loadingRef.current ||
        !hydrated
      ) {
        return;
      }

      const currentId = activeIdRef.current;
      if (!currentId || currentId === BOOTSTRAP_SESSION_ID) return;
      const current =
        sessionsRef.current.find((s) => s.id === currentId) ??
        sessionsRef.current[0];
      if (!current || current.id === BOOTSTRAP_SESSION_ID) return;

      setError(null);
      setInput("");
      setAttachments([]);
      setMode("chat");

      const userMessage: ChatMessage = {
        id: createId("msg"),
        role: "user",
        content:
          content ||
          (activeAttachments.length ? "Хавсралтыг үзэж өгнө үү." : ""),
        attachments: activeAttachments.length ? activeAttachments : undefined,
        tool: activeMode,
      };
      const assistantId = createId("msg");
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        tool: activeMode,
      };

      const nextMessages = [
        ...current.messages,
        userMessage,
        assistantMessage,
      ];

      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentId
            ? {
                ...s,
                title:
                  s.messages.length === 0
                    ? titleFromPrompt(userMessage.content, activeMode)
                    : s.title,
                messages: nextMessages,
                updatedAt: Date.now(),
              }
            : s
        )
      );

      loadingRef.current = true;
      setIsLoading(true);
      setStreamingId(assistantId);

      const controller = new AbortController();
      abortRef.current = controller;

      const patchAssistant = (patch: Partial<ChatMessage>) => {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === currentId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === assistantId ? { ...m, ...patch } : m
                  ),
                  updatedAt: Date.now(),
                }
              : s
          )
        );
      };

      try {
        if (activeMode === "image") {
          const response = await fetch("/api/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: userMessage.content }),
            signal: controller.signal,
          });
          const data = (await response.json().catch(() => null)) as {
            imageUrl?: string;
            error?: string;
            model?: string;
          } | null;
          if (!response.ok || !data?.imageUrl) {
            throw new Error(
              data?.error ||
                "Зураг үүсгэж чадсангүй. Энэ API түлхүүр/загвар зураг дэмжихгүй байж болно."
            );
          }
          patchAssistant({
            content: `Зураг амжилттай үүслээ${data.model ? ` (${data.model})` : ""}.`,
            imageUrl: data.imageUrl,
          });
          return;
        }

        let webContext: string | undefined;
        if (activeMode === "web" || activeMode === "research") {
          try {
            const searchRes = await fetch("/api/search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query: userMessage.content }),
              signal: controller.signal,
            });
            const searchData = (await searchRes.json()) as {
              hits?: Array<{ title: string; url: string; snippet: string }>;
              notice?: string;
            };
            if (searchData.hits?.length) {
              webContext = searchData.hits
                .map(
                  (h, i) =>
                    `${i + 1}. ${h.title}\n${h.snippet}${h.url ? `\n${h.url}` : ""}`
                )
                .join("\n\n");
            } else if (searchData.notice) {
              webContext = searchData.notice;
            }
          } catch {
            webContext =
              "Вэб хайлт түр ажилласангүй. Дотоод мэдлэгээр судалгааны бүтэцтэй хариул.";
          }
        }

        const history = nextMessages
          .filter((m) => m.id !== assistantId)
          .map(({ role, content: c }) => ({ role, content: c }));

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            mode: activeMode,
            attachments: activeAttachments.map((a) => ({
              name: a.name,
              mime: a.mime,
              kind: a.kind,
              dataUrl: a.dataUrl,
              text: a.text,
            })),
            webContext,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(data?.error || `Алдаа (${response.status})`);
        }

        if (!response.body) {
          throw new Error("Хариу хоосон байна.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assembled = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          assembled += decoder.decode(value, { stream: true });
          patchAssistant({ content: assembled });
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        const message =
          err instanceof Error ? err.message : "Тодорхойгүй алдаа гарлаа.";
        setError(message);
        patchAssistant({
          content:
            message ||
            "Уучлаарай, хариу өгч чадсангүй. Дахин оролдоно уу.",
        });
      } finally {
        loadingRef.current = false;
        setIsLoading(false);
        setStreamingId(null);
        abortRef.current = null;
      }
    },
    [attachments, hydrated, mode]
  );

  const handleTool = useCallback(
    (next: ToolMode) => {
      setMode(next);
      setSidebarOpen(false);
      if (input.trim()) {
        void sendMessage(input, { mode: next, attachments });
      }
    },
    [attachments, input, sendMessage]
  );

  const handleNew = () => {
    stop();
    const session = createSession();
    setSessions((prev) => [session, ...prev]);
    setActiveId(session.id);
    setError(null);
    setInput("");
    setAttachments([]);
    setMode("chat");
  };

  const handleDelete = (id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        const fresh = createSession();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) {
        setActiveId(next[0].id);
      }
      return next;
    });
  };

  const messages = activeSession?.messages ?? [];
  const isHome = messages.length === 0;

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-white dark:bg-zinc-950">
      <ChatSidebar
        sessions={sessions}
        activeId={activeSession?.id ?? ""}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={setActiveId}
        onNew={handleNew}
        onDelete={handleDelete}
        onTool={handleTool}
      />

      <div className="relative flex min-w-0 flex-1 flex-col bg-white dark:bg-zinc-950">
        <button
          type="button"
          className="absolute top-3 left-3 z-20 inline-flex size-10 items-center justify-center rounded-full bg-white/95 text-ink shadow dark:bg-zinc-900 dark:text-zinc-100 md:hidden"
          onClick={() => setSidebarOpen(true)}
          aria-label="Цэс нээх"
        >
          <Menu className="size-5" />
        </button>

        {isHome ? (
          <HomeHero
            input={input}
            onChange={setInput}
            onSubmit={(text, meta) => void sendMessage(text, meta)}
            onStop={stop}
            isLoading={isLoading}
            disabled={!hydrated}
            mode={mode}
            onModeChange={setMode}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            onTool={handleTool}
          />
        ) : (
          <>
            <header className="relative flex items-center justify-center border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="truncate text-sm font-medium text-ink dark:text-zinc-100">
                {activeSession?.title || "Шинэ чат"}
              </p>
              <div className="absolute top-1/2 right-3 hidden -translate-y-1/2 sm:block [&_button]:text-ink [&_div]:border-zinc-200 [&_div]:bg-zinc-100 dark:[&_button]:text-zinc-100 dark:[&_div]:border-zinc-700 dark:[&_div]:bg-zinc-900">
                <ThemeToggle />
              </div>
            </header>
            <MessageList
              messages={messages}
              streamingId={streamingId}
              isLoading={isLoading}
              onThinkingCommit={handleThinkingCommit}
            />
            {error ? (
              <div className="mx-auto w-full max-w-2xl px-4 pb-2">
                <div
                  role="alert"
                  className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                  <button
                    type="button"
                    className="ml-2 underline"
                    onClick={() => setError(null)}
                  >
                    Хаах
                  </button>
                </div>
              </div>
            ) : null}
            <div className="border-t border-zinc-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950 md:px-6 md:py-4">
              <div className="mx-auto max-w-2xl">
                <ChatComposer
                  value={input}
                  onChange={setInput}
                  onSubmit={(text, meta) => void sendMessage(text, meta)}
                  onStop={stop}
                  isLoading={isLoading}
                  disabled={!hydrated}
                  variant="chat"
                  mode={mode}
                  onModeChange={setMode}
                  attachments={attachments}
                  onAttachmentsChange={setAttachments}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
