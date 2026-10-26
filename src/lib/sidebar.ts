/** Desktop sidebar width (ChatGPT-style resize). */

export const SIDEBAR_WIDTH_KEY = "genghis:sidebar-width";

export const SIDEBAR_WIDTH_DEFAULT = 260;
export const SIDEBAR_WIDTH_MIN = 200;
export const SIDEBAR_WIDTH_MAX = 420;

export function clampSidebarWidth(n: number): number {
  if (!Number.isFinite(n)) return SIDEBAR_WIDTH_DEFAULT;
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, Math.round(n)));
}

export function readStoredSidebarWidth(): number {
  if (typeof window === "undefined") return SIDEBAR_WIDTH_DEFAULT;
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (!raw) return SIDEBAR_WIDTH_DEFAULT;
    return clampSidebarWidth(Number(raw));
  } catch {
    return SIDEBAR_WIDTH_DEFAULT;
  }
}

export function writeStoredSidebarWidth(width: number): void {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clampSidebarWidth(width)));
  } catch {
    // ignore quota / private mode
  }
}
