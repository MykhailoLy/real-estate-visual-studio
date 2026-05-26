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
//   - upload + delete helpers (service-role bucket access)
//   - revalidatePath helper that always invalidates `/`,
//     /admin/portfolio, AND every public pricing page that maps
//     to the affected service slug
//
// Imported via "server-only" so accidental client imports fail
// at build time rather than leaking the service-role client.
// ============================================================

export const ADMIN_MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ADMIN_MAX_IMAGE_MB =
  ADMIN_MAX_IMAGE_BYTES / (1024 * 1024);

export const ADMIN_ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg", // some browsers report this for .jpg
  "image/png",
  "image/webp",
] as const;

export const ADMIN_ALLOWED_IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
] as const;

/**
 * Quick MIME check used by request validators. Allows the small
 * set of formats that the bucket can serve back as a public web
 * image. Anything else (HEIC, TIFF, raw, etc.) is rejected.
 */
export function isAllowedImageMime(mime: string): boolean {
  return (ADMIN_ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mime);
}

/** Lower-cased file extension or "" if the filename has none. */
export function safeExt(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0 || dot === filename.length - 1) return "";
  return filename.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Build a stable, collision-resistant storage path within the
 * `portfolio` bucket:
 *
 *   <service-slug>/<yyyy-mm-dd>-<random>-<role>.<ext>
 *
 * - `<role>` is "before" or "after" so a manual storage browse
 *   reveals which half is which.
 * - `<random>` is a short hex string so two uploads in the same
 *   second never collide.
 * - `<ext>` is normalised to png/jpg/jpeg/webp.
 */
export function buildPortfolioStoragePath(
  serviceSlug: PortfolioServiceSlug,
  role: "before" | "after",
  filename: string
): string {
  let ext = safeExt(filename);
  if (!ext || !(ADMIN_ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(ext)) {
    // Fall back to png for unknown but mime-validated uploads.
    // This is rare since we already filtered MIME at validation
    // time, but it keeps the path well-formed.
    ext = "png";
  }
  const today = new Date().toISOString().slice(0, 10);
  const nonce = randomBytes(4).toString("hex");
  return `${serviceSlug}/${today}-${nonce}-${role}.${ext}`;
}

/** Result of a successful portfolio upload — caller stores the
 *  `path` in the portfolio_items row. */
export interface UploadedPortfolioFile {
  path: string;
  contentType: string;
  size: number;
}

/**
 * Upload a single image to the `portfolio` bucket using the
 * service-role client. Validates MIME and size up front; throws
 * a descriptive Error on any failure so the route handler can
 * surface a useful 4xx/5xx response.
 */
export async function uploadPortfolioFile(
  file: File,
  serviceSlug: PortfolioServiceSlug,
  role: "before" | "after"
): Promise<UploadedPortfolioFile> {
  if (!file || typeof file === "string") {
    throw new Error(`Missing ${role} image upload.`);
  }
  if (file.size === 0) {
    throw new Error(`The ${role} image is empty.`);
  }
  if (file.size > ADMIN_MAX_IMAGE_BYTES) {
    throw new Error(
      `The ${role} image is larger than ${ADMIN_MAX_IMAGE_MB} MB.`
    );
  }
  if (!isAllowedImageMime(file.type)) {
    throw new Error(
      `Unsupported ${role} image type "${file.type}". Use JPG, PNG, or WebP.`
    );
  }

  const supabase = createServerClient();
  const path = buildPortfolioStoragePath(serviceSlug, role, file.name);
  const arrayBuffer = await file.arrayBuffer();

  const { error } = await supabase.storage
    .from(PORTFOLIO_BUCKET)
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error("portfolio: storage upload failed", { path, error });
    throw new Error(
      `Could not upload ${role} image. ${error.message ?? "Storage error."}`
    );
  }

  return {
    path,
    contentType: file.type,
    size: file.size,
  };
}

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
