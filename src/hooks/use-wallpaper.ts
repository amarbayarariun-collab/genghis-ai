"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_WALLPAPER_ID,
  WALLPAPER_CUSTOM_STORAGE_KEY,
  WALLPAPER_STORAGE_KEY,
  compressWallpaperFile,
  isBuiltinWallpaperId,
  resolveWallpaper,
  type WallpaperId,
} from "@/lib/wallpapers";

type WallpaperState = {
  id: WallpaperId;
  customDataUrl: string | null;
  hydrated: boolean;
};

export function useWallpaper() {
  const [state, setState] = useState<WallpaperState>({
    id: DEFAULT_WALLPAPER_ID,
    customDataUrl: null,
    hydrated: false,
  });

  useEffect(() => {
    try {
      const id = (localStorage.getItem(WALLPAPER_STORAGE_KEY) ||
        DEFAULT_WALLPAPER_ID) as WallpaperId;
      const custom = localStorage.getItem(WALLPAPER_CUSTOM_STORAGE_KEY);
      const validId: WallpaperId =
        id === "custom" && custom
          ? "custom"
          : isBuiltinWallpaperId(id)
            ? id
            : DEFAULT_WALLPAPER_ID;
      setState({
        id: validId,
        customDataUrl: custom,
        hydrated: true,
      });
    } catch {
      setState((s) => ({ ...s, hydrated: true }));
    }
  }, []);

  const setWallpaper = useCallback((id: WallpaperId) => {
    setState((prev) => {
      if (id === "custom" && !prev.customDataUrl) return prev;
      try {
        localStorage.setItem(WALLPAPER_STORAGE_KEY, id);
      } catch {
        // ignore quota
      }
      return { ...prev, id };
    });
  }, []);

  const setCustomWallpaper = useCallback(async (file: File) => {
    const dataUrl = await compressWallpaperFile(file);
    try {
      localStorage.setItem(WALLPAPER_CUSTOM_STORAGE_KEY, dataUrl);
      localStorage.setItem(WALLPAPER_STORAGE_KEY, "custom");
    } catch {
      throw new Error(
        "Хадгалах зай хүрэлцэхгүй байна. Өөр зураг туршина уу."
      );
    }
    setState((prev) => ({
      ...prev,
      id: "custom",
      customDataUrl: dataUrl,
    }));
  }, []);

  const clearCustomWallpaper = useCallback(() => {
    try {
      localStorage.removeItem(WALLPAPER_CUSTOM_STORAGE_KEY);
      localStorage.setItem(WALLPAPER_STORAGE_KEY, DEFAULT_WALLPAPER_ID);
    } catch {
      // ignore
    }
    setState((prev) => ({
      ...prev,
      id: DEFAULT_WALLPAPER_ID,
      customDataUrl: null,
    }));
  }, []);

  const current = resolveWallpaper(state.id, state.customDataUrl);

  return {
    id: state.id,
    hydrated: state.hydrated,
    customDataUrl: state.customDataUrl,
    current,
    setWallpaper,
    setCustomWallpaper,
    clearCustomWallpaper,
  };
}
