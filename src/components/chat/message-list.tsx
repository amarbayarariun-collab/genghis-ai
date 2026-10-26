"use client";

import { useEffect, useRef } from "react";
import { FileIcon } from "lucide-react";
import { MarkdownMessage } from "@/components/chat/markdown-message";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessageListProps = {
  messages: ChatMessage[];
  streamingId?: string | null;
  isLoading?: boolean;
};

export function MessageList({
  messages,
  streamingId,
  isLoading,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-white dark:bg-zinc-950">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8 md:px-6">
        {messages.map((message, index) => {
          const isUser = message.role === "user";
          const isStreaming = message.id === streamingId;
          return (
            <div
              key={message.id}
              className={cn(
                "animate-fade-up flex",
                isUser ? "justify-end" : "justify-start"
              )}
              style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}
            >
              <div
                className={cn(
                  "max-w-[92%] text-[15px] leading-relaxed md:max-w-[85%]",
                  isUser
                    ? "rounded-2xl bg-ink px-4 py-2.5 text-cream dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-ink dark:text-zinc-100"
                )}
              >
                {!isUser ? (
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
                          className="max-h-40 max-w-[12rem] rounded-xl object-cover"
                        />
                      ) : (
                        <span
                          key={att.id}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px]",
                            isUser
                              ? "bg-white/10"
                              : "bg-zinc-100 text-ink dark:bg-zinc-800 dark:text-zinc-200"
                          )}
                        >
                          <FileIcon className="size-3.5" />
                          {att.name}
                        </span>
                      )
                    )}
                  </div>
                ) : null}

                {message.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={message.imageUrl}
                    alt="Үүсгэсэн зураг"
                    className="mb-2 max-h-[28rem] w-full rounded-2xl object-contain"
                  />
                ) : null}

                {isUser ? (
                  <div className="whitespace-pre-wrap">
                    {message.content || null}
                  </div>
                ) : message.content ? (
                  <div className="relative">
                    <MarkdownMessage content={message.content} />
                    {isStreaming ? (
                      <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-gold animate-pulse-soft" />
                    ) : null}
                  </div>
                ) : isStreaming ? (
                  <span className="inline-flex gap-1 py-1">
                    <span className="size-1.5 rounded-full bg-gold animate-pulse-soft" />
                    <span
                      className="size-1.5 rounded-full bg-gold animate-pulse-soft"
                      style={{ animationDelay: "0.2s" }}
                    />
                    <span
                      className="size-1.5 rounded-full bg-gold animate-pulse-soft"
                      style={{ animationDelay: "0.4s" }}
                    />
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}
