import { normalizeGoogleMapsInput } from "./listing-details.ts";
import {
  extractGoogleMapsCoordinates,
  isSafeApproximateMapCenter,
} from "./map-location.ts";
import type {
  LocalizedText,
  PropertyLocation,
  PropertyShowcase,
} from "./types";
import { resolvePropertySocialImageUrl } from "./social-preview.ts";
import { normalizePropertyVideoUrls } from "./video-urls.ts";

function blankLocalizedText(value: LocalizedText): LocalizedText {
  const entries = Object.keys(value).map((language) => [language, ""] as const);
  return { en: "", ...Object.fromEntries(entries) };
}

function hasValidCoordinatePair(
  location: {
    latitude?: number;
    longitude?: number;
  },
): location is { latitude: number; longitude: number } {
  return (
    typeof location.latitude === "number" &&
    Number.isFinite(location.latitude) &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    typeof location.longitude === "number" &&
    Number.isFinite(location.longitude) &&
    location.longitude >= -180 &&
    location.longitude <= 180
  );
}

function sanitizedExactLocation(location: PropertyLocation): PropertyLocation {
  const googleMapsLink = normalizeGoogleMapsInput(location.googleMapsLink);
  const external = normalizeGoogleMapsInput(location.mapExternalUrl);
  const embed = normalizeGoogleMapsInput(location.mapEmbedUrl);

  return {
    ...location,
    googleMapsLink: googleMapsLink?.externalUrl ?? googleMapsLink?.embedUrl,
    mapExternalUrl: external?.externalUrl ?? external?.embedUrl,
    mapEmbedUrl: embed?.embedUrl,
  };
}

function sanitizedApproximateLocation(
  location: PropertyLocation,
): PropertyLocation {
  const exactCoordinates = exactMapCoordinates(location);
  const approximateCoordinates = {
    latitude: location.approximateLatitude,
    longitude: location.approximateLongitude,
  };
  const hasApproximateCoordinates = hasValidCoordinatePair(
    approximateCoordinates,
  );
  const hasUnverifiedStoredMapSource =
    !exactCoordinates &&
    [
      location.googleMapsLink,
      location.mapExternalUrl,
      location.mapEmbedUrl,
    ].some((value) => Boolean(value?.trim()));
  const approximateCenterIsSafe =
    hasApproximateCoordinates &&
    !hasUnverifiedStoredMapSource &&
    (!exactCoordinates ||
      isSafeApproximateMapCenter(
        exactCoordinates,
        approximateCoordinates,
        location.approximateRadiusMeters ?? 1500,
      ));

  return {
    ...location,
    displayAddress:
      location.approximateLabel ?? blankLocalizedText(location.displayAddress),
    streetAddress: undefined,
    city: undefined,
    region: undefined,
    postalCode: undefined,
    country: undefined,
    latitude: undefined,
    longitude: undefined,
    // Never derive a public center at render time from the exact point. The
    // admin flow persists an intentionally offset center before publication.
    approximateLatitude: approximateCenterIsSafe
      ? location.approximateLatitude
      : undefined,
    approximateLongitude: approximateCenterIsSafe
      ? location.approximateLongitude
      : undefined,
    approximateRadiusMeters: location.approximateRadiusMeters ?? 1500,
    allowApproximateAreaLink: location.allowApproximateAreaLink === true,
    googleMapsLink: undefined,
    mapExternalUrl: undefined,
    mapEmbedUrl: undefined,
  };
}

function exactMapCoordinates(
  location: PropertyLocation,
): { latitude: number; longitude: number } | null {
  const directCoordinates = {
    latitude: location.latitude,
    longitude: location.longitude,
  };
  if (hasValidCoordinatePair(directCoordinates)) return directCoordinates;

  for (const value of [
    location.googleMapsLink,
    location.mapExternalUrl,
    location.mapEmbedUrl,
  ]) {
    const coordinates = value ? extractGoogleMapsCoordinates(value) : null;
    if (coordinates) return coordinates;
  }

  return null;
}

function sanitizedHiddenLocation(location: PropertyLocation): PropertyLocation {
  return {
    ...location,
    displayAddress: blankLocalizedText(location.displayAddress),
    streetAddress: undefined,
    city: undefined,
    region: undefined,
    postalCode: undefined,
    country: undefined,
    approximateLabel: undefined,
    latitude: undefined,
    longitude: undefined,
    approximateLatitude: undefined,
    approximateLongitude: undefined,
    approximateRadiusMeters: undefined,
    allowApproximateAreaLink: undefined,
    showMap: false,
    googleMapsLink: undefined,
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
    googleMapsLink: undefined,
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
  const normalizedVideos = normalizePropertyVideoUrls(property);
  const videos = normalizedVideos.property?.videos
    ? {
        ...normalizedVideos.property.videos,
        items: normalizedVideos.property.videos.items.map((video) => ({
          ...video,
          posterUrl:
            resolvePropertySocialImageUrl(property, video.posterUrl) ??
            undefined,
        })),
      }
    : undefined;

  return {
    ...property,
    location,
    videos:
      videos?.enabled === false
        ? { enabled: false, items: [] }
        : videos,
  };
}
