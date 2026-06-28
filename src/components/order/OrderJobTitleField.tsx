"use client";

import { useId } from "react";
import { Tag } from "lucide-react";

// ============================================================
// OrderJobTitleField — shared, required order-level Job Title.
//
// Rendered ONCE per order (not per item) at the top of every
// PicchuSpot order form. The value is submitted as the order-level
// `jobTitle` field — it is NOT item metadata and is never folded
// into the first item's details.
//
// Validation rules (mirrored on the server):
//   - required
//   - trimmed length 3–120 characters
// ============================================================

export const JOB_TITLE_MIN = 3;
export const JOB_TITLE_MAX = 120;

/** True when `value` (trimmed) is a valid Job Title. */
export function isJobTitleValid(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= JOB_TITLE_MIN && trimmed.length <= JOB_TITLE_MAX;
}

interface OrderJobTitleFieldProps {
  value: string;
  onChange: (value: string) => void;
  /**
   * When true, shows the validation error if the current value is not
   * a valid Job Title. Forms can flip this on after a submit attempt,
   * or leave it false to validate as-you-type once the field is dirty.
   */
  showError?: boolean;
  disabled?: boolean;
  containerId?: string;
  errorMessage?: string;
}

export default function OrderJobTitleField({
  value,
  onChange,
  showError = false,
  disabled = false,
  containerId,
  errorMessage = "Enter a job title.",
}: OrderJobTitleFieldProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const helpId = `${inputId}-help`;

  const trimmedLength = value.trim().length;
  const dirty = value.length > 0;
  const invalid = !isJobTitleValid(value);
  // Surface the error either when the parent asks (post-submit) or once
  // the user has typed something that is too short.
  const displayError =
    invalid && (showError || (dirty && trimmedLength < JOB_TITLE_MIN));

  return (
    <div
      id={containerId}
      className="bg-white border border-border rounded-xl p-5 sm:p-6"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Tag className="w-4 h-4 text-primary" aria-hidden />
        </div>
        <div className="min-w-0">
          <label
            htmlFor={inputId}
            className="block text-sm font-semibold text-foreground leading-tight"
          >
            Job Title <span className="text-red-500">*</span>
          </label>
          <p id={helpId} className="text-xs text-muted mt-0.5">
            Give this order a name so you can find it later. This appears as
            the headline for the order in your Jobs list.
          </p>
        </div>
      </div>

      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Example: 123 Main Street — Exterior Photos"
        maxLength={JOB_TITLE_MAX}
        required
        disabled={disabled}
        data-validation-control
        aria-required="true"
        aria-invalid={displayError || undefined}
        aria-describedby={displayError ? `${helpId} ${errorId}` : helpId}
        className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:cursor-not-allowed disabled:opacity-60 ${
          displayError ? "border-red-300" : "border-border"
        }`}
      />

      <div className="mt-1.5 flex items-center justify-between gap-3">
        {displayError ? (
          <p id={errorId} className="text-xs text-red-500" role="alert">
            {errorMessage}
          </p>
        ) : (
          <span aria-hidden className="text-xs text-muted-light">
            &nbsp;
          </span>
        )}
        <span
          className="text-[11px] tabular-nums text-muted-light flex-shrink-0"
          aria-hidden
        >
          {trimmedLength}/{JOB_TITLE_MAX}
        </span>
      </div>
    </div>
  );
}
