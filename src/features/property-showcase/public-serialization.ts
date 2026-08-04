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

function approximateCoordinate(
  explicit: number | undefined,
  fallback: number | undefined,
): number | undefined {
  return typeof explicit === "number"
    ? explicit
    : roundPublicCoordinate(fallback);
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
    displayAddress:
      location.approximateLabel ?? blankLocalizedText(location.displayAddress),
    latitude: undefined,
    longitude: undefined,
    approximateLatitude: approximateCoordinate(
      location.approximateLatitude,
      location.latitude,
    ),
    approximateLongitude: approximateCoordinate(
      location.approximateLongitude,
      location.longitude,
    ),
    approximateRadiusMeters: location.approximateRadiusMeters ?? 1500,
    allowApproximateAreaLink: location.allowApproximateAreaLink === true,
    mapExternalUrl: undefined,
    mapEmbedUrl: undefined,
  };
}

function sanitizedHiddenLocation(location: PropertyLocation): PropertyLocation {
  return {
    ...location,
    displayAddress: blankLocalizedText(location.displayAddress),
    approximateLabel: undefined,
    latitude: undefined,
    longitude: undefined,
    approximateLatitude: undefined,
    approximateLongitude: undefined,
    approximateRadiusMeters: undefined,
    allowApproximateAreaLink: undefined,
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
    approximateLatitude: undefined,
    approximateLongitude: undefined,
    approximateRadiusMeters: undefined,
    allowApproximateAreaLink: undefined,
    showMap: false,
    mapExternalUrl: undefined,
    mapEmbedUrl: undefined,
  };
}

export function serializePublicPropertyLocation(
  location: PropertyLocation,
): PropertyLocation {
  if (location.privacyMode === "hidden") {
    return sanitizedHiddenLocation(location);
  }

  const privacySafeLocation =
    location.privacyMode === "approximate"
      ? sanitizedApproximateLocation(location)
      : sanitizedExactLocation(location);

  return location.showMap === false
    ? sanitizedNoMapLocation(privacySafeLocation)
    : privacySafeLocation;
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
