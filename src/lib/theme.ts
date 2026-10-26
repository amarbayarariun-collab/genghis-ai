export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "genghis:theme";
export const DEFAULT_THEME: ThemeMode = "light";

export function applyThemeClass(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (mode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  root.dataset.theme = mode;
  root.style.colorScheme = mode;
}

export function readStoredTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "dark" || raw === "light") return raw;
  } catch {
    // ignore
  }
  return DEFAULT_THEME;
}
