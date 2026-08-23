export const OPTIMIZED_IMAGE_CONTEXTS = {
  "property-hero": {
    sizes: "100vw",
    quality: 75,
  },
  "property-gallery-single": {
    sizes: "(min-width: 1480px) 1480px, 100vw",
    quality: 70,
  },
  "property-gallery-half": {
    sizes: "(min-width: 1480px) 740px, (min-width: 1024px) 50vw, 50vw",
    quality: 70,
  },
  "property-gallery-tile": {
    sizes: "(min-width: 1480px) 370px, (min-width: 1024px) 25vw, 50vw",
    quality: 70,
  },
  "property-gallery-wide": {
    sizes: "(min-width: 1480px) 370px, (min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw",
    quality: 70,
  },
  "property-gallery-wide-half": {
    sizes: "(min-width: 1480px) 740px, (min-width: 1024px) 50vw, (min-width: 640px) 50vw, 100vw",
    quality: 70,
  },
  "property-gallery-additional": {
    sizes: "(min-width: 1480px) 487px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
    quality: 70,
  },
  "property-lightbox": {
    sizes: "(min-width: 1728px) 1600px, (min-width: 640px) calc(100vw - 10rem), calc(100vw - 1.5rem)",
    quality: 70,
  },
  "property-floor-plan": {
    sizes: "(min-width: 1480px) 858px, (min-width: 1024px) 58vw, 100vw",
    quality: 75,
  },
  "property-interactive-plan": {
    sizes: "(min-width: 1480px) 681px, (min-width: 1024px) 46vw, 100vw",
    quality: 75,
  },
  "property-room": {
    sizes: "(min-width: 1480px) 799px, (min-width: 1024px) 54vw, 100vw",
    quality: 70,
  },
  "property-room-thumbnail": {
    sizes: "144px",
    quality: 70,
  },
  "portfolio-card": {
    sizes: "(min-width: 1500px) 452px, (min-width: 1024px) calc(33.333vw - 48px), (min-width: 768px) calc(50vw - 34px), calc(100vw - 32px)",
    quality: 70,
  },
  "portfolio-comparison": {
    sizes: "(min-width: 1720px) 814px, (min-width: 1024px) calc(50vw - 46px), (min-width: 640px) calc(50vw - 30px), calc(100vw - 32px)",
    quality: 70,
  },
  "portfolio-frame": {
    sizes: "(min-width: 1500px) 341px, (min-width: 1024px) calc(25vw - 34px), (min-width: 768px) calc(25vw - 18px), (min-width: 640px) calc(50vw - 24px), calc(50vw - 16px)",
    quality: 70,
  },
  "content-lightbox": {
    sizes: "(min-width: 1728px) 1600px, (min-width: 640px) calc(100vw - 10rem), calc(100vw - 1.5rem)",
    quality: 70,
  },
} as const;

export type OptimizedImageContext = keyof typeof OPTIMIZED_IMAGE_CONTEXTS;

export type OptimizedImageDelivery =
  (typeof OPTIMIZED_IMAGE_CONTEXTS)[OptimizedImageContext];

export function getOptimizedImageDelivery(
  context: OptimizedImageContext,
): OptimizedImageDelivery {
  return OPTIMIZED_IMAGE_CONTEXTS[context];
}

/**
 * Mirrors PropertyGallery's responsive grid geometry. Keeping this decision
 * beside the `sizes` profiles prevents future gallery layouts from silently
 * regressing to a 100vw download.
 */
export function getPropertyGalleryImageContext(
  imageCount: number,
  index: number,
): OptimizedImageContext {
  if (imageCount <= 1) return "property-gallery-single";
  if (imageCount === 2) return "property-gallery-half";
  if (index === 0) return "property-gallery-half";
  if (imageCount === 3 && index > 0) return "property-gallery-wide-half";
  if (imageCount === 4 && index === 1) return "property-gallery-half";
  return index >= 2 ? "property-gallery-wide" : "property-gallery-tile";
}
