"use client";

import { useEffect } from "react";

/**
 * Keeps the chat shell sized to the visual viewport so the composer
 * stays above the on-screen keyboard on mobile (iOS + Android).
 * Writes --app-vv-height / --app-vv-offset CSS vars on <html>.
 */
export function useVisualViewport() {
  useEffect(() => {
    const root = document.documentElement;

    const sync = () => {
      const vv = window.visualViewport;
      if (!vv) {
        root.style.setProperty("--app-vv-height", `${window.innerHeight}px`);
        root.style.setProperty("--app-vv-offset", "0px");
        return;
      }
      root.style.setProperty("--app-vv-height", `${Math.round(vv.height)}px`);
      root.style.setProperty("--app-vv-offset", `${Math.round(vv.offsetTop)}px`);
    };

    sync();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);

    return () => {
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      root.style.removeProperty("--app-vv-height");
      root.style.removeProperty("--app-vv-offset");
    };
  }, []);
}
