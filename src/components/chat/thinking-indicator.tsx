"use client";

import { cn } from "@/lib/utils";

type ThinkingIndicatorProps = {
  /** Waiting for first token */
  phase: "contemplating" | "streaming";
  className?: string;
};

/** ChatGPT-style contemplating: 3 orbiting balls, then knot logo when streaming. */
export function ThinkingIndicator({
  phase,
  className,
}: ThinkingIndicatorProps) {
  if (phase === "streaming") {
    return (
      <div
        className={cn(
          "mb-2 flex items-center gap-2.5 text-ink/55 dark:text-zinc-400",
          className
        )}
        aria-live="polite"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/genghis-knot.png"
          alt=""
          width={28}
          height={28}
          className="size-7 rounded-full bg-white object-contain shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700"
        />
        <span className="text-[13px] tracking-wide">Genghis AI</span>
        <span
          className="size-2 rounded-full bg-gold animate-pulse-soft"
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 py-1 text-ink/60 dark:text-zinc-400",
        className
      )}
      aria-live="polite"
      aria-label="Бодож байна"
    >
      <span className="thinking-orbit" aria-hidden>
        <span className="thinking-orbit-ball" />
        <span className="thinking-orbit-ball" />
        <span className="thinking-orbit-ball" />
      </span>
      <span className="text-[14px] tracking-wide">Бодож байна…</span>
    </div>
  );
}
