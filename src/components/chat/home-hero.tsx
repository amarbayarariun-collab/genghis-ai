"use client";

import {
  Code2,
  FileText,
  ImageIcon,
  MessageSquare,
  Search,
  Sparkles,
} from "lucide-react";
import { ChatComposer } from "@/components/chat/chat-composer";
import type { ChatAttachment, ToolMode } from "@/lib/types";

type HomeHeroProps = {
  input: string;
  onChange: (value: string) => void;
  onSubmit: (
    text: string,
    meta?: { mode: ToolMode; attachments: ChatAttachment[] }
  ) => void;
  isLoading?: boolean;
  disabled?: boolean;
  onStop?: () => void;
  mode: ToolMode;
  onModeChange: (mode: ToolMode) => void;
  attachments: ChatAttachment[];
  onAttachmentsChange: (next: ChatAttachment[]) => void;
  onTool: (mode: ToolMode) => void;
};

const QUICK_PILLS: Array<{
  label: string;
  icon: typeof Search;
  mode: ToolMode;
}> = [
  { label: "Гүнзгий судалгаа", icon: Search, mode: "research" },
  { label: "Зураг үүсгэх", icon: ImageIcon, mode: "image" },
  { label: "Баримт бичиг", icon: FileText, mode: "document" },
  { label: "Код боловсруулах", icon: Code2, mode: "code" },
  { label: "Вэб хайлт", icon: Sparkles, mode: "web" },
];

const FEATURES: Array<{
  title: string;
  desc: string;
  icon: typeof Search;
  mode: ToolMode;
  autoSend?: string;
}> = [
  {
    title: "Ухаалаг чат",
    desc: "Асуулт, хариулт, зөвлөгөө",
    icon: MessageSquare,
    mode: "chat",
    autoSend: "Сайн уу",
  },
  {
    title: "Зураг үүсгэх",
    desc: "Санаагаа зургаар амьдруулах",
    icon: ImageIcon,
    mode: "image",
  },
  {
    title: "Баримт бичиг",
    desc: "Дүгнэлт, тайлан, и-мэйл, орчуулга",
    icon: FileText,
    mode: "document",
  },
  {
    title: "Код боловсруулах",
    desc: "Програмчлал, тайлбарлах",
    icon: Code2,
    mode: "code",
  },
];

export function HomeHero({
  input,
  onChange,
  onSubmit,
  isLoading,
  disabled,
  onStop,
  mode,
  onModeChange,
  attachments,
  onAttachmentsChange,
  onTool,
}: HomeHeroProps) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="absolute inset-0 overflow-hidden" aria-hidden>
        {/* Single live-photo scene — continuous motion, no image swapping */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/hero-live.webp"
          alt=""
          decoding="async"
          fetchPriority="high"
          className="hero-live-photo absolute inset-0 h-full w-full max-w-none object-cover object-[48%_40%]"
        />
        {/* Same frame, slight parallax depth (not a second photo) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/hero-live.webp"
          alt=""
          decoding="async"
          aria-hidden
          className="hero-live-parallax pointer-events-none absolute inset-0 h-full w-full max-w-none object-cover object-[48%_40%] opacity-35 mix-blend-soft-light"
        />
        <div className="hero-clouds pointer-events-none absolute inset-0" />
        <div className="hero-sky-drift pointer-events-none absolute inset-0" />
        <div className="hero-light pointer-events-none absolute inset-0" />
        <div className="hero-scrim absolute inset-0" />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col items-center justify-center px-4 pt-10 pb-4 md:px-8 md:pt-6">
          <div className="animate-fade-up mx-auto w-full max-w-3xl text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-white drop-shadow-sm sm:text-4xl md:text-5xl">
              Мэдэх. Бүтээх. Хийх.
            </h1>
            <p className="mt-3 text-base text-white/90 sm:text-lg md:text-xl">
              Genghis AI — Монголоос дэлхийтэй холбогд.
            </p>
          </div>

          <div
            className="animate-fade-up mx-auto mt-8 w-full max-w-2xl"
            style={{ animationDelay: "80ms" }}
          >
            <ChatComposer
              value={input}
              onChange={onChange}
              onSubmit={onSubmit}
              onStop={onStop}
              isLoading={isLoading}
              disabled={disabled}
              variant="hero"
              mode={mode}
              onModeChange={onModeChange}
              attachments={attachments}
              onAttachmentsChange={onAttachmentsChange}
            />
          </div>

          <div
            className="animate-fade-up mt-4 flex max-w-3xl flex-wrap items-center justify-center gap-2"
            style={{ animationDelay: "140ms" }}
          >
            {QUICK_PILLS.map((pill) => (
              <button
                key={pill.label}
                type="button"
                onClick={() => onTool(pill.mode)}
                className={
                  mode === pill.mode
                    ? "inline-flex items-center gap-1.5 rounded-full border border-gold/60 bg-gold/25 px-3 py-1.5 text-xs text-white backdrop-blur-md transition sm:text-[13px]"
                    : "inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-ink/35 px-3 py-1.5 text-xs text-white backdrop-blur-md transition hover:bg-ink/50 sm:text-[13px]"
                }
              >
                <pill.icon className="size-3.5 opacity-90" />
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative z-10 px-4 pb-5 md:px-8 md:pb-7">
          <div className="mx-auto grid w-full max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature, i) => (
              <button
                key={feature.title}
                type="button"
                onClick={() => {
                  if (feature.autoSend) {
                    onSubmit(feature.autoSend, {
                      mode: feature.mode,
                      attachments: [],
                    });
                  } else {
                    onTool(feature.mode);
                  }
                }}
                className="animate-fade-up rounded-2xl border border-white/40 bg-cream/95 p-4 text-left shadow-[0_12px_40px_-24px_rgb(11_13_15/0.55)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-cream"
                style={{ animationDelay: `${180 + i * 40}ms` }}
              >
                <feature.icon className="size-5 text-slate" />
                <p className="mt-3 text-sm font-semibold text-ink">
                  {feature.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink/55">
                  {feature.desc}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
