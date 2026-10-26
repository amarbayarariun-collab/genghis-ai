"use client";

import type { CSSProperties } from "react";
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
import { useSidebarWidth } from "@/hooks/use-sidebar-width";
import {
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
} from "@/lib/sidebar";
import type { ChatSession, ToolMode } from "@/lib/types";
import { cn } from "@/lib/utils";

type ChatSidebarProps = {
  sessions: ChatSession[];
  activeId: string;
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onTool?: (mode: ToolMode) => void;
};

const TOOLS: Array<{
  label: string;
  icon: typeof Search;
  mode: ToolMode;
}> = [
  { label: "Судалгаа", icon: Search, mode: "research" },
  { label: "Зураг үүсгэх", icon: ImageIcon, mode: "image" },
  { label: "Баримт бичиг", icon: FileText, mode: "document" },
  { label: "Вэб хайлт", icon: Globe, mode: "web" },
  { label: "Код боловсруулах", icon: Code2, mode: "code" },
];

export function ChatSidebar({
  sessions,
  activeId,
  open,
  onClose,
  onSelect,
  onNew,
  onDelete,
  onTool,
}: ChatSidebarProps) {
  const { width, setWidth, beginResize, isResizing } = useSidebarWidth();
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
          "fixed inset-y-0 left-0 z-50 flex w-[min(17.5rem,90vw)] flex-col border-r border-zinc-200 bg-white transition-transform dark:border-zinc-800 dark:bg-zinc-950 md:relative md:z-0 md:w-[var(--sidebar-w)] md:shrink-0 md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
          isResizing && "md:select-none md:transition-none"
        )}
        style={{ "--sidebar-w": `${width}px` } as CSSProperties}
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
            className="flex items-center gap-2.5 rounded-xl bg-gold/20 px-3 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-gold/30 dark:text-zinc-100"
          >
            <MessageSquarePlus className="size-4 opacity-80" />
            Шинэ чат
          </button>

          {TOOLS.map((tool) => (
            <button
              key={tool.label}
              type="button"
              onClick={() => {
                onTool?.(tool.mode);
                onClose();
              }}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ink/75 transition-colors hover:bg-zinc-100 hover:text-ink dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
            >
              <tool.icon className="size-4 opacity-70" />
              {tool.label}
            </button>
          ))}

          <button
            type="button"
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ink/55 dark:text-zinc-500"
            disabled
          >
            <MoreHorizontal className="size-4" />
            Илүү их
          </button>
        </div>

        <div className="mt-5 px-4 pb-1">
          <p className="text-[11px] tracking-wide text-ink/45 dark:text-zinc-500">
            Сүүлд чатласан
          </p>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
          {recent.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-ink/40 dark:text-zinc-600">
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
                        ? "bg-zinc-100 text-ink dark:bg-zinc-900 dark:text-zinc-50"
                        : "text-ink/65 hover:bg-zinc-50 hover:text-ink dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                    )}
                  >
                    <span className="line-clamp-1">{session.title}</span>
                  </button>
                  <button
                    type="button"
                    className="absolute top-1.5 right-1.5 rounded-md px-1.5 py-0.5 text-[10px] text-ink/40 opacity-0 transition-opacity group-hover:opacity-100 hover:text-ink dark:text-zinc-500"
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

        <div className="mt-auto border-t border-zinc-200 px-3 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
            <div className="flex size-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
              A
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink dark:text-zinc-100">
                A. Amarbayar
              </p>
              <p className="text-[11px] text-ink/45 dark:text-zinc-500">
                Genghis AI · MVP
              </p>
            </div>
          </div>
        </div>

        {/* Desktop resize handle (ChatGPT-style). Hidden on mobile drawer. */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuemin={SIDEBAR_WIDTH_MIN}
          aria-valuemax={SIDEBAR_WIDTH_MAX}
          aria-valuenow={width}
          aria-label="Хажуугийн самбарын өргөн"
          tabIndex={0}
          onPointerDown={beginResize}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 24 : 12;
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              setWidth(width - step, true);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              setWidth(width + step, true);
            } else if (e.key === "Home") {
              e.preventDefault();
              setWidth(SIDEBAR_WIDTH_MIN, true);
            } else if (e.key === "End") {
              e.preventDefault();
              setWidth(SIDEBAR_WIDTH_MAX, true);
            }
          }}
          className={cn(
            "absolute top-0 right-0 z-20 hidden h-full w-1.5 translate-x-1/2 cursor-col-resize touch-none md:block",
            "after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-transparent after:transition-colors",
            "hover:after:bg-zinc-300 focus-visible:after:bg-gold dark:hover:after:bg-zinc-600",
            isResizing && "after:bg-gold"
          )}
        />
      </aside>
    </>
  );
}
