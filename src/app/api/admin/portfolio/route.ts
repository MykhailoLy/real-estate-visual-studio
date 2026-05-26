import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";
import {
  isPortfolioServiceSlug,
  type PortfolioServiceSlug,
} from "@/lib/portfolio";
import {
  deletePortfolioFiles,
  revalidatePortfolioPaths,
  uploadPortfolioFile,
} from "@/lib/portfolio-server";

// ============================================================
// POST /api/admin/portfolio
//
// Create a new portfolio_items row + upload its before/after
// images to the `portfolio` Supabase Storage bucket. Accepts
// multipart/form-data so the browser can stream the files in a
// single request.
//
// Required FormData fields:
//   - service_slug   (one of the 10 canonical slugs)
//   - title          (non-empty)
//   - before_image   (jpg/png/webp, ≤ 10 MB)
//   - after_image    (jpg/png/webp, ≤ 10 MB)
//
// Optional fields:
//   - description, before_alt, after_alt
//   - sort_order     (integer, defaults to 0)
//   - published      ("true" | "false")
//   - featured_home  ("true" | "false")
//
// Always 401 if the admin session cookie is missing or invalid.
// ============================================================

export const runtime = "nodejs";

/** Coerce "true"/"on"/"1" → true. Anything else → false.  */
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

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const serviceSlugRaw = asText(form.get("service_slug"));
  if (!isPortfolioServiceSlug(serviceSlugRaw)) {
    return NextResponse.json(
      { error: "Invalid or missing service_slug." },
      { status: 400 }
    );
  }
  const serviceSlug = serviceSlugRaw as PortfolioServiceSlug;

  const title = asText(form.get("title"));
  if (!title) {
    return NextResponse.json(
      { error: "Title is required." },
      { status: 400 }
    );
  }

  const beforeFile = form.get("before_image");
  const afterFile = form.get("after_image");

  if (!(beforeFile instanceof File) || !(afterFile instanceof File)) {
    return NextResponse.json(
      {
        error: "Both before_image and after_image files are required.",
      },
      { status: 400 }
    );
  }

  // Upload both files first. If either fails, clean up any file
  // that already landed so we don't accumulate orphans.
  let before;
  let after;
  try {
    before = await uploadPortfolioFile(
      beforeFile,
      serviceSlug,
      "before"
    );
    after = await uploadPortfolioFile(afterFile, serviceSlug, "after");
  } catch (err) {
    // Roll back the half-uploaded pair if needed.
    if (before?.path) await deletePortfolioFiles([before.path]);
    const message =
      err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createServerClient();
  } catch (err) {
    await deletePortfolioFiles([before.path, after.path]);
    console.error("portfolio: supabase init failed", err);
    return NextResponse.json(
      { error: "Server is not configured for portfolio admin." },
      { status: 500 }
    );
  }

  const insert = {
    service_slug: serviceSlug,
    title,
    description: asText(form.get("description")) || null,
    before_image_path: before.path,
    after_image_path: after.path,
    before_alt: asText(form.get("before_alt")) || null,
    after_alt: asText(form.get("after_alt")) || null,
    sort_order: asInt(form.get("sort_order"), 0),
    published: asBool(form.get("published")),
    featured_home: asBool(form.get("featured_home")),
  };

  const { data, error } = await supabase
    .from("portfolio_items")
    .insert(insert)
    .select("*")
    .single();

  if (error || !data) {
    // Drop the orphaned files since the row never landed.
    await deletePortfolioFiles([before.path, after.path]);
    console.error("portfolio: insert failed", error);
    return NextResponse.json(
      { error: "Could not save portfolio item. Please try again." },
      { status: 500 }
    );
  }

  revalidatePortfolioPaths([serviceSlug]);

  return NextResponse.json({ ok: true, item: data });
}
