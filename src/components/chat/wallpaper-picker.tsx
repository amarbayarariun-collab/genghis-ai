"use client";

import { ImageIcon, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { BUILTIN_WALLPAPERS, type WallpaperId } from "@/lib/wallpapers";
import { cn } from "@/lib/utils";

type WallpaperPickerProps = {
  activeId: WallpaperId;
  customDataUrl: string | null;
  onSelect: (id: WallpaperId) => void;
  onUpload: (file: File) => Promise<void>;
  onClearCustom: () => void;
};

export function WallpaperPickerButton({
  activeId,
  customDataUrl,
  onSelect,
  onUpload,
  onClearCustom,
}: WallpaperPickerProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-ink/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md transition hover:bg-ink/55 sm:text-[13px]"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <ImageIcon className="size-3.5 opacity-90" />
        Дэвсгэр
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 p-3 sm:items-center"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Дэвсгэр сонгох"
            className="w-full max-w-md rounded-2xl border border-taupe/60 bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-ink">Дэвсгэр зураг</p>
                <p className="text-xs text-ink/50">
                  Нүүр хуудсын дэвсгэрийг солино
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg p-1.5 text-ink/50 transition hover:bg-ink/5 hover:text-ink"
                onClick={() => setOpen(false)}
                aria-label="Хаах"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {BUILTIN_WALLPAPERS.map((wall) => {
                const selected = activeId === wall.id;
                return (
                  <button
                    key={wall.id}
                    type="button"
                    onClick={() => {
                      onSelect(wall.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "overflow-hidden rounded-xl border text-left transition",
                      selected
                        ? "border-gold ring-2 ring-gold/40"
                        : "border-taupe/70 hover:border-ink/25"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={wall.thumb}
                      alt=""
                      className="aspect-[3/2] w-full object-cover"
                    />
                    <span className="block px-2.5 py-2 text-xs font-medium text-ink">
                      {wall.label}
                    </span>
                  </button>
                );
              })}

              {customDataUrl ? (
                <button
                  type="button"
                  onClick={() => {
                    onSelect("custom");
                    setOpen(false);
                  }}
                  className={cn(
                    "overflow-hidden rounded-xl border text-left transition",
                    activeId === "custom"
                      ? "border-gold ring-2 ring-gold/40"
                      : "border-taupe/70 hover:border-ink/25"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={customDataUrl}
                    alt=""
                    className="aspect-[3/2] w-full object-cover"
                  />
                  <span className="flex items-center justify-between gap-1 px-2.5 py-2 text-xs font-medium text-ink">
                    Миний зураг
                    <span
                      role="button"
                      tabIndex={0}
                      className="text-[10px] font-normal text-ink/45 hover:text-ink"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClearCustom();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          onClearCustom();
                        }
                      }}
                    >
                      Устгах
                    </span>
                  </span>
                </button>
              ) : null}
            </div>

            <div className="mt-3">
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setBusy(true);
                  setError(null);
                  try {
                    await onUpload(file);
                    setOpen(false);
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Зураг ачаалж чадсангүй"
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-taupe bg-ink/[0.02] px-3 py-2.5 text-sm text-ink/70 transition hover:border-gold/50 hover:text-ink disabled:opacity-60"
              >
                <Upload className="size-4" />
                {busy ? "Боловсруулж байна…" : "Өөрийн зураг оруулах"}
              </button>
              {error ? (
                <p className="mt-2 text-xs text-destructive">{error}</p>
              ) : (
                <p className="mt-2 text-[11px] text-ink/40">
                  Зөвхөн энэ төхөөрөмжид хадгалагдана
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
