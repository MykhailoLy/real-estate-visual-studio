"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STAGING_STYLE_CARDS,
  type StagingStyleCard,
} from "@/data/order-options";

interface StyleSelectorProps {
  /** The currently selected style label. Empty string means none selected. */
  value: string;
  /** Called with the new style label when a card is clicked. */
  onChange: (label: string) => void;
  /** Optional unique id used for the radio group's name attribute. */
  groupName?: string;
  /** Optional visible label id for the radiogroup accessible name. */
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  disabled?: boolean;
}

/**
 * Visual furniture-style card grid.
 *
 * Renders one card per entry in STAGING_STYLE_CARDS. Each card shows a
 * future image area plus the style name. Selecting a card calls onChange
 * with the same string the dropdown uses, so dropdown <-> cards stay in
 * sync from a single piece of state on the parent.
 *
 * If the style image file at /public/images/styles/<slug>.jpg is missing,
 * we silently fall back to a clean named placeholder block — no broken
 * image icons, no console noise. Real images can be dropped into that
 * folder later without code changes.
 */
export default function StyleSelector({
  value,
  onChange,
  groupName,
  ariaLabelledBy,
  ariaDescribedBy,
  ariaInvalid = false,
  disabled = false,
}: StyleSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabelledBy ? undefined : "Furniture style"}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid || undefined}
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5"
    >
      {STAGING_STYLE_CARDS.map((card, index) => (
        <StyleCard
          key={card.label}
          card={card}
          selected={value === card.label}
          onClick={() => onChange(card.label)}
          groupName={groupName}
          disabled={disabled}
          validationControl={index === 0}
        />
      ))}
    </div>
  );
}

function StyleCard({
  card,
  selected,
  onClick,
  groupName,
  disabled,
  validationControl,
}: {
  card: StagingStyleCard;
  selected: boolean;
  onClick: () => void;
  groupName?: string;
  disabled: boolean;
  validationControl: boolean;
}) {
  // Track image load failures locally so we can fall back to a placeholder.
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={card.label}
      data-style={card.label}
      data-group={groupName}
      data-validation-control={validationControl ? "" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group relative text-left rounded-lg border bg-white overflow-hidden transition-all",
        "hover:border-primary/40 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none",
        selected
          ? "border-primary ring-2 ring-primary/30 shadow-sm"
          : "border-border"
      )}
    >
      <div className="relative aspect-[4/3] bg-stone-100">
        {imgFailed ? (
          // Clean named placeholder — used when the image file does not
          // exist yet at /public/images/styles/<slug>.jpg.
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-stone-100 via-stone-50 to-stone-200">
            <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-foreground/75 px-2 text-center">
              {card.label}
            </span>
          </div>
        ) : (
          // Plain <img> rather than next/image: these images live in
          // /public, may not exist yet, and we want a synchronous onError
          // fallback. next/image would log a 404 and is overkill here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.imageSrc}
            alt={card.label}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {selected && (
          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center shadow-sm">
            <Check className="w-3 h-3" strokeWidth={3} aria-hidden="true" />
          </div>
        )}
      </div>
      <div
        className={cn(
          "px-2.5 py-2 text-xs font-medium border-t",
          selected
            ? "text-primary border-primary/30 bg-primary/5"
            : "text-foreground border-border"
        )}
      >
        {card.label}
      </div>
    </button>
  );
}
