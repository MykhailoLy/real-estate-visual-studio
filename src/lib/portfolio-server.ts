import "server-only";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { createServerClient } from "@/lib/supabase";
import {
  PORTFOLIO_BUCKET,
  PORTFOLIO_SERVICES,
  isPortfolioServiceSlug,
  type PortfolioServiceSlug,
} from "@/lib/portfolio";

// ============================================================
// PORTFOLIO — server-side helpers
//
// Code shared by the /api/admin/portfolio* route handlers:
//   - allowed image types and size cap
//   - filename → object-path generation inside the bucket
//   - signed upload URL helper (service-role bucket access)
//   - delete helper (service-role bucket access)
//   - revalidatePath helper that always invalidates `/`,
//     /admin/portfolio, AND every public pricing page that maps
//     to the affected service slug
//
// Imported via "server-only" so accidental client imports fail
// at build time rather than leaking the service-role client.
//
// NOTE: image bytes are NEVER streamed through this module any
// more. The browser uploads files directly to Supabase Storage
// using a signed URL issued here, which avoids Vercel's
// FUNCTION_PAYLOAD_TOO_LARGE (413) limit on the API route.
// ============================================================

export const ADMIN_MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ADMIN_MAX_IMAGE_MB =
  ADMIN_MAX_IMAGE_BYTES / (1024 * 1024);

/**
 * Image MIME types the admin upload-url endpoint will accept.
 * Deliberately narrow: only formats Supabase Storage can serve
 * back as a normal public web image.
 */
export const ADMIN_ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AdminAllowedImageMime =
  (typeof ADMIN_ALLOWED_IMAGE_MIME_TYPES)[number];

export function isAllowedImageMime(
  mime: unknown
): mime is AdminAllowedImageMime {
  return (
    typeof mime === "string" &&
    (ADMIN_ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mime)
  );
}

export type PortfolioImageKind = "before" | "after";

export function isPortfolioImageKind(
  value: unknown
): value is PortfolioImageKind {
  return value === "before" || value === "after";
}

/**
 * Sanitise a user-supplied filename for use inside a storage
 * object path:
 *   - lowercase
 *   - keep the extension if it's one we recognise
 *   - replace anything not [a-z0-9._-] with "-"
 *   - collapse repeated dashes and trim them from the edges
 *   - cap the total length so we never produce a 1KB path
 *
 * Always returns at least "file" so the path stays well-formed
 * even if the input is empty.
 */
export function safeFilename(input: string): string {
  const raw = (input ?? "").trim().toLowerCase();
  if (!raw) return "file";

  // Split off the extension so it doesn't get mangled by the
  // dash collapsing below.
  const dot = raw.lastIndexOf(".");
  let stem = raw;
  let ext = "";
  if (dot > 0 && dot < raw.length - 1) {
    stem = raw.slice(0, dot);
    ext = raw.slice(dot + 1).replace(/[^a-z0-9]/g, "");
    if (ext.length > 8) ext = ext.slice(0, 8);
  }

  let cleanStem = stem
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  if (!cleanStem) cleanStem = "file";
  if (cleanStem.length > 60) cleanStem = cleanStem.slice(0, 60);

  return ext ? `${cleanStem}.${ext}` : cleanStem;
}

/**
 * Build a stable, collision-resistant storage path inside the
 * `portfolio` bucket:
 *
 *   {service_slug}/{timestamp-random}-{kind}-{safe-filename}
 *
 * - `<timestamp>` is `Date.now()` so paths sort chronologically.
 * - `<random>` is a short hex string so two uploads in the same
 *   millisecond never collide.
 * - `<kind>` is "before" or "after" so a manual storage browse
 *   tells you which half is which.
 * - The path is RELATIVE to the bucket — never prefix with
 *   "portfolio/", because the bucket is already named that.
 */
export function buildPortfolioObjectPath(
  serviceSlug: PortfolioServiceSlug,
  kind: PortfolioImageKind,
  filename: string
): string {
  const timestamp = Date.now();
  const nonce = randomBytes(4).toString("hex");
  return `${serviceSlug}/${timestamp}-${nonce}-${kind}-${safeFilename(
    filename
  )}`;
}

// ============================================================
// SIGNED UPLOAD URL
// ============================================================

export interface PortfolioSignedUploadInfo {
  bucket: typeof PORTFOLIO_BUCKET;
  path: string;
  token: string;
  signedUrl: string;
}

/**
 * Create a signed upload URL for a single object inside the
 * `portfolio` bucket. The browser then uses
 * `supabase.storage.from(bucket).uploadToSignedUrl(path, token, file)`
 * to PUT bytes directly to Supabase, bypassing the Vercel
 * function payload limit.
 *
 * Throws on Supabase errors so the route handler can surface a
 * descriptive 5xx response.
 */
export async function createPortfolioSignedUploadUrl(
  path: string
): Promise<PortfolioSignedUploadInfo> {
  const supabase = createServerClient();
  const { data, error } = await supabase.storage
    .from(PORTFOLIO_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("portfolio: createSignedUploadUrl failed", { path, error });
    throw new Error("Could not create signed upload URL.");
  }

  return {
    bucket: PORTFOLIO_BUCKET,
    path: data.path ?? path,
    token: data.token,
    signedUrl: data.signedUrl,
  };
}

// ============================================================
// STORAGE DELETE
// ============================================================

/**
 * Best-effort removal of one or more storage objects. Failures
 * are logged but never thrown — orphaned files are easier to
 * clean up later than a stuck admin flow.
 */
export async function deletePortfolioFiles(
  paths: (string | null | undefined)[]
): Promise<void> {
  const real = paths.filter((p): p is string => Boolean(p));
  if (real.length === 0) return;
  try {
    const supabase = createServerClient();
    const { error } = await supabase.storage
      .from(PORTFOLIO_BUCKET)
      .remove(real);
    if (error) {
      console.warn("portfolio: storage remove returned error", {
        paths: real,
        error,
      });
    }
  } catch (err) {
    console.warn("portfolio: storage remove threw", { paths: real, err });
  }
}

// ============================================================
// PATH VALIDATION
// ============================================================

/**
 * Validate that a path string came from buildPortfolioObjectPath
 * (or at least conforms to its shape) AND that its leading
 * segment is the claimed service slug. Used by the create/update
 * routes so the client cannot submit an arbitrary path that
 * doesn't actually point at a portfolio object.
 *
 * Allows ".../path/with/slashes" only as long as the first
 * segment matches `serviceSlug`. We deliberately do NOT do a
 * HEAD on storage here — that would add a round-trip on every
 * save, and the path was just minted by our own signed-URL
 * endpoint moments earlier.
 */
export function isValidPortfolioObjectPath(
  path: unknown,
  expectedSlug: PortfolioServiceSlug
): path is string {
  if (typeof path !== "string") return false;
  if (path.length === 0 || path.length > 512) return false;
  if (path.startsWith("/")) return false;
  if (path.includes("..")) return false;
  // Must look like "<slug>/<...>" with at least one path segment
  // after the slug. The bucket name "portfolio" is implicit.
  const idx = path.indexOf("/");
  if (idx <= 0 || idx === path.length - 1) return false;
  const slug = path.slice(0, idx);
  if (slug !== expectedSlug) return false;
  return true;
}

// ============================================================
// REVALIDATION
// ============================================================

/**
 * Map a portfolio service slug to the canonical pricing page
 * URL we should revalidate. Note `item-removal-virtual-cleaning`
 * intentionally maps to `/pricing/photo-editing` (legacy URL).
 */
function pricingHrefForSlug(slug: PortfolioServiceSlug): string {
  const meta = PORTFOLIO_SERVICES.find((s) => s.slug === slug);
  return meta ? meta.pricingHref : "/";
}

/**
 * Always-safe revalidation after a portfolio mutation. Refreshes:
 *   - the homepage (which renders the featured-home items grid)
 *   - the pricing pages for the slugs that changed (one if a
 *     simple create/update, two if the slug was edited)
 *   - the admin portfolio list itself
 *
 * Wrapped in try/catch because revalidatePath is a no-op outside
 * a request scope and we don't want a stray invocation to crash
 * the calling route.
 */
export function revalidatePortfolioPaths(
  affectedSlugs: PortfolioServiceSlug[]
): void {
  const seen = new Set<string>();
  const queue = ["/", "/admin/portfolio"];
  for (const slug of affectedSlugs) {
    if (!isPortfolioServiceSlug(slug)) continue;
    queue.push(pricingHrefForSlug(slug));
  }
  for (const path of queue) {
    if (seen.has(path)) continue;
    seen.add(path);
    try {
      revalidatePath(path);
    } catch (err) {
      console.warn("portfolio: revalidatePath failed", { path, err });
    }
  }
}
