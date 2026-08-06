import {
  normalizePropertyProviderUrls,
  type ProviderUrlValidationResult,
} from "./provider-urls.ts";
import { normalizeGoogleMapsInput } from "./listing-details.ts";
import { getPrimaryLanguage } from "./localization.ts";
import { normalizePropertyVideoUrls } from "./video-urls.ts";
import type {
  PropertyFloorPlan,
  PropertyGalleryImage,
  PropertyShowcase,
} from "./types";

export type PropertyShowcaseUpdateMode = "details" | "media" | "replace";

export interface PropertyShowcaseUpdateOptions {
  removeVirtualTour?: boolean;
  removeInteractiveFloorPlan?: boolean;
  removeInteractivePoster?: boolean;
  removeFloorPlan?: boolean;
  replaceFloorPlans?: boolean;
  updateSocialCard?: boolean;
}

export interface PropertyShowcaseUpdateResult {
  ok: boolean;
  property?: PropertyShowcase;
  errors: string[];
}

export function immutablePropertySlugError(
  existing: PropertyShowcase,
  incoming: PropertyShowcase,
): string | null {
  return existing.slug === incoming.slug
    ? null
    : "Property slug cannot be changed after creation.";
}

export function immutablePropertyPrimaryLanguageError(
  existing: PropertyShowcase,
  incoming: PropertyShowcase,
): string | null {
  return getPrimaryLanguage(existing) === getPrimaryLanguage(incoming)
    ? null
    : "Primary content language cannot be changed after creation.";
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
  if (options.replaceFloorPlans) {
    const replaced = incoming.map((plan, index) => ({
      ...plan,
      sortOrder: index + 1,
    }));
    return options.removeInteractiveFloorPlan
      ? replaced.map(clearFloorPlanInteractiveFields)
      : replaced;
  }
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
  const existingInteractive = existing.interactiveFloorPlanTour;
  const incomingInteractive = incoming.interactiveFloorPlanTour;

  return {
    ...incoming,
    coverImage: existing.coverImage || incoming.coverImage,
    brochureUrl: existing.brochureUrl ?? incoming.brochureUrl,
    gallery: existing.gallery.length > 0 ? existing.gallery : incoming.gallery,
    socialCard: existing.socialCard,
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
    interactiveFloorPlanTour: options.removeInteractiveFloorPlan
      ? undefined
      : incomingInteractive
        ? {
            ...incomingInteractive,
            posterImage:
              existingInteractive?.posterImage ??
              incomingInteractive.posterImage ??
              incoming.floorPlans[0]?.imageUrl ??
              existing.floorPlans[0]?.imageUrl,
          }
        : existingInteractive,
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
  const agent = {
    ...existing.agent,
  };
  if ("portraitUrl" in incoming.agent || "portraitUrl" in existing.agent) {
    agent.portraitUrl = incoming.agent.portraitUrl;
  }
  if ("logoUrl" in incoming.agent || "logoUrl" in existing.agent) {
    agent.logoUrl = incoming.agent.logoUrl;
  }

  return {
    ...existing,
    coverImage,
    gallery,
    socialCard: options.updateSocialCard
      ? incoming.socialCard
      : existing.socialCard,
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
    interactiveFloorPlanTour: options.removeInteractiveFloorPlan
      ? undefined
      : existing.interactiveFloorPlanTour
        ? {
            ...existing.interactiveFloorPlanTour,
            posterImage:
              options.removeInteractivePoster
                ? undefined
                : (incoming.interactiveFloorPlanTour?.posterImage ??
                  existing.interactiveFloorPlanTour.posterImage),
          }
        : incoming.interactiveFloorPlanTour,
    agent,
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

  const videoNormalized = normalizePropertyVideoUrls(normalized.property);
  if (!videoNormalized.ok || !videoNormalized.property) {
    return {
      ok: false,
      errors: videoNormalized.errors,
    };
  }

  const mapNormalized = normalizePropertyMapUrls(videoNormalized.property);
  if (!mapNormalized.ok || !mapNormalized.property) {
    return {
      ok: false,
      errors: mapNormalized.errors,
    };
  }

  return {
    ok: true,
    property: mapNormalized.property,
    errors: [],
  };
}

function normalizePropertyMapUrls(
  property: PropertyShowcase,
): PropertyShowcaseUpdateResult {
  const externalInput = property.location.mapExternalUrl?.trim();
  const embedInput = property.location.mapEmbedUrl?.trim();
  const errors: string[] = [];
  const external = externalInput ? normalizeGoogleMapsInput(externalInput) : null;
  const embed = embedInput ? normalizeGoogleMapsInput(embedInput) : null;

  if (externalInput && !external) {
    errors.push("Unsupported or unsafe Google Maps link.");
  }
  if (embedInput && !embed?.embedUrl) {
    errors.push("Unsupported or unsafe Google Maps embed URL.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const location = {
    ...property.location,
  };

  if (externalInput) {
    location.mapExternalUrl =
      external?.externalUrl ?? external?.embedUrl ?? property.location.mapExternalUrl;
  }
  if (embedInput) {
    location.mapEmbedUrl = embed?.embedUrl ?? property.location.mapEmbedUrl;
  }

  return {
    ok: true,
    property: {
      ...property,
      location,
    },
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
