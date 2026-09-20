"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import ServicePlaceholder, {
  type ServiceVariant,
} from "@/components/home/ServicePlaceholder";
import {
  ComparisonHeroDivider,
  ComparisonHeroFooter,
  HeroSlideIndicatorRail,
} from "@/components/media/ComparisonHeroChrome";
import type { PortfolioServiceSlug } from "@/lib/portfolio-service-meta";
import {
  getHeroServicePresentation,
  type RemoteServiceLocale,
} from "@/lib/pricing/remote-service-presentation";
import { cn } from "@/lib/utils";

// Initial render mounts active slide content only. Neighbouring
// content is enabled after page load, or immediately before any
// navigation, while distant slides stay unmounted.
function isSlideMounted(
  i: number,
  idx: number,
  total: number,
  neighborsReady: boolean
): boolean {
  if (total <= 1) return true;
  if (i === idx) return true;
  if (!neighborsReady) return false;
  const next = (idx + 1) % total;
  const prev = (idx - 1 + total) % total;
  return i === next || i === prev;
}

// ============================================================
// SERVICE PAGE HERO SLIDER
//
// Reusable before/after slider for individual service pages.
//
// Controls:
//   - Vertical indicator rail inside the image stage
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
  serviceSlug: PortfolioServiceSlug;
  locale?: RemoteServiceLocale;
  orderHref: string;
  orderLabel: string;
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

export default function ServicePageSlider({
  slides,
  serviceSlug,
  locale = "en",
  orderHref,
  orderLabel,
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
  const [neighborsReady, setNeighborsReady] = useState(false);

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

  const goPrev = useCallback(() => {
    setNeighborsReady(true);
    setRawIdx((i) => (i - 1 + total) % total);
  }, [total]);
  const goNext = useCallback(() => {
    setNeighborsReady(true);
    setRawIdx((i) => (i + 1) % total);
  }, [total]);
  const goTo = useCallback((i: number) => {
    setNeighborsReady(true);
    setRawIdx(i);
  }, []);

  // Autoplay
  useEffect(() => {
    if (paused || reducedMotion || total <= 1) return;
    const t = window.setTimeout(() => {
      goNext();
    }, autoplayMs);
    return () => window.clearTimeout(t);
  }, [idx, paused, reducedMotion, total, autoplayMs, goNext]);

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

  if (total === 0) return null;

  const showNav = total > 1;
  const service = getHeroServicePresentation(serviceSlug, locale);

  // ── Swipe handlers ──────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;

    setNeighborsReady(true);
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
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      role="region"
      aria-roledescription={locale === "es" ? "carrusel" : "carousel"}
      aria-label={ariaLabel}
    >
      <div
        data-testid="service-hero-frame"
        className="w-full overflow-hidden rounded-xl bg-primary shadow-xl ring-1 ring-black/10 lg:rounded-2xl"
      >
        {/* Keep the original image-stage aspect chain; the footer sits below it. */}
        <div
          data-testid="service-hero-image-stage"
          className={cn(
            "relative w-full overflow-hidden bg-stone-100",
            mobileAspect,
            "sm:aspect-[21/9] md:aspect-[3/1] lg:aspect-[4/1]",
          )}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onLostPointerCapture={() => {
            dragStart.current = null;
          }}
          style={{
            touchAction: "pan-y",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        >
          {slides.map((slide, i) => {
            const active = i === idx;
            const mounted = isSlideMounted(i, idx, total, neighborsReady);
            return (
              <div
                key={slide.id}
                className={cn(
                  "absolute inset-0 transition-opacity duration-700 ease-in-out",
                  active ? "opacity-100" : "opacity-0",
                )}
                aria-hidden={!active}
              >
                {mounted &&
                  (slide.kind === "image" ? (
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
                      showDivider={false}
                      showInnerLabels={false}
                      labels={locale === "es" ? { ariaLabel: "Vista previa de antes y después" } : undefined}
                    />
                  ))}
              </div>
            );
          })}

          <ComparisonHeroDivider />

          {showNav && (
            <HeroSlideIndicatorRail
              slides={slides}
              activeIndex={idx}
              onSelect={goTo}
              locale={locale}
            />
          )}
        </div>

        <ComparisonHeroFooter
          service={service}
          locale={locale}
          ctaHref={orderHref}
          ctaLabel={orderLabel}
          analyticsLocation="service_hero"
          analyticsEvent="order_intent"
        />
      </div>
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
      ? "object-contain p-3 sm:p-4"
      : "object-cover";

  return (
    <div className="absolute inset-0 flex">
      {/* Before half */}
      <div className={`relative w-1/2 overflow-hidden ${imageBackground}`}>
        <Image
          src={beforeUrl}
          alt={beforeAlt}
        fill
        sizes={HERO_HALF_SIZES}
        className={imgCls}
        loading={eager ? "eager" : undefined}
        fetchPriority={eager ? "high" : undefined}
        draggable={false}
        />
      </div>

      {/* After half */}
      <div className={`relative w-1/2 overflow-hidden ${imageBackground}`}>
        <Image
          src={afterUrl}
          alt={afterAlt}
        fill
        sizes={HERO_HALF_SIZES}
        className={imgCls}
        draggable={false}
      />
    </div>
    </div>
  );
}
