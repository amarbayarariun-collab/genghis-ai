"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { FREE_PLAN, PAID_PLAN } from "@/lib/plans";

type LimitUpgradeDialogProps = {
  open: boolean;
  message: string;
  onClose: () => void;
};

export function LimitUpgradeDialog({
  open,
  message,
  onClose,
}: LimitUpgradeDialogProps) {
  const { t } = useLocale();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="limit-upgrade-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t("closeDialog")}
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-950">
        <h2
          id="limit-upgrade-title"
          className="font-heading text-xl font-semibold text-ink dark:text-zinc-100"
        >
          {t("planLimitTitle")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink/75 dark:text-zinc-300">
          {message}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-ink/55 dark:text-zinc-500">
          {t("planLimitHint")
            .replace("{free}", String(FREE_PLAN.messagesPerMonth))
            .replace("{price}", PAID_PLAN.priceMnt.toLocaleString("mn-MN"))
            .replace("{msgs}", String(PAID_PLAN.messagesPerMonth))
            .replace("{imgs}", String(PAID_PLAN.imagesPerMonth))}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("closeDialog")}
          </Button>
          <Link
            href="/pricing"
            onClick={onClose}
            className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
          >
            {t("planUpgrade")}
          </Link>
        </div>
      </div>
    </div>
  );
}
