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
  /**
   * When true the control is read-only (used while a photo inherits
   * Photo #1's shared preferences). The selected value stays visible.
   */
  disabled?: boolean;
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
  disabled = false,
}: LightingPreferenceToggleProps) {
  const groupName = `${idPrefix}-group`;

  return (
    <fieldset>
      <legend className="mb-2 block text-base font-medium text-foreground">
        {label}
      </legend>
      <div
        role="radiogroup"
        aria-label={label}
        aria-disabled={disabled || undefined}
        className={`grid grid-cols-2 gap-2 ${disabled ? "opacity-60" : ""}`}
      >
        {OPTIONS.map((option) => {
          const optionKey = option.value ? "yes" : "no";
          const id = `${idPrefix}-${optionKey}`;
          const selected = value === option.value;
          return (
            <label
              key={optionKey}
              htmlFor={id}
              className={`relative flex items-center justify-center rounded-lg border px-3 py-2.5 text-center text-sm font-semibold transition-colors focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-1 ${
                disabled ? "cursor-default" : "cursor-pointer"
              } ${
                selected
                  ? "border-primary bg-primary/10 text-primary"
                  : `border-border bg-white text-foreground/70 ${
                      disabled ? "" : "hover:border-primary/40"
                    }`
              }`}
            >
              <input
                id={id}
                type="radio"
                name={groupName}
                value={optionKey}
                checked={selected}
                disabled={disabled}
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
