"use client";

import { useLocale } from "@/components/locale-provider";
import { cn } from "@/lib/utils";

export function LocaleToggle({ className }: { className?: string }) {
  const { locale, setLocale, t, hydrated } = useLocale();

  if (!hydrated) {
    return (
      <span
        className={cn(
          "inline-flex h-9 items-center rounded-full border border-white/30 bg-ink/40 px-2 text-xs text-white/70 backdrop-blur-md",
          className
        )}
      >
        …
      </span>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-white/30 bg-ink/45 p-0.5 backdrop-blur-md",
        className
      )}
      role="group"
      aria-label={t("localeGroup")}
    >
      <button
        type="button"
        onClick={() => setLocale("mn")}
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-1.5 text-xs font-medium transition",
          locale === "mn"
            ? "bg-white text-ink shadow-sm"
            : "text-white/85 hover:bg-white/10"
        )}
        aria-pressed={locale === "mn"}
      >
        {t("localeMn")}
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-1.5 text-xs font-medium transition",
          locale === "en"
            ? "bg-white text-ink shadow-sm"
            : "text-white/85 hover:bg-white/10"
        )}
        aria-pressed={locale === "en"}
      >
        {t("localeEn")}
      </button>
    </div>
  );
}
