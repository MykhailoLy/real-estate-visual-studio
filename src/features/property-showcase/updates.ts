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

export interface PropertyShowcaseUpdateOptions {
  removeVirtualTour?: boolean;
  removeInteractiveFloorPlan?: boolean;
  removeFloorPlan?: boolean;
}

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
  options: PropertyShowcaseUpdateOptions,
): PropertyFloorPlan[] {
  if (options.removeFloorPlan) return [];
  if (existing.length === 0) {
    return options.removeInteractiveFloorPlan
      ? incoming.map(clearFloorPlanInteractiveFields)
      : [...incoming];
  }
  if (incoming.length === 0) {
    return options.removeInteractiveFloorPlan
      ? existing.map(clearFloorPlanInteractiveFields)
      : [...existing];
  }

  const existingById = byId(existing);

  const merged = existing.map((existingPlan, index) => {
    const incomingPlan =
      existingById.has(incoming[index]?.id ?? "")
        ? incoming[index]
        : incoming.find((plan) => plan.id === existingPlan.id) ?? incoming[index];

    if (!incomingPlan) return existingPlan;

    return {
      ...existingPlan,
      title: incomingPlan.title,
      interactiveProvider:
        incomingPlan.interactiveProvider ?? existingPlan.interactiveProvider,
      interactiveExternalUrl:
        incomingPlan.interactiveExternalUrl ??
        existingPlan.interactiveExternalUrl,
      interactiveEmbedUrl:
        incomingPlan.interactiveEmbedUrl ?? existingPlan.interactiveEmbedUrl,
      interactiveUrl:
        incomingPlan.interactiveUrl ?? existingPlan.interactiveUrl,
      sortOrder: incomingPlan.sortOrder,
    };
  });

  return options.removeInteractiveFloorPlan
    ? merged.map(clearFloorPlanInteractiveFields)
    : merged;
}

function mergeMediaFloorPlans(
  existing: readonly PropertyFloorPlan[],
  incoming: readonly PropertyFloorPlan[],
  options: PropertyShowcaseUpdateOptions,
): PropertyFloorPlan[] {
  if (options.removeFloorPlan) return [];
  if (incoming.length === 0) {
    return options.removeInteractiveFloorPlan
      ? existing.map(clearFloorPlanInteractiveFields)
      : [...existing];
  }
  const existingById = byId(existing);
  const incomingIds = new Set(incoming.map((plan) => plan.id));

  const mergedIncoming = incoming.map((incomingPlan, index) => {
    const existingPlan = existingById.get(incomingPlan.id) ?? existing[index];

    return {
      ...incomingPlan,
      interactiveProvider:
        existingPlan?.interactiveProvider ?? incomingPlan.interactiveProvider,
      interactiveExternalUrl:
        existingPlan?.interactiveExternalUrl ??
        incomingPlan.interactiveExternalUrl,
      interactiveEmbedUrl:
        existingPlan?.interactiveEmbedUrl ?? incomingPlan.interactiveEmbedUrl,
      interactiveUrl:
        existingPlan?.interactiveUrl ?? incomingPlan.interactiveUrl,
    };
  });

  const merged = [
    ...mergedIncoming,
    ...existing.filter((existingPlan) => !incomingIds.has(existingPlan.id)),
  ];

  return options.removeInteractiveFloorPlan
    ? merged.map(clearFloorPlanInteractiveFields)
    : merged;
}

function clearFloorPlanInteractiveFields(
  floorPlan: PropertyFloorPlan,
): PropertyFloorPlan {
  return {
    id: floorPlan.id,
    title: floorPlan.title,
    imageUrl: floorPlan.imageUrl,
    downloadUrl: floorPlan.downloadUrl,
    sortOrder: floorPlan.sortOrder,
  };
}

function mergeDetailsUpdate(
  existing: PropertyShowcase,
  incoming: PropertyShowcase,
  options: PropertyShowcaseUpdateOptions,
): PropertyShowcase {
  const existingTour = existing.virtualTour;
  const incomingTour = incoming.virtualTour;

  return {
    ...incoming,
    coverImage: existing.coverImage || incoming.coverImage,
    brochureUrl: existing.brochureUrl ?? incoming.brochureUrl,
    gallery: existing.gallery.length > 0 ? existing.gallery : incoming.gallery,
    virtualTour: options.removeVirtualTour
      ? undefined
      : incomingTour
        ? {
            ...incomingTour,
            posterImage:
              existingTour?.posterImage ??
              incomingTour.posterImage ??
              existing.coverImage,
          }
        : existingTour,
    floorPlans: mergeDetailsFloorPlans(
      existing.floorPlans,
      incoming.floorPlans,
      options,
    ),
    publishedAt: existing.publishedAt,
  };
}

function mergeMediaUpdate(
  existing: PropertyShowcase,
  incoming: PropertyShowcase,
  options: PropertyShowcaseUpdateOptions,
): PropertyShowcase {
  const gallery: PropertyGalleryImage[] = incoming.gallery;
  const coverImage = incoming.coverImage || existing.coverImage;

  return {
    ...existing,
    coverImage,
    gallery,
    floorPlans: mergeMediaFloorPlans(
      existing.floorPlans,
      incoming.floorPlans,
      options,
    ),
    virtualTour: options.removeVirtualTour
      ? undefined
      : existing.virtualTour
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
  options: PropertyShowcaseUpdateOptions = {},
): PropertyShowcaseUpdateResult {
  if (!existing || mode === "replace") return finish(incoming);

  if (mode === "media") {
    return finish(mergeMediaUpdate(existing, incoming, options));
  }

  return finish(mergeDetailsUpdate(existing, incoming, options));
}
