"use client";

import { useMemo } from "react";
import {
  Code2,
  FileText,
  ImageIcon,
  MessageSquare,
  Search,
  Sparkles,
} from "lucide-react";
import { ChatComposer } from "@/components/chat/chat-composer";
import { LiveHeroBackdrop } from "@/components/chat/live-hero-backdrop";
import { LocaleToggle } from "@/components/chat/locale-toggle";
import { ThemeToggle } from "@/components/chat/theme-toggle";
import { WallpaperPickerButton } from "@/components/chat/wallpaper-picker";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { useWallpaper } from "@/hooks/use-wallpaper";
import { greetingForNow } from "@/lib/greeting";
import { examplePrompts } from "@/lib/locale";
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
  const wallpaper = useWallpaper();
  const { locale, t } = useLocale();
  const greeting = useMemo(
    () => greetingForNow(new Date(), locale),
    [locale]
  );
  const prompts = useMemo(() => examplePrompts(locale), [locale]);

  const quickPills = useMemo(
    () =>
      [
        { label: t("toolResearch"), icon: Search, mode: "research" as const },
        { label: t("toolImage"), icon: ImageIcon, mode: "image" as const },
        { label: t("toolDocument"), icon: FileText, mode: "document" as const },
        { label: t("toolCode"), icon: Code2, mode: "code" as const },
        { label: t("toolWeb"), icon: Sparkles, mode: "web" as const },
      ] as const,
    [t]
  );

  const features = useMemo(
    () => [
      {
        title: t("featureChatTitle"),
        desc: t("featureChatDesc"),
        icon: MessageSquare,
        mode: "chat" as const,
        autoSend: t("hiAutoSend"),
      },
      {
        title: t("toolImage"),
        desc: t("featureImageDesc"),
        icon: ImageIcon,
        mode: "image" as const,
      },
      {
        title: t("toolDocument"),
        desc: t("featureDocDesc"),
        icon: FileText,
        mode: "document" as const,
      },
      {
        title: t("toolCode"),
        desc: t("featureCodeDesc"),
        icon: Code2,
        mode: "code" as const,
      },
    ],
    [t]
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <LiveHeroBackdrop
        src={wallpaper.current.src}
        position={wallpaper.current.position}
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-end gap-2 p-3 md:p-4">
          <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
            <LocaleToggle />
            <ThemeToggle />
            <WallpaperPickerButton
              activeId={wallpaper.id}
              customDataUrl={wallpaper.customDataUrl}
              onSelect={wallpaper.setWallpaper}
              onUpload={wallpaper.setCustomWallpaper}
              onClearCustom={wallpaper.clearCustomWallpaper}
            />
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-3 pt-14 pb-3 sm:px-4 sm:pt-10 md:px-8 md:pt-6">
          <div className="animate-fade-up mx-auto w-full max-w-3xl text-center">
            <h1 className="text-[2.1rem] font-semibold leading-tight tracking-tight text-white drop-shadow-sm sm:text-6xl md:text-7xl">
              {greeting || (
                <span className="invisible" aria-hidden>
                  {t("greetingAfternoon")}
                </span>
              )}
            </h1>
            <p className="mt-2 text-sm font-medium text-white/80 sm:mt-3 sm:text-base">
              {t("tagline")}
            </p>
            <p className="mx-auto mt-2 max-w-xl text-[13px] leading-relaxed text-white/65 sm:text-sm">
              {t("valueProp")}
            </p>
            <p className="mx-auto mt-2 max-w-xl text-[12px] leading-relaxed text-white/55 sm:text-[13px]">
              {t("pricingHero")}{" "}
              <Link
                href="/pricing"
                className="underline underline-offset-2 hover:text-white"
              >
                {t("pricingLink")}
              </Link>
            </p>
          </div>

          <div
            className="animate-fade-up mx-auto mt-6 w-full max-w-2xl sm:mt-8"
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
            className="animate-fade-up mt-3 w-full max-w-2xl sm:mt-4"
            style={{ animationDelay: "110ms" }}
          >
            <p className="mb-2 text-center text-[11px] tracking-wide text-white/55 uppercase sm:text-xs">
              {t("tryExamples")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {prompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={disabled || isLoading}
                  onClick={() =>
                    onSubmit(prompt, { mode: "chat", attachments: [] })
                  }
                  className="max-w-full min-h-11 rounded-full border border-white/20 bg-ink/40 px-3 py-2.5 text-left text-[12px] leading-snug text-white/90 backdrop-blur-md transition hover:bg-ink/55 disabled:opacity-60 sm:min-h-0 sm:py-1.5 sm:text-[13px]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div
            className="animate-fade-up mt-3 flex max-w-3xl flex-wrap items-center justify-center gap-2 sm:mt-4"
            style={{ animationDelay: "140ms" }}
          >
            {quickPills.map((pill) => (
              <button
                key={pill.mode}
                type="button"
                onClick={() => onTool(pill.mode)}
                className={
                  mode === pill.mode
                    ? "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-gold/60 bg-gold/25 px-3 py-2 text-xs text-white backdrop-blur-md transition sm:min-h-0 sm:py-1.5 sm:text-[13px]"
                    : "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/25 bg-ink/35 px-3 py-2 text-xs text-white backdrop-blur-md transition hover:bg-ink/50 sm:min-h-0 sm:py-1.5 sm:text-[13px]"
                }
              >
                <pill.icon className="size-3.5 opacity-90" />
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative z-10 px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-4 md:px-8 md:pb-7">
          <div className="mx-auto grid w-full max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, i) => (
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
