import { cn } from "@/lib/utils";

type GenghisLogoProps = {
  className?: string;
  showTagline?: boolean;
  compact?: boolean;
};

/** Circular ölzii-style knot + GENGHIS (dark) AI (gold) wordmark */
export function GenghisLogo({
  className,
  showTagline = true,
  compact = false,
}: GenghisLogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 64 64"
        aria-hidden
        className={cn(compact ? "size-8" : "size-10", "shrink-0")}
      >
        <circle cx="32" cy="32" r="30" fill="#0B0D0F" />
        <path
          fill="#F8F6F1"
          d="M32 14c2.2 0 4 1.8 4 4v2.2c3.6.6 6.4 3.4 7 7H45c2.2 0 4 1.8 4 4s-1.8 4-4 4h-1.8c-.6 3.6-3.4 6.4-7 7V44c0 2.2-1.8 4-4 4s-4-1.8-4-4v-1.8c-3.6-.6-6.4-3.4-7-7H19c-2.2 0-4-1.8-4-4s1.8-4 4-4h1.8c.6-3.6 3.4-6.4 7-7V18c0-2.2 1.8-4 4-4zm0 8c-3.3 0-6 2.7-6 6v2h-2c-1.1 0-2 .9-2 2s.9 2 2 2h2v2c0 3.3 2.7 6 6 6h2v2c0 1.1.9 2 2 2s2-.9 2-2v-2h2c3.3 0 6-2.7 6-6v-2h2c1.1 0 2-.9 2-2s-.9-2-2-2h-2v-2c0-3.3-2.7-6-6-6h-2v-2c0-1.1-.9-2-2-2s-2 .9-2 2v2h-2zm0 6c2.2 0 4 1.8 4 4s-1.8 4-4 4-4-1.8-4-4 1.8-4 4-4z"
        />
      </svg>
      <div className="min-w-0 leading-none">
        <p className={cn("tracking-tight", compact ? "text-base" : "text-lg")}>
          <span className="font-semibold text-ink">GENGHIS</span>{" "}
          <span className="font-[family-name:var(--font-heading)] font-medium text-gold">
            AI
          </span>
        </p>
        {showTagline ? (
          <p className="mt-1 text-[9px] tracking-[0.18em] text-ink/70 uppercase">
            From Mongolia to the World
          </p>
        ) : null}
      </div>
    </div>
  );
}
