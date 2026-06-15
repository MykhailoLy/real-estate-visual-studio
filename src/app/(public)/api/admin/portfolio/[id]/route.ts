import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";
import {
  PORTFOLIO_SERVICE_SLUGS,
  type PortfolioServiceSlug,
  type PortfolioItem,
} from "@/lib/portfolio";
import { normalizeGalleryFilter } from "@/lib/gallery";
import {
  deletePortfolioFiles,
  isValidPortfolioObjectPath,
  revalidatePortfolioPaths,
} from "@/lib/portfolio-server";

// ============================================================
// PATCH /api/admin/portfolio/[id]
// DELETE /api/admin/portfolio/[id]
//
// PATCH accepts a JSON body. Image bytes never reach this route
// — the client uploads files directly to Supabase Storage using
// signed URLs from /api/admin/portfolio/upload-url, then sends
// the resulting object paths here. To keep an existing image
// untouched, the client just resends the existing path.
//
// DELETE removes the row AND best-effort-deletes both storage
// objects.
// ============================================================

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** UUID v4-ish shape check — Supabase always issues v4s here. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PatchBody = z.object({
  service_slug: z.enum(PORTFOLIO_SERVICE_SLUGS).optional(),
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty.")
    .max(140)
    .optional(),
  description: z
    .union([z.string().trim().max(2000), z.null()])
    .optional(),
  before_image_path: z.string().min(1).max(512).optional(),
  after_image_path: z.string().min(1).max(512).optional(),
  before_alt: z.union([z.string().trim().max(200), z.null()]).optional(),
  after_alt: z.union([z.string().trim().max(200), z.null()]).optional(),
  gallery_filter: z.union([z.string().trim().max(64), z.null()]).optional(),
  sort_order: z.number().int().min(-9999).max(9999).optional(),
  featured_home: z.boolean().optional(),
  show_in_gallery: z.boolean().optional(),
  show_on_service_page: z.boolean().optional(),
  published: z.boolean().optional(),
});

function nullable(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

async function loadExistingItem(id: string): Promise<PortfolioItem | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("portfolio_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("portfolio: load existing failed", error);
    return null;
  }
  return (data as PortfolioItem | null) ?? null;
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
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const parsed = PatchBody.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const first =
      Object.values(flat.fieldErrors)
        .flat()
        .find((m): m is string => typeof m === "string" && m.length > 0) ??
      "Invalid request.";
    return NextResponse.json(
      { error: first, details: flat },
      { status: 400 }
    );
  }
  const body = parsed.data;

  const existing = await loadExistingItem(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Determine the next service slug — needed up front so we can
  // validate any newly-supplied image paths against it.
  const nextSlug: PortfolioServiceSlug =
    body.service_slug !== undefined
      ? (body.service_slug as PortfolioServiceSlug)
      : existing.service_slug;

  // For each image path, the client may either:
  //   - send a new path (just minted by upload-url) belonging to
  //     `nextSlug` — meaning a fresh upload happened; OR
  //   - send the existing path — meaning "keep as-is"; OR
  //   - omit the field — same as "keep as-is".
  //
  // Anything else is rejected.
  let nextBefore: string = existing.before_image_path;
  let beforeReplaced = false;
  if (body.before_image_path !== undefined) {
    const candidate = body.before_image_path;
    if (candidate === existing.before_image_path) {
      nextBefore = candidate;
    } else if (isValidPortfolioObjectPath(candidate, nextSlug)) {
      nextBefore = candidate;
      beforeReplaced = true;
    } else {
      return NextResponse.json(
        { error: "Invalid before_image_path." },
        { status: 400 }
      );
    }
  }

  let nextAfter: string = existing.after_image_path;
  let afterReplaced = false;
  if (body.after_image_path !== undefined) {
    const candidate = body.after_image_path;
    if (candidate === existing.after_image_path) {
      nextAfter = candidate;
    } else if (isValidPortfolioObjectPath(candidate, nextSlug)) {
      nextAfter = candidate;
      afterReplaced = true;
    } else {
      return NextResponse.json(
        { error: "Invalid after_image_path." },
        { status: 400 }
      );
    }
  }

  // Build the partial update. Only include keys the client sent.
  const update: Partial<PortfolioItem> = {
    service_slug: nextSlug,
    before_image_path: nextBefore,
    after_image_path: nextAfter,
  };
  if (body.title !== undefined) update.title = body.title.trim();
  if (body.description !== undefined) update.description = nullable(body.description);
  if (body.before_alt !== undefined) update.before_alt = nullable(body.before_alt);
  if (body.after_alt !== undefined) update.after_alt = nullable(body.after_alt);
  // Gallery filter: validate against the (possibly new) service slug.
  // If the client sent a value, normalize it. If the service slug
  // changed without an explicit filter, re-validate the existing
  // value so an incompatible category is reset to null.
  if (body.gallery_filter !== undefined) {
    update.gallery_filter = normalizeGalleryFilter(nextSlug, body.gallery_filter);
  } else if (
    body.service_slug !== undefined &&
    body.service_slug !== existing.service_slug
  ) {
    update.gallery_filter = normalizeGalleryFilter(
      nextSlug,
      existing.gallery_filter,
    );
  }
  if (body.sort_order !== undefined) update.sort_order = body.sort_order;
  if (body.featured_home !== undefined) update.featured_home = body.featured_home;
  if (body.show_in_gallery !== undefined)
    update.show_in_gallery = body.show_in_gallery;
  if (body.show_on_service_page !== undefined)
    update.show_on_service_page = body.show_on_service_page;
  if (body.published !== undefined) update.published = body.published;

  let supabase;
  try {
    supabase = createServerClient();
  } catch (err) {
    console.error("portfolio: supabase init failed", err);
    return NextResponse.json(
      { error: "Server is not configured for portfolio admin." },
      { status: 500 }
    );
  }

  const { data: row, error } = await supabase
    .from("portfolio_items")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !row) {
    // Drop newly-uploaded objects since the row update failed.
    const orphans: string[] = [];
    if (beforeReplaced) orphans.push(nextBefore);
    if (afterReplaced) orphans.push(nextAfter);
    if (orphans.length > 0) await deletePortfolioFiles(orphans);
    console.error("portfolio: update failed", error);
    return NextResponse.json(
      { error: "Could not save portfolio item." },
      { status: 500 }
    );
  }

  // Now that the row is committed, retire the old file objects
  // that were replaced. Best-effort — orphans aren't fatal.
  const stale: string[] = [];
  if (beforeReplaced && existing.before_image_path) {
    stale.push(existing.before_image_path);
  }
  if (afterReplaced && existing.after_image_path) {
    stale.push(existing.after_image_path);
  }
  if (stale.length > 0) await deletePortfolioFiles(stale);

  // Invalidate both old and new slugs in case the slug changed.
  const slugsToRevalidate: PortfolioServiceSlug[] = [nextSlug];
  if (existing.service_slug !== nextSlug) {
    slugsToRevalidate.push(existing.service_slug);
  }
  revalidatePortfolioPaths(slugsToRevalidate);

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
    console.error("portfolio: supabase init failed", err);
    return NextResponse.json(
      { error: "Server is not configured for portfolio admin." },
      { status: 500 }
    );
  }

  const { error } = await supabase
    .from("portfolio_items")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("portfolio: delete failed", error);
    return NextResponse.json(
      { error: "Could not delete portfolio item." },
      { status: 500 }
    );
  }

  // Best-effort storage cleanup after the row is gone. Storage
  // failures are logged inside deletePortfolioFiles and never
  // bubble up — losing the row matters more than orphan bytes.
  await deletePortfolioFiles([
    existing.before_image_path,
    existing.after_image_path,
  ]);

  revalidatePortfolioPaths([existing.service_slug]);

  return NextResponse.json({ ok: true });
}
