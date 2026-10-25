"use client";

import {
  Code2,
  FileText,
  Globe,
  ImageIcon,
  MessageSquarePlus,
  MoreHorizontal,
  Search,
  X,
} from "lucide-react";
import { GenghisLogo } from "@/components/brand/genghis-logo";
import { Button } from "@/components/ui/button";
import type { ChatSession } from "@/lib/types";
import { cn } from "@/lib/utils";

type ChatSidebarProps = {
  sessions: ChatSession[];
  activeId: string;
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onToolPrefill?: (text: string) => void;
};

const TOOLS: Array<{
  label: string;
  icon: typeof Search;
  prefill?: string;
}> = [
  { label: "Судалгаа", icon: Search, prefill: "Гүнзгий судалгаа: " },
  { label: "Зураг үүсгэх", icon: ImageIcon, prefill: "Зураг үүсгэ: " },
  { label: "Баримт бичиг", icon: FileText, prefill: "Баримт бичиг: " },
  { label: "Вэб хайлт", icon: Globe, prefill: "Вэб хайлт: " },
  { label: "Код боловсруулах", icon: Code2, prefill: "Код боловсруул: " },
];

export function ChatSidebar({
  sessions,
  activeId,
  open,
  onClose,
  onSelect,
  onNew,
  onDelete,
  onToolPrefill,
}: ChatSidebarProps) {
  const recent = [...sessions]
    .filter((s) => s.messages.length > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 8);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-ink/40 transition-opacity md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(17.5rem,90vw)] flex-col border-r border-taupe bg-cream transition-transform md:static md:z-0 md:w-64 md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-start justify-between gap-2 px-4 pt-5 pb-3">
          <GenghisLogo compact showTagline />
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={onClose}
            aria-label="Хаалт"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-0.5 px-2.5 pt-1">
          <button
            type="button"
            onClick={() => {
              onNew();
              onClose();
            }}
            className="flex items-center gap-2.5 rounded-xl bg-taupe/55 px-3 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-taupe"
          >
            <MessageSquarePlus className="size-4 opacity-80" />
            Шинэ чат
          </button>

          {TOOLS.map((tool) => (
            <button
              key={tool.label}
              type="button"
              onClick={() => {
                if (tool.prefill) onToolPrefill?.(tool.prefill);
                onClose();
              }}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ink/75 transition-colors hover:bg-taupe/40 hover:text-ink"
            >
              <tool.icon className="size-4 opacity-70" />
              {tool.label}
            </button>
          ))}

          <button
            type="button"
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ink/55"
            disabled
          >
            <MoreHorizontal className="size-4" />
            Илүү их
          </button>
        </div>

        <div className="mt-5 px-4 pb-1">
          <p className="text-[11px] tracking-wide text-ink/45">Сүүлд чатласан</p>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
          {recent.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-ink/40">
              Одоогоор яриа байхгүй.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {recent.map((session) => (
                <li key={session.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(session.id);
                      onClose();
                    }}
                    className={cn(
                      "w-full rounded-xl px-3 py-2 pr-8 text-left text-[13px] transition-colors",
                      session.id === activeId
                        ? "bg-taupe/60 text-ink"
                        : "text-ink/65 hover:bg-taupe/35 hover:text-ink"
                    )}
                  >
                    <span className="line-clamp-1">{session.title}</span>
                  </button>
                  <button
                    type="button"
                    className="absolute top-1.5 right-1.5 rounded-md px-1.5 py-0.5 text-[10px] text-ink/40 opacity-0 transition-opacity group-hover:opacity-100 hover:text-ink"
                    onClick={() => onDelete(session.id)}
                    aria-label="Устгах"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>

        <div className="mt-auto border-t border-taupe px-3 py-3">
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
            <div className="flex size-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-cream">
              A
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                A. Amarbayar
              </p>
              <p className="text-[11px] text-ink/45">Genghis AI · MVP</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
