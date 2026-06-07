import { createServerClient } from "@/lib/supabase";

// ============================================================
// SITE MEDIA — shared library
//
// Single source of truth for the new admin-managed marketing
// media surface (homepage slider, About collage, 360 tour
// embeds, future service-hero images). The corresponding DB
// schema lives in supabase/site-media.sql; the admin routes
// live under /api/admin/media; the editor UI lives at
// /admin/media.
//
// Anything that needs to render or look up a site media item
// should import from this file so the section / media-type
// vocabulary stays consistent across the public site, the
// admin UI, and the route handlers.
//
// SAFETY: this file MUST stay free of admin-only secrets so the
// public homepage can import it. The signed-URL helper that
// touches the service role lives in lib/site-media-server.ts
// behind "server-only".
// ============================================================

export const SITE_MEDIA_BUCKET = "site-media";

// -----------------------------------------------------------
// Sections — where on the public site a media item is meant
// to render. Mirrors the CHECK constraint in
// supabase/site-media.sql; keep in sync with that file.
// -----------------------------------------------------------
export const SITE_MEDIA_SECTIONS = [
  "homepage-slider",
  "about-collage",
  "service-hero",
  "service-options",
  "360-tour",
  "general",
] as const;

export type SiteMediaSection = (typeof SITE_MEDIA_SECTIONS)[number];

export function isSiteMediaSection(value: unknown): value is SiteMediaSection {
  return (
    typeof value === "string" &&
    (SITE_MEDIA_SECTIONS as readonly string[]).includes(value)
  );
}

export interface SiteMediaSectionMeta {
  section: SiteMediaSection;
  label: string;
  /** Short admin-facing description so the filter + editor
   *  read as more than terse keys. */
  description: string;
  /** Default media_type the editor selects when creating an
   *  item in this section — purely a UX nicety. */
  defaultMediaType: SiteMediaType;
}

export const SITE_MEDIA_SECTION_META: SiteMediaSectionMeta[] = [
  {
    section: "homepage-slider",
    label: "Homepage slider",
    description:
      "Wide before/after slides that play in the hero strip on the homepage.",
    defaultMediaType: "before-after",
  },
  {
    section: "about-collage",
    label: "About collage",
    description:
      "Tiles that make up the asymmetric image collage in the About section.",
    defaultMediaType: "image",
  },
  {
    section: "service-hero",
    label: "Service hero",
    description:
      "Before/after hero slider media for individual service pages (e.g. floor-plans, virtual-staging).",
    defaultMediaType: "before-after",
  },
  {
    section: "service-options",
    label: "Service options",
    description:
      "Images for service page style cards and option cards. Match cards by title and service_slug.",
    defaultMediaType: "image",
  },
  {
    section: "360-tour",
    label: "360° tour",
    description:
      "Kuula or other external 360 tour embeds with a poster image fallback.",
    defaultMediaType: "embed",
  },
  {
    section: "general",
    label: "General",
    description:
      "Anything that doesn't belong in the sections above yet. Acts as a holding area.",
    defaultMediaType: "image",
  },
];

const SECTION_INDEX: Record<SiteMediaSection, SiteMediaSectionMeta> =
  Object.fromEntries(
    SITE_MEDIA_SECTION_META.map((s) => [s.section, s])
  ) as Record<SiteMediaSection, SiteMediaSectionMeta>;

export function getSiteMediaSectionMeta(
  section: SiteMediaSection
): SiteMediaSectionMeta {
  return SECTION_INDEX[section];
}

// -----------------------------------------------------------
// Media types — shape of one item. Drives which path columns
// the admin UI requires.
// -----------------------------------------------------------
export const SITE_MEDIA_TYPES = [
  "before-after",
  "image",
  "panorama-360",
  "embed",
  "video",
] as const;

export type SiteMediaType = (typeof SITE_MEDIA_TYPES)[number];

export function isSiteMediaType(value: unknown): value is SiteMediaType {
  return (
    typeof value === "string" &&
    (SITE_MEDIA_TYPES as readonly string[]).includes(value)
  );
}

// -----------------------------------------------------------
// Upload kinds — which slot inside an item a freshly uploaded
// file belongs to. Used by the upload-url endpoint to build a
// readable storage path.
// -----------------------------------------------------------
export const SITE_MEDIA_UPLOAD_KINDS = [
  "image",
  "before",
  "after",
  "poster",
  "panorama",
] as const;

export type SiteMediaUploadKind = (typeof SITE_MEDIA_UPLOAD_KINDS)[number];

export function isSiteMediaUploadKind(
  value: unknown
): value is SiteMediaUploadKind {
  return (
    typeof value === "string" &&
    (SITE_MEDIA_UPLOAD_KINDS as readonly string[]).includes(value)
  );
}

// ============================================================
// PUBLIC URL BUILDER
// ============================================================

/**
 * Build a public Supabase Storage URL for a path inside the
 * `site-media` bucket. Returns null when either the path is
 * missing or NEXT_PUBLIC_SUPABASE_URL is unset (e.g. sandbox /
 * preview builds without secrets) — callers should fall back to
 * a placeholder visual in that case.
 */
export function getSiteMediaPublicUrl(
  path: string | null | undefined
): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  const clean = path.replace(/^\/+/, "");
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${SITE_MEDIA_BUCKET}/${clean}`;
}

// ============================================================
// DB ROW TYPE + READS
// ============================================================

export interface SiteMediaItem {
  id: string;
  section: SiteMediaSection;
  media_type: SiteMediaType;
  title: string | null;
  description: string | null;
  service_slug: string | null;
  before_image_path: string | null;
  after_image_path: string | null;
  image_path: string | null;
  poster_image_path: string | null;
  panorama_image_path: string | null;
  embed_url: string | null;
  alt_text: string | null;
  sort_order: number;
  published: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Whether the Supabase secrets needed to talk to the database
 * are configured at all. Lets the public site degrade gracefully
 * to placeholders instead of crashing during sandbox / fork-PR
 * builds.
 */
function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Public read: published items in a single section, ordered the
 * way the admin set them via sort_order then created_at.
 */
export async function getPublishedSiteMediaForSection(
  section: SiteMediaSection
): Promise<SiteMediaItem[]> {
  if (!isSupabaseConfigured()) return [];

  let supabase;
  try {
    supabase = createServerClient();
  } catch {
    return [];
  }

  const { data, error } = await supabase
    .from("site_media_items")
    .select("*")
    .eq("section", section)
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.warn(
      `site-media: getPublishedSiteMediaForSection(${section}) failed`,
      error
    );
    return [];
  }
  return (data ?? []) as SiteMediaItem[];
}

/**
 * Convenience: the homepage slider only cares about
 * before-after media in the homepage-slider section, but we
 * filter media_type in JS rather than SQL so the index on
 * (section, sort_order) still serves the query.
 */
export async function getHomepageSliderItems(): Promise<SiteMediaItem[]> {
  const all = await getPublishedSiteMediaForSection("homepage-slider");
  return all.filter(
    (item) =>
      item.media_type === "before-after" &&
      item.before_image_path &&
      item.after_image_path
  );
}

/**
 * Convenience: About collage tiles. We accept any media_type
 * that resolves to a single visible image, so the admin can mix
 * "image" tiles with the occasional "before-after" pair where
 * only the after frame ends up on screen.
 */
export async function getAboutCollageItems(): Promise<SiteMediaItem[]> {
  return getPublishedSiteMediaForSection("about-collage");
}

/**
 * Service-options images for a specific service page.
 *
 * Reads from site_media_items where:
 *   section      = "service-options"
 *   service_slug = <provided slug>
 *   media_type   = "image"
 *   published    = true
 *
 * Returns items ordered by sort_order (ascending) so callers can
 * map sort_order=1 → card index 0, sort_order=2 → card index 1, etc.
 *
 * Returns [] when Supabase is unconfigured — callers should fall
 * back to CSS placeholder visuals in that case.
 */
export async function getServiceOptionsImages(
  serviceSlug: string
): Promise<SiteMediaItem[]> {
  if (!isSupabaseConfigured()) return [];

  let supabase;
  try {
    supabase = createServerClient();
  } catch {
    return [];
  }

  const { data, error } = await supabase
    .from("site_media_items")
    .select("*")
    .eq("section", "service-options")
    .eq("service_slug", serviceSlug)
    .eq("media_type", "image")
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.warn(
      `site-media: getServiceOptionsImages(${serviceSlug}) failed`,
      error
    );
    return [];
  }
  return (data ?? []) as SiteMediaItem[];
}

/**
 * Service-hero before/after slider items for a specific service page.
 *
 * Reads from site_media_items where:
 *   section      = "service-hero"
 *   service_slug = <provided slug>
 *   media_type   = "before-after"
 *   published    = true
 *
 * Ordered by sort_order then created_at; limited to 5 slides so
 * the hero slider never becomes unwieldy.
 *
 * Returns [] when Supabase is unconfigured — callers should fall
 * back to portfolio_items or a CSS placeholder in that case.
 *
 * This is the preferred source for service-page hero sliders so
 * the admin can manage hero imagery (/admin/media → service-hero)
 * independently from the portfolio examples in the page body
 * (/admin/portfolio).
 */
export async function getServiceHeroSliderItems(
  serviceSlug: string
): Promise<SiteMediaItem[]> {
  if (!isSupabaseConfigured()) return [];

  let supabase;
  try {
    supabase = createServerClient();
  } catch {
    return [];
  }

  const { data, error } = await supabase
    .from("site_media_items")
    .select("*")
    .eq("section", "service-hero")
    .eq("service_slug", serviceSlug)
    .eq("media_type", "before-after")
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(5);

  if (error) {
    console.warn(
      `site-media: getServiceHeroSliderItems(${serviceSlug}) failed`,
      error
    );
    return [];
  }
  return (data ?? []) as SiteMediaItem[];
}

/**
 * Admin read — every row, regardless of `published`. Sorted the
 * way the admin grid renders them (newest first within a
 * section).
 */
export async function getAllSiteMediaForAdmin(
  filterSection?: SiteMediaSection | null
): Promise<SiteMediaItem[]> {
  if (!isSupabaseConfigured()) return [];

  let supabase;
  try {
    supabase = createServerClient();
  } catch {
    return [];
  }

  let query = supabase
    .from("site_media_items")
    .select("*")
    .order("section", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (filterSection) query = query.eq("section", filterSection);

  const { data, error } = await query;
  if (error) {
    console.warn("site-media: getAllSiteMediaForAdmin failed", error);
    return [];
  }
  return (data ?? []) as SiteMediaItem[];
}
