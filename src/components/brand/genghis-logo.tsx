import { cn } from "@/lib/utils";

type GenghisLogoProps = {
  className?: string;
  showTagline?: boolean;
  compact?: boolean;
};

/** Official ölzii mark + GENGHIS (dark) AI (gold) wordmark */
export function GenghisLogo({
  className,
  showTagline = true,
  compact = false,
}: GenghisLogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/genghis-knot.png"
        alt=""
        width={40}
        height={40}
        className={cn(
          compact ? "size-8" : "size-10",
          "shrink-0 object-contain dark:hidden"
        )}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/genghis-knot-dark.png"
        alt=""
        width={40}
        height={40}
        className={cn(
          compact ? "size-8" : "size-10",
          "hidden shrink-0 object-contain dark:block"
        )}
      />
      <div className="min-w-0 leading-none">
        <p className={cn("tracking-tight", compact ? "text-base" : "text-lg")}>
          <span className="font-semibold text-ink dark:text-zinc-50">
            GENGHIS
          </span>{" "}
          <span className="font-[family-name:var(--font-heading)] font-medium text-gold">
            AI
          </span>
        </p>
        {showTagline ? (
          <p className="mt-1 text-[10px] leading-snug tracking-wide text-ink/70 dark:text-zinc-400">
            Монголоос дэлхийтэй холбогд
          </p>
        ) : null}
      </div>
    </div>
  );
}
