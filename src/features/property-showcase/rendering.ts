import type { PropertyGalleryImage, PropertyShowcase } from "./types";

export function hasNativeInteractiveFloorPlan(
  gallery: readonly PropertyGalleryImage[],
): boolean {
  return gallery.some((image) => Boolean(image.roomId));
}

export function hasExternalInteractiveFloorPlan(
  property: PropertyShowcase,
): boolean {
  const primaryFloorPlan = [...property.floorPlans].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )[0];

  return Boolean(
    primaryFloorPlan?.interactiveExternalUrl?.trim() ||
      primaryFloorPlan?.interactiveEmbedUrl?.trim() ||
      primaryFloorPlan?.interactiveUrl?.trim(),
  );
}

export function shouldRenderInteractiveFloorPlan(
  property: PropertyShowcase,
): boolean {
  if (property.floorPlans.length === 0) return false;
  return (
    hasExternalInteractiveFloorPlan(property) ||
    hasNativeInteractiveFloorPlan(property.gallery)
  );
}
