"use client";

/** Static full-bleed hero photo — no motion (per product request). */
export function LiveHeroBackdrop({
  src,
  position = "50% 45%",
}: {
  src: string;
  position?: string;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={src.slice(0, 64)}
        src={src}
        alt=""
        decoding="async"
        fetchPriority="high"
        className="absolute inset-0 h-full w-full max-w-none object-cover"
        style={{ objectPosition: position }}
      />
      <div className="hero-scrim absolute inset-0" />
    </div>
  );
}
