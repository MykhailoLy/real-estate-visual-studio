import "server-only";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { createServerClient } from "@/lib/supabase";
import {
  SITE_MEDIA_BUCKET,
  type SiteMediaSection,
  type SiteMediaUploadKind,
} from "@/lib/site-media";
import {
  isPortfolioServiceSlug,
  PORTFOLIO_SERVICES,
  type PortfolioServiceSlug,
} from "@/lib/portfolio";

// ============================================================
// SITE MEDIA — server-side helpers
//
// Code shared by the /api/admin/media* route handlers:
//   - allowed image types and size cap (mirrors portfolio limits)
//   - filename → object-path generation inside the `site-media`
//     bucket
//   - signed upload URL helper (service-role bucket access)
//   - delete helper (service-role bucket access)
//   - revalidatePath helper that always invalidates `/`,
//     /admin/media, AND any pricing page bound to a known
//     portfolio service slug
//
// Imported via "server-only" so accidental client imports fail
// at build time rather than leaking the service-role client.
//
// NOTE: image bytes never stream through this module. The
// browser uploads files directly to Supabase Storage using a
// signed URL issued here, which avoids Vercel's
// FUNCTION_PAYLOAD_TOO_LARGE (413) limit on the API route. This
// is the same pattern the portfolio admin already uses.
// ============================================================

export const SITE_MEDIA_MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const SITE_MEDIA_MAX_IMAGE_MB =
  SITE_MEDIA_MAX_IMAGE_BYTES / (1024 * 1024);

/** MIME types accepted by the upload-url endpoint. */
export const SITE_MEDIA_ALLOWED_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type SiteMediaAllowedMime = (typeof SITE_MEDIA_ALLOWED_MIMES)[number];

export function isAllowedSiteMediaMime(
  mime: unknown
): mime is SiteMediaAllowedMime {
  return (
    typeof mime === "string" &&
    (SITE_MEDIA_ALLOWED_MIMES as readonly string[]).includes(mime)
  );
}

/**
 * Sanitise a user-supplied filename for use inside a storage
 * path: lowercase, keep a known extension, replace anything
 * that isn't [a-z0-9._-] with "-", collapse repeats, cap length.
 *
 * Always returns at least "file" so the path stays well-formed
 * even if the input is empty.
 */
export function safeFilename(input: string): string {
  const raw = (input ?? "").trim().toLowerCase();
  if (!raw) return "file";

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
 * `site-media` bucket:
 *
 *   {section}/{timestamp-random}-{kind}-{safe-filename}
 *
 * - `<section>` matches one of SITE_MEDIA_SECTIONS so a manual
 *   storage browse groups items by where they appear on the
 *   site (homepage-slider/, about-collage/, etc.).
 * - `<timestamp>` is `Date.now()` so paths sort chronologically.
 * - `<random>` is a short hex string so two uploads in the same
 *   millisecond never collide.
 * - `<kind>` is one of image/before/after/poster/panorama so a
 *   manual storage browse tells you what each file is.
 *
 * The path is RELATIVE to the bucket — never prefix with
 * "site-media/", because the bucket is already named that.
 */
export function buildSiteMediaObjectPath(
  section: SiteMediaSection,
  kind: SiteMediaUploadKind,
  filename: string
): string {
  const timestamp = Date.now();
  const nonce = randomBytes(4).toString("hex");
  return `${section}/${timestamp}-${nonce}-${kind}-${safeFilename(filename)}`;
}

// ============================================================
// SIGNED UPLOAD URL
// ============================================================

export interface SiteMediaSignedUploadInfo {
  bucket: typeof SITE_MEDIA_BUCKET;
  path: string;
  token: string;
  signedUrl: string;
}

/**
 * Create a signed upload URL for a single object inside the
 * `site-media` bucket. The browser then uses
 * `supabase.storage.from(bucket).uploadToSignedUrl(path, token, file)`
 * to PUT bytes directly to Supabase, bypassing the Vercel
 * function payload limit.
 *
 * Throws on Supabase errors so the route handler can surface a
 * descriptive 5xx response.
 */
export async function createSiteMediaSignedUploadUrl(
  path: string
): Promise<SiteMediaSignedUploadInfo> {
  const supabase = createServerClient();
  const { data, error } = await supabase.storage
    .from(SITE_MEDIA_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("site-media: createSignedUploadUrl failed", { path, error });
    throw new Error("Could not create signed upload URL.");
  }

  return {
    bucket: SITE_MEDIA_BUCKET,
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
export async function deleteSiteMediaFiles(
  paths: (string | null | undefined)[]
): Promise<void> {
  const real = paths.filter((p): p is string => Boolean(p));
  if (real.length === 0) return;
  try {
    const supabase = createServerClient();
    const { error } = await supabase.storage
      .from(SITE_MEDIA_BUCKET)
      .remove(real);
    if (error) {
      console.warn("site-media: storage remove returned error", {
        paths: real,
        error,
      });
    }
  } catch (err) {
    console.warn("site-media: storage remove threw", { paths: real, err });
  }
}

/**
 * Fail closed when cleaning up an interrupted browser upload: never delete a
 * path that has already been attached to a site_media_items row.
 */
export async function unreferencedSiteMediaFiles(
  paths: readonly string[],
): Promise<string[]> {
  const unique = [...new Set(paths)];
  if (unique.length === 0) return [];

  const fields = [
    "before_image_path",
    "after_image_path",
    "image_path",
    "poster_image_path",
    "panorama_image_path",
  ] as const;

  try {
    const supabase = createServerClient();
    const results = await Promise.all(
      fields.map((field) =>
        supabase.from("site_media_items").select(field).in(field, unique),
      ),
    );

    if (results.some((result) => result.error)) {
      console.warn("site-media: could not verify failed upload ownership", {
        errors: results.map((result) => result.error).filter(Boolean),
      });
      return [];
    }

    const referenced = new Set<string>();
    results.forEach((result) => {
      for (const row of result.data ?? []) {
        for (const path of Object.values(row)) {
          if (typeof path === "string") referenced.add(path);
        }
      }
    });
    return unique.filter((path) => !referenced.has(path));
  } catch (error) {
    console.warn("site-media: failed upload ownership check threw", error);
    return [];
  }
}

// ============================================================
// PATH VALIDATION
// ============================================================

/**
 * Validate that a path string conforms to the shape produced by
 * buildSiteMediaObjectPath AND that its leading segment is the
 * claimed section. The create/update routes use this so a
 * logged-in admin can't submit an arbitrary path that doesn't
 * actually point at a `site-media` object.
 *
 * We deliberately do NOT do a HEAD on storage here — that would
 * add a round-trip on every save, and the path was just minted
 * by our own signed-URL endpoint moments earlier.
 */
export function isValidSiteMediaObjectPath(
  path: unknown,
  expectedSection: SiteMediaSection
): path is string {
  if (typeof path !== "string") return false;
  if (path.length === 0 || path.length > 512) return false;
  if (path.startsWith("/")) return false;
  if (path.includes("..")) return false;
  const idx = path.indexOf("/");
  if (idx <= 0 || idx === path.length - 1) return false;
  return path.slice(0, idx) === expectedSection;
}

// ============================================================
// REVALIDATION
// ============================================================

function pricingHrefForSlug(slug: PortfolioServiceSlug): string | null {
  const meta = PORTFOLIO_SERVICES.find((s) => s.slug === slug);
  return meta ? meta.pricingHref : null;
}

/**
 * Always-safe revalidation after a site-media mutation.
 * Refreshes:
 *   - the homepage (slider + About collage live there)
 *   - /admin/media (the editor list itself)
 *   - the pricing page bound to the item's service_slug, IF
 *     that slug is a recognised portfolio service slug
 *
 * Wrapped in try/catch because revalidatePath is a no-op outside
 * a request scope and we don't want a stray invocation to crash
 * the calling route.
 */
export function revalidateSiteMediaPaths(
  affectedServiceSlugs: (string | null | undefined)[] = []
): void {
  const seen = new Set<string>();
  const queue: string[] = ["/", "/admin/media"];

  for (const slug of affectedServiceSlugs) {
    if (!slug || !isPortfolioServiceSlug(slug)) continue;
    const href = pricingHrefForSlug(slug);
    if (href) queue.push(href);
  }

  for (const path of queue) {
    if (seen.has(path)) continue;
    seen.add(path);
    try {
      revalidatePath(path);
    } catch (err) {
      console.warn("site-media: revalidatePath failed", { path, err });
    }
  }
}
