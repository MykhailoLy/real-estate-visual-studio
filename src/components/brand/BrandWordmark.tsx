import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// BrandWordmark — renders "PicchuSpot" with brand-colored spans
//
// On light backgrounds:  Picchu = Deep Navy, Spot = PicchuSpot Gold
// On dark backgrounds:   Picchu = Warm Ivory, Spot = PicchuSpot Gold
//
// The two spans render without a gap so the word reads as one unified brand name.
// The outer span is exposed as a single graphic label: this is a brand mark,
// not body copy that should be recolored to satisfy normal-text contrast.
// ─────────────────────────────────────────────────────────────

export type WordmarkTheme = "light" | "dark";

interface BrandWordmarkProps {
  /** "light" for light backgrounds (navy+gold), "dark" for dark backgrounds (white+gold) */
  theme?: WordmarkTheme;
  /** Additional className applied to the outer span */
  className?: string;
}

export default function BrandWordmark({
  theme = "light",
  className,
}: BrandWordmarkProps) {
  return (
    <span
      role="img"
      aria-label="PicchuSpot"
      className={cn("font-bold tracking-tight leading-none", className)}
    >
      <span
        aria-hidden="true"
        className={theme === "dark" ? "text-white" : "text-primary"}
      >
        Picchu
      </span>
      <span aria-hidden="true" className="text-secondary">Spot</span>
    </span>
  );
}
