import Image from "next/image";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// PicchuSpotLogo — reusable brand component
//
// Variants:
//   "full"      — horizontal logo with wordmark (SVG, default)
//   "mark"      — icon-only mark (SVG, dark)
//   "mark-light"— icon-only mark (SVG, white + gold for dark bg)
//   "wordmark"  — text-only wordmark rendered as styled span
//
// Sizes are controlled via className (height/width) passed by
// the consumer. The component sets sensible defaults per variant.
// ─────────────────────────────────────────────────────────────

export type LogoVariant = "full" | "mark" | "mark-light" | "wordmark";

interface PicchuSpotLogoProps {
  /** Which logo variant to render */
  variant?: LogoVariant;
  /** Override the default height class. Applied to the image wrapper. */
  className?: string;
  /** Alt text override (default: "PicchuSpot") */
  alt?: string;
  /** Width in pixels for Next/Image (only for image variants) */
  width?: number;
  /** Height in pixels for Next/Image (only for image variants) */
  height?: number;
}

const LOGO_SOURCES: Record<Exclude<LogoVariant, "wordmark">, string> = {
  full: "/brand/picchuspot-logo.svg",
  mark: "/brand/picchuspot-mark.svg",
  "mark-light": "/brand/picchuspot-mark-white-gold.svg",
};

const DEFAULT_DIMENSIONS: Record<
  Exclude<LogoVariant, "wordmark">,
  { width: number; height: number }
> = {
  full: { width: 160, height: 120 },
  mark: { width: 48, height: 24 },
  "mark-light": { width: 48, height: 24 },
};

export default function PicchuSpotLogo({
  variant = "full",
  className,
  alt = "PicchuSpot",
  width,
  height,
}: PicchuSpotLogoProps) {
  if (variant === "wordmark") {
    return (
      <span
        className={cn(
          "font-bold text-primary tracking-tight leading-none",
          className
        )}
      >
        PicchuSpot
      </span>
    );
  }

  const src = LOGO_SOURCES[variant];
  const defaults = DEFAULT_DIMENSIONS[variant];

  return (
    <Image
      src={src}
      alt={alt}
      width={width ?? defaults.width}
      height={height ?? defaults.height}
      className={cn("h-auto w-auto", className)}
      priority
    />
  );
}
