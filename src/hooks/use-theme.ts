"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  applyThemeClass,
  readStoredTheme,
  type ThemeMode,
} from "@/lib/theme";

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(DEFAULT_THEME);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    applyThemeClass(stored);
    setHydrated(true);
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    applyThemeClass(mode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  return { theme, setTheme, toggleTheme, hydrated };
}
