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
// Image-led, near-full-width hero slider. The stage itself is
// the focal point — no label pills, no captions, no thumbnail
// strip. Navigation uses a simple dot indicator + paired side
// arrows, autoplay is on, and we honour prefers-reduced-motion
// so users who've opted out of motion never see auto-cycling.
// Hovering or focusing the slider pauses autoplay, which keeps
// the UX predictable for keyboard and pointer users.
// ============================================================

interface Slide {
  id: string;
  variant: ServiceVariant;
}

const SLIDES: Slide[] = [
  { id: "image-enhancement", variant: "image-enhancement" },
  { id: "day-to-dusk", variant: "day-to-dusk" },
  { id: "virtual-staging", variant: "virtual-staging" },
  { id: "floor-plans", variant: "floor-plans" },
  { id: "virtual-renovation", variant: "virtual-renovation" },
  { id: "panorama-staging", variant: "panorama-staging" },
  { id: "aerial-editing", variant: "aerial-editing" },
  { id: "local-package", variant: "local-package" },
];

const AUTOPLAY_MS = 5500;

export default function BeforeAfterShowcase() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Detect prefers-reduced-motion at mount and subscribe to changes
  // so a user who toggles their OS setting mid-session sees the
  // slider stop or resume cycling without a reload.
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
    const t = window.setTimeout(() => {
      setIdx((i) => (i + 1) % SLIDES.length);
    }, AUTOPLAY_MS);
    return () => window.clearTimeout(t);
  }, [idx, paused, reducedMotion]);

  const goPrev = () =>
    setIdx((i) => (i - 1 + SLIDES.length) % SLIDES.length);
  const goNext = () => setIdx((i) => (i + 1) % SLIDES.length);
  const goTo = (i: number) => setIdx(i);

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
      {/* Stage — wide, dramatic, no overlay text/pills */}
      <div className="relative w-full overflow-hidden rounded-2xl lg:rounded-3xl shadow-2xl ring-1 ring-black/10 bg-stone-100 aspect-[4/3] sm:aspect-[16/9] lg:aspect-[21/9]">
        {SLIDES.map((slide, i) => (
          <div
            key={slide.id}
            className={cn(
              "absolute inset-0 transition-opacity duration-700 ease-in-out",
              i === idx ? "opacity-100" : "opacity-0"
            )}
            aria-hidden={i !== idx}
          >
            <ServicePlaceholder
              variant={slide.variant}
              showInnerLabels={false}
            />
          </div>
        ))}

        {/* Side arrows — kept simple per spec ("Manual navigation
            is okay if simple"). Sized large on desktop so they
            read as a deliberate UI element rather than tiny
            decorative bits. */}
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
      </div>

      {/* Dot indicators — simple, not thumbnails */}
      <div
        className="mt-6 lg:mt-8 flex items-center justify-center gap-2.5"
        role="tablist"
        aria-label="Slide indicator"
      >
        {SLIDES.map((slide, i) => {
          const isActive = i === idx;
          return (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`Show slide ${i + 1} of ${SLIDES.length}`}
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
    </div>
  );
}
