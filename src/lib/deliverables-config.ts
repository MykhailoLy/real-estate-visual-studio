// ============================================================
// DELIVERABLES CONFIG — shared safe constants
//
// Safe to import from both server-only code AND "use client"
// components. Contains no env vars, no secrets, no server SDK.
//
// Server-only helpers (DB queries, signed URLs, service role
// key) live in src/lib/client-deliverables.ts — do NOT import
// that file from "use client" components.
// ============================================================

/** Private Supabase Storage bucket that holds finished deliverables. */
export const DELIVERABLES_BUCKET = "deliverables";

/** Signed URL TTL in seconds (5 minutes). */
export const SIGNED_URL_TTL_SECONDS = 300;

/** Max file size for admin deliverable uploads (200 MB). */
export const ADMIN_DELIVERABLE_MAX_BYTES = 200 * 1024 * 1024;
export const ADMIN_DELIVERABLE_MAX_MB = ADMIN_DELIVERABLE_MAX_BYTES / (1024 * 1024);

/** MIME types accepted for deliverable uploads. */
export const ALLOWED_DELIVERABLE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  // Some OS/browsers report generic octet-stream for ZIP files
  "application/octet-stream",
] as const;

/** Allowed file extensions (used to verify octet-stream uploads). */
export const ALLOWED_DELIVERABLE_EXTENSIONS = [
  "jpg", "jpeg", "png", "webp", "tif", "tiff", "pdf", "zip",
] as const;

/**
 * Constructs a safe storage path for a deliverable file.
 * Path is built server-side only — never accepts raw client input.
 *
 * Format: <orderNumber>/<timestamp>-<safe-filename>
 */
export function buildDeliverablePath(
  orderNumber: string,
  originalFilename: string
): string {
  const safeBase = originalFilename
    .replace(/^.*[\\/]/, "")            // strip any path prefix
    .replace(/[^a-zA-Z0-9._-]/g, "_")  // replace unsafe chars
    .slice(0, 100);                     // cap length
  const ts = Date.now();
  return `${orderNumber}/${ts}-${safeBase}`;
}
