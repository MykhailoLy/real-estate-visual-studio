"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import GalleryBeforeAfterPair from "@/components/gallery/GalleryBeforeAfterPair";
import { getGalleryPairLabels } from "@/lib/gallery";
import type { PortfolioServiceSlug } from "@/lib/portfolio";
import type { OrderExamplePair } from "@/lib/order-card-examples";

// ============================================================
// OrderExamplesModal — in-dashboard Before/After gallery dialog.
//
// Rendered via a React portal into document.body so it is NEVER a
// descendant of the transformed / overflow-hidden service card (which
// previously clipped and mis-positioned the fixed overlay). The
// trigger button stays inside the card.
//
// Accessible dialog (role="dialog", aria-modal, labelled title):
//   - Escape / backdrop / close button all close
//   - body scroll locked while open; restored on close
//   - focus moves to the close button on open, restored to the
//     trigger on close
//   - viewport-sized, centered, single internal scrollbar (the body),
//     sticky header.
//
// Reuses the public GalleryBeforeAfterPair + getGalleryPairLabels.
// No new dialog dependency.
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

  // The modal only renders after a client-side open (user click), never
  // during SSR, so guarding on `document` avoids any hydration mismatch
  // without needing client-mounted state.
  if (!open || typeof document === "undefined") return null;

  const labels = getGalleryPairLabels(serviceSlug, "en");
  const count = pairs.length;

  const overlay = (
    <div
      // Full-viewport backdrop. High, stable z-index above the dashboard
      // top nav / sidebar / cards. The backdrop itself does not scroll —
      // the panel body owns the single scrollbar.
      className="fixed inset-0 z-[100] flex h-[100dvh] w-screen items-center justify-center bg-black/60 p-2 sm:p-6"
      onMouseDown={(e) => {
        // Close only when the backdrop itself is pressed, not the panel.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="flex w-[calc(100vw-16px)] max-h-[calc(100dvh-16px)] flex-col overflow-hidden rounded-xl bg-white shadow-2xl sm:max-h-[calc(100dvh-48px)] sm:w-[min(1200px,calc(100vw-48px))] sm:rounded-2xl"
      >
        {/* Sticky header — stays visible while the body scrolls */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-white px-5 py-4 sm:px-6">
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

        {/* Single scroll region — vertical only, contained */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-5 sm:px-6">
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

  return createPortal(overlay, document.body);
}
