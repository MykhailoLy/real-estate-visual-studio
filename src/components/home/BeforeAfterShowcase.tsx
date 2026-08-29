"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ServicePlaceholder, {
  type ServiceVariant,
} from "./ServicePlaceholder";
import { cn } from "@/lib/utils";

// Initial render mounts active slide content only. Neighbouring
// content is enabled after page load, or immediately before any
// navigation, while distant slides stay unmounted.
function isSlideMounted(
  i: number,
  idx: number,
  total: number,
  neighborsReady: boolean,
  preparePrev: boolean
): boolean {
  if (total <= 1) return true;
  if (i === idx) return true;
  if (!neighborsReady) return false;
  const next = (idx + 1) % total;
  if (i === next) return true;
  if (preparePrev) {
    const prev = (idx - 1 + total) % total;
    if (i === prev) return true;
  }
  return false;
}

// ============================================================
// HERO BEFORE/AFTER SLIDER
//
// Wide cinematic banner under the nav.
//
// Controls:
//   - Arrow buttons (bare icons, no heavy white circle)
//   - Dot indicator below
//   - Touch/pointer swipe: swipe left → next, swipe right → prev.
//     A minimum horizontal displacement (SWIPE_MIN_X) prevents
//     accidental slide changes during normal vertical scrolling.
//     Vertical-dominant gestures are ignored so page scroll is
//     never blocked.
//   - Autoplay (paused on hover/focus, respects reduced-motion)
// ============================================================

export type ShowcaseSlide =
  | {
      kind: "image";
      id: string;
      beforeUrl: string;
      afterUrl: string;
      beforeAlt: string;
      afterAlt: string;
    }
  | {
      kind: "placeholder";
      id: string;
      variant: ServiceVariant;
    };

interface Props {
  slides?: ShowcaseSlide[];
}

const FALLBACK_SLIDES: ShowcaseSlide[] = [
  { kind: "placeholder", id: "image-enhancement", variant: "image-enhancement" },
  { kind: "placeholder", id: "day-to-dusk", variant: "day-to-dusk" },
  { kind: "placeholder", id: "virtual-staging", variant: "virtual-staging" },
  { kind: "placeholder", id: "floor-plans", variant: "floor-plans" },
  { kind: "placeholder", id: "virtual-renovation", variant: "virtual-renovation" },
  { kind: "placeholder", id: "panorama-staging", variant: "panorama-staging" },
  { kind: "placeholder", id: "aerial-editing", variant: "aerial-editing" },
  { kind: "placeholder", id: "local-package", variant: "local-package" },
];

const AUTOPLAY_MS = 5500;
/** Minimum horizontal pointer travel (px) before recognising a swipe. */
const SWIPE_MIN_X = 40;
/** Maximum vertical travel as a ratio of horizontal — prevents
 *  diagonal drags from triggering a slide change. */
const SWIPE_MAX_RATIO = 1.2;

// Match the actual homepage wrapper padding so high-DPR mobile browsers
// do not select a wider Next Image candidate than either half can render.
const HERO_HALF_SIZES =
  "(min-width: 1024px) calc(50vw - 8px), (min-width: 640px) calc(50vw - 16px), calc(50vw - 12px)";

export default function BeforeAfterShowcase({ slides }: Props) {
  const effective: ShowcaseSlide[] =
    slides && slides.length > 0 ? slides : FALLBACK_SLIDES;

  const [rawIdx, setRawIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [neighborsReady, setNeighborsReady] = useState(false);
  const [preparePrev, setPreparePrev] = useState(false);

  const idx = effective.length > 0 ? rawIdx % effective.length : 0;

  // Pointer-drag state for swipe detection.
  // Using refs avoids re-render on every pointermove.
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);

  // prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const goPrev = useCallback(() => {
    setNeighborsReady(true);
    setRawIdx((i) => (i - 1 + effective.length) % effective.length);
  }, [effective.length]);
  const goNext = useCallback(() => {
    setNeighborsReady(true);
    setRawIdx((i) => (i + 1) % effective.length);
  }, [effective.length]);
  const goTo = useCallback((i: number) => {
    setNeighborsReady(true);
    setRawIdx(i);
  }, []);

  // Autoplay
  useEffect(() => {
    if (paused || reducedMotion) return;
    if (effective.length <= 1) return;
    const t = window.setTimeout(() => {
      goNext();
    }, AUTOPLAY_MS);
    return () => window.clearTimeout(t);
  }, [idx, paused, reducedMotion, effective.length, goNext]);

  useEffect(() => {
    let timeout: number | undefined;

    const schedule = () => {
      timeout = window.setTimeout(() => {
        setNeighborsReady(true);
      }, 500);
    };

    if (document.readyState === "complete") {
      schedule();
    } else {
      window.addEventListener("load", schedule, { once: true });
    }

    return () => {
      window.removeEventListener("load", schedule);
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, []);

  const showNav = effective.length > 1;

  // ── Swipe handlers ──────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only track primary pointer (finger or mouse left-button).
    if (!e.isPrimary) return;
    setPreparePrev(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    isDragging.current = false;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!e.isPrimary || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    dragStart.current = null;

    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    // Require a clear horizontal swipe:
    //   - moved at least SWIPE_MIN_X pixels horizontally
    //   - horizontal dominates over vertical by SWIPE_MAX_RATIO
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
      onMouseEnter={() => {
        setPaused(true);
        setPreparePrev(true);
      }}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => {
        setPaused(true);
        setPreparePrev(true);
      }}
      onBlur={() => setPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Before and after slider"
    >
      {/* ── Slide stage ── */}
      <div
        className="relative w-full overflow-hidden rounded-xl lg:rounded-2xl shadow-xl ring-1 ring-black/10 bg-stone-100 aspect-[16/9] sm:aspect-[21/9] md:aspect-[3/1] lg:aspect-[4/1]"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        // Prevent text/image selection while swiping
        style={{ userSelect: "none", WebkitUserSelect: "none" }}
      >
        {effective.map((slide, i) => {
          const active = i === idx;
          const mounted = isSlideMounted(
            i,
            idx,
            effective.length,
            neighborsReady,
            preparePrev
          );
          return (
            <div
              key={slide.id}
              className={cn(
                "absolute inset-0 transition-opacity duration-700 ease-in-out",
                active ? "opacity-100" : "opacity-0"
              )}
              aria-hidden={!active}
            >
              {mounted &&
                (slide.kind === "image" ? (
                  <ImageBeforeAfter
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
                ))}
            </div>
          );
        })}

        {/* ── Arrow controls — bare icons, no white circle ── */}
        {showNav && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous slide"
              className={cn(
                // Generous tap target (44×44 minimum), centred on the icon
                "absolute left-2 lg:left-4 top-1/2 -translate-y-1/2",
                "w-11 h-11 flex items-center justify-center",
                // Visually only the icon — no background circle
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

      {/* ── Dot indicators ── */}
      {showNav && (
        <div
          className="mt-2 lg:mt-3 flex items-center justify-center gap-0"
          role="tablist"
          aria-label="Slide indicator"
        >
          {effective.map((slide, i) => {
            const isActive = i === idx;
            return (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Show slide ${i + 1} of ${effective.length}`}
                onClick={() => goTo(i)}
                className="group flex h-11 w-11 items-center justify-center rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-2.5 rounded-full transition-all duration-200",
                    isActive
                      ? "w-9 bg-primary"
                      : "w-2.5 bg-stone-300 group-hover:bg-stone-400"
                  )}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ImageBeforeAfter({
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
      <div className="relative w-1/2 overflow-hidden bg-stone-200">
        <Image
          src={beforeUrl}
          alt={beforeAlt}
          fill
          // Each half is ~50% of the banner width at every breakpoint.
          sizes={HERO_HALF_SIZES}
          className="object-cover"
          preload={eager}
        />
      </div>
      <div className="relative w-1/2 overflow-hidden bg-stone-200">
        <Image
          src={afterUrl}
          alt={afterAlt}
          fill
          sizes={HERO_HALF_SIZES}
          className="object-cover"
          preload={eager}
        />
      </div>
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
