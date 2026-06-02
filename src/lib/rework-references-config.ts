// ============================================================
// REWORK REFERENCES CONFIG
// Phase 5H.4: reference files attached to client rework requests.
//
// Safe to import from both server-only code AND "use client"
// components — contains no env vars, no secrets, no server SDK.
//
// Files are stored in the private `order-files` bucket under:
//   rework/<reviewId>/<timestamp>-<safe-filename>
//
// SECURITY RULES (enforced in server API routes):
// • storage_path must NEVER appear in any API response.
// • Signed upload URLs are issued only after the server verifies
//   the review belongs to the requesting client's email.
// • Signed download URLs for admin use the same 300-second TTL
//   as all other signed URLs in this project.
// • No direct client INSERT to deliverable_review_files.
// ============================================================

/** Maximum number of reference files per rework request. */
export const REWORK_REFERENCES_MAX_FILES = 5;

/** Maximum size in bytes for a single rework reference file (20 MB). */
export const REWORK_REFERENCE_MAX_BYTES = 20 * 1024 * 1024;

/** Convenience: same value in MB for human-readable messages. */
export const REWORK_REFERENCE_MAX_MB =
  REWORK_REFERENCE_MAX_BYTES / (1024 * 1024);

/**
 * MIME types accepted for rework reference uploads.
 *
 * Includes common image formats for visual reference (inspiration
 * photos, annotated screenshots) plus PDF for annotated documents.
 * Does NOT include ZIP, TIFF, or octet-stream — clients should
 * upload specific reference images, not archives or raw files.
 */
export const ALLOWED_REWORK_REFERENCE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;

export type AllowedReworkReferenceMimeType =
  (typeof ALLOWED_REWORK_REFERENCE_MIME_TYPES)[number];

/**
 * TTL in seconds for signed download/preview URLs served to admin.
 * Matches the project-wide standard of 5 minutes.
 */
export const REWORK_REFERENCE_SIGNED_URL_TTL_SECONDS = 300;

/**
 * Returns true if `mime` is in the allowed rework reference allowlist.
 *
 * Safe to call from both server and client ("use client") components
 * for pre-upload validation. The server validates again before issuing
 * a signed upload URL.
 */
export function isAllowedReworkReferenceMimeType(mime: string): boolean {
  return (ALLOWED_REWORK_REFERENCE_MIME_TYPES as readonly string[]).includes(
    mime,
  );
}
