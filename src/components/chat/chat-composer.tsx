"use client";

import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  Brain,
  FileIcon,
  Globe,
  Mic,
  Plus,
  Square,
  X,
} from "lucide-react";
import { fileToAttachment } from "@/lib/attachments";
import { TOOL_LABELS } from "@/lib/tools";
import type { ChatAttachment, ToolMode } from "@/lib/types";
import { cn } from "@/lib/utils";

type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string, meta?: { mode: ToolMode; attachments: ChatAttachment[] }) => void;
  onStop?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  variant?: "hero" | "chat";
  mode?: ToolMode;
  onModeChange?: (mode: ToolMode) => void;
  attachments?: ChatAttachment[];
  onAttachmentsChange?: (next: ChatAttachment[]) => void;
};

type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  isLoading,
  disabled,
  variant = "chat",
  mode = "chat",
  onModeChange,
  attachments = [],
  onAttachmentsChange,
}: ChatComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const recognitionRef = useRef<SpeechRec | null>(null);

  useEffect(() => {
    setMicSupported(Boolean(getSpeechRecognition()));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [value]);

  const submit = () => {
    if (disabled || isLoading) return;
    const text = (ref.current?.value ?? value).trim();
    if (!text && attachments.length === 0) return;
    onSubmit(text || (attachments.length ? "Хавсралтыг үзэж өгнө үү." : ""), {
      mode,
      attachments,
    });
  };

  const canSend =
    (Boolean(value.trim()) || attachments.length > 0) && !disabled;

  const toggleMode = (next: ToolMode) => {
    onModeChange?.(mode === next ? "chat" : next);
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length || !onAttachmentsChange) return;
    setAttachError(null);
    try {
      const next: ChatAttachment[] = [...attachments];
      for (const file of Array.from(files).slice(0, 4)) {
        next.push(await fileToAttachment(file));
      }
      onAttachmentsChange(next.slice(0, 6));
    } catch (err) {
      setAttachError(
        err instanceof Error ? err.message : "Файл нэмж чадсангүй."
      );
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeAttachment = (id: string) => {
    onAttachmentsChange?.(attachments.filter((a) => a.id !== id));
  };

  const toggleMic = () => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const rec = new Ctor();
    rec.lang = "mn-MN";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (ev) => {
      const transcript = Array.from(ev.results)
        .map((r) => r[0]?.transcript || "")
        .join(" ")
        .trim();
      if (transcript) {
        onChange(value ? `${value.trim()} ${transcript}` : transcript);
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  return (
    <div className="w-full">
      {attachments.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2 px-1">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="relative flex max-w-[11rem] items-center gap-2 rounded-xl border border-[#E8E4DC] bg-white/95 px-2 py-1.5 shadow-sm"
            >
              {att.kind === "image" && att.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={att.dataUrl}
                  alt=""
                  className="size-9 rounded-md object-cover"
                />
              ) : (
                <FileIcon className="size-4 shrink-0 text-[#5C584F]" />
              )}
              <span className="truncate text-[11px] text-[#0B0D0F]">
                {att.name}
              </span>
              <button
                type="button"
                className="absolute -top-1.5 -right-1.5 inline-flex size-5 items-center justify-center rounded-full bg-[#0B0D0F] text-white"
                aria-label="Хавсралт хасах"
                onClick={() => removeAttachment(att.id)}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {mode !== "chat" ? (
        <div className="mb-2 flex items-center gap-2 px-1">
          <span className="rounded-full bg-[#C9A36B]/20 px-2.5 py-0.5 text-[11px] font-medium text-[#0B0D0F]">
            {TOOL_LABELS[mode]}
          </span>
          <button
            type="button"
            className="text-[11px] text-[#5C584F] underline"
            onClick={() => onModeChange?.("chat")}
          >
            Цуцлах
          </button>
        </div>
      ) : null}

      <div
        className={cn(
          "flex w-full items-center gap-1 border border-[#E8E4DC] bg-white px-2 py-1.5",
          attachments.length || mode !== "chat" ? "rounded-3xl" : "rounded-full",
          "shadow-[0_10px_40px_-18px_rgba(11,13,15,0.45)]",
          variant === "hero" && "shadow-[0_14px_48px_-16px_rgba(11,13,15,0.55)]"
        )}
      >
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept="image/*,.txt,.md,.csv,.json,.pdf,.ts,.tsx,.js,.jsx,.py,.html,.css"
          multiple
          onChange={(e) => void addFiles(e.target.files)}
        />

        <button
          type="button"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[#0B0D0F] transition hover:bg-[#F3F0EA]"
          aria-label="Зураг эсвэл файл хавсаргах"
          disabled={disabled || isLoading}
          onClick={() => fileRef.current?.click()}
        >
          <Plus className="size-5 stroke-[2.25]" />
        </button>

        <span className="mr-1 h-5 w-px shrink-0 bg-[#D9D3C7]" aria-hidden />

        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            mode === "image"
              ? "Зургийн тайлбараа бичнэ үү..."
              : mode === "web"
                ? "Юу хайх вэ?"
                : "Genghis AI -д асуух зүйлээ бичнэ үү..."
          }
          disabled={disabled}
          rows={1}
          className={cn(
            "max-h-36 min-h-10 flex-1 resize-none bg-transparent py-2.5 text-[15px] outline-none",
            "text-[#0B0D0F] caret-[#0B0D0F]",
            "placeholder:text-[#8A8580] placeholder:opacity-100",
            "disabled:cursor-not-allowed disabled:opacity-60"
          )}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (isLoading) {
                onStop?.();
                return;
              }
              submit();
            }
          }}
        />

        <div className="hidden items-center gap-0.5 sm:flex">
          <button
            type="button"
            onClick={() => toggleMode("think")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] transition-colors",
              mode === "think"
                ? "bg-[#0B0D0F] text-white"
                : "text-[#5C584F] hover:bg-[#F3F0EA] hover:text-[#0B0D0F]"
            )}
            aria-pressed={mode === "think"}
            aria-label="Think"
          >
            <Brain className="size-4 stroke-[1.75]" />
            <span>Think</span>
          </button>

          <button
            type="button"
            onClick={() => toggleMode("web")}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-[13px] transition-colors",
              mode === "web"
                ? "bg-[#0B0D0F] text-white"
                : "text-[#5C584F] hover:bg-[#F3F0EA] hover:text-[#0B0D0F]"
            )}
            aria-pressed={mode === "web"}
            aria-label="Вэб хайлт"
          >
            <Globe className="size-4 stroke-[1.75]" />
            <span>Вэб хайлт</span>
          </button>
        </div>

        <button
          type="button"
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-full transition",
            listening
              ? "bg-[#C9A36B] text-white"
              : "text-[#0B0D0F] hover:bg-[#F3F0EA]",
            !micSupported && "opacity-40"
          )}
          aria-label={
            micSupported
              ? listening
                ? "Дуу хоолойг зогсоох"
                : "Дуу хоолойгоор бичих"
              : "Микрофон энэ браузерт дэмжигдэхгүй"
          }
          title={
            micSupported
              ? "Дуу хоолойгоор бичих"
              : "Энэ браузер SpeechRecognition дэмжихгүй"
          }
          disabled={disabled || isLoading || !micSupported}
          onClick={toggleMic}
        >
          <Mic className="size-[18px] stroke-[1.75]" />
        </button>

        <button
          type="button"
          onClick={() => {
            if (isLoading) {
              onStop?.();
              return;
            }
            submit();
          }}
          disabled={disabled || (!isLoading && !canSend)}
          aria-label={isLoading ? "Зогсоох" : "Илгээх"}
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
            "disabled:pointer-events-none disabled:opacity-45",
            isLoading
              ? "bg-[#0B0D0F] text-white"
              : "bg-[#C9A36B] text-white hover:bg-[#BC956A]"
          )}
        >
          {isLoading ? (
            <Square className="size-3 fill-current" />
          ) : (
            <AudioLines className="size-4 stroke-[2]" />
          )}
        </button>
      </div>

      {attachError ? (
        <p className="mt-1.5 px-1 text-[12px] text-[#B33B2E]">{attachError}</p>
      ) : null}
    </div>
  );
}
