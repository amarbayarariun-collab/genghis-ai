"use client";

import { useEffect, useRef } from "react";

/**
 * Single-scene “live photo” backdrop: continuous camera drift via rAF
 * (more reliable / visible than CSS-only transform on some browsers).
 */
export function LiveHeroBackdrop() {
  const photoRef = useRef<HTMLImageElement>(null);
  const depthRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduced) return;

    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = (now - start) / 1000;
      // ~22s full orbit — clearly visible pan + breathe zoom
      const a = (t / 22) * Math.PI * 2;
      const zoom = 1.12 + Math.sin(a * 0.85) * 0.08;
      const x = Math.sin(a) * 3.2;
      const y = Math.cos(a * 0.7) * 2.1;
      const photo = photoRef.current;
      const depth = depthRef.current;
      if (photo) {
        photo.style.transform = `translate3d(${x}%, ${y}%, 0) scale(${zoom})`;
      }
      if (depth) {
        depth.style.transform = `translate3d(${x * 1.45}%, ${y * 1.35}%, 0) scale(${zoom + 0.08})`;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={photoRef}
        src="/brand/hero-live.webp"
        alt=""
        decoding="async"
        fetchPriority="high"
        className="hero-live-photo absolute inset-[-8%] h-[116%] w-[116%] max-w-none object-cover object-[48%_40%] will-change-transform"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={depthRef}
        src="/brand/hero-live.webp"
        alt=""
        decoding="async"
        className="hero-live-parallax pointer-events-none absolute inset-[-10%] h-[120%] w-[120%] max-w-none object-cover object-[48%_40%] opacity-30 mix-blend-soft-light will-change-transform"
      />
      <div className="hero-clouds pointer-events-none absolute inset-0" />
      <div className="hero-sky-drift pointer-events-none absolute inset-0" />
      <div className="hero-light pointer-events-none absolute inset-0" />
      <div className="hero-scrim absolute inset-0" />
    </div>
  );
}
