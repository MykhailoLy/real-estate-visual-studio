import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";
import {
  SITE_MEDIA_SECTIONS,
  SITE_MEDIA_TYPES,
  type SiteMediaSection,
  type SiteMediaType,
} from "@/lib/site-media";
import {
  deleteSiteMediaFiles,
  isValidSiteMediaObjectPath,
  revalidateSiteMediaPaths,
} from "@/lib/site-media-server";

// ============================================================
// POST /api/admin/media
//
// Create a new site_media_items row. Image files are NOT sent
// here — the browser uploads them directly to the `site-media`
// Supabase Storage bucket using signed URLs from
// /api/admin/media/upload-url, then sends only the resulting
// object paths in this JSON request.
//
// Body shape (JSON):
//   section, media_type             (required)
//   title, description, alt_text    (optional strings)
//   service_slug                    (optional free-text)
//   before_image_path,              \
//   after_image_path,                |
//   image_path,                      |  optional storage paths;
//   poster_image_path,               |  required combinations
//   panorama_image_path              /  depend on media_type
//   embed_url                       (optional URL for embed/video/360)
//   sort_order                      (integer, default 0)
//   published                       (boolean, default true)
//
// Required combinations per media_type:
//   - before-after  -> before_image_path AND after_image_path
//   - image         -> image_path
//   - panorama-360  -> panorama_image_path  (poster optional)
//   - embed         -> embed_url            (poster optional)
//   - video         -> poster_image_path    (embed_url optional)
//
// 401 if the admin cookie is missing. 400 on validation errors.
// ============================================================

export const runtime = "nodejs";

const OptionalString = (max: number) =>
  z.union([z.string().trim().max(max), z.null(), z.undefined()]).optional();

const Body = z.object({
  section: z.enum(SITE_MEDIA_SECTIONS),
  media_type: z.enum(SITE_MEDIA_TYPES),
  title: OptionalString(200),
  description: OptionalString(2000),
  service_slug: OptionalString(100),
  alt_text: OptionalString(300),
  before_image_path: OptionalString(512),
  after_image_path: OptionalString(512),
  image_path: OptionalString(512),
  poster_image_path: OptionalString(512),
  panorama_image_path: OptionalString(512),
  embed_url: z
    .union([
      z.string().trim().url("embed_url must be a valid URL.").max(2000),
      z.literal(""),
      z.null(),
      z.undefined(),
    ])
    .optional(),
  sort_order: z.number().int().min(-9999).max(9999).optional(),
  published: z.boolean().optional(),
});

function nullable(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Apply the media_type-specific shape rules. Returns either a
 * validated path-set ready to insert, or a string error message
 * suitable to send back to the client verbatim.
 */
function validatePathsForType(
  mediaType: SiteMediaType,
  section: SiteMediaSection,
  paths: {
    before_image_path: string | null;
    after_image_path: string | null;
    image_path: string | null;
    poster_image_path: string | null;
    panorama_image_path: string | null;
    embed_url: string | null;
  }
): { ok: true } | { ok: false; error: string } {
  // Each path that IS provided must look like one minted by
  // upload-url for the declared section. Empty-string and null
  // both mean "not set".
  const checkPath = (
    label: string,
    value: string | null
  ): string | null => {
    if (!value) return null;
    if (!isValidSiteMediaObjectPath(value, section)) {
      return `Invalid ${label}.`;
    }
    return null;
  };

  for (const [label, value] of [
    ["before_image_path", paths.before_image_path],
    ["after_image_path", paths.after_image_path],
    ["image_path", paths.image_path],
    ["poster_image_path", paths.poster_image_path],
    ["panorama_image_path", paths.panorama_image_path],
  ] as const) {
    const err = checkPath(label, value);
    if (err) return { ok: false, error: err };
  }

  // Required-combo gate. Anything missing means the editor sent
  // us an incomplete item.
  switch (mediaType) {
    case "before-after":
      if (!paths.before_image_path || !paths.after_image_path) {
        return {
          ok: false,
          error: "Before and after images are required for a before/after item.",
        };
      }
      break;
    case "image":
      if (!paths.image_path) {
        return { ok: false, error: "Image file is required." };
      }
      break;
    case "panorama-360":
      if (!paths.panorama_image_path) {
        return { ok: false, error: "Panorama image is required for a 360 item." };
      }
      break;
    case "embed":
      if (!paths.embed_url) {
        return { ok: false, error: "Embed URL is required for an embed item." };
      }
      break;
    case "video":
      if (!paths.poster_image_path) {
        return {
          ok: false,
          error: "Poster image is required for a video item.",
        };
      }
      break;
  }

  return { ok: true };
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const first =
      Object.values(flat.fieldErrors)
        .flat()
        .find((m): m is string => typeof m === "string" && m.length > 0) ??
      "Invalid request.";
    return NextResponse.json({ error: first, details: flat }, { status: 400 });
  }

  const data = parsed.data;
  const section = data.section as SiteMediaSection;
  const mediaType = data.media_type as SiteMediaType;

  const paths = {
    before_image_path: nullable(data.before_image_path ?? null),
    after_image_path: nullable(data.after_image_path ?? null),
    image_path: nullable(data.image_path ?? null),
    poster_image_path: nullable(data.poster_image_path ?? null),
    panorama_image_path: nullable(data.panorama_image_path ?? null),
    embed_url: nullable(data.embed_url ?? null),
  };

  const checks = validatePathsForType(mediaType, section, paths);
  if (!checks.ok) {
    return NextResponse.json({ error: checks.error }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createServerClient();
  } catch (err) {
    console.error("site-media: supabase init failed", err);
    return NextResponse.json(
      { error: "Server is not configured for site media admin." },
      { status: 500 }
    );
  }

  const insert = {
    section,
    media_type: mediaType,
    title: nullable(data.title ?? null),
    description: nullable(data.description ?? null),
    service_slug: nullable(data.service_slug ?? null),
    alt_text: nullable(data.alt_text ?? null),
    before_image_path: paths.before_image_path,
    after_image_path: paths.after_image_path,
    image_path: paths.image_path,
    poster_image_path: paths.poster_image_path,
    panorama_image_path: paths.panorama_image_path,
    embed_url: paths.embed_url,
    sort_order: data.sort_order ?? 0,
    published: data.published ?? true,
  };

  const { data: row, error } = await supabase
    .from("site_media_items")
    .insert(insert)
    .select("*")
    .single();

  if (error || !row) {
    // Drop any orphaned files we just accepted. Best-effort.
    await deleteSiteMediaFiles([
      paths.before_image_path,
      paths.after_image_path,
      paths.image_path,
      paths.poster_image_path,
      paths.panorama_image_path,
    ]);
    console.error("site-media: insert failed", error);
    return NextResponse.json(
      { error: "Could not save site media item." },
      { status: 500 }
    );
  }

  revalidateSiteMediaPaths([insert.service_slug]);

  return NextResponse.json({ ok: true, item: row });
}
