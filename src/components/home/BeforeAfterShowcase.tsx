"use client";

import { useState } from "react";
import ServicePlaceholder, {
  type ServiceVariant,
} from "./ServicePlaceholder";
import { cn } from "@/lib/utils";

// ============================================================
// HERO BEFORE/AFTER SHOWCASE
//
// A static (non-autoplaying) before/after surface with a row of
// labelled tabs underneath. Clicking a tab swaps the placeholder
// underneath, keeping the user in control. Pure CSS placeholders
// — no third-party imagery.
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
      {/* Stage */}
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/5 bg-stone-100">
        <ServicePlaceholder variant={active.variant} />

        {/* Overlay copy */}
        <div className="pointer-events-none absolute left-4 right-4 top-4 flex items-start justify-between gap-4">
          <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/90 backdrop-blur text-[11px] font-semibold tracking-[0.15em] uppercase text-primary shadow-sm">
            {active.label}
          </span>
          <span className="hidden sm:inline-flex px-3 py-1.5 rounded-full bg-primary/90 text-white backdrop-blur text-[11px] font-semibold tracking-[0.15em] uppercase shadow-sm">
            Before / After
          </span>
        </div>

        <div className="pointer-events-none absolute left-4 right-4 bottom-4">
          <p className="text-sm sm:text-base text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] max-w-2xl">
            {active.caption}
          </p>
        </div>
      </div>

      {/* Slide picker */}
      <div className="mt-4">
        <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Service preview slides">
          {SLIDES.map((slide) => {
            const isActive = slide.id === activeId;
            return (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveId(slide.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-foreground/70 border-border hover:border-primary/40 hover:text-primary"
                )}
              >
                {slide.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
