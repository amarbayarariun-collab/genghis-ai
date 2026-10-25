"use client";

import { useEffect, useRef } from "react";
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
    <div className="min-h-0 flex-1 overflow-y-auto bg-cream">
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
                  "max-w-[92%] text-[15px] leading-relaxed whitespace-pre-wrap md:max-w-[85%]",
                  isUser
                    ? "rounded-2xl bg-ink px-4 py-2.5 text-cream"
                    : "text-ink"
                )}
              >
                {!isUser ? (
                  <p className="mb-1.5 text-[11px] tracking-wide text-slate">
                    Genghis AI
                  </p>
                ) : null}
                {message.content ||
                  (isStreaming ? (
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
                  ) : null)}
                {isStreaming && message.content ? (
                  <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-gold animate-pulse-soft" />
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
