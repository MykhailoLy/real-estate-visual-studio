import {
  normalizePropertyProviderUrls,
  type ProviderUrlValidationResult,
} from "./provider-urls.ts";
import type {
  PropertyFloorPlan,
  PropertyGalleryImage,
  PropertyShowcase,
} from "./types";

export type PropertyShowcaseUpdateMode = "details" | "media" | "replace";

export interface PropertyShowcaseUpdateResult {
  ok: boolean;
  property?: PropertyShowcase;
  errors: string[];
}

function byId<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function mergeDetailsFloorPlans(
  existing: readonly PropertyFloorPlan[],
  incoming: readonly PropertyFloorPlan[],
): PropertyFloorPlan[] {
  if (existing.length === 0) return [...incoming];
  if (incoming.length === 0) return [...existing];

  const existingById = byId(existing);

  return existing.map((existingPlan, index) => {
    const incomingPlan =
      existingById.has(incoming[index]?.id ?? "")
        ? incoming[index]
        : incoming.find((plan) => plan.id === existingPlan.id) ?? incoming[index];

    if (!incomingPlan) return existingPlan;

    return {
      ...existingPlan,
      title: incomingPlan.title,
      interactiveUrl:
        incomingPlan.interactiveUrl ?? existingPlan.interactiveUrl,
      sortOrder: incomingPlan.sortOrder,
    };
  });
}

function mergeMediaFloorPlans(
  existing: readonly PropertyFloorPlan[],
  incoming: readonly PropertyFloorPlan[],
): PropertyFloorPlan[] {
  if (incoming.length === 0) return [...existing];
  const existingById = byId(existing);
  const incomingIds = new Set(incoming.map((plan) => plan.id));

  const mergedIncoming = incoming.map((incomingPlan, index) => {
    const existingPlan = existingById.get(incomingPlan.id) ?? existing[index];

    return {
      ...incomingPlan,
      interactiveUrl:
        existingPlan?.interactiveUrl ?? incomingPlan.interactiveUrl,
    };
  });

  return [
    ...mergedIncoming,
    ...existing.filter((existingPlan) => !incomingIds.has(existingPlan.id)),
  ];
}

function mergeDetailsUpdate(
  existing: PropertyShowcase,
  incoming: PropertyShowcase,
): PropertyShowcase {
  const existingTour = existing.virtualTour;
  const incomingTour = incoming.virtualTour;

  return {
    ...incoming,
    coverImage: existing.coverImage || incoming.coverImage,
    brochureUrl: existing.brochureUrl ?? incoming.brochureUrl,
    gallery: existing.gallery.length > 0 ? existing.gallery : incoming.gallery,
    virtualTour: incomingTour
      ? {
          ...incomingTour,
          posterImage:
            existingTour?.posterImage ??
            incomingTour.posterImage ??
            existing.coverImage,
        }
      : existingTour,
    floorPlans: mergeDetailsFloorPlans(existing.floorPlans, incoming.floorPlans),
    publishedAt: existing.publishedAt,
  };
}

function mergeMediaUpdate(
  existing: PropertyShowcase,
  incoming: PropertyShowcase,
): PropertyShowcase {
  const gallery: PropertyGalleryImage[] = incoming.gallery;
  const coverImage = incoming.coverImage || existing.coverImage;

  return {
    ...existing,
    coverImage,
    gallery,
    floorPlans: mergeMediaFloorPlans(existing.floorPlans, incoming.floorPlans),
    virtualTour: existing.virtualTour
      ? {
          ...existing.virtualTour,
          posterImage:
            incoming.virtualTour?.posterImage ??
            existing.virtualTour.posterImage ??
            coverImage,
        }
      : incoming.virtualTour,
  };
}

function finish(
  property: PropertyShowcase,
): PropertyShowcaseUpdateResult {
  const normalized: ProviderUrlValidationResult =
    normalizePropertyProviderUrls(property);

  if (!normalized.ok || !normalized.property) {
    return {
      ok: false,
      errors: normalized.errors,
    };
  }

  return {
    ok: true,
    property: normalized.property,
    errors: [],
  };
}

export function mergePropertyShowcaseUpdate(
  existing: PropertyShowcase | null,
  incoming: PropertyShowcase,
  mode: PropertyShowcaseUpdateMode,
): PropertyShowcaseUpdateResult {
  if (!existing || mode === "replace") return finish(incoming);

  if (mode === "media") {
    return finish(mergeMediaUpdate(existing, incoming));
  }

  return finish(mergeDetailsUpdate(existing, incoming));
}
