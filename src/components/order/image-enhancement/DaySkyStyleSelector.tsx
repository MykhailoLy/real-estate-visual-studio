"use client";

import { Check } from "lucide-react";
import {
  DAY_SKY_STYLES,
  type DaySkyStyleId,
} from "@/lib/image-enhancement";
import type { ServiceOptionMedia } from "@/lib/site-media";
import SelectorMediaTile from "@/components/order/SelectorMediaTile";
import { getBeforeAfterAlt } from "@/lib/before-after-alt";

// ============================================================
// DaySkyStyleSelector — visual radio-card selector for the Day Sky
// Style choice on a Single Exposure item. Exactly one is selected;
// the choice is included in the base price.
//
// Accessibility: native radio inputs (sr-only) inside labels, wrapped
// in a role="radiogroup". The selected card shows a gold border, a
// checkmark, and a subtle shadow — selection is never communicated by
// colour alone (checkmark + ring + aria-checked).
//
// Images are admin-managed (service-options) and passed in as a plain
// record keyed by mediaKey so a missing key falls back to a CSS tile.
// ============================================================

interface DaySkyStyleSelectorProps {
  value: DaySkyStyleId;
  onChange: (value: DaySkyStyleId) => void;
  /** mediaKey → resolved image. Missing keys render a CSS fallback. */
  mediaByKey: Record<string, ServiceOptionMedia>;
  /** Unique id prefix so multiple item cards don't collide. */
  idPrefix: string;
}

export default function DaySkyStyleSelector({
  value,
  onChange,
  mediaByKey,
  idPrefix,
}: DaySkyStyleSelectorProps) {
  const groupName = `${idPrefix}-day-sky`;

  return (
    <div>
      <p className="block text-sm font-medium text-foreground mb-2">
        Select a Day Sky Style
      </p>
      <div
        role="radiogroup"
        aria-label="Select a Day Sky Style"
        className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3"
      >
        {DAY_SKY_STYLES.map((style) => {
          const id = `${idPrefix}-${style.id}`;
          const selected = value === style.id;
          const media = mediaByKey[style.mediaKey] ?? null;
          const mediaUrl =
            media?.imageUrl ?? media?.afterUrl ?? media?.beforeUrl ?? null;
          const pairAlt = getBeforeAfterAlt({
            sharedAlt: media?.altText,
            title: style.label,
            description: media?.description,
          });
          const mediaAlt = media?.imageUrl
            ? media.altText ?? `${style.label} sky example`
            : media?.afterUrl
              ? pairAlt.afterAlt
              : pairAlt.beforeAlt;

          return (
            <label
              key={style.id}
              htmlFor={id}
              className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-white transition-all focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${
                selected
                  ? "border-secondary border-2 shadow-md"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <input
                id={id}
                type="radio"
                name={groupName}
                value={style.id}
                checked={selected}
                onChange={() => onChange(style.id)}
                className="sr-only"
              />

              <SelectorMediaTile
                url={mediaUrl}
                alt={mediaAlt}
                sizes="(min-width: 1024px) 18vw, (min-width: 640px) 33vw, 45vw"
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

              <span
                className={`px-2.5 py-2 text-center text-[12px] font-semibold leading-tight ${
                  selected ? "text-secondary-dark" : "text-foreground/75"
                }`}
              >
                {style.label}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
