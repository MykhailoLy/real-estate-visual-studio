"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ServicePlaceholder, {
  type ServiceVariant,
} from "@/components/home/ServicePlaceholder";
import { cn } from "@/lib/utils";

// ============================================================
// SERVICE PAGE HERO SLIDER
//
// Reusable before/after slider for individual service pages.
//
// Controls:
//   - Arrow buttons (bare icons, no heavy white circle)
//   - Dot indicator below
//   - Touch/pointer swipe: swipe left → next, swipe right → prev.
//     SWIPE_MIN_X prevents accidental slide changes. Vertical-
//     dominant gestures are ignored so the page can still scroll.
//   - Autoplay (paused on hover/focus, respects reduced-motion)
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
  autoplayMs?: number;
  ariaLabel?: string;
  /**
   * How real slide images fit inside each half of the stage.
   *   "cover"   (default) — crops to fill; correct for photos.
   *   "contain" — fits whole image without cropping; use for plans,
   *               drawings, documents where nothing can be cut off.
   */
  imageFit?: "cover" | "contain";
  /**
   * Tailwind bg-* class applied behind each image half when
   * imageFit = "contain". Defaults to "bg-stone-100".
   */
  imageBackground?: string;
  /**
   * Override the mobile aspect-ratio Tailwind class (applied at the
   * base/mobile breakpoint only). Defaults to "aspect-[16/9]" which
   * is appropriate for photo-based services. Pass a wider ratio like
   * "aspect-[16/10]" for plan-based pages that still need to feel
   * like a banner rather than a tall square.
   */
  mobileAspect?: string;
}

const AUTOPLAY_MS = 5_500;
const SWIPE_MIN_X = 40;
const SWIPE_MAX_RATIO = 1.2;

export default function ServicePageSlider({
  slides,
  autoplayMs = AUTOPLAY_MS,
  ariaLabel = "Before and after examples",
  imageFit = "cover",
  imageBackground = "bg-stone-100",
  mobileAspect = "aspect-[16/9]",
}: Props) {
  const total = slides.length;

  const [rawIdx, setRawIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const idx = total > 0 ? rawIdx % total : 0;

  const dragStart = useRef<{ x: number; y: number } | null>(null);

  // prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Autoplay
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

  // ── Swipe handlers ──────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!e.isPrimary || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    dragStart.current = null;

    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    if (adx < SWIPE_MIN_X) return;
    if (ady > adx * SWIPE_MAX_RATIO) return;

    if (dx < 0) goNext();
    else goPrev();
  };

  const handlePointerCancel = () => {
    dragStart.current = null;
  };

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
      {/*
        Aspect chain:
          [mobileAspect] e.g. aspect-[16/9] for photos, aspect-[16/10] for plans
          sm:aspect-[21/9]  small tablets
          md:aspect-[3/1]   medium viewports
          lg:aspect-[4/1]   wide desktop hero
      */}
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-xl lg:rounded-2xl shadow-xl ring-1 ring-black/10 bg-stone-100",
          mobileAspect,
          "sm:aspect-[21/9] md:aspect-[3/1] lg:aspect-[4/1]"
        )}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        style={{ userSelect: "none", WebkitUserSelect: "none" }}
      >
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
                imageFit={imageFit}
                imageBackground={imageBackground}
              />
            ) : (
              <ServicePlaceholder
                variant={slide.variant}
                showInnerLabels={false}
              />
            )}
          </div>
        ))}

        {/* ── Arrow controls — bare icons, no white circle ── */}
        {showNav && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous slide"
              className={cn(
                "absolute left-2 lg:left-4 top-1/2 -translate-y-1/2",
                "w-11 h-11 flex items-center justify-center",
                "text-white/80 hover:text-white",
                "drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)]",
                "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent rounded"
              )}
            >
              <ChevronLeft className="w-7 h-7 lg:w-8 lg:h-8" strokeWidth={2.2} aria-hidden />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next slide"
              className={cn(
                "absolute right-2 lg:right-4 top-1/2 -translate-y-1/2",
                "w-11 h-11 flex items-center justify-center",
                "text-white/80 hover:text-white",
                "drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)]",
                "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent rounded"
              )}
            >
              <ChevronRight className="w-7 h-7 lg:w-8 lg:h-8" strokeWidth={2.2} aria-hidden />
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

function RealSlide({
  beforeUrl,
  afterUrl,
  beforeAlt,
  afterAlt,
  eager,
  imageFit = "cover",
  imageBackground = "bg-stone-100",
}: {
  beforeUrl: string;
  afterUrl: string;
  beforeAlt: string;
  afterAlt: string;
  eager: boolean;
  imageFit?: "cover" | "contain";
  imageBackground?: string;
}) {
  // object-contain gets a small inset so the plan image has
  // breathing room against the frame edge and centerline divider.
  const imgCls =
    imageFit === "contain"
      ? "absolute inset-0 w-full h-full object-contain p-3 sm:p-4"
      : "absolute inset-0 w-full h-full object-cover";

  return (
    <div className="absolute inset-0 flex">
      {/* Before half */}
      <div className={`relative w-1/2 overflow-hidden ${imageBackground}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeUrl}
          alt={beforeAlt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className={imgCls}
        />
      </div>

      {/* After half */}
      <div className={`relative w-1/2 overflow-hidden ${imageBackground}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={afterUrl}
          alt={afterAlt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className={imgCls}
        />
      </div>

      {/* Centerline divider */}
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
