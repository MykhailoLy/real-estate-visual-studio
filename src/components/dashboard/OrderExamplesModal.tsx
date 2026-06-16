"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import GalleryBeforeAfterPair from "@/components/gallery/GalleryBeforeAfterPair";
import { getGalleryPairLabels } from "@/lib/gallery";
import type { PortfolioServiceSlug } from "@/lib/portfolio";
import type { OrderExamplePair } from "@/lib/order-card-examples";

// ============================================================
// OrderExamplesModal — in-dashboard Before/After gallery dialog.
//
// Accessible dialog (role="dialog", aria-modal, labelled title):
//   - Escape closes; backdrop click closes; close button closes
//   - body scroll locked while open
//   - focus moves to the close button on open and is restored to
//     the previously-focused element (the trigger) on close
//   - max-height with internal scrolling; responsive
//
// Reuses the public GalleryBeforeAfterPair for each example row and
// the service-specific labels from getGalleryPairLabels(). No new
// dialog dependency.
// ============================================================

interface OrderExamplesModalProps {
  open: boolean;
  onClose: () => void;
  /** Service title shown in the header + used for the count copy. */
  title: string;
  /** Portfolio slug → drives the Before/After label pair. */
  serviceSlug: PortfolioServiceSlug;
  pairs: OrderExamplePair[];
}

export default function OrderExamplesModal({
  open,
  onClose,
  title,
  serviceSlug,
  pairs,
}: OrderExamplesModalProps) {
  const headingId = useId();
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the dialog.
    closeBtnRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      // Restore focus to the trigger where practical.
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const labels = getGalleryPairLabels(serviceSlug, "en");
  const count = pairs.length;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-6 lg:p-8"
      onMouseDown={(e) => {
        // Close only when the backdrop itself is pressed, not the panel.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="my-auto flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2
              id={headingId}
              className="truncate text-lg font-bold text-primary"
            >
              {title} examples
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {count} {count === 1 ? "example" : "examples"}
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close examples"
            className="flex-shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-surface hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-6">
            {pairs.map((pair, index) => (
              <GalleryBeforeAfterPair
                key={pair.id}
                beforeUrl={pair.beforeUrl}
                afterUrl={pair.afterUrl}
                beforeAlt={pair.beforeAlt}
                afterAlt={pair.afterAlt}
                beforeLabel={labels.before}
                afterLabel={labels.after}
                loading={index === 0 ? "eager" : "lazy"}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
