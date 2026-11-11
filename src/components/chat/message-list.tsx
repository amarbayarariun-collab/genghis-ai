"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy, FileIcon, Pencil, RefreshCw } from "lucide-react";
import { MarkdownMessage } from "@/components/chat/markdown-message";
import { ThinkingIndicator } from "@/components/chat/thinking-indicator";
import { useLocale } from "@/components/locale-provider";
import {
  lastAssistantMessageIndex,
  lastUserMessageIndex,
  messageCopyText,
} from "@/lib/chat-actions";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessageListProps = {
  messages: ChatMessage[];
  streamingId?: string | null;
  isLoading?: boolean;
  onRegenerate?: () => void;
  onEditResend?: (messageId: string, content: string) => void;
};

export function MessageList({
  messages,
  streamingId,
  isLoading,
  onRegenerate,
  onEditResend,
}: MessageListProps) {
  const { t } = useLocale();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const lastUserIdx = lastUserMessageIndex(messages);
  const lastAssistantIdx = lastAssistantMessageIndex(messages);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickToBottomRef.current = dist < 96;
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver(() => {
      if (!stickToBottomRef.current) return;
      endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const behavior = streamingId ? "auto" : "smooth";
    endRef.current?.scrollIntoView({ behavior, block: "end" });
  }, [messages, isLoading, streamingId]);

  useEffect(() => {
    if (isLoading) {
      setEditingId(null);
    }
  }, [isLoading]);

  const copyMessage = async (message: ChatMessage) => {
    const text = messageCopyText(message);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(message.id);
      window.setTimeout(() => {
        setCopiedId((id) => (id === message.id ? null : id));
      }, 1600);
    } catch {
      // ignore clipboard failures
    }
  };

  const startEdit = (message: ChatMessage) => {
    setEditingId(message.id);
    setEditDraft(message.content);
  };

  const submitEdit = () => {
    if (!editingId || !onEditResend) return;
    const next = editDraft.trim();
    if (!next) return;
    onEditResend(editingId, next);
    setEditingId(null);
    setEditDraft("");
  };

  return (
    <div
      ref={scrollerRef}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white dark:bg-zinc-950"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-3 py-6 sm:gap-5 sm:px-4 sm:py-8 md:px-6">
        {messages.map((message, index) => {
          const isUser = message.role === "user";
          const isStreaming = message.id === streamingId;
          const isThinking = isStreaming && !message.content;
          const isStreamingAnswer = isStreaming && Boolean(message.content);
          const showActions = !isStreaming && !isLoading;
          const isLastUser = index === lastUserIdx;
          const isLastAssistant = index === lastAssistantIdx;
          const isEditing = editingId === message.id;

          return (
            <div
              key={message.id}
              className={cn(
                "animate-fade-up flex flex-col",
                isUser ? "items-end" : "items-start"
              )}
              style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}
            >
              <div
                className={cn(
                  "max-w-[min(92%,22rem)] text-[15px] leading-relaxed break-words sm:max-w-[85%]",
                  isUser
                    ? "rounded-2xl bg-ink px-3.5 py-2.5 text-cream dark:bg-zinc-100 dark:text-zinc-900 sm:px-4"
                    : "text-ink dark:text-zinc-100"
                )}
              >
                {!isUser && !isThinking ? (
                  <p className="mb-1.5 text-[11px] tracking-wide text-slate dark:text-gold/90">
                    Genghis AI
                  </p>
                ) : null}

                {message.attachments?.length ? (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {message.attachments.map((att) =>
                      att.kind === "image" && att.dataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={att.id}
                          src={att.dataUrl}
                          alt={att.name}
                          className="max-h-40 max-w-[min(12rem,70vw)] rounded-xl object-cover"
                        />
                      ) : (
                        <span
                          key={att.id}
                          className={cn(
                            "inline-flex max-w-full items-center gap-1.5 rounded-lg px-2 py-1 text-[11px]",
                            isUser
                              ? "bg-white/10"
                              : "bg-zinc-100 text-ink dark:bg-zinc-800 dark:text-zinc-200"
                          )}
                        >
                          <FileIcon className="size-3.5 shrink-0" />
                          <span className="truncate">{att.name}</span>
                        </span>
                      )
                    )}
                  </div>
                ) : null}

                {message.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={message.imageUrl}
                    alt={t("generatedImage")}
                    className="mb-2 max-h-[28rem] w-full rounded-2xl object-contain"
                  />
                ) : null}

                {isEditing ? (
                  <div className="flex w-[min(92vw,20rem)] flex-col gap-2 sm:w-80">
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={3}
                      className="min-h-20 w-full resize-y rounded-xl bg-white/95 px-3 py-2 text-[15px] text-ink outline-none ring-1 ring-gold/50 dark:bg-zinc-900 dark:text-zinc-100"
                      aria-label={t("editMessage")}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center rounded-full bg-gold px-3 text-sm font-medium text-ink"
                        onClick={submitEdit}
                      >
                        {t("resendEdit")}
                      </button>
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center rounded-full px-3 text-sm text-cream/90 underline-offset-2 hover:underline dark:text-zinc-700"
                        onClick={() => {
                          setEditingId(null);
                          setEditDraft("");
                        }}
                      >
                        {t("cancel")}
                      </button>
                    </div>
                  </div>
                ) : isUser ? (
                  <div className="whitespace-pre-wrap break-words">
                    {message.content || null}
                  </div>
                ) : (
                  <>
                    {isThinking ? (
                      <ThinkingIndicator mode={message.tool ?? "chat"} />
                    ) : null}

                    {message.content ? (
                      <div className="relative break-words">
                        <MarkdownMessage content={message.content} />
                        {isStreamingAnswer ? (
                          <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-gold animate-pulse-soft" />
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              {showActions && !isEditing ? (
                <div
                  className={cn(
                    "mt-1.5 flex max-w-full flex-wrap items-center gap-1",
                    isUser ? "justify-end" : "justify-start"
                  )}
                >
                  <ActionButton
                    label={
                      copiedId === message.id
                        ? t("copiedMessage")
                        : t("copyMessage")
                    }
                    onClick={() => void copyMessage(message)}
                    icon={
                      copiedId === message.id ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Copy className="size-3.5" />
                      )
                    }
                  />
                  {isUser && isLastUser && onEditResend ? (
                    <ActionButton
                      label={t("editMessage")}
                      onClick={() => startEdit(message)}
                      icon={<Pencil className="size-3.5" />}
                    />
                  ) : null}
                  {!isUser && isLastAssistant && onRegenerate ? (
                    <ActionButton
                      label={t("regenerate")}
                      onClick={onRegenerate}
                      icon={<RefreshCw className="size-3.5" />}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
        <div ref={endRef} className="h-px w-full shrink-0" aria-hidden />
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2.5 text-[12px] text-ink/55 transition-colors hover:bg-zinc-100 hover:text-ink dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 sm:min-h-9"
    >
      {icon}
      <span className="max-w-[9rem] truncate">{label}</span>
    </button>
  );
}
