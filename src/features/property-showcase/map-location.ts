import { normalizeGoogleMapsInput } from "./listing-details.ts";

export interface PropertyMapCoordinates {
  latitude: number;
  longitude: number;
}

export interface ResolvedGoogleMapsLink {
  coordinates: PropertyMapCoordinates;
  resolvedUrl: string;
}

export type GoogleMapsLinkResolution =
  | { ok: true; value: ResolvedGoogleMapsLink }
  | { ok: false; error: string };

type RedirectResponse = Pick<Response, "headers" | "status" | "url">;
type FetchLike = (
  input: string,
  init: RequestInit,
) => Promise<RedirectResponse>;

const GOOGLE_MAPS_HOSTS = new Set([
  "www.google.com",
  "maps.google.com",
  "maps.app.goo.gl",
]);
const MAX_REDIRECTS = 3;
const MAP_LINK_TIMEOUT_MS = 5_000;
const EARTH_RADIUS_METERS = 6_371_000;

/**
 * A privacy radius is the minimum Haversine distance between the source
 * property point and the public approximate map center.
 *
 * Generated centers deliberately include a buffer so six-decimal persistence
 * rounding cannot move one inside that boundary.
 */
export const APPROXIMATE_CENTER_MIN_DISTANCE_MULTIPLIER = 1.1;
export const APPROXIMATE_CENTER_MAX_DISTANCE_MULTIPLIER = 1.4;

function isFiniteCoordinate(
  latitude: number,
  longitude: number,
): boolean {
  return (
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function coordinatesFromPair(value: string | null): PropertyMapCoordinates | null {
  if (!value) return null;
  const match = value.match(
    /^\s*(-?(?:\d{1,2}(?:\.\d+)?|90(?:\.0+)?))\s*,\s*(-?(?:\d{1,3}(?:\.\d+)?|180(?:\.0+)?))\s*$/,
  );
  if (!match) return null;

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  return isFiniteCoordinate(latitude, longitude) ? { latitude, longitude } : null;
}

function coordinatesFromGoogleData(value: string): PropertyMapCoordinates | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  const direct = decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (direct) {
    return coordinatesFromPair(`${direct[1]},${direct[2]}`);
  }

  const reverse = decoded.match(/!4d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/);
  return reverse ? coordinatesFromPair(`${reverse[2]},${reverse[1]}`) : null;
}

function isTrustedGoogleMapsUrl(url: URL): boolean {
  return (
    url.protocol === "https:" &&
    !url.username &&
    !url.password &&
    !url.port &&
    GOOGLE_MAPS_HOSTS.has(url.hostname.toLowerCase())
  );
}

function parseTrustedGoogleMapsUrl(value: string): URL | null {
  const normalized = normalizeGoogleMapsInput(value);
  const candidate = normalized?.externalUrl ?? normalized?.embedUrl;
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    return isTrustedGoogleMapsUrl(url) ? url : null;
  } catch {
    return null;
  }
}

export function extractGoogleMapsCoordinates(
  value: string | URL,
): PropertyMapCoordinates | null {
  const url = typeof value === "string" ? parseTrustedGoogleMapsUrl(value) : value;
  if (!url || !isTrustedGoogleMapsUrl(url)) return null;

  for (const key of ["q", "query", "ll", "center"]) {
    const coordinates = coordinatesFromPair(url.searchParams.get(key));
    if (coordinates) return coordinates;
  }

  const atCoordinates = url.pathname.match(
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,|$)/,
  );
  if (atCoordinates) {
    const coordinates = coordinatesFromPair(
      `${atCoordinates[1]},${atCoordinates[2]}`,
    );
    if (coordinates) return coordinates;
  }

  return coordinatesFromGoogleData(`${url.pathname}${url.search}${url.hash}`);
}

function redirectLocation(
  response: RedirectResponse,
  current: URL,
): URL | null {
  if (response.status < 300 || response.status >= 400) return null;
  const location = response.headers.get("location");
  if (!location) return null;

  try {
    const next = new URL(location, current);
    return isTrustedGoogleMapsUrl(next) ? next : null;
  } catch {
    return null;
  }
}

/**
 * Resolves a Google Maps share/copy link without following a redirect to an
 * arbitrary host. The route handler calls this only after admin auth.
 */
export async function resolveGoogleMapsLink(
  input: string,
  fetcher: FetchLike = fetch,
): Promise<GoogleMapsLinkResolution> {
  let current = parseTrustedGoogleMapsUrl(input);
  if (!current) {
    return { ok: false, error: "Use a Google Maps share or copy link." };
  }

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const coordinates = extractGoogleMapsCoordinates(current);
    if (coordinates) {
      return {
        ok: true,
        value: { coordinates, resolvedUrl: current.toString() },
      };
    }

    let response: RedirectResponse;
    try {
      response = await fetcher(current.toString(), {
        redirect: "manual",
        signal: AbortSignal.timeout(MAP_LINK_TIMEOUT_MS),
        headers: { Accept: "text/html,application/xhtml+xml" },
      });
    } catch {
      return {
        ok: false,
        error: "Google Maps could not be reached. Paste an expanded Google Maps link or use Advanced / legacy settings.",
      };
    }

    const next = redirectLocation(response, current);
    if (next) {
      current = next;
      continue;
    }

    if (response.status >= 300 && response.status < 400) {
      return {
        ok: false,
        error: "The Google Maps link redirected to an unsupported destination.",
      };
    }

    if (response.url) {
      try {
        const finalUrl = new URL(response.url);
        if (isTrustedGoogleMapsUrl(finalUrl)) {
          const finalCoordinates = extractGoogleMapsCoordinates(finalUrl);
          if (finalCoordinates) {
            return {
              ok: true,
              value: {
                coordinates: finalCoordinates,
                resolvedUrl: finalUrl.toString(),
              },
            };
          }
        }
      } catch {
        // The response URL is optional diagnostic data; ignore malformed values.
      }
    }

    return {
      ok: false,
      error: "Coordinates could not be read safely. Paste an expanded Google Maps link or use Advanced / legacy settings.",
    };
  }

  return {
    ok: false,
    error: "The Google Maps link has too many redirects. Paste an expanded Google Maps link instead.",
  };
}

export function createApproximateMapCenter(
  exact: PropertyMapCoordinates,
  radiusMeters: number,
  random: () => number = Math.random,
): PropertyMapCoordinates {
  const radius = Math.min(50_000, Math.max(100, Math.round(radiusMeters)));
  const angle = random() * Math.PI * 2;
  const distance = radius * (
    APPROXIMATE_CENTER_MIN_DISTANCE_MULTIPLIER +
    random() * (
      APPROXIMATE_CENTER_MAX_DISTANCE_MULTIPLIER -
      APPROXIMATE_CENTER_MIN_DISTANCE_MULTIPLIER
    )
  );
  const latitudeRadians = (exact.latitude * Math.PI) / 180;
  const angularDistance = distance / EARTH_RADIUS_METERS;

  // A geodesic destination calculation remains valid near the poles and
  // across the antimeridian. Haversine below remains the single source of
  // truth for the privacy invariant.
  const destinationLatitude = Math.asin(
    Math.sin(latitudeRadians) * Math.cos(angularDistance) +
      Math.cos(latitudeRadians) * Math.sin(angularDistance) * Math.cos(angle),
  );
  const destinationLongitude =
    (exact.longitude * Math.PI) / 180 +
    Math.atan2(
      Math.sin(angle) * Math.sin(angularDistance) * Math.cos(latitudeRadians),
      Math.cos(angularDistance) -
        Math.sin(latitudeRadians) * Math.sin(destinationLatitude),
    );
  const normalizedLongitude =
    ((destinationLongitude * 180) / Math.PI + 540) % 360 - 180;

  return {
    latitude: Number(((destinationLatitude * 180) / Math.PI).toFixed(6)),
    longitude: Number(normalizedLongitude.toFixed(6)),
  };
}

export function distanceBetweenCoordinatesMeters(
  first: PropertyMapCoordinates,
  second: PropertyMapCoordinates,
): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const a = Math.min(1, Math.max(0,
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2,
  ));
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isSafeApproximateMapCenter(
  exact: PropertyMapCoordinates,
  approximate: PropertyMapCoordinates,
  privacyRadiusMeters: number,
): boolean {
  if (
    !isFiniteCoordinate(exact.latitude, exact.longitude) ||
    !isFiniteCoordinate(approximate.latitude, approximate.longitude)
  ) {
    return false;
  }

  const radius = Math.min(50_000, Math.max(100, Math.round(privacyRadiusMeters)));
  return distanceBetweenCoordinatesMeters(exact, approximate) >= radius;
}
