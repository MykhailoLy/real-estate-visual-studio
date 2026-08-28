"use client";

import Image from "next/image";
import { useEffect, useId, useRef } from "react";
import { ImageIcon, X } from "lucide-react";
import type { ServiceOptionMedia } from "@/lib/site-media";
import { getBeforeAfterAlt } from "@/lib/before-after-alt";

interface ExampleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  media?: ServiceOptionMedia | null;
  /** Opt-in fallback for new flows whose admin media may not be populated yet. */
  showMissingMediaPlaceholder?: boolean;
}

function PreviewImage({
  src,
  alt,
  label,
}: {
  src: string;
  alt: string;
  label?: string;
}) {
  return (
    <figure className="min-w-0">
      {label ? (
        <figcaption className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-primary/70">
          {label}
        </figcaption>
      ) : null}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-surface">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(min-width: 768px) 44vw, 92vw"
          className="object-contain"
        />
      </div>
    </figure>
  );
}

/** Shared informational image dialog for order styles and options. */
export default function ExampleDialog({
  open,
  onOpenChange,
  title,
  description,
  media,
  showMissingMediaPlaceholder = false,
}: ExampleDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      if (!dialog.open) dialog.showModal();
      const frame = requestAnimationFrame(() => closeButtonRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }

    if (dialog.open) dialog.close();
  }, [open]);

  const close = () => onOpenChange(false);
  const hasPair = Boolean(media?.beforeUrl && media?.afterUrl);
  const singleUrl = hasPair
    ? null
    : media?.imageUrl ?? media?.afterUrl ?? media?.beforeUrl ?? null;
  const alt = getBeforeAfterAlt({
    sharedAlt: media?.altText,
    title,
    description: media?.description,
  });

  return (
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClose={() => {
        if (open) onOpenChange(false);
        returnFocusRef.current?.focus?.();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-5xl overflow-hidden rounded-2xl border border-border bg-white p-0 text-foreground shadow-2xl backdrop:bg-[#071426]/70"
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-primary sm:text-xl">
              {title}
            </h2>
            <p
              id={descriptionId}
              className="mt-1 max-w-3xl text-sm leading-6 text-muted"
            >
              {description}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            aria-label={`Close ${title} example`}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border text-primary transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6">
          {hasPair && media?.beforeUrl && media.afterUrl ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <PreviewImage
                src={media.beforeUrl}
                alt={alt.beforeAlt}
                label="Before"
              />
              <PreviewImage
                src={media.afterUrl}
                alt={alt.afterAlt}
                label="After"
              />
            </div>
          ) : singleUrl ? (
            <div className="mx-auto max-w-3xl">
              <PreviewImage
                src={singleUrl}
                alt={media?.altText?.trim() || `${title} example`}
              />
            </div>
          ) : showMissingMediaPlaceholder ? (
            <div className="mx-auto flex aspect-[4/3] max-w-3xl flex-col items-center justify-center gap-2 rounded-xl border border-border bg-gradient-to-br from-primary/10 via-surface to-secondary/10 px-6 text-center text-muted-light">
              <ImageIcon className="h-8 w-8" aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-[0.14em]">
                Example media coming soon
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
