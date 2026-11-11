import Link from "next/link";

type SiteLegalLinksProps = {
  /** Visual tone for landing (dark hero) vs cream/pricing/sidebar. */
  tone?: "light" | "onDark" | "muted";
  className?: string;
};

const toneClass: Record<NonNullable<SiteLegalLinksProps["tone"]>, string> = {
  light: "text-ink/55 hover:text-ink",
  onDark: "text-white/55 hover:text-white",
  muted: "text-ink/45 hover:text-ink/70 dark:text-zinc-500 dark:hover:text-zinc-300",
};

/**
 * Additive legal links (privacy / terms). Keep markup minimal — no redesign.
 */
export function SiteLegalLinks({
  tone = "light",
  className = "",
}: SiteLegalLinksProps) {
  const link = `underline underline-offset-2 ${toneClass[tone]}`;
  return (
    <nav
      aria-label="Хууль эрх зүй"
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:text-xs ${className}`}
    >
      <Link href="/privacy" className={link}>
        Нууцлалын бодлого
      </Link>
      <span aria-hidden className={tone === "onDark" ? "text-white/30" : "text-ink/25 dark:text-zinc-700"}>
        ·
      </span>
      <Link href="/terms" className={link}>
        Үйлчилгээний нөхцөл
      </Link>
    </nav>
  );
}
