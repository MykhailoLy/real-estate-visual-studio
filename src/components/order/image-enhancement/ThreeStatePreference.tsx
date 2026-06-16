"use client";

import {
  THREE_STATE_VALUES,
  THREE_STATE_LABELS,
  type ThreeStateValue,
} from "@/lib/image-enhancement";

// ============================================================
// ThreeStatePreference — segmented radio control with the three
// states used by Single Exposure preferences:
//   Let Our Experts Decide · Yes · No
//
// Uses native radio inputs for full keyboard accessibility (arrow
// keys move between options). Selection never affects the price.
// ============================================================

interface ThreeStatePreferenceProps {
  label: string;
  value: ThreeStateValue;
  onChange: (value: ThreeStateValue) => void;
  /** Unique id prefix so multiple controls per item don't collide. */
  idPrefix: string;
}

export default function ThreeStatePreference({
  label,
  value,
  onChange,
  idPrefix,
}: ThreeStatePreferenceProps) {
  const groupName = `${idPrefix}-group`;

  return (
    <fieldset>
      <legend className="block text-sm font-medium text-foreground mb-1.5">
        {label}
      </legend>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid grid-cols-3 gap-2"
      >
        {THREE_STATE_VALUES.map((option) => {
          const id = `${idPrefix}-${option}`;
          const selected = value === option;
          return (
            <label
              key={option}
              htmlFor={id}
              className={`relative flex cursor-pointer items-center justify-center rounded-lg border px-2 py-2 text-center text-[12px] font-semibold transition-colors focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-1 ${
                selected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-white text-foreground/70 hover:border-primary/40"
              }`}
            >
              <input
                id={id}
                type="radio"
                name={groupName}
                value={option}
                checked={selected}
                onChange={() => onChange(option)}
                className="sr-only"
              />
              {THREE_STATE_LABELS[option]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
