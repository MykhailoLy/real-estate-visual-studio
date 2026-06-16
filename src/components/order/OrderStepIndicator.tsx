"use client";

import { Check } from "lucide-react";

// ============================================================
// OrderStepIndicator — restrained, accessible multi-step indicator.
//
// Generic over an ordered list of steps so the order flow can later
// grow from [Configure, Review] to [Configure, Review, Payment]
// WITHOUT changing this component. Pass the additional step in the
// `steps` array when payment is implemented — no fake/disabled payment
// step is shown today.
//
// Accessibility: rendered as an ordered list with aria-current="step"
// on the active step. State is NOT communicated by colour alone — the
// active step uses a filled badge + bold label + ring, and completed
// steps show a check icon.
// ============================================================

export interface OrderStep {
  id: string;
  label: string;
}

interface OrderStepIndicatorProps {
  steps: OrderStep[];
  /** id of the currently active step. */
  currentStepId: string;
}

export default function OrderStepIndicator({
  steps,
  currentStepId,
}: OrderStepIndicatorProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId);

  return (
    <nav aria-label="Order progress">
      <ol className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {steps.map((step, index) => {
          const isActive = index === currentIndex;
          const isComplete = index < currentIndex;
          const stepNumber = index + 1;

          return (
            <li key={step.id} className="flex items-center gap-3">
              <div
                className="flex items-center gap-2"
                aria-current={isActive ? "step" : undefined}
              >
                <span
                  className={[
                    "inline-flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold transition-colors",
                    isActive
                      ? "bg-primary text-white ring-2 ring-primary/30 ring-offset-1"
                      : isComplete
                      ? "bg-primary/15 text-primary"
                      : "bg-surface border border-border text-muted",
                  ].join(" ")}
                >
                  {isComplete ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                  ) : (
                    stepNumber
                  )}
                </span>
                <span
                  className={[
                    "text-[13px] leading-tight",
                    isActive
                      ? "font-bold text-foreground"
                      : isComplete
                      ? "font-semibold text-foreground/80"
                      : "font-medium text-muted",
                  ].join(" ")}
                >
                  {step.label}
                  {isActive && <span className="sr-only"> (current step)</span>}
                </span>
              </div>

              {index < steps.length - 1 && (
                <span
                  aria-hidden
                  className="hidden sm:block h-px w-8 bg-border"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
