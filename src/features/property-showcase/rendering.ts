import type {
  PropertyFloorPlan,
  PropertyGalleryImage,
  PropertyInteractiveFloorPlanTour,
  PropertyShowcase,
} from "./types";
import { normalizeInteractiveFloorPlanInput } from "./provider-urls.ts";

export interface LegacyInteractiveTourCandidate {
  id: string;
  label: string;
  planIds: string[];
  tour: PropertyInteractiveFloorPlanTour;
}

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

export function getLegacyInteractiveTourCandidates(
  property: PropertyShowcase,
): LegacyInteractiveTourCandidate[] {
  const candidates = new Map<string, LegacyInteractiveTourCandidate>();

  for (const floorPlan of sortedPropertyFloorPlans(property.floorPlans)) {
    if (!hasFloorPlanInteractiveInput(floorPlan)) continue;
    const normalized = normalizeInteractiveFloorPlanInput({
      provider: floorPlan.interactiveProvider,
      externalUrl: floorPlan.interactiveExternalUrl,
      embedUrl: floorPlan.interactiveEmbedUrl,
      interactiveUrl: floorPlan.interactiveUrl,
    });
    if (!normalized) continue;

    const id = [
      normalized.provider,
      normalized.externalUrl ?? "",
      normalized.embedUrl ?? "",
    ].join("|");
    const existing = candidates.get(id);
    if (existing) {
      existing.planIds.push(floorPlan.id);
      continue;
    }

    candidates.set(id, {
      id,
      label:
        floorPlan.title.en.trim() ||
        normalized.externalUrl ||
        normalized.embedUrl ||
        "Legacy interactive plan",
      planIds: [floorPlan.id],
      tour: {
        enabled: true,
        provider: normalized.provider,
        externalUrl: normalized.externalUrl,
        embedUrl: normalized.embedUrl,
        posterImage: floorPlan.imageUrl,
      },
    });
  }

  return [...candidates.values()];
}

export function promoteLegacyInteractiveTour(
  property: PropertyShowcase,
  candidateId?: string,
): PropertyShowcase | null {
  if (getPropertyLevelInteractiveFloorPlanTour(property)) return property;
  const candidates = getLegacyInteractiveTourCandidates(property);
  const selected = candidateId
    ? candidates.find((candidate) => candidate.id === candidateId)
    : candidates.length === 1
      ? candidates[0]
      : undefined;
  if (!selected) return null;

  return {
    ...property,
    interactiveFloorPlanTour: selected.tour,
  };
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
