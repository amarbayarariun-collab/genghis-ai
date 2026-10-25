"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { HomeHero } from "@/components/chat/home-hero";
import { MessageList } from "@/components/chat/message-list";
import { createId } from "@/lib/id";
import type { ChatMessage, ChatSession } from "@/lib/types";

const STORAGE_KEY = "genghis-ai-sessions-v2";
const BOOTSTRAP_SESSION_ID = "chat_bootstrap";

function titleFromPrompt(prompt: string): string {
  const clean = prompt.replace(/\s+/g, " ").trim();
  if (!clean) return "Шинэ чат";
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

export function ChatApp() {
  const [sessions, setSessions] = useState<ChatSession[]>([BOOTSTRAP_SESSION]);
  const [activeId, setActiveId] = useState(BOOTSTRAP_SESSION_ID);
  const [input, setInput] = useState("");
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

  const sendMessage = useCallback(
    async (raw: string) => {
      const content = raw.trim();
      if (!content || loadingRef.current || !hydrated) return;

      const currentId = activeIdRef.current;
      if (!currentId || currentId === BOOTSTRAP_SESSION_ID) return;
      const current =
        sessionsRef.current.find((s) => s.id === currentId) ??
        sessionsRef.current[0];
      if (!current || current.id === BOOTSTRAP_SESSION_ID) return;

      setError(null);
      setInput("");

      const userMessage: ChatMessage = {
        id: createId("msg"),
        role: "user",
        content,
      };
      const assistantId = createId("msg");
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
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
                    ? titleFromPrompt(content)
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

      try {
        const payload = nextMessages
          .filter((m) => m.id !== assistantId)
          .map(({ role, content: c }) => ({ role, content: c }));

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: payload }),
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
          const snapshot = assembled;
          setSessions((prev) =>
            prev.map((s) =>
              s.id === currentId
                ? {
                    ...s,
                    messages: s.messages.map((m) =>
                      m.id === assistantId ? { ...m, content: snapshot } : m
                    ),
                    updatedAt: Date.now(),
                  }
                : s
            )
          );
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        const message =
          err instanceof Error ? err.message : "Тодорхойгүй алдаа гарлаа.";
        setError(message);
        setSessions((prev) =>
          prev.map((s) =>
            s.id === currentId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          content:
                            m.content ||
                            "Уучлаарай, хариу өгч чадсангүй. Дахин оролдоно уу.",
                        }
                      : m
                  ),
                }
              : s
          )
        );
      } finally {
        loadingRef.current = false;
        setIsLoading(false);
        setStreamingId(null);
        abortRef.current = null;
      }
    },
    [hydrated]
  );

  const handleNew = () => {
    stop();
    const session = createSession();
    setSessions((prev) => [session, ...prev]);
    setActiveId(session.id);
    setError(null);
    setInput("");
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
    <div className="flex h-dvh min-h-0 overflow-hidden bg-cream">
      <ChatSidebar
        sessions={sessions}
        activeId={activeSession?.id ?? ""}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={setActiveId}
        onNew={handleNew}
        onDelete={handleDelete}
        onToolPrefill={setInput}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <button
          type="button"
          className="absolute top-3 left-3 z-20 inline-flex size-10 items-center justify-center rounded-full bg-cream/90 text-ink shadow md:hidden"
          onClick={() => setSidebarOpen(true)}
          aria-label="Цэс нээх"
        >
          <Menu className="size-5" />
        </button>

        {isHome ? (
          <HomeHero
            input={input}
            onChange={setInput}
            onSubmit={(text) => void sendMessage(text)}
            onStop={stop}
            isLoading={isLoading}
            disabled={!hydrated}
            onPrefill={setInput}
          />
        ) : (
          <>
            <header className="flex items-center justify-center border-b border-taupe/70 bg-cream px-4 py-3">
              <p className="truncate text-sm font-medium text-ink">
                {activeSession?.title || "Шинэ чат"}
              </p>
            </header>
            <MessageList
              messages={messages}
              streamingId={streamingId}
              isLoading={isLoading}
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
            <div className="border-t border-taupe/50 bg-cream px-3 py-3 md:px-6 md:py-4">
              <div className="mx-auto max-w-2xl">
                <ChatComposer
                  value={input}
                  onChange={setInput}
                  onSubmit={(text) => void sendMessage(text)}
                  onStop={stop}
                  isLoading={isLoading}
                  disabled={!hydrated}
                  variant="chat"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
