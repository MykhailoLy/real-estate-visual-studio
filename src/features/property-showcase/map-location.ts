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
  // Use an annulus rather than a point close to the property for a meaningful
  // privacy offset while still remaining inside the admin-selected radius.
  const distance = radius * (0.6 + random() * 0.3);
  const latitudeRadians = (exact.latitude * Math.PI) / 180;
  const latitudeOffset = (distance * Math.cos(angle)) / 111_320;
  const longitudeDenominator = Math.max(1, 111_320 * Math.cos(latitudeRadians));
  const longitudeOffset = (distance * Math.sin(angle)) / longitudeDenominator;

  return {
    latitude: Number((exact.latitude + latitudeOffset).toFixed(6)),
    longitude: Number((exact.longitude + longitudeOffset).toFixed(6)),
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
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
