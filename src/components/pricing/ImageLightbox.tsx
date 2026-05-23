"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export interface LightboxImage {
  src: string;
  alt: string;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  initialIndex?: number;
  onClose: () => void;
  /** Optional title shown above the image (e.g. style name). */
  title?: string;
}

/**
 * Accessible image lightbox with previous / next navigation.
 *
 * Closes on Escape and on backdrop click. Left/Right arrows step
 * through images; wraps at the ends. Locks body scroll while mounted.
 *
 * Mounting model: the parent renders this component only while it
 * should be visible (e.g. `{open && <ImageLightbox ... />}`). That
 * means initial state seeds naturally from props on each open and we
 * don't need any setState-in-effect resets.
 *
 * Plain <img> with onError fallback to a clean named placeholder so a
 * missing file does not show a broken-image icon. Failed sources are
 * tracked in a Set keyed by src — no extra effects needed.
 */
export default function ImageLightbox({
  images,
  initialIndex = 0,
  onClose,
  title,
}: ImageLightboxProps) {
  const total = images.length;
  const safeInitial = Math.min(Math.max(0, initialIndex), Math.max(0, total - 1));

  const [index, setIndex] = useState(safeInitial);
  const [failedSrcs, setFailedSrcs] = useState<Set<string>>(() => new Set());
  const dialogRef = useRef<HTMLDivElement>(null);

  const hasMultiple = total > 1;
  const current = images[index];
  const imgFailed = !current || failedSrcs.has(current.src);

  const goPrev = useCallback(() => {
    if (!hasMultiple) return;
    setIndex((i) => (i - 1 + total) % total);
  }, [hasMultiple, total]);

  const goNext = useCallback(() => {
    if (!hasMultiple) return;
    setIndex((i) => (i + 1) % total);
  }, [hasMultiple, total]);

  const markCurrentFailed = () => {
    if (!current) return;
    setFailedSrcs((prev) => {
      if (prev.has(current.src)) return prev;
      const next = new Set(prev);
      next.add(current.src);
      return next;
    });
  };

  // Keyboard nav + body scroll lock. This effect only attaches listeners
  // and toggles document state — no setState calls inside, so it does
  // not violate the "no setState in effect" guideline.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus to the dialog so keyboard nav works immediately.
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, goPrev, goNext]);

  if (total === 0) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ? `${title} — image gallery` : "Image gallery"}
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm focus:outline-none"
      onClick={onClose}
    >
      {/* Close */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close gallery"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Previous */}
      {hasMultiple && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          aria-label="Previous image"
          className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Next */}
      {hasMultiple && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          aria-label="Next image"
          className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Stage */}
      <div
        className="relative max-w-[1200px] w-[92vw] max-h-[88vh] flex flex-col items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <p className="text-[10px] sm:text-xs font-semibold tracking-[0.2em] uppercase text-white/70 mb-3 sm:mb-4">
            {title}
          </p>
        )}

        <div className="relative w-full aspect-[16/10] max-h-[72vh] rounded-2xl overflow-hidden bg-stone-900 shadow-2xl">
          {imgFailed ? (
            <div className="absolute inset-0 bg-gradient-to-br from-stone-700 via-stone-600 to-stone-800 flex items-center justify-center">
              <span className="text-xs sm:text-sm font-semibold tracking-[0.18em] uppercase text-white/80 px-4 text-center">
                {title ?? "Preview"} — Image {index + 1}
              </span>
            </div>
          ) : (
            // Plain <img>: preview images live in /public, may not exist
            // yet, and we want a synchronous onError fallback. next/image
            // would log a 404 and is overkill for a placeholder lightbox.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={current.src}
              src={current.src}
              alt={current.alt}
              onError={markCurrentFailed}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
        </div>

        {hasMultiple && (
          <div className="mt-4 flex items-center gap-3 text-white/80 text-xs sm:text-sm">
            <span className="font-medium tabular-nums">
              {index + 1} / {total}
            </span>
            <div className="flex items-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to image ${i + 1}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIndex(i);
                  }}
                  className={
                    i === index
                      ? "w-6 h-1.5 rounded-full bg-white transition-all"
                      : "w-1.5 h-1.5 rounded-full bg-white/40 hover:bg-white/70 transition-all"
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
