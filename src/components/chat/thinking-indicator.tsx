"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  formatThinkingDuration,
  stepIndexForElapsed,
  thinkingStepsForMode,
} from "@/lib/thinking-steps";
import type { ThinkingStep, ThinkingTrace, ToolMode } from "@/lib/types";
import { cn } from "@/lib/utils";

const thinkingCache = new Map<string, ThinkingTrace>();

type ThinkingIndicatorProps = {
  className?: string;
  messageId: string;
  mode?: ToolMode;
  /** True while waiting for the first answer tokens. */
  running?: boolean;
  /** Persisted trace after the answer finishes. */
  trace?: ThinkingTrace | null;
  onCommit?: (trace: ThinkingTrace) => void;
};

function CoralDots({ active }: { active?: boolean }) {
  return (
    <span
      className={cn("thinking-coral-dots", active && "is-active")}
      aria-hidden
    >
      <span />
      <span />
      <span />
    </span>
  );
}

type RowProps = {
  className?: string;
  summary: string;
  durationLabel: string;
  running: boolean;
  open: boolean;
  onToggle: () => void;
  steps: ThinkingStep[];
  activeIndex: number;
};

function ThinkingRow({
  className,
  summary,
  durationLabel,
  running,
  open,
  onToggle,
  steps,
  activeIndex,
}: RowProps) {
  return (
    <div
      className={cn("thinking-steps", className)}
      aria-live="polite"
      aria-label={running ? "Бодож байна" : "Бодсон алхмууд"}
    >
      <button
        type="button"
        className="thinking-steps-toggle"
        aria-expanded={open}
        onClick={onToggle}
      >
        <CoralDots active={running} />
        <span className="thinking-steps-summary">{summary}</span>
        <span className="thinking-steps-duration">{durationLabel}</span>
        <ChevronRight
          className={cn(
            "thinking-steps-caret size-3.5 shrink-0",
            open && "is-open"
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="thinking-steps-panel">
          <ul className="thinking-steps-list">
            {steps.map((step, i) => {
              const isCurrent = i === activeIndex && running;
              return (
                <li
                  key={`${step.summary}-${i}`}
                  className={cn(
                    "thinking-steps-item",
                    isCurrent && "is-current"
                  )}
                >
                  <p className="thinking-steps-item-title">{step.summary}</p>
                  <p className="thinking-steps-item-detail">{step.detail}</p>
                </li>
              );
            })}
          </ul>
          {running ? (
            <p className="thinking-steps-live">Бодож байна…</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function LiveThinking({
  className,
  messageId,
  mode,
  onCommit,
}: {
  className?: string;
  messageId: string;
  mode: ToolMode;
  onCommit?: (trace: ThinkingTrace) => void;
}) {
  const catalog = useMemo(() => thinkingStepsForMode(mode), [mode]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [open, setOpen] = useState(true);
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 200);
    return () => {
      window.clearInterval(id);
      const elapsed = Date.now() - start;
      const idx = stepIndexForElapsed(elapsed, catalog.length);
      const steps = catalog.slice(0, idx + 1);
      const next: ThinkingTrace = {
        steps,
        activeIndex: steps.length - 1,
        durationSec: Math.max(1, Math.round(elapsed / 1000)),
        startedAt: start,
      };
      thinkingCache.set(messageId, next);
      onCommitRef.current?.(next);
    };
  }, [catalog, messageId]);

  const idx = stepIndexForElapsed(elapsedMs, catalog.length);
  const steps = catalog.slice(0, idx + 1);
  const summary = steps[idx]?.summary || "Бодож байна…";
  const durationSec = elapsedMs / 1000;

  return (
    <ThinkingRow
      className={className}
      summary={summary}
      durationLabel={formatThinkingDuration(durationSec)}
      running
      open={open}
      onToggle={() => setOpen((v) => !v)}
      steps={steps}
      activeIndex={idx}
    />
  );
}

function SettledThinking({
  className,
  trace,
}: {
  className?: string;
  trace: ThinkingTrace;
}) {
  const [open, setOpen] = useState(false);
  const summary =
    trace.steps[Math.min(trace.activeIndex, trace.steps.length - 1)]
      ?.summary || "Бодож дууслаа";

  return (
    <ThinkingRow
      className={className}
      summary={summary}
      durationLabel={formatThinkingDuration(trace.durationSec)}
      running={false}
      open={open}
      onToggle={() => setOpen((v) => !v)}
      steps={trace.steps}
      activeIndex={trace.activeIndex}
    />
  );
}

/**
 * Claude-style expandable thinking row:
 * coral dots + gray summary + duration + caret; expands to step detail.
 * Live while waiting for tokens; collapses to a summarized row afterward.
 */
export function ThinkingIndicator({
  className,
  messageId,
  mode = "chat",
  running = false,
  trace = null,
  onCommit,
}: ThinkingIndicatorProps) {
  const settled = trace ?? thinkingCache.get(messageId) ?? null;

  if (running && !settled) {
    return (
      <LiveThinking
        className={className}
        messageId={messageId}
        mode={mode}
        onCommit={onCommit}
      />
    );
  }

  if (settled) {
    return <SettledThinking className={className} trace={settled} />;
  }

  return (
    <ThinkingRow
      className={className}
      summary="Бодож байна…"
      durationLabel="0s"
      running
      open={false}
      onToggle={() => undefined}
      steps={thinkingStepsForMode(mode).slice(0, 1)}
      activeIndex={0}
    />
  );
}
