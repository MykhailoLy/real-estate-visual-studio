// ============================================================
// GalleryBeforeAfterPair — full-width before/after example row
//
// Desktop / large tablet (sm+):
//   Before and After sit side by side, each ~50% of the row,
//   separated by a narrow gap. The pair is intended to span
//   nearly the full page width (the parent provides the wide
//   container).
//
// Mobile:
//   Stacked vertically, each image full content width.
//
// Images render at their natural aspect ratio (width:100%,
// height:auto) so nothing is cropped or distorted. Before/After
// uploads are expected to share dimensions; if they unexpectedly
// differ, items align at the top (items-start).
//
// A dark PicchuSpot-navy label bar sits directly beneath each
// image (BEFORE / result label). No title or description is shown
// on the public page — the focus is the visual comparison.
//
// Both images must be available (non-null) to render; otherwise
// the component returns null so a single-sided pair is never
// shown to the public.
//
// Uses plain <img> (not next/image) because Supabase Storage URLs
// are project-specific and can't be added to next.config
// remotePatterns at build time without leaking the project URL.
// ============================================================

interface GalleryBeforeAfterPairProps {
  beforeUrl: string | null;
  afterUrl: string | null;
  beforeAlt: string;
  afterAlt: string;
  /** Dark-bar label under the left image (e.g. "BEFORE" / "SOURCE"). */
  beforeLabel: string;
  /** Dark-bar label under the right image (service-specific result). */
  afterLabel: string;
  /** Pass "eager" for the first pair above the fold. Defaults to "lazy". */
  loading?: "lazy" | "eager";
}

function LabelBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-primary text-white text-center py-2.5 px-3">
      <span className="text-[11px] sm:text-xs font-bold tracking-[0.18em] uppercase">
        {children}
      </span>
    </div>
  );
}

export default function GalleryBeforeAfterPair({
  beforeUrl,
  afterUrl,
  beforeAlt,
  afterAlt,
  beforeLabel,
  afterLabel,
  loading = "lazy",
}: GalleryBeforeAfterPairProps) {
  // Both images must be present — never show a single-sided pair.
  if (!beforeUrl || !afterUrl) return null;

  return (
    <article className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 items-start">
      {/* Before */}
      <figure className="overflow-hidden rounded-xl ring-1 ring-stone-200 bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeUrl}
          alt={beforeAlt}
          loading={loading}
          className="block w-full h-auto"
        />
        <LabelBar>{beforeLabel}</LabelBar>
      </figure>

      {/* After / result */}
      <figure className="overflow-hidden rounded-xl ring-1 ring-stone-200 bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={afterUrl}
          alt={afterAlt}
          loading={loading}
          className="block w-full h-auto"
        />
        <LabelBar>{afterLabel}</LabelBar>
      </figure>
    </article>
  );
}
