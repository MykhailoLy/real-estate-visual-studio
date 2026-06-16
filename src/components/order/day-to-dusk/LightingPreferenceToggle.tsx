"use client";

// ============================================================
// LightingPreferenceToggle — two-state segmented Yes / No control
// used by the Day to Dusk lighting preferences (interior lights,
// exterior lights, pool lights).
//
// Uses native radio inputs for full keyboard accessibility (arrow
// keys move between Yes / No). The value is a real boolean. Selection
// is INCLUDED in the base price and never affects the subtotal.
// ============================================================

interface LightingPreferenceToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  /** Unique id prefix so multiple controls per item don't collide. */
  idPrefix: string;
}

const OPTIONS: { value: boolean; label: string }[] = [
  { value: true, label: "Yes" },
  { value: false, label: "No" },
];

export default function LightingPreferenceToggle({
  label,
  value,
  onChange,
  idPrefix,
}: LightingPreferenceToggleProps) {
  const groupName = `${idPrefix}-group`;

  return (
    <fieldset>
      <legend className="block text-sm font-medium text-foreground mb-1.5">
        {label}
      </legend>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid grid-cols-2 gap-2"
      >
        {OPTIONS.map((option) => {
          const optionKey = option.value ? "yes" : "no";
          const id = `${idPrefix}-${optionKey}`;
          const selected = value === option.value;
          return (
            <label
              key={optionKey}
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
                value={optionKey}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
