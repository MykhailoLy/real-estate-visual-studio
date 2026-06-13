// ============================================================
// GalleryBeforeAfterPair — gallery-optimised before/after display
//
// Desktop (sm+):  two equal columns, side by side
// Mobile:         stacked vertically (one column)
//
// Images use object-contain so the full room/property composition
// is always visible — no cropping. A neutral bg-stone-50 fills
// any letterbox area so the frame looks clean without distortion.
//
// Both images must be available (non-null) to render. If either
// URL is missing the component returns null so a single-sided
// pair is never shown to the public.
//
// Uses next/image (fill, object-contain) so the public Supabase
// Storage originals are resized and served as AVIF/WebP via the
// Next.js optimizer. The Supabase public host is allow-listed in
// next.config.ts.
// ============================================================

import Image from "next/image";

interface GalleryBeforeAfterPairProps {
  beforeUrl: string | null;
  afterUrl: string | null;
  beforeAlt: string;
  afterAlt: string;
  title: string;
  description?: string | null;
  /** Localised label for the "Before" pill. Defaults to "Before". */
  beforeLabel?: string;
  /** Localised label for the "After" pill.  Defaults to "After". */
  afterLabel?: string;
  /** Pass "eager" for the first pair above the fold. Defaults to "lazy". */
  loading?: "lazy" | "eager";
}

export default function GalleryBeforeAfterPair({
  beforeUrl,
  afterUrl,
  beforeAlt,
  afterAlt,
  title,
  description,
  beforeLabel = "Before",
  afterLabel = "After",
  loading = "lazy",
}: GalleryBeforeAfterPairProps) {
  // Both images must be present — never show a single-sided pair.
  if (!beforeUrl || !afterUrl) return null;

  return (
    <article className="group">
      {/* ── Image pair ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        {/* Before */}
        <div>
          {/*
           * aspect-[4/3] provides a consistent shared height between
           * Before and After on desktop so they stay visually aligned.
           * object-contain ensures the full image is visible without
           * cropping; bg-stone-50 provides a neutral letterbox background.
           */}
          <div className="aspect-[4/3] relative overflow-hidden rounded-xl bg-stone-50 ring-1 ring-stone-200">
            <Image
              src={beforeUrl}
              alt={beforeAlt}
              fill
              // Detail grid: 2-up on sm+, full width on mobile.
              sizes="(min-width: 640px) 50vw, 100vw"
              className="object-contain"
              priority={loading === "eager"}
            />
          </div>
          {/* Label sits just below the image */}
          <p className="mt-2 flex items-center gap-1.5 px-0.5">
            <span className="inline-block w-2 h-2 rounded-full bg-stone-400 flex-shrink-0" />
            <span className="text-[11px] font-bold tracking-[0.16em] uppercase text-muted">
              {beforeLabel}
            </span>
          </p>
        </div>

        {/* After */}
        <div>
          <div className="aspect-[4/3] relative overflow-hidden rounded-xl bg-stone-50 ring-1 ring-stone-200">
            <Image
              src={afterUrl}
              alt={afterAlt}
              fill
              sizes="(min-width: 640px) 50vw, 100vw"
              className="object-contain"
              priority={loading === "eager"}
            />
          </div>
          {/* Label */}
          <p className="mt-2 flex items-center gap-1.5 px-0.5">
            <span className="inline-block w-2 h-2 rounded-full bg-primary flex-shrink-0" />
            <span className="text-[11px] font-bold tracking-[0.16em] uppercase text-primary">
              {afterLabel}
            </span>
          </p>
        </div>
      </div>

      {/* ── Caption ─────────────────────────────────────────── */}
      <div className="mt-3 px-0.5">
        <h3 className="text-base font-bold text-primary leading-snug">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-sm text-muted leading-relaxed line-clamp-3">
            {description}
          </p>
        )}
      </div>
    </article>
  );
}
