"use client";

import { useState } from "react";
import ServicePlaceholder, {
  type ServiceVariant,
} from "./ServicePlaceholder";
import { cn } from "@/lib/utils";

// ============================================================
// HERO BEFORE/AFTER SHOWCASE
//
// Designed to be the visual anchor of the homepage hero. Lives
// inside a near-full-width container; the stage itself runs to a
// 16:8.5 aspect on desktop so it reads as a hero image rather
// than a card. A horizontally scrollable thumbnail strip below
// lets visitors swap services without taking the focus away from
// the stage. Pure CSS placeholders — no third-party imagery.
// ============================================================

interface Slide {
  id: string;
  variant: ServiceVariant;
  label: string;
  caption: string;
}

const SLIDES: Slide[] = [
  {
    id: "image-enhancement",
    variant: "image-enhancement",
    label: "Image Enhancement",
    caption:
      "Lifted contrast, balanced color, and clean windows — without losing the natural look.",
  },
  {
    id: "day-to-dusk",
    variant: "day-to-dusk",
    label: "Day to Dusk",
    caption:
      "A daytime exterior turned into a warm dusk shot for a stand-out hero photo.",
  },
  {
    id: "virtual-staging",
    variant: "virtual-staging",
    label: "Virtual Staging",
    caption:
      "Empty rooms turned into furnished spaces buyers can imagine living in.",
  },
  {
    id: "floor-plans",
    variant: "floor-plans",
    label: "Floor Plans",
    caption:
      "Sketches and existing plans redrawn into clean 2D and 3D floor plans.",
  },
  {
    id: "virtual-renovation",
    variant: "virtual-renovation",
    label: "Virtual Renovation",
    caption:
      "Show what a kitchen, bathroom, or facade could look like — before any work begins.",
  },
  {
    id: "panorama-staging",
    variant: "panorama-staging",
    label: "360° Visuals",
    caption:
      "Enhance and stage panoramic shots so every angle of the listing looks intentional.",
  },
  {
    id: "aerial-editing",
    variant: "aerial-editing",
    label: "Aerial Editing",
    caption:
      "Cleaner skies and crisper detail for drone exteriors and listing aerials.",
  },
  {
    id: "local-package",
    variant: "local-package",
    label: "Local Real Estate Media",
    caption:
      "On-location photo, video, and 360 tours across Alicante and Costa Blanca.",
  },
];

export default function BeforeAfterShowcase() {
  const [activeId, setActiveId] = useState(SLIDES[0].id);
  const active = SLIDES.find((s) => s.id === activeId) ?? SLIDES[0];

  return (
    <div>
      {/* Big stage */}
      <div className="relative w-full overflow-hidden rounded-2xl lg:rounded-3xl shadow-2xl ring-1 ring-black/10 bg-stone-100 aspect-[4/3] sm:aspect-[16/9] lg:aspect-[16/8]">
        <ServicePlaceholder variant={active.variant} />

        {/* Service label pill (top-left) */}
        <div className="pointer-events-none absolute left-4 right-4 top-4 sm:left-6 sm:right-6 sm:top-6 lg:left-8 lg:top-8 flex items-start justify-between gap-4">
          <span className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/95 backdrop-blur text-[11px] sm:text-xs font-bold tracking-[0.18em] uppercase text-primary shadow-md">
            {active.label}
          </span>
        </div>

        {/* Caption (bottom) */}
        <div className="pointer-events-none absolute left-4 right-4 bottom-4 sm:left-6 sm:right-6 sm:bottom-6 lg:left-10 lg:right-10 lg:bottom-10 max-w-3xl">
          <p className="text-sm sm:text-base lg:text-xl xl:text-2xl text-white font-medium drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)] leading-snug">
            {active.caption}
          </p>
        </div>
      </div>

      {/* Thumbnail strip */}
      <div className="mt-4 lg:mt-6">
        <div
          className="flex gap-2 sm:gap-3 overflow-x-auto pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory"
          role="tablist"
          aria-label="Service preview slides"
        >
          {SLIDES.map((slide, i) => {
            const isActive = slide.id === activeId;
            return (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveId(slide.id)}
                className={cn(
                  "group flex-shrink-0 w-32 sm:w-40 lg:w-48 rounded-xl overflow-hidden ring-2 transition-all duration-200 snap-start",
                  isActive
                    ? "ring-secondary scale-[1.03] shadow-md"
                    : "ring-white/10 opacity-70 hover:opacity-100 hover:ring-white/30"
                )}
              >
                <div className="relative aspect-[16/10] bg-stone-100">
                  <ServicePlaceholder variant={slide.variant} />
                </div>
                <div
                  className={cn(
                    "px-2.5 py-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.12em] whitespace-nowrap text-left flex items-center justify-between gap-2",
                    isActive
                      ? "bg-white text-primary"
                      : "bg-white/95 text-foreground/80 group-hover:text-primary"
                  )}
                >
                  <span className="truncate">{slide.label}</span>
                  <span className="text-stone-400 font-semibold tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
