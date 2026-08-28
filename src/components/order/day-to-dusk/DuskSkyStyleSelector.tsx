"use client";

import { useState } from "react";
import { Check, Maximize2 } from "lucide-react";
import {
  DUSK_STYLES,
  type DuskStyleConfig,
  type DuskStyleId,
} from "@/lib/day-to-dusk";
import type { ServiceOptionImage } from "@/lib/site-media";
import SelectorMediaTile from "@/components/order/SelectorMediaTile";
import ImageLightbox from "@/components/pricing/ImageLightbox";

// ============================================================
// DuskSkyStyleSelector — visual radio-card selector for the Dusk Sky
// Style choice on a Day to Dusk item. Exactly one is selected; the
// choice is INCLUDED in the base price (it never changes the subtotal).
//
// Accessibility: native radio inputs (sr-only) inside labels, wrapped
// in a role="radiogroup". The selected card shows a gold border, a
// checkmark, a subtle shadow, and a strong focus ring — selection is
// never communicated by colour alone (checkmark + ring + aria-checked).
//
// Responsive grid: 1 column on mobile, 2 on tablet, 3 on desktop, so
// the 16:9 examples and their supporting text stay readable.
//
// Images are admin-managed (service-options) and passed in as a plain
// record keyed by mediaKey so a missing key falls back to a CSS tile.
// ============================================================

interface DuskSkyStyleSelectorProps {
  value: DuskStyleId;
  onChange: (value: DuskStyleId) => void;
  /** mediaKey → resolved image. Missing keys render a CSS fallback. */
  images: Record<string, ServiceOptionImage>;
  /** Unique id prefix so multiple item cards don't collide. */
  idPrefix: string;
  /**
   * When true the selector is read-only (used while a photo inherits
   * Photo #1's shared preferences). The selected value stays visible.
   */
  disabled?: boolean;
}

export default function DuskSkyStyleSelector({
  value,
  onChange,
  images,
  idPrefix,
  disabled = false,
}: DuskSkyStyleSelectorProps) {
  const groupName = `${idPrefix}-dusk-sky`;
  const [activeStyle, setActiveStyle] = useState<DuskStyleConfig | null>(null);
  const activeMedia = activeStyle ? images[activeStyle.mediaKey] ?? null : null;

  return (
    <div>
      <h3
        id={`${idPrefix}-dusk-style-title`}
        className="mb-2 block text-xl font-semibold leading-tight text-primary sm:text-[22px]"
      >
        Select a Dusk Sky Style
      </h3>
      <p className="mb-5 max-w-2xl text-sm leading-6 text-muted">
        Choose the atmosphere that best suits this property. Open any example
        to inspect the sky treatment in more detail.
      </p>
      <div
        role="radiogroup"
        aria-labelledby={`${idPrefix}-dusk-style-title`}
        aria-disabled={disabled || undefined}
        className={`grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 ${
          disabled ? "opacity-60" : ""
        }`}
      >
        {DUSK_STYLES.map((style) => {
          const id = `${idPrefix}-${style.id}`;
          const selected = value === style.id;
          const media = images[style.mediaKey] ?? null;

          return (
            <div key={style.id} className="relative min-w-0">
              <label
                htmlFor={id}
                className={`group relative flex h-full flex-col overflow-hidden rounded-xl border bg-white transition-all focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${
                  disabled ? "cursor-default" : "cursor-pointer"
                } ${
                  selected
                    ? "border-2 border-secondary shadow-md"
                    : `border-border ${
                        disabled ? "" : "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
                      }`
                }`}
              >
                <input
                  id={id}
                  type="radio"
                  name={groupName}
                  value={style.id}
                  checked={selected}
                  disabled={disabled}
                  onChange={() => onChange(style.id)}
                  className="sr-only"
                />

                <SelectorMediaTile
                  url={media?.url ?? null}
                  alt={media?.alt ?? `${style.label} dusk sky example`}
                  sizes="(min-width: 1440px) 17vw, (min-width: 1024px) 22vw, (min-width: 768px) 45vw, 92vw"
                  rounded="rounded-none"
                />

                {selected && (
                  <span
                    className="absolute left-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-white shadow"
                    aria-hidden
                  >
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                )}

                <span className="flex flex-1 flex-col gap-1 px-4 py-3.5">
                  <span
                    className={`text-base font-semibold leading-tight ${
                      selected ? "text-secondary-dark" : "text-foreground/90"
                    }`}
                  >
                    {style.label}
                  </span>
                  <span className="line-clamp-2 text-sm leading-5 text-muted">
                    {style.supportingText}
                  </span>
                </span>
              </label>

              {media?.url ? (
                <button
                  type="button"
                  onClick={() => setActiveStyle(style)}
                  aria-label={`View ${style.label} example larger`}
                  className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-white/60 bg-primary/90 text-white shadow-md backdrop-blur-sm transition-colors hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
                >
                  <Maximize2 className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {activeStyle && activeMedia?.url ? (
        <ImageLightbox
          images={[
            {
              src: activeMedia.url,
              alt: activeMedia.alt ?? `${activeStyle.label} dusk sky example`,
            },
          ]}
          variant="photo"
          title={`${activeStyle.label} example`}
          onClose={() => setActiveStyle(null)}
        />
      ) : null}
    </div>
  );
}
