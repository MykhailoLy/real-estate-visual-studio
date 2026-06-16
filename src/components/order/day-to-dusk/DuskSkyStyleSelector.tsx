"use client";

import { Check } from "lucide-react";
import { DUSK_STYLES, type DuskStyleId } from "@/lib/day-to-dusk";
import type { ServiceOptionImage } from "@/lib/site-media";
import SelectorMediaTile from "@/components/order/image-enhancement/SelectorMediaTile";

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

  return (
    <div>
      <p className="block text-sm font-medium text-foreground mb-2">
        Select a Dusk Sky Style
      </p>
      <div
        role="radiogroup"
        aria-label="Select a Dusk Sky Style"
        aria-disabled={disabled || undefined}
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ${
          disabled ? "opacity-60" : ""
        }`}
      >
        {DUSK_STYLES.map((style) => {
          const id = `${idPrefix}-${style.id}`;
          const selected = value === style.id;
          const media = images[style.mediaKey] ?? null;

          return (
            <label
              key={style.id}
              htmlFor={id}
              className={`group relative flex flex-col overflow-hidden rounded-xl border bg-white transition-all focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${
                disabled ? "cursor-default" : "cursor-pointer"
              } ${
                selected
                  ? "border-secondary border-2 shadow-md"
                  : `border-border ${
                      disabled ? "" : "hover:border-primary/40"
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
                sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
                rounded="rounded-none"
              />

              {selected && (
                <span
                  className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-white shadow"
                  aria-hidden
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              )}

              <span className="flex flex-col gap-0.5 px-3 py-2.5">
                <span
                  className={`text-[13px] font-semibold leading-tight ${
                    selected ? "text-secondary-dark" : "text-foreground/80"
                  }`}
                >
                  {style.label}
                </span>
                <span className="text-[11px] leading-snug text-muted">
                  {style.supportingText}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
