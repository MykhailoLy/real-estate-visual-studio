import type { PortfolioServiceSlug } from "@/lib/portfolio";

export type StaticImageViewerVariant = "photo" | "plan";

export interface StaticImageSize {
  width: number;
  height: number;
}

function planPadding({ width, height }: StaticImageSize): number {
  const shortestSide = Math.min(width, height);
  if (width > height && height <= 500) {
    return Math.min(10, Math.max(6, shortestSide / 45));
  }
  if (width < 560) {
    return Math.min(12, Math.max(8, shortestSide / 40));
  }
  return Math.min(24, Math.max(16, shortestSide / 36));
}

export function getContainedSurfaceGeometry(
  stage: StaticImageSize,
  natural: StaticImageSize,
  variant: StaticImageViewerVariant,
) {
  const padding = variant === "plan" ? planPadding(stage) : 0;
  const outerGap = variant === "plan" ? 4 : 0;
  const availableWidth = Math.max(1, stage.width - 2 * (padding + outerGap));
  const availableHeight = Math.max(1, stage.height - 2 * (padding + outerGap));
  const scale = Math.min(
    availableWidth / natural.width,
    availableHeight / natural.height,
    1,
  );
  const imageWidth = natural.width * scale;
  const imageHeight = natural.height * scale;

  return {
    imageWidth,
    imageHeight,
    padding,
    surfaceWidth: imageWidth + padding * 2,
    surfaceHeight: imageHeight + padding * 2,
  };
}

/**
 * Semantic viewer treatment for every portfolio service.
 *
 * This mapping is intentionally driven only by the service context supplied by
 * the caller. Image names, dimensions, file formats, colours, and pixels never
 * participate in variant selection.
 */
export const PORTFOLIO_VIEWER_VARIANTS = {
  "image-enhancement": "photo",
  "day-to-dusk": "photo",
  "virtual-staging": "photo",
  "item-removal-virtual-cleaning": "photo",
  "floor-plans": "plan",
  "virtual-renovation": "photo",
  "360-image-enhancement": "photo",
  "360-virtual-staging": "photo",
  "aerial-editing": "photo",
  "development-site-plans": "plan",
} as const satisfies Record<PortfolioServiceSlug, StaticImageViewerVariant>;

export function getStaticImageViewerVariantForService(
  serviceSlug: string,
): StaticImageViewerVariant {
  return serviceSlug === "floor-plans" || serviceSlug === "development-site-plans"
    ? "plan"
    : "photo";
}
