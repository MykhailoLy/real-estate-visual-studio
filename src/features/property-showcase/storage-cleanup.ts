import type { PropertyShowcase } from "./types";

export const PROPERTY_SHOWCASE_STORAGE_ROOT = "property-showcases";
export const PROPERTY_SHOWCASE_SITE_MEDIA_BUCKET = "site-media";

export function propertyShowcaseStorageFolder(slug: string): string {
  return `${PROPERTY_SHOWCASE_STORAGE_ROOT}/${slug}/`;
}

function normalizeObjectPath(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const path = trimmed.replace(/^\/+/, "");
  if (!path || path.length > 1024) return null;
  if (path.includes("\\") || path.includes("//")) return null;
  if (path.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    return null;
  }
  return path;
}

export function siteMediaObjectPathFromUrl(
  value: string | undefined,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const directPath = normalizeObjectPath(trimmed);
  if (directPath?.startsWith(`${PROPERTY_SHOWCASE_STORAGE_ROOT}/`)) {
    return directPath;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
    const marker = `/storage/v1/object/public/${PROPERTY_SHOWCASE_SITE_MEDIA_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return null;
    const encodedPath = url.pathname.slice(markerIndex + marker.length);
    return normalizeObjectPath(decodeURIComponent(encodedPath));
  } catch {
    return null;
  }
}

export function ownedPropertyShowcaseStoragePath(
  value: string | undefined,
  slug: string,
): string | null {
  const path = siteMediaObjectPathFromUrl(value);
  if (!path) return null;
  const folder = propertyShowcaseStorageFolder(slug);
  if (!path.startsWith(folder) || path.length <= folder.length) return null;
  return path;
}

export function isOwnedPropertyShowcaseStoragePath(
  value: string | undefined,
  slug: string,
): boolean {
  return Boolean(ownedPropertyShowcaseStoragePath(value, slug));
}

function collectMediaValues(property: PropertyShowcase): string[] {
  return [
    property.coverImage,
    ...property.gallery.map((image) => image.src),
    property.virtualTour?.posterImage,
    ...property.floorPlans.flatMap((plan) => [
      plan.imageUrl,
      plan.downloadUrl,
    ]),
  ].filter((value): value is string => Boolean(value));
}

export function collectPropertyShowcaseMediaPaths(
  property: PropertyShowcase,
  slug: string,
): string[] {
  return [
    ...new Set(
      collectMediaValues(property)
        .map((value) => ownedPropertyShowcaseStoragePath(value, slug))
        .filter((path): path is string => Boolean(path)),
    ),
  ].sort();
}

export function propertyShowcaseMediaDeletionCandidates(params: {
  existing: PropertyShowcase;
  next: PropertyShowcase;
  slug: string;
}): string[] {
  const existingPaths = collectPropertyShowcaseMediaPaths(
    params.existing,
    params.slug,
  );
  const retainedPaths = new Set(
    collectPropertyShowcaseMediaPaths(params.next, params.slug),
  );

  return existingPaths.filter((path) => !retainedPaths.has(path));
}

export function failedPropertyShowcaseUploadCleanupCandidates(params: {
  uploaded: readonly string[];
  retained?: readonly string[];
  slug: string;
}): string[] {
  const retainedPaths = new Set(
    (params.retained ?? [])
      .map((value) => ownedPropertyShowcaseStoragePath(value, params.slug))
      .filter((path): path is string => Boolean(path)),
  );

  return [
    ...new Set(
      params.uploaded
        .map((value) => ownedPropertyShowcaseStoragePath(value, params.slug))
        .filter((path): path is string => Boolean(path))
        .filter((path) => !retainedPaths.has(path)),
    ),
  ].sort();
}
