"use client";

import { useState } from "react";
import { Maximize2, Images } from "lucide-react";
import type { StyleGalleryEntry } from "@/data/staging-style-gallery";

interface StyleGalleryCardProps {
  entry: StyleGalleryEntry;
  coverOverride?: {
    src: string;
    alt: string;
  };
  exampleCount?: number;
  /** Called with the entry id and the image index the user clicked on. */
  onOpen: (id: string, imageIndex: number) => void;
}

/**
 * Single style card for /pricing/virtual-staging.
 *
 * Image area uses a 16:9 horizontal aspect ratio so the card reads
 * as a wide preview tile — consistent with the before/after cards
 * used throughout the service page — rather than the previous tall
 * portrait shape that didn't suit horizontal room photography.
 *
 * Grid context (in StyleGallerySection):
 *   mobile  : 1 col   → card fills full width
 *   tablet  : 2 cols  → comfortable pair
 *   desktop : 3 cols  → nine styles in 3 rows
 *
 * Plain <img> with onError fallback: preview images live in /public
 * and may not exist yet; the placeholder block stands in silently.
 */
export default function StyleGalleryCard({
  entry,
  coverOverride,
  exampleCount,
  onOpen,
}: StyleGalleryCardProps) {
  const [coverFailed, setCoverFailed] = useState(false);
  const cover = coverOverride ?? entry.images[0];
  const totalImages = exampleCount ?? entry.images.length;

  return (
    <button
      type="button"
      onClick={() => onOpen(entry.id, 0)}
      aria-label={`Open ${entry.label} style gallery`}
      className="group relative text-left rounded-2xl border border-stone-200 bg-white overflow-hidden transition-all hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2"
    >
      {/* ── Cover image — 16:9 horizontal ── */}
      <div className="relative aspect-video overflow-hidden bg-stone-100">
        {coverFailed || !cover ? (
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

        {/* Bottom gradient for badge legibility */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 via-black/10 to-transparent"
        />

        {totalImages > 1 && (
          <span className="absolute bottom-2.5 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/92 backdrop-blur text-[11px] font-medium text-primary shadow-sm">
            <Images className="w-3.5 h-3.5" aria-hidden />
            {totalImages} examples
          </span>
        )}

        <span
          aria-hidden="true"
          className="absolute bottom-2.5 right-3 w-7 h-7 rounded-full bg-white/92 backdrop-blur text-primary flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </span>
      </div>

      {/* ── Card body ── */}
      <div className="px-4 py-3.5 lg:px-5 lg:py-4">
        <h3 className="text-sm lg:text-base font-bold text-primary tracking-tight leading-tight">
          {entry.label}
        </h3>
        {entry.description && (
          <p className="text-xs text-muted mt-0.5 leading-relaxed line-clamp-1">
            {entry.description}
          </p>
        )}
      </div>
    </button>
  );
}
