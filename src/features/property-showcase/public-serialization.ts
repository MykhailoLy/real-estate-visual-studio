import { normalizeGoogleMapsInput } from "./listing-details.ts";
import type {
  LocalizedText,
  PropertyLocation,
  PropertyShowcase,
} from "./types";

function roundPublicCoordinate(value: number | undefined): number | undefined {
  if (typeof value !== "number") return undefined;
  const rounded = Math.round(value * 10) / 10;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function blankLocalizedText(value: LocalizedText): LocalizedText {
  const entries = Object.keys(value).map((language) => [language, ""] as const);
  return { en: "", ...Object.fromEntries(entries) };
}

function sanitizedExactLocation(location: PropertyLocation): PropertyLocation {
  const external = normalizeGoogleMapsInput(location.mapExternalUrl);
  const embed = normalizeGoogleMapsInput(location.mapEmbedUrl);

  return {
    ...location,
    mapExternalUrl: external?.externalUrl ?? external?.embedUrl,
    mapEmbedUrl: embed?.embedUrl,
  };
}

function sanitizedApproximateLocation(
  location: PropertyLocation,
): PropertyLocation {
  return {
    ...location,
    displayAddress: blankLocalizedText(location.displayAddress),
    latitude: roundPublicCoordinate(location.latitude),
    longitude: roundPublicCoordinate(location.longitude),
    mapExternalUrl: undefined,
    mapEmbedUrl: undefined,
  };
}

function sanitizedHiddenLocation(location: PropertyLocation): PropertyLocation {
  return {
    ...location,
    displayAddress: blankLocalizedText(location.displayAddress),
    latitude: undefined,
    longitude: undefined,
    showMap: false,
    mapExternalUrl: undefined,
    mapEmbedUrl: undefined,
  };
}

function sanitizedNoMapLocation(location: PropertyLocation): PropertyLocation {
  return {
    ...location,
    latitude: undefined,
    longitude: undefined,
    showMap: false,
    mapExternalUrl: undefined,
    mapEmbedUrl: undefined,
  };
}

export function serializePublicPropertyLocation(
  location: PropertyLocation,
): PropertyLocation {
  return location.privacyMode === "hidden"
    ? sanitizedHiddenLocation(location)
    : location.showMap === false
      ? sanitizedNoMapLocation(location)
      : location.privacyMode === "approximate"
        ? sanitizedApproximateLocation(location)
        : sanitizedExactLocation(location);
}

export function serializePublicPropertyShowcase(
  property: PropertyShowcase,
): PropertyShowcase {
  const location = serializePublicPropertyLocation(property.location);

  return {
    ...property,
    location,
  };
}
