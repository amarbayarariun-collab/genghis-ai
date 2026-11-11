"use client";

import { useEffect, useState } from "react";
import {
  STARTER_PROMPTS,
  STARTER_PROMPT_SUBSET_SIZE,
  pickStarterPrompts,
  type StarterPrompt,
} from "@/lib/starter-prompts";
import { cn } from "@/lib/utils";

type StarterPromptCardsProps = {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
  className?: string;
  /** Injected prompts for tests; defaults to a shuffled subset after mount. */
  prompts?: readonly StarterPrompt[];
};

/**
 * ChatGPT-style empty-chat starter cards.
 * Tap fills the composer only — never auto-sends.
 *
 * SSR uses a stable subset; shuffle runs after mount to avoid hydration mismatch.
 */
export function StarterPromptCards({
  onSelect,
  disabled,
  className,
  prompts: promptsProp,
}: StarterPromptCardsProps) {
  const [prompts, setPrompts] = useState<readonly StarterPrompt[]>(
    () =>
      promptsProp ??
      STARTER_PROMPTS.slice(0, STARTER_PROMPT_SUBSET_SIZE)
  );

  useEffect(() => {
    if (promptsProp) {
      setPrompts(promptsProp);
      return;
    }
    setPrompts(pickStarterPrompts());
  }, [promptsProp]);

  if (prompts.length === 0) return null;

  return (
    <div
      className={cn(
        "mx-auto grid w-full max-w-2xl grid-cols-2 gap-2 min-[360px]:gap-2.5",
        className
      )}
      role="list"
      aria-label="Жишээ асуултууд"
    >
      {prompts.map((item) => (
        <button
          key={item.id}
          type="button"
          role="listitem"
          disabled={disabled}
          onClick={() => onSelect(item.prompt)}
          className={cn(
            "flex min-h-11 flex-col items-start gap-0.5 rounded-2xl border border-white/25 bg-ink/40 px-2.5 py-2 text-left backdrop-blur-md transition sm:min-h-[4.25rem] sm:gap-1 sm:px-3 sm:py-2.5",
            "hover:border-gold/50 hover:bg-ink/55",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70",
            "disabled:pointer-events-none disabled:opacity-55",
            "active:scale-[0.99]"
          )}
        >
          <span className="text-[11px] font-semibold tracking-wide text-gold sm:text-xs">
            {item.title}
          </span>
          <span className="line-clamp-2 text-[11px] leading-snug text-white/85 sm:line-clamp-3 sm:text-[12px]">
            {item.prompt}
          </span>
        </button>
      ))}
    </div>
  );
}
