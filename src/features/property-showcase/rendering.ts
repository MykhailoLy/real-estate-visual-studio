import type {
  PropertyFloorPlan,
  PropertyGalleryImage,
  PropertyShowcase,
} from "./types";

export function hasNativeInteractiveFloorPlan(
  gallery: readonly PropertyGalleryImage[],
): boolean {
  return gallery.some((image) => Boolean(image.roomId));
}

export function hasExternalInteractiveFloorPlan(
  property: PropertyShowcase,
): boolean {
  return getExternalInteractiveFloorPlan(property) !== undefined;
}

export function hasFloorPlanInteractiveInput(
  floorPlan: PropertyFloorPlan | undefined,
): boolean {
  return Boolean(
    floorPlan?.interactiveExternalUrl?.trim() ||
      floorPlan?.interactiveEmbedUrl?.trim() ||
      floorPlan?.interactiveUrl?.trim(),
  );
}

export function sortedPropertyFloorPlans(
  floorPlans: readonly PropertyFloorPlan[],
): PropertyFloorPlan[] {
  return [...floorPlans].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getExternalInteractiveFloorPlan(
  property: PropertyShowcase,
): PropertyFloorPlan | undefined {
  return sortedPropertyFloorPlans(property.floorPlans).find(
    hasFloorPlanInteractiveInput,
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
