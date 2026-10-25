"use client";

import { useEffect, useRef } from "react";
import {
  AudioLines,
  Brain,
  ChevronDown,
  Globe,
  Mic,
  Plus,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string) => void;
  onStop?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  variant?: "hero" | "chat";
};

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  isLoading,
  disabled,
  variant = "chat",
}: ChatComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [value]);

  const submit = () => {
    if (disabled || isLoading) return;
    const text = (ref.current?.value ?? value).trim();
    if (!text) return;
    onSubmit(text);
  };

  const canSend = Boolean(value.trim()) && !disabled;

  return (
    <div
      className={cn(
        "flex w-full items-center gap-1 rounded-full border border-[#E8E4DC] bg-white px-2 py-1.5",
        "shadow-[0_10px_40px_-18px_rgba(11,13,15,0.45)]",
        variant === "hero" && "shadow-[0_14px_48px_-16px_rgba(11,13,15,0.55)]"
      )}
    >
      <button
        type="button"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[#0B0D0F]"
        aria-label="Нэмэх"
        tabIndex={-1}
      >
        <Plus className="size-5 stroke-[2.25]" />
      </button>

      <span
        className="mr-1 h-5 w-px shrink-0 bg-[#D9D3C7]"
        aria-hidden
      />

      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Genghis AI -д асуух зүйлээ бичнэ үү..."
        disabled={disabled}
        rows={1}
        className={cn(
          "max-h-36 min-h-10 flex-1 resize-none bg-transparent py-2.5 text-[15px] outline-none",
          "text-[#0B0D0F] caret-[#0B0D0F]",
          "placeholder:text-[#8A8580] placeholder:opacity-100",
          "disabled:cursor-not-allowed disabled:opacity-60"
        )}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (isLoading) {
              onStop?.();
              return;
            }
            submit();
          }
        }}
      />

      <div className="hidden items-center gap-0.5 sm:flex">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] text-[#5C584F] transition-colors hover:bg-[#F3F0EA] hover:text-[#0B0D0F]"
          aria-label="Think"
          tabIndex={-1}
        >
          <Brain className="size-4 stroke-[1.75]" />
          <span>Think</span>
        </button>

        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-[13px] text-[#5C584F] transition-colors hover:bg-[#F3F0EA] hover:text-[#0B0D0F]"
          aria-label="Вэб хайлт"
          tabIndex={-1}
        >
          <Globe className="size-4 stroke-[1.75]" />
          <span>Вэб хайлт</span>
          <ChevronDown className="size-3.5 opacity-70" />
        </button>
      </div>

      <button
        type="button"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[#0B0D0F]"
        aria-label="Дуу хоолой"
        tabIndex={-1}
      >
        <Mic className="size-[18px] stroke-[1.75]" />
      </button>

      <button
        type="button"
        onClick={() => {
          if (isLoading) {
            onStop?.();
            return;
          }
          submit();
        }}
        disabled={disabled || (!isLoading && !canSend)}
        aria-label={isLoading ? "Зогсоох" : "Илгээх"}
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
          "disabled:pointer-events-none disabled:opacity-45",
          isLoading
            ? "bg-[#0B0D0F] text-white"
            : "bg-[#C9A36B] text-white hover:bg-[#BC956A]"
        )}
      >
        {isLoading ? (
          <Square className="size-3 fill-current" />
        ) : (
          <AudioLines className="size-4 stroke-[2]" />
        )}
      </button>
    </div>
  );
}
