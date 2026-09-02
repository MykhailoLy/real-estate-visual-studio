"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ComparisonHeroDivider,
  ComparisonHeroFooter,
  HeroSlideIndicatorRail,
} from "@/components/media/ComparisonHeroChrome";
import {
  getHeroServicePresentation,
  type RemoteServiceLocale,
} from "@/lib/pricing/remote-service-presentation";
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
//   - Vertical dot navigation over the left side of the image stage
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
      serviceSlug?: string | null;
    }
  | {
      kind: "placeholder";
      id: string;
      variant: ServiceVariant;
      serviceSlug?: string;
    };

interface Props {
  slides?: ShowcaseSlide[];
  locale?: RemoteServiceLocale;
}

const FALLBACK_SLIDES: ShowcaseSlide[] = [
  {
    kind: "placeholder",
    id: "image-enhancement",
    variant: "image-enhancement",
    serviceSlug: "image-enhancement",
  },
  {
    kind: "placeholder",
    id: "day-to-dusk",
    variant: "day-to-dusk",
    serviceSlug: "day-to-dusk",
  },
  {
    kind: "placeholder",
    id: "virtual-staging",
    variant: "virtual-staging",
    serviceSlug: "virtual-staging",
  },
  {
    kind: "placeholder",
    id: "item-removal",
    variant: "item-removal",
    serviceSlug: "item-removal-virtual-cleaning",
  },
  {
    kind: "placeholder",
    id: "floor-plans",
    variant: "floor-plans",
    serviceSlug: "floor-plans",
  },
  {
    kind: "placeholder",
    id: "virtual-renovation",
    variant: "virtual-renovation",
    serviceSlug: "virtual-renovation",
  },
  {
    kind: "placeholder",
    id: "panorama-staging",
    variant: "panorama-staging",
    serviceSlug: "360-virtual-staging",
  },
  {
    kind: "placeholder",
    id: "aerial-editing",
    variant: "aerial-editing",
    serviceSlug: "aerial-editing",
  },
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

function safelyCapturePointer(element: HTMLDivElement, pointerId: number) {
  try {
    if (typeof element.setPointerCapture === "function") {
      element.setPointerCapture(pointerId);
    }
  } catch {
    // Pointer capture can fail if the pointer is no longer active.
  }
}

function safelyReleasePointer(element: HTMLDivElement, pointerId: number) {
  try {
    if (
      typeof element.hasPointerCapture === "function" &&
      element.hasPointerCapture(pointerId)
    ) {
      element.releasePointerCapture(pointerId);
    }
  } catch {
    // A cancelled pointer may already have released capture implicitly.
  }
}

export default function BeforeAfterShowcase({ slides, locale = "en" }: Props) {
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

  const activeSlide = effective[idx];
  const activeService = getHeroServicePresentation(
    activeSlide?.serviceSlug,
    locale,
  );

  // ── Swipe handlers ──────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only track primary pointer (finger or mouse left-button).
    if (!e.isPrimary) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;

    setPreparePrev(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    safelyCapturePointer(e.currentTarget, e.pointerId);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary) return;

    const start = dragStart.current;
    dragStart.current = null;
    safelyReleasePointer(e.currentTarget, e.pointerId);
    if (!start) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

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

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStart.current = null;
    safelyReleasePointer(e.currentTarget, e.pointerId);
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
      <div
        data-testid="homepage-hero-frame"
        className="w-full overflow-hidden rounded-xl bg-primary shadow-xl ring-1 ring-black/10 lg:rounded-2xl"
      >
        {/* ── Slide stage ── */}
        <div
          data-testid="homepage-hero-image-stage"
          className="relative w-full overflow-hidden bg-stone-100 aspect-[16/9] sm:aspect-[21/9] md:aspect-[3/1] lg:aspect-[4/1]"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onLostPointerCapture={() => {
            dragStart.current = null;
          }}
          // Prevent text/image selection while swiping
          style={{
            touchAction: "pan-y",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
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
                      showDivider={false}
                      showInnerLabels={false}
                    />
                  ))}
              </div>
            );
          })}

          <ComparisonHeroDivider />

          {effective.length > 1 && (
            <HeroSlideIndicatorRail
              slides={effective}
              activeIndex={idx}
              onSelect={goTo}
              locale={locale}
            />
          )}
        </div>

        <ComparisonHeroFooter
          service={activeService}
          locale={locale}
          ctaHref={activeService?.href}
          ctaLabel={activeService?.ctaLabel}
          analyticsLocation="homepage_hero"
          analyticsEvent="pricing_cta"
        />
      </div>
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
          loading={eager ? "eager" : undefined}
          fetchPriority={eager ? "high" : undefined}
          draggable={false}
        />
      </div>
      <div className="relative w-1/2 overflow-hidden bg-stone-200">
        <Image
          src={afterUrl}
          alt={afterAlt}
          fill
          sizes={HERO_HALF_SIZES}
          className="object-cover"
          draggable={false}
        />
      </div>
    </div>
  );
}
