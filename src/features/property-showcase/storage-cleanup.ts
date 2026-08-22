import type { PropertyShowcase } from "./types";

export const PROPERTY_SHOWCASE_STORAGE_ROOT = "property-showcases";
export const PROPERTY_SHOWCASE_SITE_MEDIA_BUCKET = "site-media";

interface StoragePathParseOptions {
  allowRelativeObjectPath?: boolean;
}

export function propertyShowcaseStorageFolder(slug: string): string {
  return `${PROPERTY_SHOWCASE_STORAGE_ROOT}/${slug}/`;
}

export function propertyCustomFlyerStorageFolder(slug: string): string {
  return `${propertyShowcaseStorageFolder(slug)}flyer/`;
}

function configuredSupabaseOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return null;

  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
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

function hasEncodedPathControl(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.includes("%2e") || lower.includes("%2f") || lower.includes("%5c");
}

export function siteMediaObjectPathFromUrl(
  value: string | undefined,
  options: StoragePathParseOptions = {},
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const directPath = normalizeObjectPath(trimmed);
  if (
    options.allowRelativeObjectPath &&
    directPath &&
    !/^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  ) {
    return directPath;
  }

  try {
    if (hasEncodedPathControl(trimmed)) return null;
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (url.origin !== configuredSupabaseOrigin()) return null;
    const marker = `/storage/v1/object/public/${PROPERTY_SHOWCASE_SITE_MEDIA_BUCKET}/`;
    if (!url.pathname.startsWith(marker)) return null;
    const encodedPath = url.pathname.slice(marker.length);
    if (hasEncodedPathControl(encodedPath)) return null;
    return normalizeObjectPath(decodeURIComponent(encodedPath));
  } catch {
    return null;
  }
}

export function ownedPropertyShowcaseStoragePath(
  value: string | undefined,
  slug: string,
  options: StoragePathParseOptions = {},
): string | null {
  const path = siteMediaObjectPathFromUrl(value, options);
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

export function ownedPropertyCustomFlyerStoragePath(
  value: string | undefined,
  slug: string,
  options: StoragePathParseOptions = {},
): string | null {
  const path = ownedPropertyShowcaseStoragePath(value, slug, options);
  const folder = propertyCustomFlyerStorageFolder(slug);
  return path && path.startsWith(folder) && path.length > folder.length
    ? path
    : null;
}

function collectMediaValues(property: PropertyShowcase): string[] {
  return [
    property.coverImage,
    ...property.gallery.map((image) => image.src),
    property.virtualTour?.posterImage,
    property.interactiveFloorPlanTour?.posterImage,
    ...(property.videos?.items.map((video) => video.posterUrl) ?? []),
    ...property.floorPlans.flatMap((plan) => [
      plan.imageUrl,
      plan.downloadUrl,
    ]),
    property.agent.logoUrl,
    property.agent.portraitUrl,
    property.branding?.logoUrl,
    property.marketingMaterials?.customFlyer?.pdf,
    property.marketingMaterials?.customFlyer?.jpg,
    property.marketingMaterials?.customFlyer?.png,
  ].filter((value): value is string => Boolean(value));
}

/**
 * Collect every confidently parsed site-media object path referenced by the
 * validated Property Showcase document, including shared paths outside the
 * property's owned folder. This broader read-only view is used by cleanup
 * safety checks; ownership checks below remain deliberately narrower.
 */
export function collectPropertyShowcaseReferencedSiteMediaPaths(
  property: PropertyShowcase,
): string[] {
  return [
    ...new Set(
      [...collectMediaValues(property), property.brochureUrl]
        .map((value) =>
          siteMediaObjectPathFromUrl(value, { allowRelativeObjectPath: true }),
        )
        .filter((path): path is string => Boolean(path)),
    ),
  ].sort();
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
