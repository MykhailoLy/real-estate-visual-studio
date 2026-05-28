"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ServicePlaceholder, {
  type ServiceVariant,
} from "./ServicePlaceholder";
import { cn } from "@/lib/utils";

// ============================================================
// HERO BEFORE/AFTER SLIDER
//
// Wide cinematic banner under the nav. Each slide is either:
//   - a real before/after image pair sourced from
//     site_media_items (admin-managed via /admin/media)
//   - or a built-in placeholder ServiceVariant used as a
//     fallback when the admin hasn't uploaded any homepage-slider
//     items yet (or Supabase isn't configured)
//
// Behaviour notes:
//   - Autoplay cycles slides every AUTOPLAY_MS, paused on hover
//     and keyboard focus so the UX stays predictable.
//   - Honours prefers-reduced-motion: users with it on never see
//     auto-cycling.
//   - Navigation: side arrows + a dot indicator below.
//
// Server components hand us the resolved slides via the `slides`
// prop. We deliberately do NOT fetch from Supabase in this
// "use client" file — keeping data loading on the server lets the
// page stay statically optimisable when secrets are absent.
// ============================================================

/**
 * One slide. Two shapes are supported in a single union so the
 * server component can pass a mix of real and placeholder slides
 * without coordination — admin-uploaded ones use the image
 * variant, hardcoded fallbacks use the variant variant.
 */
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
  /**
   * Admin-supplied slides. Empty array (or omitted) ⇒ render
   * the built-in placeholder set so the homepage never looks
   * broken.
   */
  slides?: ShowcaseSlide[];
}

/** Fallback set used when no homepage-slider items exist. Mirrors
 *  the original demo content so the page still ships a polished
 *  hero on a fresh deploy. */
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

export default function BeforeAfterShowcase({ slides }: Props) {
  const effective: ShowcaseSlide[] =
    slides && slides.length > 0 ? slides : FALLBACK_SLIDES;

  const [rawIdx, setRawIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Clamp idx to the current slide count during render — no effect needed.
  // If the slide set shrinks (admin unpublishes a slide), we transparently
  // wrap around without a setState-in-effect cascade.
  const idx = effective.length > 0 ? rawIdx % effective.length : 0;

  // Detect prefers-reduced-motion at mount and subscribe to changes
  // so a user toggling their OS setting mid-session sees the slider
  // stop or resume cycling without a reload.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Autoplay timer. Re-armed on every slide change so the dwell on
  // each slide is consistent regardless of how the user got there.
  useEffect(() => {
    if (paused || reducedMotion) return;
    if (effective.length <= 1) return;
    const t = window.setTimeout(() => {
      setRawIdx((i) => (i + 1) % effective.length);
    }, AUTOPLAY_MS);
    return () => window.clearTimeout(t);
  }, [idx, paused, reducedMotion, effective.length]);

  const goPrev = () =>
    setRawIdx((i) => (i - 1 + effective.length) % effective.length);
  const goNext = () => setRawIdx((i) => (i + 1) % effective.length);
  const goTo = (i: number) => setRawIdx(i);

  const showNav = effective.length > 1;

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Before and after slider"
    >
      {/* Stage — wide cinematic banner. The desktop aspect sits
          deliberately between the original 32:9 (~3.56:1) and the
          previous 5:1 attempt: 4:1 keeps the slider feeling like a
          banner strip but is tall enough that the "Remote Digital
          Services" intro strip below the benefits row stays out of
          the first viewport on common laptop and desktop heights,
          while the dots and "Why work with PicchuSpot" benefits
          remain visible directly underneath. */}
      <div className="relative w-full overflow-hidden rounded-xl lg:rounded-2xl shadow-xl ring-1 ring-black/10 bg-stone-100 aspect-[16/9] sm:aspect-[21/9] md:aspect-[3/1] lg:aspect-[4/1]">
        {effective.map((slide, i) => (
          <div
            key={slide.id}
            className={cn(
              "absolute inset-0 transition-opacity duration-700 ease-in-out",
              i === idx ? "opacity-100" : "opacity-0"
            )}
            aria-hidden={i !== idx}
          >
            {slide.kind === "image" ? (
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
            )}
          </div>
        ))}

        {showNav && (
          <>
            {/* Side arrows — kept simple per spec ("Manual
                navigation is okay if simple"). Sized large on
                desktop so they read as a deliberate UI element
                rather than tiny decorative bits. */}
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

      {/* Dot indicators — simple, not thumbnails. Margin tuned so
          the slider + dots together leave just enough room below
          for the benefits row to begin in the first viewport. */}
      {showNav && (
        <div
          className="mt-5 lg:mt-6 flex items-center justify-center gap-2.5"
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

/**
 * Two halves of a real before/after pair. Mirrors the placeholder
 * layout (50/50 split with a centerline divider) so the
 * transition between admin-managed and fallback slides is visually
 * seamless.
 *
 * Uses plain <img> rather than next/image because:
 *   - the source is already a Supabase public URL and we don't
 *     have it in next.config images.remotePatterns
 *   - the slider is a fixed-aspect banner, not an LCP-critical
 *     content image grid, so next/image's optimisation pipeline
 *     buys very little here
 */
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeUrl}
          alt={beforeAlt}
          className="absolute inset-0 w-full h-full object-cover"
          loading={eager ? "eager" : "lazy"}
          decoding="async"
        />
      </div>
      <div className="relative w-1/2 overflow-hidden bg-stone-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={afterUrl}
          alt={afterAlt}
          className="absolute inset-0 w-full h-full object-cover"
          loading={eager ? "eager" : "lazy"}
          decoding="async"
        />
      </div>
      {/* Centerline divider — same affordance as the placeholder
          variant so a mixed slider doesn't visually jump between
          slides. */}
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
