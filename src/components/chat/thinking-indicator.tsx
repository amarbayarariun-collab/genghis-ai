"use client";

import { cn } from "@/lib/utils";

type ThinkingIndicatorProps = {
  className?: string;
  /** Show MN label next to logo + balls */
  showLabel?: boolean;
};

/** Knot logo + 3 orbiting balls together while waiting for the reply. */
export function ThinkingIndicator({
  className,
  showLabel = true,
}: ThinkingIndicatorProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 py-1 text-ink/60 dark:text-zinc-400",
        className
      )}
      aria-live="polite"
      aria-label="Бодож байна"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/genghis-knot.png"
        alt=""
        width={28}
        height={28}
        className="size-7 shrink-0 rounded-full bg-white object-contain shadow-sm ring-1 ring-zinc-200 dark:hidden"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/genghis-knot-dark.png"
        alt=""
        width={28}
        height={28}
        className="hidden size-7 shrink-0 rounded-full bg-zinc-900 object-contain shadow-sm ring-1 ring-zinc-700 dark:block"
      />
      <span className="thinking-orbit" aria-hidden>
        <span className="thinking-orbit-ball" />
        <span className="thinking-orbit-ball" />
        <span className="thinking-orbit-ball" />
      </span>
      {showLabel ? (
        <span className="text-[14px] tracking-wide">Бодож байна…</span>
      ) : null}
    </div>
  );
}
