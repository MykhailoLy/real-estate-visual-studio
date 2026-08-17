"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import StaticImageStage from "@/components/media/StaticImageStage";
import type { StaticImageViewerVariant } from "@/components/media/static-image-variant";
import { useViewerScrollLock } from "@/components/media/useViewerScrollLock";

export interface LightboxImage {
  src: string;
  alt: string;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  variant: StaticImageViewerVariant;
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
 * The visible raster frame goes through the shared Next.js optimizer. Failed
 * sources still fall back to a clean named placeholder and are tracked in a
 * Set keyed by src — no extra effects needed.
 */
export default function ImageLightbox({
  images,
  variant,
  initialIndex = 0,
  onClose,
  title,
}: ImageLightboxProps) {
  const total = images.length;
  const safeInitial = Math.min(Math.max(0, initialIndex), Math.max(0, total - 1));

  const [index, setIndex] = useState(safeInitial);
  const [failedSrcs, setFailedSrcs] = useState<Set<string>>(() => new Set());
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useViewerScrollLock(true);

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

  // Keyboard navigation, focus trapping, and trigger-focus restoration.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;

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
      } else if (e.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]),a[href]:not([aria-disabled="true"])',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable.at(-1) ?? first;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKey);

    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
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
      className="static-image-viewer-overlay fixed inset-0 z-[100] h-[100dvh] w-screen overflow-hidden bg-black/85 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm focus:outline-none sm:p-6"
      onClick={onClose}
    >
      <div className="static-image-viewer-root mx-auto grid h-full w-full max-w-[1728px] grid-rows-[auto_minmax(0,1fr)] gap-3 sm:gap-4">
        <div
          className="static-image-viewer-header mx-auto grid w-full max-w-[1600px] grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2"
          onClick={(event) => event.stopPropagation()}
        >
          <span aria-hidden />
          {title ? (
            <p className="truncate text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70 sm:text-xs">
              {title}
            </p>
          ) : (
            <span aria-hidden />
          )}
          <button
            ref={closeButtonRef}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            aria-label="Close gallery"
            className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="static-image-viewer-layout mx-auto grid min-h-0 w-full grid-cols-[3rem_minmax(0,1fr)_3rem] grid-rows-[minmax(0,1fr)_auto] gap-x-2 gap-y-3 sm:grid-cols-[3.5rem_minmax(0,1fr)_3.5rem] sm:gap-x-4">
          <div
            className="relative col-span-3 row-start-1 min-h-0 overflow-hidden rounded-xl sm:col-span-1 sm:col-start-2 sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <StaticImageStage
              key={current.src}
              variant={variant}
              src={current.src}
              alt={current.alt}
              context="content-lightbox"
              loading="eager"
              onError={markCurrentFailed}
              showImage={!imgFailed}
              stageClassName="h-full w-full"
            >
              {imgFailed ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-stone-700 via-stone-600 to-stone-800">
                  <span className="px-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-white/80 sm:text-sm">
                    {title ?? "Preview"} — Image {index + 1}
                  </span>
                </div>
              ) : null}
            </StaticImageStage>
          </div>

          {hasMultiple ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                goPrev();
              }}
              aria-label="Previous image"
              className="static-image-viewer-control col-start-1 row-start-2 grid h-11 w-11 place-items-center self-center justify-self-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:row-start-1 sm:h-12 sm:w-12"
            >
              <ChevronLeft className="h-6 w-6" aria-hidden />
            </button>
          ) : null}

          {hasMultiple ? (
            <div
              className="col-start-2 row-start-2 flex min-w-0 items-center justify-center gap-3 text-xs text-white/80 sm:text-sm"
              onClick={(event) => event.stopPropagation()}
            >
              <span className="shrink-0 font-medium tabular-nums">
                {index + 1} / {total}
              </span>
              <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto py-1">
                {images.map((_, imageIndex) => (
                  <button
                    key={imageIndex}
                    type="button"
                    aria-label={`Go to image ${imageIndex + 1}`}
                    onClick={() => setIndex(imageIndex)}
                    className={
                      imageIndex === index
                        ? "h-1.5 w-6 shrink-0 rounded-full bg-white transition-all"
                        : "h-1.5 w-1.5 shrink-0 rounded-full bg-white/40 transition-all hover:bg-white/70"
                    }
                  />
                ))}
              </div>
            </div>
          ) : null}

          {hasMultiple ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                goNext();
              }}
              aria-label="Next image"
              className="static-image-viewer-control col-start-3 row-start-2 grid h-11 w-11 place-items-center self-center justify-self-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:row-start-1 sm:h-12 sm:w-12"
            >
              <ChevronRight className="h-6 w-6" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
