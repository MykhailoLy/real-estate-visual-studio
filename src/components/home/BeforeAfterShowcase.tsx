"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
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
//   - Arrow buttons with subtle contrast backing
//   - Dot indicator integrated into the navy service footer
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
  const activeSlide = effective[idx];
  const activeService = getHomeHeroServicePresentation(
    activeSlide?.serviceSlug,
    locale,
  );
  const showFooter = showNav || Boolean(activeService);

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
                {active && (
                  <BeforeAfterLabels
                    beforeLabel={locale === "es" ? "ANTES" : "BEFORE"}
                    afterLabel={locale === "es" ? "DESPUÉS" : "AFTER"}
                  />
                )}
              </div>
            );
          })}

          {showNav && (
            <>
              <HeroArrowControl direction="previous" onClick={goPrev} />
              <HeroArrowControl direction="next" onClick={goNext} />
            </>
          )}
        </div>

        {showFooter && (
          <HeroServiceFooter
            service={activeService}
            slides={effective}
            activeIndex={idx}
            onSelect={goTo}
          />
        )}
      </div>
    </div>
  );
}

function BeforeAfterLabels({
  beforeLabel,
  afterLabel,
}: {
  beforeLabel: string;
  afterLabel: string;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between sm:inset-x-4 sm:top-3.5"
    >
      <span className="rounded-md border border-white/55 bg-white/85 px-2 py-1 text-[13px] font-bold uppercase tracking-[0.08em] text-primary sm:text-sm backdrop-blur-sm">
        {beforeLabel}
      </span>
      <span className="rounded-md border border-white/55 bg-white/85 px-2 py-1 text-[13px] font-bold uppercase tracking-[0.08em] text-primary sm:text-sm backdrop-blur-sm">
        {afterLabel}
      </span>
    </div>
  );
}

function HeroServiceFooter({
  service,
  slides,
  activeIndex,
  onSelect,
}: {
  service: HomeHeroServicePresentation | null;
  slides: ShowcaseSlide[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  const showNav = slides.length > 1;
  return (
    <div
      data-testid="hero-service-footer"
      className={cn(
        "grid w-full bg-primary px-3 py-1 text-white",
        showNav
          ? "min-h-[4.25rem] grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto] gap-x-2 sm:min-h-14 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:grid-rows-1 sm:items-center sm:gap-x-3 sm:px-4 sm:py-2 lg:px-5"
          : "min-h-[3.25rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 sm:min-h-14 sm:px-4 lg:px-5",
      )}
    >
      <span className="min-w-0 truncate text-[13px] font-bold uppercase leading-tight tracking-[0.04em] text-white sm:tracking-[0.06em] lg:text-sm">
        {service?.name}
      </span>

      {showNav && (
        <HeroSlideDots
          slides={slides}
          activeIndex={activeIndex}
          onSelect={onSelect}
        />
      )}

      {service && (
        <TrackedLink
          href={service.href}
          prefetch={false}
          analyticsLabel={service.ctaLabel}
          analyticsLocation="homepage_hero"
          analyticsEvent="pricing_cta"
          serviceSlug={service.mediaSlug}
          className="col-start-2 row-start-1 inline-flex min-h-7 items-center justify-self-end gap-1.5 rounded-sm px-1 text-[13px] font-bold text-secondary transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary sm:col-start-3 sm:min-h-8 sm:text-sm"
        >
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
          <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </TrackedLink>
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
  return (
    <div
      data-testid="hero-slide-dots"
      className="col-span-2 row-start-2 flex items-center justify-center gap-0 justify-self-center sm:col-span-1 sm:col-start-2 sm:row-start-1"
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
            className="group flex h-7 w-7 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-primary sm:h-8 sm:w-8"
          >
            <span
              aria-hidden
              className={cn(
                "h-2 rounded-full transition-all duration-200",
                isActive
                  ? "w-6 bg-white"
                  : "w-2 bg-white/40 group-hover:bg-white/60",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

function HeroArrowControl({
  direction,
  onClick,
}: {
  direction: "previous" | "next";
  onClick: () => void;
}) {
  const isPrevious = direction === "previous";
  const Icon = isPrevious ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isPrevious ? "Previous slide" : "Next slide"}
      className={cn(
        "group absolute top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent",
        isPrevious ? "left-2 lg:left-4" : "right-2 lg:right-4",
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-primary/25 text-white backdrop-blur-sm transition-colors group-hover:bg-primary/40">
        <Icon className="h-6 w-6 lg:h-7 lg:w-7" strokeWidth={2.2} aria-hidden />
      </span>
    </button>
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
        />
      </div>
      <div className="relative w-1/2 overflow-hidden bg-stone-200">
        <Image
          src={afterUrl}
          alt={afterAlt}
          fill
          sizes={HERO_HALF_SIZES}
          className="object-cover"
        />
      </div>
      <div
        aria-hidden
        className="absolute top-0 bottom-0 left-1/2 w-[2px] -translate-x-1/2 bg-white/85 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]"
      />
    </div>
  );
}
