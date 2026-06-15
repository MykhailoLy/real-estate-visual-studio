import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";
import {
  PORTFOLIO_SERVICE_SLUGS,
  type PortfolioServiceSlug,
} from "@/lib/portfolio";
import { normalizeGalleryFilter } from "@/lib/gallery";
import {
  deletePortfolioFiles,
  isValidPortfolioObjectPath,
  revalidatePortfolioPaths,
} from "@/lib/portfolio-server";

// ============================================================
// POST /api/admin/portfolio
//
// Create a new portfolio_items row. Image files are NOT sent
// here any more — the browser uploads them directly to the
// `portfolio` Supabase Storage bucket using signed URLs from
// /api/admin/portfolio/upload-url, then sends only the resulting
// object paths in this JSON request.
//
// Request body (JSON):
//   service_slug         (one of the canonical slugs)
//   title                (non-empty)
//   before_image_path    (returned by upload-url)
//   after_image_path     (returned by upload-url)
//   description          (optional)
//   before_alt           (optional)
//   after_alt            (optional)
//   sort_order           (integer, defaults to 0)
//   featured_home        (boolean, defaults to false)
//   published            (boolean, defaults to false)
//
// Always 401 if the admin session cookie is missing or invalid.
// ============================================================

export const runtime = "nodejs";

const Body = z.object({
  service_slug: z.enum(PORTFOLIO_SERVICE_SLUGS),
  title: z.string().trim().min(1, "Title is required.").max(140),
  description: z
    .union([z.string().trim().max(2000), z.null(), z.undefined()])
    .optional(),
  before_image_path: z.string().min(1).max(512),
  after_image_path: z.string().min(1).max(512),
  before_alt: z
    .union([z.string().trim().max(200), z.null(), z.undefined()])
    .optional(),
  after_alt: z
    .union([z.string().trim().max(200), z.null(), z.undefined()])
    .optional(),
  gallery_filter: z
    .union([z.string().trim().max(64), z.null(), z.undefined()])
    .optional(),
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

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const parsed = Body.safeParse(raw);
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

  const data = parsed.data;
  const serviceSlug = data.service_slug as PortfolioServiceSlug;

  // Sanity-check the paths the client sent: they must look like
  // they came out of buildPortfolioObjectPath AND start with the
  // declared service slug. Stops a logged-in admin from pointing
  // a row at an arbitrary object in the bucket.
  if (!isValidPortfolioObjectPath(data.before_image_path, serviceSlug)) {
    return NextResponse.json(
      { error: "Invalid before_image_path." },
      { status: 400 }
    );
  }
  if (!isValidPortfolioObjectPath(data.after_image_path, serviceSlug)) {
    return NextResponse.json(
      { error: "Invalid after_image_path." },
      { status: 400 }
    );
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

  const insert = {
    service_slug: serviceSlug,
    title: data.title.trim(),
    description: nullable(data.description ?? null),
    before_image_path: data.before_image_path,
    after_image_path: data.after_image_path,
    before_alt: nullable(data.before_alt ?? null),
    after_alt: nullable(data.after_alt ?? null),
    // Server-authoritative: drop any value not valid for this
    // service (and force null for services without a filter).
    gallery_filter: normalizeGalleryFilter(
      serviceSlug,
      data.gallery_filter ?? null,
    ),
    sort_order: data.sort_order ?? 0,
    published: data.published ?? false,
    featured_home: data.featured_home ?? false,
    // Display locations are independent of featured_home. Defaults
    // match the DB column defaults: gallery ON, service page OFF.
    show_in_gallery: data.show_in_gallery ?? true,
    show_on_service_page: data.show_on_service_page ?? false,
  };

  const { data: row, error } = await supabase
    .from("portfolio_items")
    .insert(insert)
    .select("*")
    .single();

  if (error || !row) {
    // Drop the orphaned files we accepted moments ago. Best-
    // effort — if delete fails, we just leave them.
    await deletePortfolioFiles([
      data.before_image_path,
      data.after_image_path,
    ]);
    console.error("portfolio: insert failed", error);
    return NextResponse.json(
      { error: "Could not save portfolio item." },
      { status: 500 }
    );
  }

  revalidatePortfolioPaths([serviceSlug]);

  return NextResponse.json({ ok: true, item: row });
}
