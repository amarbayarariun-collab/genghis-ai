"use client";

import { useEffect } from "react";
import { applyThemeClass, readStoredTheme } from "@/lib/theme";

/** Applies stored light/dark only. Never follows system prefers-color-scheme. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyThemeClass(readStoredTheme());
  }, []);

  return children;
}
