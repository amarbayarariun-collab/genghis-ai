export type BuiltinWallpaperId = "horseman" | "gers";

export type WallpaperId = BuiltinWallpaperId | "custom";

export type WallpaperOption = {
  id: BuiltinWallpaperId;
  label: string;
  src: string;
  thumb: string;
  /** CSS object-position */
  position: string;
};

export const WALLPAPER_STORAGE_KEY = "genghis:wallpaper-id";
export const WALLPAPER_CUSTOM_STORAGE_KEY = "genghis:wallpaper-custom";

export const BUILTIN_WALLPAPERS: WallpaperOption[] = [
  {
    id: "horseman",
    label: "Морьтон · тал",
    src: "/brand/wallpapers/horseman.webp",
    thumb: "/brand/wallpapers/thumbs/horseman.webp",
    position: "50% 45%",
  },
  {
    id: "gers",
    label: "Гэрүүд",
    src: "/brand/wallpapers/gers.webp",
    thumb: "/brand/wallpapers/thumbs/gers.webp",
    position: "42% 40%",
  },
];

export const DEFAULT_WALLPAPER_ID: WallpaperId = "horseman";

export function resolveWallpaper(
  id: WallpaperId,
  customDataUrl: string | null
): { src: string; position: string; label: string } {
  if (id === "custom" && customDataUrl) {
    return {
      src: customDataUrl,
      position: "50% 50%",
      label: "Миний зураг",
    };
  }
  const builtin =
    BUILTIN_WALLPAPERS.find((w) => w.id === id) ?? BUILTIN_WALLPAPERS[0];
  return {
    src: builtin.src,
    position: builtin.position,
    label: builtin.label,
  };
}

/** Compress an image file for localStorage custom wallpaper. */
export async function compressWallpaperFile(
  file: File,
  maxWidth = 1920,
  quality = 0.82
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  // localStorage soft cap — reject if still huge
  if (dataUrl.length > 2_800_000) {
    throw new Error("Зураг хэт том байна. Бага хэмжээтэй файл сонгоно уу.");
  }
  return dataUrl;
}
