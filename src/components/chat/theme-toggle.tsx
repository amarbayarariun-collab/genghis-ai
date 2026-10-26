"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, hydrated } = useTheme();

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
      aria-label="Гэрэлтүүлэг"
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition",
          theme === "light"
            ? "bg-white text-ink shadow-sm"
            : "text-white/85 hover:bg-white/10"
        )}
        aria-pressed={theme === "light"}
      >
        <Sun className="size-3.5" />
        Гэрэлтэй
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition",
          theme === "dark"
            ? "bg-white text-ink shadow-sm"
            : "text-white/85 hover:bg-white/10"
        )}
        aria-pressed={theme === "dark"}
      >
        <Moon className="size-3.5" />
        Харанхуй
      </button>
    </div>
  );
}
