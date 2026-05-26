import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";
import {
  isPortfolioServiceSlug,
  type PortfolioServiceSlug,
  type PortfolioItem,
} from "@/lib/portfolio";
import {
  deletePortfolioFiles,
  revalidatePortfolioPaths,
  uploadPortfolioFile,
} from "@/lib/portfolio-server";

// ============================================================
// PATCH /api/admin/portfolio/[id]
// DELETE /api/admin/portfolio/[id]
//
// PATCH accepts the same multipart/form-data shape as POST, but
// every field is optional. Files are only re-uploaded if the
// admin actually picked a new one — replaced files are deleted
// from storage so the bucket doesn't grow forever.
//
// DELETE removes the row AND both storage objects.
// ============================================================

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function asBool(value: FormDataEntryValue | null): boolean {
  if (value == null) return false;
  const s = String(value).toLowerCase();
  return s === "true" || s === "on" || s === "1" || s === "yes";
}

function asInt(value: FormDataEntryValue | null, fallback = 0): number {
  if (value == null) return fallback;
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
}

function asText(value: FormDataEntryValue | null): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  return "";
}

/** UUID v4-ish shape check — Supabase always issues v4s here. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const existing = await loadExistingItem(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data body." },
      { status: 400 }
    );
  }

  // service_slug is optional on update — but if provided must
  // pass the canonical-list check. We collect "affected slugs"
  // for revalidation: both old and new in case it changes.
  const slugRaw = asText(form.get("service_slug"));
  let nextSlug: PortfolioServiceSlug = existing.service_slug;
  if (slugRaw) {
    if (!isPortfolioServiceSlug(slugRaw)) {
      return NextResponse.json(
        { error: "Invalid service_slug." },
        { status: 400 }
      );
    }
    nextSlug = slugRaw as PortfolioServiceSlug;
  }

  const beforeFile = form.get("before_image");
  const afterFile = form.get("after_image");
  const hasNewBefore = beforeFile instanceof File && beforeFile.size > 0;
  const hasNewAfter = afterFile instanceof File && afterFile.size > 0;

  // Upload any newly-supplied files first. Roll back if one fails.
  let nextBeforePath = existing.before_image_path;
  let nextAfterPath = existing.after_image_path;
  let uploadedBefore: { path: string } | null = null;
  let uploadedAfter: { path: string } | null = null;

  try {
    if (hasNewBefore) {
      uploadedBefore = await uploadPortfolioFile(
        beforeFile as File,
        nextSlug,
        "before"
      );
      nextBeforePath = uploadedBefore.path;
    }
    if (hasNewAfter) {
      uploadedAfter = await uploadPortfolioFile(
        afterFile as File,
        nextSlug,
        "after"
      );
      nextAfterPath = uploadedAfter.path;
    }
  } catch (err) {
    if (uploadedBefore?.path) await deletePortfolioFiles([uploadedBefore.path]);
    if (uploadedAfter?.path) await deletePortfolioFiles([uploadedAfter.path]);
    const message =
      err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Build the partial update payload from whichever fields the
  // form actually contained. Empty strings → null where the DB
  // column is nullable; missing fields are left untouched.
  const update: Partial<PortfolioItem> = {
    service_slug: nextSlug,
    before_image_path: nextBeforePath,
    after_image_path: nextAfterPath,
  };

  if (form.has("title")) {
    const title = asText(form.get("title"));
    if (!title) {
      // Roll back uploads if the row update would be invalid.
      if (uploadedBefore?.path) await deletePortfolioFiles([uploadedBefore.path]);
      if (uploadedAfter?.path) await deletePortfolioFiles([uploadedAfter.path]);
      return NextResponse.json(
        { error: "Title cannot be empty." },
        { status: 400 }
      );
    }
    update.title = title;
  }
  if (form.has("description")) {
    update.description = asText(form.get("description")) || null;
  }
  if (form.has("before_alt")) {
    update.before_alt = asText(form.get("before_alt")) || null;
  }
  if (form.has("after_alt")) {
    update.after_alt = asText(form.get("after_alt")) || null;
  }
  if (form.has("sort_order")) {
    update.sort_order = asInt(form.get("sort_order"), existing.sort_order);
  }
  if (form.has("published")) {
    update.published = asBool(form.get("published"));
  }
  if (form.has("featured_home")) {
    update.featured_home = asBool(form.get("featured_home"));
  }

  let supabase;
  try {
    supabase = createServerClient();
  } catch (err) {
    if (uploadedBefore?.path) await deletePortfolioFiles([uploadedBefore.path]);
    if (uploadedAfter?.path) await deletePortfolioFiles([uploadedAfter.path]);
    console.error("portfolio: supabase init failed", err);
    return NextResponse.json(
      { error: "Server is not configured for portfolio admin." },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from("portfolio_items")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    // Drop newly-uploaded files since the row update failed.
    if (uploadedBefore?.path) await deletePortfolioFiles([uploadedBefore.path]);
    if (uploadedAfter?.path) await deletePortfolioFiles([uploadedAfter.path]);
    console.error("portfolio: update failed", error);
    return NextResponse.json(
      { error: "Could not update portfolio item. Please try again." },
      { status: 500 }
    );
  }

  // Now that the row is committed, retire the *old* file objects
  // that have been replaced. Best-effort — orphans aren't fatal.
  const stale: string[] = [];
  if (uploadedBefore?.path && existing.before_image_path) {
    stale.push(existing.before_image_path);
  }
  if (uploadedAfter?.path && existing.after_image_path) {
    stale.push(existing.after_image_path);
  }
  if (stale.length > 0) await deletePortfolioFiles(stale);

  // Invalidate both old and new slugs in case the slug changed.
  const slugsToRevalidate: PortfolioServiceSlug[] = [nextSlug];
  if (existing.service_slug !== nextSlug) {
    slugsToRevalidate.push(existing.service_slug);
  }
  revalidatePortfolioPaths(slugsToRevalidate);

  return NextResponse.json({ ok: true, item: data });
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

  const supabase = createServerClient();
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

  // Best-effort storage cleanup after the row is gone.
  await deletePortfolioFiles([
    existing.before_image_path,
    existing.after_image_path,
  ]);

  revalidatePortfolioPaths([existing.service_slug]);

  return NextResponse.json({ ok: true });
}
