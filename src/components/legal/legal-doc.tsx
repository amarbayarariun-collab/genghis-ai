import Link from "next/link";
import type { ReactNode } from "react";
import { SiteLegalLinks } from "@/components/legal/site-legal-links";

type LegalDocProps = {
  title: string;
  children: ReactNode;
};

/** Shared cream shell for Mongolian-first legal drafts (owner review). */
export function LegalDoc({ title, children }: LegalDocProps) {
  return (
    <main className="min-h-dvh bg-[radial-gradient(ellipse_at_top,#F8F6F1_0%,#EFE8DC_45%,#E4D5BE_100%)] text-ink">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-12">
        <header className="space-y-3">
          <p className="text-xs tracking-[0.2em] text-ink/45 uppercase">
            Genghis AI
          </p>
          <p className="inline-flex w-fit rounded-sm border border-amber-700/25 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-950">
            НООРОГ · эзэмшигчийн хяналтад (draft for owner review)
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="text-sm text-ink/60">
            Сүүлийн шинэчлэл: 2026-11-11 · Монгол хэлээр (анхны хувилбар)
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              href="/"
              className="text-sm text-ink/60 underline underline-offset-4"
            >
              Чат руу буцах
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-ink/60 underline underline-offset-4"
            >
              Багц / үнэ
            </Link>
            <SiteLegalLinks />
          </div>
        </header>

        <article className="space-y-6 text-sm leading-relaxed text-ink/80 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
          {children}
        </article>

        <footer className="border-t border-ink/10 pt-6">
          <SiteLegalLinks />
        </footer>
      </div>
    </main>
  );
}
