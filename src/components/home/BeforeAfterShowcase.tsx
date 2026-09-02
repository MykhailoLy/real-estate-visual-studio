"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import TrackedLink from "@/components/analytics/TrackedLink";
import { CatalogPriceText } from "@/components/pricing/currency-client";
import {
  getHomeHeroServicePresentation,
  type HomeHeroServicePresentation,
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
  const activeService = getHomeHeroServicePresentation(
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

          <div
            data-testid="hero-comparison-divider"
            aria-hidden
            className="absolute top-0 bottom-0 left-1/2 z-10 w-[2px] -translate-x-1/2 bg-white/85 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]"
          />

          {effective.length > 1 && (
            <HeroSlideDots
              slides={effective}
              activeIndex={idx}
              onSelect={goTo}
            />
          )}
        </div>

        <HeroServiceFooter
          service={activeService}
          locale={locale}
        />
      </div>
    </div>
  );
}

function HeroServiceFooter({
  service,
  locale,
}: {
  service: HomeHeroServicePresentation | null;
  locale: RemoteServiceLocale;
}) {
  const beforeLabel = locale === "es" ? "ANTES" : "BEFORE";
  const afterLabel = locale === "es" ? "DESPUÉS" : "AFTER";

  return (
    <div
      data-testid="hero-service-footer"
      className="grid min-h-[3.75rem] w-full grid-cols-2 grid-rows-[auto_auto] content-center items-center gap-y-0.5 bg-[#071A2B] px-3 py-1 text-white md:min-h-14 md:grid-cols-[1fr_auto_1fr] md:grid-rows-1 md:gap-y-0 md:px-4 md:py-2 lg:px-5"
    >
      <span className="col-start-1 row-start-1 justify-self-start text-sm font-bold uppercase leading-none tracking-[0.08em] text-white md:text-base 2xl:text-[17px]">
        {beforeLabel}
      </span>

      <span className="col-start-2 row-start-1 justify-self-end text-sm font-bold uppercase leading-none tracking-[0.08em] text-white md:col-start-3 md:text-base 2xl:text-[17px]">
        {afterLabel}
      </span>

      {service && (
        <TrackedLink
          href={service.href}
          prefetch={false}
          analyticsLabel={service.ctaLabel}
          analyticsLocation="homepage_hero"
          analyticsEvent="pricing_cta"
          serviceSlug={service.mediaSlug}
          className="group col-span-2 col-start-1 row-start-2 inline-flex min-h-5 max-w-full flex-wrap items-center justify-center justify-self-center rounded-sm px-1 text-center text-[13px] leading-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C7A94E] md:col-span-1 md:col-start-2 md:row-start-1 md:text-[15px] 2xl:text-base"
        >
          <span className="min-w-0 text-center font-bold uppercase tracking-[0.04em] text-[#C7A94E] transition-colors group-hover:text-[#d8bf72]">
            {service.name}
          </span>
          <span className="inline-flex whitespace-nowrap items-baseline gap-1.5 font-bold text-white">
            <span aria-hidden className="ml-1.5 text-white/40">
              ·
            </span>
            {service.price.kind === "catalog" ? (
              <CatalogPriceText
                priceKey={service.price.priceKey}
                prefix={service.price.prefix}
                suffix={service.price.suffix}
                trimWholeCents
              />
            ) : (
              service.price.label
            )}
          </span>
        </TrackedLink>
      )}

      {!service && (
        <span
          aria-hidden
          className="col-span-2 col-start-1 row-start-2 min-h-5 md:col-span-1 md:col-start-2 md:row-start-1"
        />
      )}
    </div>
  );
}

function HeroSlideDots({
  slides,
  activeIndex,
  onSelect,
}: {
  slides: ShowcaseSlide[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  // Keep all nine targets non-overlapping inside the preserved short stage:
  // full 28/32px widths, compact heights until the stage can fit 32px squares.
  return (
    <div
      data-testid="hero-slide-dots"
      className="absolute top-1/2 left-3 z-20 flex -translate-y-1/2 flex-col items-center justify-center md:left-4 lg:left-5"
      role="tablist"
      aria-label="Slide indicator"
    >
      {slides.map((slide, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={slide.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={`Show slide ${index + 1} of ${slides.length}`}
            onClick={() => onSelect(index)}
            className="group flex h-5 w-7 items-center justify-center rounded-full focus:outline-none md:h-[26px] md:w-8 xl:h-8"
          >
            <span
              aria-hidden
              className={cn(
                "rounded-full border shadow-[0_1px_4px_rgba(0,0,0,0.4)] transition-all duration-200 group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-[#C7A94E]",
                isActive
                  ? "h-3 w-3 border-white/90 bg-[#C7A94E] ring-1 ring-[#071A2B]/35"
                  : "h-2.5 w-2.5 border-white/70 bg-primary/50 group-hover:bg-primary/65",
              )}
            />
          </button>
        );
      })}
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
