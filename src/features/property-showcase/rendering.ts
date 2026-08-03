import type {
  PropertyFloorPlan,
  PropertyGalleryImage,
  PropertyInteractiveFloorPlanTour,
  PropertyShowcase,
} from "./types";
import { normalizeInteractiveFloorPlanInput } from "./provider-urls.ts";

export function hasNativeInteractiveFloorPlan(
  gallery: readonly PropertyGalleryImage[],
): boolean {
  return gallery.some((image) => Boolean(image.roomId));
}

export function hasExternalInteractiveFloorPlan(
  property: PropertyShowcase,
): boolean {
  return (
    getPropertyLevelInteractiveFloorPlanTour(property) !== undefined ||
    getExternalInteractiveFloorPlan(property) !== undefined
  );
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

export function getPropertyLevelInteractiveFloorPlanTour(
  property: PropertyShowcase,
): PropertyInteractiveFloorPlanTour | undefined {
  const tour = property.interactiveFloorPlanTour;
  if (!tour?.enabled) return undefined;
  const normalized = normalizeInteractiveFloorPlanInput({
    provider: tour.provider,
    externalUrl: tour.externalUrl,
    embedUrl: tour.embedUrl,
  });
  return normalized ? tour : undefined;
}

export function shouldRenderInteractiveFloorPlan(
  property: PropertyShowcase,
): boolean {
  if (getPropertyLevelInteractiveFloorPlanTour(property)) return true;
  if (property.floorPlans.length === 0) return false;
  return (
    hasExternalInteractiveFloorPlan(property) ||
    hasNativeInteractiveFloorPlan(property.gallery)
  );
}
