"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import {
  formatThinkingDuration,
  stepIndexForElapsed,
  thinkingStepsForMode,
} from "@/lib/thinking-steps";
import type { ToolMode } from "@/lib/types";
import { cn } from "@/lib/utils";

type ThinkingIndicatorProps = {
  className?: string;
  mode?: ToolMode;
};

function CoralDots() {
  return (
    <span className="thinking-coral-dots is-active" aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}

/**
 * Single horizontal thinking row (Claude-style):
 * coral dots + cycling summary + duration + caret.
 */
export function ThinkingIndicator({
  className,
  mode = "chat",
}: ThinkingIndicatorProps) {
  const { locale, t } = useLocale();
  const catalog = useMemo(
    () => thinkingStepsForMode(mode, locale),
    [mode, locale]
  );
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  const idx = stepIndexForElapsed(elapsedMs, catalog.length);
  const summary = catalog[idx]?.summary || t("thinkingFallback");

  return (
    <div
      className={cn("thinking-steps", className)}
      aria-live="polite"
      aria-label={t("thinking")}
    >
      <div className="thinking-steps-row">
        <CoralDots />
        <span key={summary} className="thinking-steps-summary">
          {summary}
        </span>
        <span className="thinking-steps-duration">
          {formatThinkingDuration(elapsedMs / 1000)}
        </span>
        <ChevronRight
          className="thinking-steps-caret size-3.5 shrink-0"
          aria-hidden
        />
      </div>
    </div>
  );
}
