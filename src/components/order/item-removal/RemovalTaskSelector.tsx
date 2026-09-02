"use client";

import { Check } from "lucide-react";
import {
  REMOVAL_TASKS,
  type RemovalTaskId,
} from "@/lib/item-removal";

// ============================================================
// RemovalTaskSelector — accessible multi-select checkbox cards for the
// "What should we do with this photo?" section.
//
// One or more tasks may be selected; at least one is required per photo.
// Native checkboxes (sr-only) inside labels keep it fully keyboard
// accessible (Space toggles). Selected cards show a gold border + a
// checkmark + a focus ring — selection is never communicated by colour
// alone (checkmark + aria-checked via the native input). Task choices
// never change the $8 subtotal.
// ============================================================

interface RemovalTaskSelectorProps {
  value: RemovalTaskId[];
  onChange: (value: RemovalTaskId[]) => void;
  /** Unique id prefix so multiple item cards don't collide. */
  idPrefix: string;
  /** Show the inline "select at least one" validation error. */
  error?: boolean;
}

export default function RemovalTaskSelector({
  value,
  onChange,
  idPrefix,
  error = false,
}: RemovalTaskSelectorProps) {
  const errorId = `${idPrefix}-tasks-error`;

  const toggle = (id: RemovalTaskId) => {
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id]
    );
  };

  return (
    <fieldset>
      <legend className="block text-sm font-medium text-foreground mb-2">
        What should we do with this photo?
        <span className="text-red-500 ml-0.5">*</span>
      </legend>
      <div
        className="grid grid-cols-1 gap-3"
        aria-describedby={error ? errorId : undefined}
      >
        {REMOVAL_TASKS.map((task) => {
          const id = `${idPrefix}-${task.id}`;
          const selected = value.includes(task.id);

          return (
            <label
              key={task.id}
              htmlFor={id}
              className={`group relative flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 transition-all focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${
                selected
                  ? "border-secondary border-2 shadow-sm"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <input
                id={id}
                type="checkbox"
                checked={selected}
                onChange={() => toggle(task.id)}
                className="sr-only"
              />

              <span
                className={`mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors ${
                  selected
                    ? "bg-secondary border-secondary text-white"
                    : "bg-white border-border text-transparent"
                }`}
                aria-hidden
              >
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>

              <span className="min-w-0">
                <span
                  className={`block text-sm font-semibold ${
                    selected ? "text-secondary-dark" : "text-foreground"
                  }`}
                >
                  {task.label}
                </span>
                <span className="mt-0.5 block text-dashboard-body text-muted">
                  {task.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-dashboard-metadata text-red-500">
          Please select at least one task for this photo.
        </p>
      )}
    </fieldset>
  );
}
