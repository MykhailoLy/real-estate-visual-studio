import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";
import {
  SITE_MEDIA_SECTIONS,
  SITE_MEDIA_TYPES,
  type SiteMediaItem,
  type SiteMediaSection,
  type SiteMediaType,
} from "@/lib/site-media";
import {
  deleteSiteMediaFiles,
  isValidSiteMediaObjectPath,
  revalidateSiteMediaPaths,
} from "@/lib/site-media-server";

// ============================================================
// PATCH /api/admin/media/[id]
// DELETE /api/admin/media/[id]
//
// PATCH accepts a JSON body. Image bytes never reach this route
// — the client uploads files directly to Supabase Storage using
// signed URLs from /api/admin/media/upload-url, then sends the
// resulting object paths here. To keep an existing image
// untouched, the client just resends the existing path.
//
// DELETE removes the row AND best-effort-deletes every storage
// object referenced by the row.
// ============================================================

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NullableString = (max: number) =>
  z.union([z.string().trim().max(max), z.null()]).optional();

const NullablePath = z
  .union([z.string().trim().max(512), z.null()])
  .optional();

const PatchBody = z.object({
  section: z.enum(SITE_MEDIA_SECTIONS).optional(),
  media_type: z.enum(SITE_MEDIA_TYPES).optional(),
  title: NullableString(200),
  description: NullableString(2000),
  service_slug: NullableString(100),
  alt_text: NullableString(300),
  before_image_path: NullablePath,
  after_image_path: NullablePath,
  image_path: NullablePath,
  poster_image_path: NullablePath,
  panorama_image_path: NullablePath,
  embed_url: z
    .union([
      z.string().trim().url("embed_url must be a valid URL.").max(2000),
      z.literal(""),
      z.null(),
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

async function loadExistingItem(id: string): Promise<SiteMediaItem | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("site_media_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("site-media: load existing failed", error);
    return null;
  }
  return (data as SiteMediaItem | null) ?? null;
}

/** Path-shape rules per media_type. Identical to POST but takes
 *  the resolved final values rather than the body so PATCH can
 *  validate the merged "current + incoming" state. */
function checkRequiredPathsForType(
  mediaType: SiteMediaType,
  paths: {
    before_image_path: string | null;
    after_image_path: string | null;
    image_path: string | null;
    poster_image_path: string | null;
    panorama_image_path: string | null;
    embed_url: string | null;
  }
): { ok: true } | { ok: false; error: string } {
  switch (mediaType) {
    case "before-after":
      if (!paths.before_image_path || !paths.after_image_path) {
        return {
          ok: false,
          error: "Before and after images are required for a before/after item.",
        };
      }
      return { ok: true };
    case "image":
      if (!paths.image_path) {
        return { ok: false, error: "Image file is required." };
      }
      return { ok: true };
    case "panorama-360":
      if (!paths.panorama_image_path) {
        return { ok: false, error: "Panorama image is required for a 360 item." };
      }
      return { ok: true };
    case "embed":
      if (!paths.embed_url) {
        return { ok: false, error: "Embed URL is required for an embed item." };
      }
      return { ok: true };
    case "video":
      if (!paths.poster_image_path) {
        return { ok: false, error: "Poster image is required for a video item." };
      }
      return { ok: true };
    default:
      return { ok: true };
  }
}

// ============================================================
// PATCH
// ============================================================

export async function PATCH(request: Request, context: RouteContext) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = PatchBody.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const first =
      Object.values(flat.fieldErrors)
        .flat()
        .find((m): m is string => typeof m === "string" && m.length > 0) ??
      "Invalid request.";
    return NextResponse.json({ error: first, details: flat }, { status: 400 });
  }
  const body = parsed.data;

  const existing = await loadExistingItem(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const nextSection: SiteMediaSection =
    body.section !== undefined ? (body.section as SiteMediaSection) : existing.section;
  const nextMediaType: SiteMediaType =
    body.media_type !== undefined
      ? (body.media_type as SiteMediaType)
      : existing.media_type;

  // For each storage-path field, the client may either:
  //   - omit it           -> keep existing (null or path)
  //   - send the same     -> keep existing
  //   - send a new path   -> validate vs nextSection, replace
  //   - send "" or null   -> clear (remove storage on commit)
  //
  // We track which paths actually got swapped so we can drop
  // the orphaned old objects after the row update succeeds.
  type PathField =
    | "before_image_path"
    | "after_image_path"
    | "image_path"
    | "poster_image_path"
    | "panorama_image_path";

  const PATH_FIELDS: PathField[] = [
    "before_image_path",
    "after_image_path",
    "image_path",
    "poster_image_path",
    "panorama_image_path",
  ];

  const nextPaths: Record<PathField, string | null> = {
    before_image_path: existing.before_image_path,
    after_image_path: existing.after_image_path,
    image_path: existing.image_path,
    poster_image_path: existing.poster_image_path,
    panorama_image_path: existing.panorama_image_path,
  };
  const replacedFiles: string[] = []; // old file paths to delete on commit
  const newlyMintedFiles: string[] = []; // new file paths to delete on rollback

  for (const field of PATH_FIELDS) {
    if (body[field] === undefined) continue;
    const incoming = nullable(body[field] ?? null);
    const current = existing[field];

    if (incoming === current) {
      nextPaths[field] = current;
      continue;
    }

    if (incoming === null) {
      // Cleared the slot. The old object becomes an orphan.
      nextPaths[field] = null;
      if (current) replacedFiles.push(current);
      continue;
    }

    // New, non-empty path. Must validate against the section
    // we're settling on for this update.
    if (!isValidSiteMediaObjectPath(incoming, nextSection)) {
      return NextResponse.json(
        { error: `Invalid ${field}.` },
        { status: 400 }
      );
    }
    nextPaths[field] = incoming;
    newlyMintedFiles.push(incoming);
    if (current) replacedFiles.push(current);
  }

  // embed_url isn't a storage path so it follows simpler rules.
  let nextEmbed: string | null = existing.embed_url;
  if (body.embed_url !== undefined) {
    const v = nullable(body.embed_url ?? null);
    nextEmbed = v;
  }

  const checks = checkRequiredPathsForType(nextMediaType, {
    before_image_path: nextPaths.before_image_path,
    after_image_path: nextPaths.after_image_path,
    image_path: nextPaths.image_path,
    poster_image_path: nextPaths.poster_image_path,
    panorama_image_path: nextPaths.panorama_image_path,
    embed_url: nextEmbed,
  });
  if (!checks.ok) {
    // Drop any newly-minted-but-not-yet-saved orphans.
    if (newlyMintedFiles.length > 0) {
      await deleteSiteMediaFiles(newlyMintedFiles);
    }
    return NextResponse.json({ error: checks.error }, { status: 400 });
  }

  const update: Partial<SiteMediaItem> = {
    section: nextSection,
    media_type: nextMediaType,
    before_image_path: nextPaths.before_image_path,
    after_image_path: nextPaths.after_image_path,
    image_path: nextPaths.image_path,
    poster_image_path: nextPaths.poster_image_path,
    panorama_image_path: nextPaths.panorama_image_path,
    embed_url: nextEmbed,
  };
  if (body.title !== undefined) update.title = nullable(body.title);
  if (body.description !== undefined) update.description = nullable(body.description);
  if (body.service_slug !== undefined) update.service_slug = nullable(body.service_slug);
  if (body.alt_text !== undefined) update.alt_text = nullable(body.alt_text);
  if (body.sort_order !== undefined) update.sort_order = body.sort_order;
  if (body.published !== undefined) update.published = body.published;

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

  const { data: row, error } = await supabase
    .from("site_media_items")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !row) {
    // Roll back the new storage objects since the DB write
    // failed. Best-effort.
    if (newlyMintedFiles.length > 0) {
      await deleteSiteMediaFiles(newlyMintedFiles);
    }
    console.error("site-media: update failed", error);
    return NextResponse.json(
      { error: "Could not save site media item." },
      { status: 500 }
    );
  }

  // Row is committed — retire the now-orphaned old files.
  if (replacedFiles.length > 0) {
    await deleteSiteMediaFiles(replacedFiles);
  }

  // Invalidate both old and new service slugs so the right
  // pricing pages refresh on a slug move.
  revalidateSiteMediaPaths([
    update.service_slug ?? null,
    existing.service_slug ?? null,
  ]);

  return NextResponse.json({ ok: true, item: row });
}

// ============================================================
// DELETE
// ============================================================

export async function DELETE(_request: Request, context: RouteContext) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const existing = await loadExistingItem(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
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

  const { error } = await supabase
    .from("site_media_items")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("site-media: delete failed", error);
    return NextResponse.json(
      { error: "Could not delete site media item." },
      { status: 500 }
    );
  }

  // Best-effort storage cleanup after the row is gone. Storage
  // failures are logged and never bubble up — the row removal
  // matters more than orphan bytes.
  await deleteSiteMediaFiles([
    existing.before_image_path,
    existing.after_image_path,
    existing.image_path,
    existing.poster_image_path,
    existing.panorama_image_path,
  ]);

  revalidateSiteMediaPaths([existing.service_slug]);

  return NextResponse.json({ ok: true });
}
