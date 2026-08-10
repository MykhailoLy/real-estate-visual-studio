export const MOBILE_GALLERY_INITIAL_IMAGE_COUNT = 5;

export function shouldShowMobileGalleryImage(
  index: number,
  expanded: boolean,
): boolean {
  return expanded || index < MOBILE_GALLERY_INITIAL_IMAGE_COUNT;
}

export function hasCollapsedMobileGalleryImages(imageCount: number): boolean {
  return imageCount > MOBILE_GALLERY_INITIAL_IMAGE_COUNT;
}
