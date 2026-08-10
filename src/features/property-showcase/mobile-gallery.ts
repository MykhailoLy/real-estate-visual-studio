export const PROPERTY_GALLERY_COLLAPSED_IMAGE_COUNT = 5;

export type PropertyGalleryCompactLayout = "single" | "pair" | "mosaic";

export function propertyGalleryCompactLayout(
  imageCount: number,
): PropertyGalleryCompactLayout {
  if (imageCount === 1) return "single";
  if (imageCount === 2) return "pair";
  return "mosaic";
}

export function visiblePropertyGalleryImageCount(
  imageCount: number,
  expanded: boolean,
): number {
  return expanded
    ? imageCount
    : Math.min(imageCount, PROPERTY_GALLERY_COLLAPSED_IMAGE_COUNT);
}

export function shouldShowPropertyGalleryImage(
  index: number,
  expanded: boolean,
): boolean {
  return expanded || index < PROPERTY_GALLERY_COLLAPSED_IMAGE_COUNT;
}

export function hasCollapsedPropertyGalleryImages(imageCount: number): boolean {
  return imageCount > PROPERTY_GALLERY_COLLAPSED_IMAGE_COUNT;
}
