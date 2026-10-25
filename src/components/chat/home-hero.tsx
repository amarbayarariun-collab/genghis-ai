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

type HomeHeroProps = {
  input: string;
  onChange: (value: string) => void;
  onSubmit: (text: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  onStop?: () => void;
  onPrefill: (text: string) => void;
};

const QUICK_PILLS = [
  { label: "Гүнзгий судалгаа", icon: Search, prefill: "Гүнзгий судалгаа: " },
  { label: "Зураг үүсгэх", icon: ImageIcon, prefill: "Зураг үүсгэ: " },
  { label: "Баримт бичиг", icon: FileText, prefill: "Баримт бичиг: " },
  { label: "Код боловсруулах", icon: Code2, prefill: "Код боловсруул: " },
  { label: "Вэб хайлт", icon: Sparkles, prefill: "Вэб хайлт: " },
] as const;

const FEATURES = [
  {
    title: "Ухаалаг чат",
    desc: "Асуулт, хариулт, зөвлөгөө",
    icon: MessageSquare,
    action: "send" as const,
    text: "Сайн уу",
  },
  {
    title: "Зураг үүсгэх",
    desc: "Санаагаа зургаар амьдруулах",
    icon: ImageIcon,
    action: "prefill" as const,
    text: "Зураг үүсгэ: ",
  },
  {
    title: "Баримт бичиг",
    desc: "Дүгнэлт, тайлан, и-мэйл, орчуулга",
    icon: FileText,
    action: "prefill" as const,
    text: "Баримт бичиг: ",
  },
  {
    title: "Код боловсруулах",
    desc: "Програмчлал, тайлбарлах",
    icon: Code2,
    action: "prefill" as const,
    text: "Код боловсруул: ",
  },
];

export function HomeHero({
  input,
  onChange,
  onSubmit,
  isLoading,
  disabled,
  onStop,
  onPrefill,
}: HomeHeroProps) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Full-bleed mountain hero */}
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/hero-mountains.jpg"
          alt=""
          className="h-full w-full object-cover object-center"
        />
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
                onClick={() => onPrefill(pill.prefill)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-ink/35 px-3 py-1.5 text-xs text-white backdrop-blur-md transition hover:bg-ink/50 sm:text-[13px]"
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
                  if (feature.action === "send") onSubmit(feature.text);
                  else onPrefill(feature.text);
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
