"use client";

import { useState } from "react";
import { Maximize2, Images } from "lucide-react";
import type { StyleGalleryEntry } from "@/data/staging-style-gallery";

interface StyleGalleryCardProps {
  entry: StyleGalleryEntry;
  /** Called with the entry id and the image index the user clicked on. */
  onOpen: (id: string, imageIndex: number) => void;
}

/**
 * Single style card for /pricing/virtual-staging.
 *
 * Visible: cover image (or named placeholder if the file is missing),
 * style name, optional one-line description, and a small image-count
 * badge. Whole card is a button that opens the lightbox at image 0.
 *
 * Plain <img> with onError fallback is used because preview images live
 * in /public and may not exist yet; we silently swap in a clean named
 * placeholder rather than showing a broken-image icon.
 */
export default function StyleGalleryCard({
  entry,
  onOpen,
}: StyleGalleryCardProps) {
  const [coverFailed, setCoverFailed] = useState(false);
  const cover = entry.images[0];
  const totalImages = entry.images.length;

  return (
    <button
      type="button"
      onClick={() => onOpen(entry.id, 0)}
      aria-label={`Open ${entry.label} style gallery`}
      className="group relative text-left rounded-2xl border border-stone-200 bg-white overflow-hidden transition-all hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2"
    >
      <div className="relative aspect-[4/5] sm:aspect-[3/4] overflow-hidden bg-stone-100">
        {coverFailed || !cover ? (
          // Clean named placeholder — used while real images are being added.
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-stone-100 via-stone-50 to-stone-200">
            <span className="text-[10px] sm:text-xs font-semibold tracking-[0.18em] uppercase text-muted px-3 text-center">
              {entry.label}
            </span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.src}
            alt={cover.alt}
            loading="lazy"
            onError={() => setCoverFailed(true)}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        )}

        {/* Subtle bottom gradient for legibility of the image-count badge. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 via-black/10 to-transparent"
        />

        {totalImages > 1 && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/92 backdrop-blur text-[11px] font-medium text-primary shadow-sm">
            <Images className="w-3.5 h-3.5" />
            {totalImages} examples
          </span>
        )}

        <span
          aria-hidden="true"
          className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white/92 backdrop-blur text-primary flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </span>
      </div>

      <div className="px-5 py-4">
        <h3 className="text-base lg:text-lg font-bold text-primary tracking-tight leading-tight">
          {entry.label}
        </h3>
        {entry.description && (
          <p className="text-xs lg:text-sm text-muted mt-1 leading-relaxed line-clamp-2">
            {entry.description}
          </p>
        )}
      </div>
    </button>
  );
}
