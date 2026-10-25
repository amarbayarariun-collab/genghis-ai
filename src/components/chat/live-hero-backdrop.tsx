"use client";

/** Static full-bleed hero photo — no motion (per product request). */
export function LiveHeroBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/hero-live.webp"
        alt=""
        decoding="async"
        fetchPriority="high"
        className="absolute inset-0 h-full w-full max-w-none object-cover object-[48%_42%]"
      />
      <div className="hero-scrim absolute inset-0" />
    </div>
  );
}
