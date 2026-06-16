import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// BrandWordmark — renders "PicchuSpot" with brand-colored spans
//
// On light backgrounds:  Picchu = navy (#0B1F3A), Spot = gold (#B88A44)
// On dark backgrounds:   Picchu = white,          Spot = gold (#B88A44)
//
// The two spans render without a gap so the word reads as one
// unified brand name. Screen readers announce "PicchuSpot" naturally.
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
    <span className={cn("font-bold tracking-tight leading-none", className)}>
      <span className={theme === "dark" ? "text-white" : "text-[#0B1F3A]"}>
        Picchu
      </span>
      <span className="text-[#B88A44]">Spot</span>
    </span>
  );
}
