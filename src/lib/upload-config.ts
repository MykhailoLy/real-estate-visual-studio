// ============================================================
// SHARED UPLOAD CONFIGURATION
// Used by both the signed-upload-URL API route (server) and the
// submit-order client helper. Keeping these in one place ensures
// the limits the client enforces match what the server will accept.
// ============================================================

import type { ServiceType } from "@/lib/server-validation";

/** Storage bucket where order files are uploaded. Single source of truth. */
export const ORDER_FILES_BUCKET = "order-files";

/** Hard cap for any individual file. 20 MB matches the previous server cap. */
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

/** Convenience: same value in MB for human-readable error messages. */
export const MAX_FILE_SIZE_MB = MAX_FILE_SIZE_BYTES / (1024 * 1024);

/** Image MIME types accepted across all services. */
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

/**
 * Floor plan source files may also be PDFs and CAD-style drawings.
 * `application/octet-stream` is allowed because some browsers don't have
 * a registered MIME for DXF/DWG/FBX and fall back to that.
 */
export const ALLOWED_FLOOR_PLAN_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  "application/pdf",
  "application/octet-stream",
] as const;

/** Reference images (optional secondary uploads) are always images only. */
export const ALLOWED_REFERENCE_MIME_TYPES = ALLOWED_IMAGE_MIME_TYPES;
export const ALLOWED_MULTI_REFERENCE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export type UploadKind = "original" | "reference";

const SUPABASE_USER_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DIRECT_PENDING_TOKEN_REGEX = /^[0-9a-f]{32}$/;
const UPLOAD_EXTENSION_REGEX = /^[a-z0-9]{1,16}$/;
const DIRECT_PENDING_BASENAME_REGEX =
  /^(0|[1-9][0-9]*)-(original|reference)\.([a-z0-9]{1,16})$/;
const MULTI_REFERENCE_PENDING_BASENAME_REGEX =
  /^(0|[1-9][0-9]*)-reference-([0-9])-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([a-z0-9]{1,16})$/;

export interface DirectPendingPathParts {
  userId: string;
  pendingToken: string;
  directory: string;
  basename: string;
  itemIndex: number;
  kind: UploadKind;
  extension: string;
  referencePosition?: number;
  referenceId?: string;
}

export function isCanonicalSupabaseUserId(value: string): boolean {
  return SUPABASE_USER_ID_REGEX.test(value);
}

export function normalizeSupabaseUserId(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return isCanonicalSupabaseUserId(normalized) ? normalized : null;
}

export function isCanonicalDirectPendingToken(value: string): boolean {
  return DIRECT_PENDING_TOKEN_REGEX.test(value);
}

export function isCanonicalUploadExtension(value: string): boolean {
  return UPLOAD_EXTENSION_REGEX.test(value);
}

/**
 * Pick the right allowed-MIME-type list for a given upload slot.
 *
 * - "original" depends on the service (3d-floor-plans accepts PDF/CAD).
 * - "reference" is always image-only across all services.
 */
export function getAllowedMimeTypes(
  serviceType: ServiceType,
  kind: UploadKind,
): readonly string[] {
  if (kind === "reference") return ALLOWED_REFERENCE_MIME_TYPES;
  if (serviceType === "3d-floor-plans") return ALLOWED_FLOOR_PLAN_MIME_TYPES;
  return ALLOWED_IMAGE_MIME_TYPES;
}

export function getAllowedMultiReferenceMimeTypes(): readonly string[] {
  return ALLOWED_MULTI_REFERENCE_MIME_TYPES;
}

/**
 * Best-effort extension extractor. Lower-cased, falls back to "bin"
 * so storage paths always have something to put after the dot.
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "bin";
}

/**
 * Build the storage path for an uploaded file *before* an order number
 * has been generated. Files live under
 * `pending/<authenticated-user-id>/<token>/...` until the order is
 * created, at which point the API moves them to `<orderNumber>/...`.
 * Includes the slot kind so an item can have both an original and a
 * reference without collisions.
 */
export function buildPendingPath(
  userId: string,
  pendingToken: string,
  itemIndex: number,
  kind: UploadKind,
  ext: string,
  referencePosition?: number,
  referenceId?: string,
): string {
  if (
    !isCanonicalSupabaseUserId(userId) ||
    !isCanonicalDirectPendingToken(pendingToken) ||
    !Number.isInteger(itemIndex) ||
    itemIndex < 0 ||
    (kind !== "original" && kind !== "reference") ||
    !isCanonicalUploadExtension(ext)
  ) {
    throw new Error("Invalid pending upload path input.");
  }

  if (referencePosition !== undefined || referenceId !== undefined) {
    if (
      kind !== "reference" ||
      !Number.isInteger(referencePosition) ||
      referencePosition! < 0 ||
      referencePosition! > 9 ||
      !referenceId ||
      !SUPABASE_USER_ID_REGEX.test(referenceId)
    ) {
      throw new Error("Invalid multi-reference pending upload path input.");
    }
    return `pending/${userId}/${pendingToken}/${itemIndex}-reference-${referencePosition}-${referenceId}.${ext}`;
  }

  return `pending/${userId}/${pendingToken}/${itemIndex}-${kind}.${ext}`;
}

export function parseDirectPendingPath(
  path: string,
): DirectPendingPathParts | null {
  const segments = path.split("/");
  if (segments.length !== 4) return null;

  const [namespace, userId, pendingToken, basename] = segments;
  if (
    namespace !== "pending" ||
    !userId ||
    !pendingToken ||
    !basename ||
    !isCanonicalSupabaseUserId(userId) ||
    !isCanonicalDirectPendingToken(pendingToken)
  ) {
    return null;
  }

  const multiReferenceMatch = MULTI_REFERENCE_PENDING_BASENAME_REGEX.exec(basename);
  if (multiReferenceMatch) {
    const [, itemIndexText, positionText, referenceId, extension] = multiReferenceMatch;
    const itemIndex = Number(itemIndexText);
    if (
      !Number.isInteger(itemIndex) ||
      itemIndex < 0 ||
      itemIndexText !== String(itemIndex) ||
      !isCanonicalUploadExtension(extension)
    ) {
      return null;
    }
    return {
      userId,
      pendingToken,
      directory: `pending/${userId}/${pendingToken}`,
      basename,
      itemIndex,
      kind: "reference",
      extension,
      referencePosition: Number(positionText),
      referenceId,
    };
  }

  const basenameMatch = DIRECT_PENDING_BASENAME_REGEX.exec(basename);
  if (!basenameMatch) return null;

  const [, itemIndexText, kind, extension] = basenameMatch;
  const itemIndex = Number(itemIndexText);
  if (
    !Number.isInteger(itemIndex) ||
    itemIndex < 0 ||
    itemIndexText !== String(itemIndex) ||
    !isCanonicalUploadExtension(extension)
  ) {
    return null;
  }

  return {
    userId,
    pendingToken,
    directory: `pending/${userId}/${pendingToken}`,
    basename,
    itemIndex,
    kind: kind as UploadKind,
    extension,
  };
}

/**
 * Final path layout matches the previous implementation so admins
 * already familiar with the storage browser don't have to learn a new
 * scheme.
 */
export function buildFinalPath(
  orderNumber: string,
  itemIndex: number,
  kind: UploadKind,
  ext: string,
  referencePosition?: number,
  referenceId?: string,
): string {
  if (
    kind === "reference" &&
    referencePosition !== undefined &&
    referenceId
  ) {
    return `${orderNumber}/${itemIndex}-reference-${referencePosition}-${referenceId}.${ext}`;
  }
  return `${orderNumber}/${itemIndex}-${kind}.${ext}`;
}

/**
 * Build the storage path for a rework reference file.
 *
 * Files are stored in the private `order-files` bucket.
 * Path format:  rework/<reviewId>/<timestamp>-<safeFilename>
 *
 * SECURITY:
 * • `reviewId` comes from a server-created DB row — never from raw
 *   client input.
 * • `originalFilename` is sanitized: path separators stripped,
 *   unsafe characters replaced, length capped at 100 characters.
 * • The resulting path is used server-side only to issue a signed
 *   upload URL. The path is NEVER returned to the browser.
 * • Admin download routes generate short-lived signed URLs from the
 *   stored path without exposing the path itself.
 */
export function buildReworkReferencePath(
  reviewId: string,
  originalFilename: string,
): string {
  const safeBase = originalFilename
    .replace(/^.*[\\/]/, "") // strip any leading path prefix
    .replace(/[^a-zA-Z0-9._-]/g, "_") // replace unsafe characters
    .slice(0, 100); // cap total length
  const ts = Date.now();
  return `rework/${reviewId}/${ts}-${safeBase}`;
}
