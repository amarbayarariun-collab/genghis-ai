"use client";

import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  Brain,
  FileIcon,
  Globe,
  Languages,
  Mic,
  Plus,
  Square,
  X,
} from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { fileToAttachment } from "@/lib/attachments";
import { toolLabel } from "@/lib/locale";
import {
  hasLatinForTranslit,
  latinToCyrillicMn,
  readStoredTranslitEnabled,
  writeStoredTranslitEnabled,
} from "@/lib/transliterate-mn";
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
  const { locale, t } = useLocale();
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [translitOn, setTranslitOn] = useState(false);
  const recognitionRef = useRef<SpeechRec | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- detect SpeechRecognition once
    setMicSupported(Boolean(getSpeechRecognition()));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate translit pref from localStorage
    setTranslitOn(readStoredTranslitEnabled());
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [value]);

  const preview =
    translitOn && hasLatinForTranslit(value)
      ? latinToCyrillicMn(value)
      : null;

  const setTranslit = (next: boolean) => {
    setTranslitOn(next);
    writeStoredTranslitEnabled(next);
  };

  const applyTranslit = () => {
    if (!preview || preview === value) return;
    onChange(preview);
  };

  const submit = () => {
    if (disabled || isLoading) return;
    let text = (ref.current?.value ?? value).trim();
    if (translitOn && text && hasLatinForTranslit(text)) {
      text = latinToCyrillicMn(text).trim();
      onChange(text);
    }
    if (!text && attachments.length === 0) return;
    onSubmit(text || (attachments.length ? t("viewAttachments") : ""), {
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
        err instanceof Error ? err.message : t("fileAddFail")
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
    rec.lang = locale === "en" ? "en-US" : "mn-MN";
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
                className="absolute -top-2 -right-2 inline-flex size-8 items-center justify-center rounded-full bg-[#0B0D0F] text-white"
                aria-label={t("removeAttachment")}
                onClick={() => removeAttachment(att.id)}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {mode !== "chat" ? (
        <div className="mb-2 flex items-center gap-2 px-1">
          <span className="rounded-full bg-[#C9A36B]/20 px-2.5 py-0.5 text-[11px] font-medium text-[#0B0D0F]">
            {toolLabel(locale, mode)}
          </span>
          <button
            type="button"
            className="inline-flex min-h-11 items-center text-[12px] text-[#5C584F] underline sm:min-h-0 sm:text-[11px]"
            onClick={() => onModeChange?.("chat")}
          >
            {t("cancel")}
          </button>
        </div>
      ) : null}

      <div
        className={cn(
          "flex w-full items-end gap-0.5 border border-[#E8E4DC] bg-white px-1.5 py-1.5 sm:items-center sm:gap-1 sm:px-2",
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
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-[#0B0D0F] transition hover:bg-[#F3F0EA] sm:size-9"
          aria-label={t("attach")}
          disabled={disabled || isLoading}
          onClick={() => fileRef.current?.click()}
        >
          <Plus className="size-5 stroke-[2.25]" />
        </button>

        <span className="mb-3 mr-0.5 hidden h-5 w-px shrink-0 bg-[#D9D3C7] sm:mb-0 sm:mr-1 sm:block" aria-hidden />

        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            mode === "image"
              ? t("placeholderImage")
              : mode === "web"
                ? t("placeholderWeb")
                : t("placeholderDefault")
          }
          disabled={disabled}
          rows={1}
          className={cn(
            "max-h-36 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-[16px] outline-none sm:min-h-10 sm:text-[15px]",
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
            onClick={() => setTranslit(!translitOn)}
            className={cn(
              "inline-flex min-h-9 items-center gap-1 rounded-full px-2.5 py-1.5 text-[13px] transition-colors",
              translitOn
                ? "bg-[#C9A36B]/25 text-[#0B0D0F]"
                : "text-[#5C584F] hover:bg-[#F3F0EA] hover:text-[#0B0D0F]"
            )}
            aria-pressed={translitOn}
            aria-label={t("translitToggle")}
            title={t("translitToggle")}
          >
            <Languages className="size-4 stroke-[1.75]" />
            <span className="max-w-[7.5rem] truncate">{t("translitToggle")}</span>
          </button>

          <button
            type="button"
            onClick={() => toggleMode("think")}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] transition-colors",
              mode === "think"
                ? "bg-[#0B0D0F] text-white"
                : "text-[#5C584F] hover:bg-[#F3F0EA] hover:text-[#0B0D0F]"
            )}
            aria-pressed={mode === "think"}
            aria-label={t("toolThink")}
          >
            <Brain className="size-4 stroke-[1.75]" />
            <span>{t("toolThink")}</span>
          </button>

          <button
            type="button"
            onClick={() => toggleMode("web")}
            className={cn(
              "inline-flex min-h-9 items-center gap-1 rounded-full px-2.5 py-1.5 text-[13px] transition-colors",
              mode === "web"
                ? "bg-[#0B0D0F] text-white"
                : "text-[#5C584F] hover:bg-[#F3F0EA] hover:text-[#0B0D0F]"
            )}
            aria-pressed={mode === "web"}
            aria-label={t("toolWeb")}
          >
            <Globe className="size-4 stroke-[1.75]" />
            <span>{t("toolWeb")}</span>
          </button>
        </div>

        <button
          type="button"
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-full transition sm:hidden sm:size-9",
            translitOn
              ? "bg-[#C9A36B]/25 text-[#0B0D0F]"
              : "text-[#0B0D0F] hover:bg-[#F3F0EA]"
          )}
          aria-pressed={translitOn}
          aria-label={t("translitToggle")}
          title={t("translitToggle")}
          disabled={disabled}
          onClick={() => setTranslit(!translitOn)}
        >
          <Languages className="size-[18px] stroke-[1.75]" />
        </button>

        <button
          type="button"
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-full transition sm:size-9",
            listening
              ? "bg-[#C9A36B] text-white"
              : "text-[#0B0D0F] hover:bg-[#F3F0EA]",
            !micSupported && "opacity-40"
          )}
          aria-label={
            micSupported
              ? listening
                ? t("micStop")
                : t("micStart")
              : t("micUnsupported")
          }
          title={
            micSupported ? t("micStart") : t("micTitleUnsupported")
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
          aria-label={isLoading ? t("stop") : t("send")}
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors sm:size-9",
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

      {preview && preview !== value ? (
        <div className="mt-1.5 flex items-start gap-2 px-1">
          <p className="min-w-0 flex-1 text-[12px] leading-snug text-[#5C584F]">
            <span className="mr-1 font-medium text-[#0B0D0F]">
              {t("translitPreview")}:
            </span>
            {preview}
          </p>
          <button
            type="button"
            className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-[#E8E4DC] bg-white px-3 text-[12px] text-[#0B0D0F] sm:min-h-0 sm:px-2.5 sm:py-1 sm:text-[11px]"
            onClick={applyTranslit}
          >
            {t("translitConvert")}
          </button>
        </div>
      ) : null}

      {attachError ? (
        <p className="mt-1.5 px-1 text-[12px] text-[#B33B2E]">{attachError}</p>
      ) : null}
    </div>
  );
}
