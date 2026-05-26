import { cn } from "@/lib/utils";
import ServicePlaceholder, {
  type ServiceVariant,
} from "@/components/home/ServicePlaceholder";

// ============================================================
// BEFORE/AFTER FRAME
//
// Drop-in replacement for `<ServicePlaceholder />` that prefers
// real uploaded portfolio images when both are available, and
// falls back to the original CSS placeholder otherwise.
//
// Layout deliberately mirrors ServicePlaceholder: two halves +
// a centerline + small "Before" / "After" pills. Doing it this
// way means the homepage service grid (5:2 frame) and any
// pricing-page strips can switch between placeholder and real
// imagery without a visual jump.
//
// We use a plain <img> here (not next/image) for two reasons:
//   1. NEXT_PUBLIC_SUPABASE_URL is project-specific and we'd
//      otherwise need to hard-code remotePatterns at build time
//      to allow Supabase Storage URLs through next/image.
//   2. These are admin-curated portfolio JPGs; the optimisation
//      win for next/image is small relative to the deploy cost.
// ============================================================

export interface BeforeAfterFrameProps {
  /** Public Supabase Storage URL or null. */
  beforeUrl: string | null;
  /** Public Supabase Storage URL or null. */
  afterUrl: string | null;
  /** Alt text for the BEFORE image. */
  beforeAlt: string;
  /** Alt text for the AFTER image. */
  afterAlt: string;
  /** Variant used by the CSS placeholder fallback. */
  placeholderVariant: ServiceVariant;
  /** Render the small "Before" / "After" corner pills. Defaults true. */
  showLabels?: boolean;
  className?: string;
  /** Pass-through to <img loading=...>. Defaults to "lazy". */
  loading?: "lazy" | "eager";
}

export default function BeforeAfterFrame({
  beforeUrl,
  afterUrl,
  beforeAlt,
  afterAlt,
  placeholderVariant,
  showLabels = true,
  className,
  loading = "lazy",
}: BeforeAfterFrameProps) {
  // Both images must be available to render the real frame —
  // a single-sided portfolio item would be confusing. If either
  // is missing we fall back to the placeholder, which preserves
  // the design when an admin uploads only one half mid-edit.
  const hasReal = Boolean(beforeUrl && afterUrl);

  if (!hasReal) {
    return (
      <ServicePlaceholder
        variant={placeholderVariant}
        className={className}
      />
    );
  }

  return (
    <div
      className={cn("absolute inset-0 flex overflow-hidden", className)}
      role="img"
      aria-label={`${beforeAlt} versus ${afterAlt}`}
    >
      {/* LEFT half — before */}
      <div className="relative w-1/2 overflow-hidden bg-stone-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeUrl ?? ""}
          alt={beforeAlt}
          loading={loading}
          className="absolute inset-0 w-full h-full object-cover"
        />
        {showLabels && (
          <span className="absolute bottom-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full bg-white/90 backdrop-blur text-[10px] font-bold tracking-[0.18em] uppercase text-stone-700 shadow-sm">
            Before
          </span>
        )}
      </div>

      {/* RIGHT half — after */}
      <div className="relative w-1/2 overflow-hidden bg-stone-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={afterUrl ?? ""}
          alt={afterAlt}
          loading={loading}
          className="absolute inset-0 w-full h-full object-cover"
        />
        {showLabels && (
          <span className="absolute bottom-3 right-3 inline-flex items-center px-2.5 py-1 rounded-full bg-white/90 backdrop-blur text-[10px] font-bold tracking-[0.18em] uppercase text-primary shadow-sm">
            After
          </span>
        )}
      </div>

      {/* Centerline divider — matches ServicePlaceholder so the
          grid reads as the same shape regardless of source. */}
      <div
        aria-hidden
        className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[3px] bg-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center">
          <svg
            viewBox="0 0 12 12"
            className="w-3 h-3 text-primary"
            fill="currentColor"
            aria-hidden
          >
            <path d="M3 1L0 6l3 5V1zm6 0v10l3-5-3-5z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
