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
import { useLocale } from "@/components/locale-provider";
import { useWallpaper } from "@/hooks/use-wallpaper";
import { greetingForNow } from "@/lib/greeting";
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

        <div className="flex flex-1 flex-col items-center justify-center px-4 pt-10 pb-4 md:px-8 md:pt-6">
          <div className="animate-fade-up mx-auto w-full max-w-3xl text-center">
            <h1 className="text-5xl font-semibold tracking-tight text-white drop-shadow-sm sm:text-6xl md:text-7xl">
              {greeting || (
                <span className="invisible" aria-hidden>
                  {t("greetingAfternoon")}
                </span>
              )}
            </h1>
            <p className="mt-3 text-sm text-white/75 sm:text-base">
              {t("tagline")}
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
            {quickPills.map((pill) => (
              <button
                key={pill.mode}
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
