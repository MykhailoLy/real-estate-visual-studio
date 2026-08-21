"use client";

// ============================================================
// ApplyToAllPreferencesToggle — single global control that shares
// Photo #1's preferences across every photo in a Day to Dusk order.
//
// Rendered ONCE, below the final photo card and before "Add Another
// Photo", and only when there are 2+ photos. Replaces the old
// per-card "Apply to all" links so the action is no longer duplicated.
//
// Styled as a clear, bordered card (not a small text link): real
// checkbox, bold primary label, smaller explanatory line, full-row
// clickable label, with visible checked / hover / keyboard-focus states.
// ============================================================

interface ApplyToAllPreferencesToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function ApplyToAllPreferencesToggle({
  checked,
  onChange,
}: ApplyToAllPreferencesToggleProps) {
  return (
    <label
      className={[
        "flex items-start gap-3 rounded-xl border p-5 cursor-pointer transition-colors",
        "focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2",
        checked
          ? "border-primary bg-primary/5"
          : "border-border bg-white hover:border-primary/40",
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-border text-primary focus:ring-primary"
      />
      <span className="min-w-0">
        <span className="block text-base font-bold text-foreground">
          Use Photo #1 preferences for all photos
        </span>
        <span className="mt-1 block text-sm leading-6 text-muted">
          Dusk style, lighting preferences and file-size preference will be
          shared across every photo. Uploaded files and Additional Instructions
          remain individual.
        </span>
      </span>
    </label>
  );
}
