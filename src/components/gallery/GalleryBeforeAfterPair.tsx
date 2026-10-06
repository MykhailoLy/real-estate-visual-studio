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
// Images use next/image so the public Supabase Storage originals
// are resized and served as WebP via the Next.js optimizer
// (the Supabase public host is allow-listed in next.config.ts).
// We keep the natural-aspect, full-width presentation: width/height
// are only an intrinsic-ratio hint and CSS `w-full h-auto` makes the
// image fluid and lets it reflow to its true ratio — no object-fit,
// so nothing is cropped or distorted.
// ============================================================

import { OptimizedImage } from "@/components/media/OptimizedImage";
import { cn } from "@/lib/utils";
import type { StaticImageViewerVariant } from "@/components/media/static-image-variant";

// Intrinsic-ratio hint for the optimizer / CLS reservation only.
// Real-estate photography is most commonly ~3:2; `h-auto` overrides
// this to the true ratio once the image is known, so it never
// crops or distorts regardless of the actual dimensions.
const RATIO_HINT_WIDTH = 1600;
const RATIO_HINT_HEIGHT = 1067;

interface GalleryBeforeAfterPairProps {
  /** Present only when this pair is rendered inside an expanded viewer. */
  viewerVariant?: StaticImageViewerVariant;
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
  viewerVariant,
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
      <figure
        data-static-image-variant={viewerVariant}
        className={cn(
          "overflow-hidden rounded-xl ring-1",
          viewerVariant
            ? "bg-slate-950 ring-black/10"
            : "bg-white ring-stone-200",
        )}
      >
        <div className={cn(viewerVariant === "plan" && "static-image-plan-pair-surface bg-white p-2 sm:p-4 lg:p-5")}>
          <OptimizedImage
            src={beforeUrl}
            alt={beforeAlt}
            context="portfolio-comparison"
            width={RATIO_HINT_WIDTH}
            height={RATIO_HINT_HEIGHT}
            className="block w-full h-auto"
            loading={loading}
          />
        </div>
        <LabelBar>{beforeLabel}</LabelBar>
      </figure>

      {/* After / result */}
      <figure
        data-static-image-variant={viewerVariant}
        className={cn(
          "overflow-hidden rounded-xl ring-1",
          viewerVariant
            ? "bg-slate-950 ring-black/10"
            : "bg-white ring-stone-200",
        )}
      >
        <div className={cn(viewerVariant === "plan" && "static-image-plan-pair-surface bg-white p-2 sm:p-4 lg:p-5")}>
          <OptimizedImage
            src={afterUrl}
            alt={afterAlt}
            context="portfolio-comparison"
            width={RATIO_HINT_WIDTH}
            height={RATIO_HINT_HEIGHT}
            className="block w-full h-auto"
            loading={loading}
          />
        </div>
        <LabelBar>{afterLabel}</LabelBar>
      </figure>
    </article>
  );
}
