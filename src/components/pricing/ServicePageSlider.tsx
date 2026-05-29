"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ServicePlaceholder, {
  type ServiceVariant,
} from "@/components/home/ServicePlaceholder";
import { cn } from "@/lib/utils";

// ============================================================
// SERVICE PAGE HERO SLIDER
//
// Reusable variant of the homepage BeforeAfterShowcase designed
// for individual service pages. Accepts an array of resolved
// slides so the parent server component can inject real portfolio
// items from Supabase; falls back to CSS ServicePlaceholder when
// images are absent or Supabase is unconfigured.
//
// Shape mirrors the homepage slider exactly — same aspect ratios,
// same arrow / dot controls, same autoplay / pause / reduced-
// motion behaviour — so the transition between the homepage and a
// service page feels consistent.
//
// "use client" because autoplay and user-controlled navigation
// require useState / useEffect.
// ============================================================

export type ServicePageSlide =
  | {
      kind: "image";
      id: string;
      beforeUrl: string;
      afterUrl: string;
      beforeAlt: string;
      afterAlt: string;
      title?: string;
    }
  | {
      kind: "placeholder";
      id: string;
      variant: ServiceVariant;
    };

interface Props {
  slides: ServicePageSlide[];
  /** Autoplay interval in ms. Defaults to 5 500. */
  autoplayMs?: number;
  /** ARIA label for the carousel region. */
  ariaLabel?: string;
}

const AUTOPLAY_MS = 5_500;

export default function ServicePageSlider({
  slides,
  autoplayMs = AUTOPLAY_MS,
  ariaLabel = "Before and after examples",
}: Props) {
  const total = slides.length;

  const [rawIdx, setRawIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Clamp idx at render time — avoids setState-in-effect when the
  // slide list changes size between server and client.
  const idx = total > 0 ? rawIdx % total : 0;

  // Subscribe to prefers-reduced-motion. Synchronous check on
  // mount + listener for live changes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Autoplay timer re-armed on every slide change so dwell time is
  // consistent regardless of how navigation happened.
  useEffect(() => {
    if (paused || reducedMotion || total <= 1) return;
    const t = window.setTimeout(
      () => setRawIdx((i) => (i + 1) % total),
      autoplayMs
    );
    return () => window.clearTimeout(t);
  }, [idx, paused, reducedMotion, total, autoplayMs]);

  if (total === 0) return null;

  const showNav = total > 1;

  const goPrev = () => setRawIdx((i) => (i - 1 + total) % total);
  const goNext = () => setRawIdx((i) => (i + 1) % total);

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
    >
      {/* ── Slide stage ── */}
      {/* Aspect ratios match the homepage banner exactly so the
          slider reads as the same design element. */}
      <div className="relative w-full overflow-hidden rounded-xl lg:rounded-2xl shadow-xl ring-1 ring-black/10 bg-stone-100 aspect-[16/9] sm:aspect-[21/9] md:aspect-[3/1] lg:aspect-[4/1]">
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            className={cn(
              "absolute inset-0 transition-opacity duration-700 ease-in-out",
              i === idx ? "opacity-100" : "opacity-0"
            )}
            aria-hidden={i !== idx}
          >
            {slide.kind === "image" ? (
              <RealSlide
                beforeUrl={slide.beforeUrl}
                afterUrl={slide.afterUrl}
                beforeAlt={slide.beforeAlt}
                afterAlt={slide.afterAlt}
                eager={i === 0}
              />
            ) : (
              <ServicePlaceholder
                variant={slide.variant}
                showInnerLabels={false}
              />
            )}
          </div>
        ))}

        {showNav && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous slide"
              className="absolute left-3 lg:left-5 top-1/2 -translate-y-1/2 w-11 h-11 lg:w-12 lg:h-12 rounded-full bg-white/95 text-foreground hover:text-primary hover:bg-white shadow-lg flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
            >
              <ChevronLeft className="w-5 h-5 lg:w-6 lg:h-6" aria-hidden />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next slide"
              className="absolute right-3 lg:right-5 top-1/2 -translate-y-1/2 w-11 h-11 lg:w-12 lg:h-12 rounded-full bg-white/95 text-foreground hover:text-primary hover:bg-white shadow-lg flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
            >
              <ChevronRight className="w-5 h-5 lg:w-6 lg:h-6" aria-hidden />
            </button>
          </>
        )}
      </div>

      {/* ── Dot indicator ── */}
      {showNav && (
        <div
          className="mt-4 lg:mt-5 flex items-center justify-center gap-2.5"
          role="tablist"
          aria-label="Slide indicators"
        >
          {slides.map((slide, i) => {
            const isActive = i === idx;
            return (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Show slide ${i + 1} of ${total}`}
                onClick={() => setRawIdx(i)}
                className={cn(
                  "h-2.5 rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
                  isActive
                    ? "w-9 bg-primary"
                    : "w-2.5 bg-stone-300 hover:bg-stone-400"
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Real before/after image pair ──────────────────────────────
// Plain <img> for Supabase Storage URLs — avoids needing
// next.config remotePatterns and is fine for admin-uploaded JPGs.

function RealSlide({
  beforeUrl,
  afterUrl,
  beforeAlt,
  afterAlt,
  eager,
}: {
  beforeUrl: string;
  afterUrl: string;
  beforeAlt: string;
  afterAlt: string;
  eager: boolean;
}) {
  return (
    <div className="absolute inset-0 flex">
      {/* Before half */}
      <div className="relative w-1/2 overflow-hidden bg-stone-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeUrl}
          alt={beforeAlt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>

      {/* After half */}
      <div className="relative w-1/2 overflow-hidden bg-stone-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={afterUrl}
          alt={afterAlt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>

      {/* Centerline divider — same affordance as ServicePlaceholder */}
      <div
        aria-hidden
        className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[3px] bg-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center">
          <svg
            viewBox="0 0 12 12"
            className="w-3 h-3 text-primary"
            fill="currentColor"
            aria-hidden
          >
            <path d="M3 1L0 6l3 5V1zm6 0v10l3-5-3-5z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
