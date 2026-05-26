import { cn } from "@/lib/utils";

// ============================================================
// SERVICE PLACEHOLDER (before / after)
//
// A self-contained, image-free visual that suggests the kind of
// transformation each service performs. Pure CSS gradients +
// labels — no third-party imagery, nothing copyrighted.
//
// All variants render the same outer rectangle so they tile
// uniformly inside the homepage service grid and the hero
// showcase. A divider on the centerline makes the "before / after"
// narrative obvious at a glance.
// ============================================================

export type ServiceVariant =
  | "image-enhancement"
  | "day-to-dusk"
  | "virtual-staging"
  | "item-removal"
  | "floor-plans"
  | "virtual-renovation"
  | "panorama-enhancement"
  | "panorama-staging"
  | "aerial-editing"
  | "site-plans"
  // local + render + retail
  | "local-photography"
  | "local-360-tour"
  | "local-video"
  | "local-drone"
  | "local-package"
  | "exterior-render"
  | "interior-render"
  | "render-360"
  | "render-tour"
  | "development-marketing"
  | "product-edit"
  | "background-removal"
  | "lifestyle"
  | "color-variations"
  | "marketplace";

interface VariantStyle {
  /** CSS for the LEFT half (the "before" / starting state). */
  left: string;
  /** CSS for the RIGHT half (the "after" / finished state). */
  right: string;
  /** Short label rendered in the bottom-left corner of LEFT. */
  leftLabel: string;
  /** Short label rendered in the bottom-right corner of RIGHT. */
  rightLabel: string;
  /** Optional tonal hint shown in the right half (a light glow,
   *  a circle, etc.) — purely decorative. */
  rightAccent?: "glow" | "circle" | "grid" | "none";
}

const STYLES: Record<ServiceVariant, VariantStyle> = {
  "image-enhancement": {
    left: "bg-gradient-to-br from-stone-300 via-stone-300 to-stone-400 saturate-50",
    right: "bg-gradient-to-br from-amber-50 via-orange-100 to-rose-100",
    leftLabel: "Original",
    rightLabel: "Enhanced",
    rightAccent: "glow",
  },
  "day-to-dusk": {
    left: "bg-gradient-to-b from-sky-200 via-sky-100 to-stone-200",
    right: "bg-gradient-to-b from-indigo-900 via-rose-500 to-amber-300",
    leftLabel: "Day",
    rightLabel: "Dusk",
    rightAccent: "glow",
  },
  "virtual-staging": {
    left: "bg-gradient-to-br from-stone-200 via-stone-200 to-stone-300",
    right: "bg-gradient-to-br from-amber-50 via-orange-100 to-stone-200",
    leftLabel: "Empty",
    rightLabel: "Staged",
  },
  "item-removal": {
    left: "bg-[radial-gradient(circle_at_30%_50%,#cbd5e1_0,transparent_45%),radial-gradient(circle_at_70%_60%,#94a3b8_0,transparent_50%),linear-gradient(135deg,#e2e8f0,#cbd5e1)]",
    right: "bg-gradient-to-br from-stone-50 via-stone-100 to-stone-200",
    leftLabel: "Cluttered",
    rightLabel: "Clean",
  },
  "floor-plans": {
    left: "bg-stone-200",
    right: "bg-slate-50",
    leftLabel: "Sketch",
    rightLabel: "Floor plan",
    rightAccent: "grid",
  },
  "virtual-renovation": {
    left: "bg-gradient-to-br from-stone-300 via-stone-300 to-stone-400",
    right: "bg-gradient-to-br from-emerald-50 via-sky-50 to-stone-100",
    leftLabel: "Existing",
    rightLabel: "Renovated",
  },
  "panorama-enhancement": {
    left: "bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300 saturate-50",
    right: "bg-gradient-to-r from-amber-100 via-orange-100 to-rose-100",
    leftLabel: "360° Original",
    rightLabel: "360° Enhanced",
    rightAccent: "circle",
  },
  "panorama-staging": {
    left: "bg-gradient-to-r from-stone-200 via-stone-200 to-stone-300",
    right: "bg-gradient-to-r from-amber-50 via-orange-100 to-stone-200",
    leftLabel: "360° Empty",
    rightLabel: "360° Staged",
    rightAccent: "circle",
  },
  "aerial-editing": {
    left: "bg-gradient-to-b from-sky-200 via-sky-100 to-emerald-100 saturate-50",
    right: "bg-gradient-to-b from-sky-300 via-sky-100 to-emerald-100",
    leftLabel: "Original",
    rightLabel: "Edited",
  },
  "site-plans": {
    left: "bg-stone-200",
    right: "bg-emerald-50",
    leftLabel: "Plot",
    rightLabel: "Site plan",
    rightAccent: "grid",
  },
  "local-photography": {
    left: "bg-gradient-to-br from-stone-300 to-stone-400 saturate-50",
    right: "bg-gradient-to-br from-amber-50 via-orange-100 to-rose-100",
    leftLabel: "Phone",
    rightLabel: "HDR",
    rightAccent: "glow",
  },
  "local-360-tour": {
    left: "bg-gradient-to-br from-sky-50 via-cyan-50 to-blue-100",
    right: "bg-gradient-to-br from-sky-50 via-cyan-50 to-blue-100",
    leftLabel: "360° Tour",
    rightLabel: "Walkthrough",
    rightAccent: "circle",
  },
  "local-video": {
    left: "bg-gradient-to-br from-stone-700 via-stone-600 to-[#0f2440]",
    right: "bg-gradient-to-br from-stone-700 via-stone-600 to-[#0f2440]",
    leftLabel: "Video",
    rightLabel: "Edited cut",
  },
  "local-drone": {
    left: "bg-gradient-to-b from-sky-300 via-sky-200 to-stone-200",
    right: "bg-gradient-to-b from-sky-300 via-sky-200 to-stone-200",
    leftLabel: "Aerial",
    rightLabel: "Listing-ready",
  },
  "local-package": {
    left: "bg-gradient-to-br from-amber-50 via-orange-100 to-rose-100",
    right: "bg-gradient-to-br from-amber-50 via-orange-100 to-rose-100",
    leftLabel: "Photos",
    rightLabel: "Photos + Video + Tour",
  },
  "exterior-render": {
    left: "bg-stone-200",
    right: "bg-gradient-to-br from-amber-50 via-orange-100 to-rose-100",
    leftLabel: "Plot",
    rightLabel: "Render",
    rightAccent: "glow",
  },
  "interior-render": {
    left: "bg-stone-200",
    right: "bg-gradient-to-br from-amber-50 via-orange-100 to-stone-200",
    leftLabel: "Layout",
    rightLabel: "Render",
  },
  "render-360": {
    left: "bg-stone-200",
    right: "bg-gradient-to-br from-sky-50 via-cyan-50 to-blue-100",
    leftLabel: "Layout",
    rightLabel: "360° Render",
    rightAccent: "circle",
  },
  "render-tour": {
    left: "bg-gradient-to-br from-sky-50 via-cyan-50 to-blue-100",
    right: "bg-gradient-to-br from-sky-50 via-cyan-50 to-blue-100",
    leftLabel: "Tour",
    rightLabel: "Connected scenes",
    rightAccent: "circle",
  },
  "development-marketing": {
    left: "bg-stone-200",
    right: "bg-gradient-to-br from-amber-50 via-orange-100 to-stone-200",
    leftLabel: "Brief",
    rightLabel: "Brochure-ready",
  },
  "product-edit": {
    left: "bg-stone-300 saturate-50",
    right: "bg-gradient-to-br from-stone-50 to-white",
    leftLabel: "Original",
    rightLabel: "Edited",
    rightAccent: "glow",
  },
  "background-removal": {
    left: "bg-gradient-to-br from-stone-300 to-stone-400",
    right:
      "bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%,transparent_75%,#f1f5f9_75%),linear-gradient(45deg,#f1f5f9_25%,#fff_25%,#fff_75%,#f1f5f9_75%)] [background-size:14px_14px] [background-position:0_0,7px_7px]",
    leftLabel: "Original",
    rightLabel: "Cut-out",
  },
  "lifestyle": {
    left: "bg-gradient-to-br from-stone-50 to-white",
    right: "bg-gradient-to-br from-amber-50 via-orange-100 to-rose-100",
    leftLabel: "Catalog",
    rightLabel: "Lifestyle",
    rightAccent: "glow",
  },
  "color-variations": {
    left: "bg-gradient-to-br from-rose-300 via-amber-300 to-emerald-300",
    right: "bg-gradient-to-br from-sky-300 via-indigo-300 to-rose-300",
    leftLabel: "Variant A",
    rightLabel: "Variant B",
  },
  "marketplace": {
    left: "bg-gradient-to-br from-stone-50 to-white",
    right: "bg-gradient-to-br from-stone-50 to-white",
    leftLabel: "Original",
    rightLabel: "Marketplace-ready",
    rightAccent: "grid",
  },
};

interface ServicePlaceholderProps {
  variant: ServiceVariant;
  /** Hide the centerline divider for "no before/after" services
   *  (e.g. a 360 tour or a video cut). Defaults to true. */
  showDivider?: boolean;
  className?: string;
}

export default function ServicePlaceholder({
  variant,
  showDivider = true,
  className,
}: ServicePlaceholderProps) {
  const style = STYLES[variant];
  return (
    <div
      className={cn(
        "absolute inset-0 flex overflow-hidden",
        className
      )}
      role="img"
      aria-label={`${style.leftLabel} versus ${style.rightLabel} preview`}
    >
      {/* LEFT half */}
      <div className={cn("relative w-1/2 flex items-end p-4", style.left)}>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/85 backdrop-blur text-[10px] font-bold tracking-[0.18em] uppercase text-stone-700">
          {style.leftLabel}
        </span>
      </div>

      {/* RIGHT half */}
      <div
        className={cn(
          "relative w-1/2 flex items-end p-4 justify-end",
          style.right
        )}
      >
        {style.rightAccent === "glow" && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.4)_0%,transparent_55%)]"
          />
        )}
        {style.rightAccent === "circle" && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div className="w-[70%] aspect-square rounded-full border-2 border-blue-400/40" />
            <div className="absolute w-[44%] aspect-square rounded-full border-2 border-blue-500/35" />
            <div className="absolute w-[22%] aspect-square rounded-full border border-blue-600/30" />
          </div>
        )}
        {style.rightAccent === "grid" && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "linear-gradient(rgba(15,36,64,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(15,36,64,0.12) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
        )}
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/85 backdrop-blur text-[10px] font-bold tracking-[0.18em] uppercase text-primary relative">
          {style.rightLabel}
        </span>
      </div>

      {/* Centerline divider */}
      {showDivider && (
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
      )}
    </div>
  );
}
