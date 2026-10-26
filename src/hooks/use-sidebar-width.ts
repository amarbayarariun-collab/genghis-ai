"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  SIDEBAR_WIDTH_DEFAULT,
  clampSidebarWidth,
  readStoredSidebarWidth,
  writeStoredSidebarWidth,
} from "@/lib/sidebar";

export function useSidebarWidth() {
  const [width, setWidthState] = useState(SIDEBAR_WIDTH_DEFAULT);
  const [hydrated, setHydrated] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const widthRef = useRef(width);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  useEffect(() => {
    setWidthState(readStoredSidebarWidth());
    setHydrated(true);
  }, []);

  const setWidth = useCallback((next: number, persist = false) => {
    const clamped = clampSidebarWidth(next);
    setWidthState(clamped);
    widthRef.current = clamped;
    if (persist) writeStoredSidebarWidth(clamped);
  }, []);

  const beginResize = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      const handle = event.currentTarget;
      const startX = event.clientX;
      const startW = widthRef.current;
      setIsResizing(true);
      handle.setPointerCapture(event.pointerId);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: PointerEvent) => {
        setWidth(startW + (ev.clientX - startX), false);
      };

      const end = (ev: PointerEvent) => {
        setIsResizing(false);
        try {
          handle.releasePointerCapture(ev.pointerId);
        } catch {
          // already released
        }
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        setWidth(startW + (ev.clientX - startX), true);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    },
    [setWidth]
  );

  return { width, setWidth, beginResize, hydrated, isResizing };
}
