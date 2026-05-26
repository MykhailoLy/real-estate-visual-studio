import { createServerClient } from "@/lib/supabase";
import type { ServiceVariant } from "@/components/home/ServicePlaceholder";

// ============================================================
// PORTFOLIO MEDIA — shared library
//
// Single source of truth for:
//   - the canonical service-slug list used by portfolio_items
//   - the mapping from slug -> public pricing page URL
//   - the mapping from pricing page URL -> slug
//   - the placeholder ServiceVariant used when no image exists
//   - tiny helpers to read items + build public storage URLs
//
// Anything that needs to know about a portfolio service should
// import from here so we don't drift across the homepage grid,
// the pricing pages, and the admin UI.
// ============================================================

export const PORTFOLIO_BUCKET = "portfolio";

/**
 * Canonical portfolio service slugs. These are also the values
 * the `portfolio_items.service_slug` CHECK constraint enforces in
 * supabase/portfolio.sql — keep in sync with that file.
 *
 * Note: `item-removal-virtual-cleaning` is the canonical portfolio
 * slug, but the corresponding *pricing page* lives at
 * `/pricing/photo-editing` (legacy URL kept stable). The mapping
 * below handles the bridge so the public site keeps working.
 */
export const PORTFOLIO_SERVICE_SLUGS = [
  "image-enhancement",
  "day-to-dusk",
  "virtual-staging",
  "item-removal-virtual-cleaning",
  "floor-plans",
  "virtual-renovation",
  "360-image-enhancement",
  "360-virtual-staging",
  "aerial-editing",
  "development-site-plans",
] as const;

export type PortfolioServiceSlug = (typeof PORTFOLIO_SERVICE_SLUGS)[number];

export function isPortfolioServiceSlug(
  value: unknown
): value is PortfolioServiceSlug {
  return (
    typeof value === "string" &&
    (PORTFOLIO_SERVICE_SLUGS as readonly string[]).includes(value)
  );
}

/**
 * Long-form display labels and the route each slug resolves to on
 * the public marketing site. This is what the admin UI renders in
 * its filter and what the homepage card / pricing page reverse-
 * lookups consume.
 */
export interface PortfolioServiceMeta {
  slug: PortfolioServiceSlug;
  label: string;
  /** Public pricing page URL — note photo-editing legacy URL. */
  pricingHref: string;
  /** Variant used by ServicePlaceholder as fallback when no item
   *  has been uploaded yet. */
  placeholderVariant: ServiceVariant;
}

export const PORTFOLIO_SERVICES: PortfolioServiceMeta[] = [
  {
    slug: "image-enhancement",
    label: "Image Enhancement",
    pricingHref: "/pricing/image-enhancement",
    placeholderVariant: "image-enhancement",
  },
  {
    slug: "day-to-dusk",
    label: "Day to Dusk",
    pricingHref: "/pricing/day-to-dusk",
    placeholderVariant: "day-to-dusk",
  },
  {
    slug: "virtual-staging",
    label: "Virtual Staging",
    pricingHref: "/pricing/virtual-staging",
    placeholderVariant: "virtual-staging",
  },
  {
    slug: "item-removal-virtual-cleaning",
    label: "Item Removal & Virtual Cleaning",
    // Legacy URL — the pricing page is /pricing/photo-editing,
    // but its portfolio slug is item-removal-virtual-cleaning.
    pricingHref: "/pricing/photo-editing",
    placeholderVariant: "item-removal",
  },
  {
    slug: "floor-plans",
    label: "Floor Plans",
    pricingHref: "/pricing/floor-plans",
    placeholderVariant: "floor-plans",
  },
  {
    slug: "virtual-renovation",
    label: "Virtual Renovation",
    pricingHref: "/pricing/virtual-renovation",
    placeholderVariant: "virtual-renovation",
  },
  {
    slug: "360-image-enhancement",
    label: "360° Image Enhancement",
    pricingHref: "/pricing/360-image-enhancement",
    placeholderVariant: "panorama-enhancement",
  },
  {
    slug: "360-virtual-staging",
    label: "360° Virtual Staging",
    pricingHref: "/pricing/360-virtual-staging",
    placeholderVariant: "panorama-staging",
  },
  {
    slug: "aerial-editing",
    label: "Aerial Editing",
    pricingHref: "/pricing/aerial-editing",
    placeholderVariant: "aerial-editing",
  },
  {
    slug: "development-site-plans",
    label: "Development Site Plans",
    pricingHref: "/pricing/development-site-plans",
    placeholderVariant: "site-plans",
  },
];

const SLUG_INDEX: Record<PortfolioServiceSlug, PortfolioServiceMeta> =
  Object.fromEntries(
    PORTFOLIO_SERVICES.map((s) => [s.slug, s])
  ) as Record<PortfolioServiceSlug, PortfolioServiceMeta>;

/** Look up a portfolio service entry by canonical slug. */
export function getPortfolioService(
  slug: PortfolioServiceSlug
): PortfolioServiceMeta {
  return SLUG_INDEX[slug];
}

/**
 * The set of pricing-page paths that map to portfolio slugs. Used
 * by admin revalidation so we always invalidate the page actually
 * affected by an item change (including the legacy photo-editing
 * URL).
 */
export const ALL_PORTFOLIO_PRICING_PATHS = PORTFOLIO_SERVICES.map(
  (s) => s.pricingHref
);

// ============================================================
// PUBLIC URL BUILDER
// ============================================================

/**
 * Build a public Supabase Storage URL for a path inside the
 * `portfolio` bucket.
 *
 * Returns `null` if NEXT_PUBLIC_SUPABASE_URL is not configured —
 * which happens in sandbox / preview builds without secrets.
 * Callers should fall back to the placeholder visual in that case.
 */
export function getPortfolioPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  const clean = path.replace(/^\/+/, "");
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${PORTFOLIO_BUCKET}/${clean}`;
}

// ============================================================
// DB ROW TYPE + READS
// ============================================================

export interface PortfolioItem {
  id: string;
  service_slug: PortfolioServiceSlug;
  title: string;
  description: string | null;
  before_image_path: string;
  after_image_path: string;
  before_alt: string | null;
  after_alt: string | null;
  sort_order: number;
  featured_home: boolean;
  published: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Whether the Supabase client is configured at all. Build steps
 * without secrets (sandbox CI, fork PRs) call this so they don't
 * crash trying to render a page that needs portfolio data.
 */
function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Pick the "homepage" portfolio item for each service:
 *   1. first published item with featured_home = TRUE, OR
 *   2. first published item ordered by sort_order ASC (stable),
 *      OR
 *   3. nothing — caller should render the placeholder.
 *
 * Returns a Map keyed by service slug. Missing slugs simply have
 * no entry.
 */
export async function getFeaturedHomeItems(): Promise<
  Map<PortfolioServiceSlug, PortfolioItem>
> {
  const out = new Map<PortfolioServiceSlug, PortfolioItem>();
  if (!isSupabaseConfigured()) return out;

  let supabase;
  try {
    supabase = createServerClient();
  } catch {
    return out;
  }

  const { data, error } = await supabase
    .from("portfolio_items")
    .select("*")
    .eq("published", true)
    .order("featured_home", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("portfolio: getFeaturedHomeItems query failed:", error);
    return out;
  }

  for (const row of (data ?? []) as PortfolioItem[]) {
    if (!isPortfolioServiceSlug(row.service_slug)) continue;
    if (out.has(row.service_slug)) continue; // first match wins per slug
    out.set(row.service_slug, row);
  }
  return out;
}

/**
 * All published items for a single service slug, in the order the
 * admin set via sort_order (then created_at).
 */
export async function getPublishedItemsForService(
  slug: PortfolioServiceSlug
): Promise<PortfolioItem[]> {
  if (!isSupabaseConfigured()) return [];

  let supabase;
  try {
    supabase = createServerClient();
  } catch {
    return [];
  }

  const { data, error } = await supabase
    .from("portfolio_items")
    .select("*")
    .eq("service_slug", slug)
    .eq("published", true)
    .order("featured_home", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.warn(
      `portfolio: getPublishedItemsForService(${slug}) query failed:`,
      error
    );
    return [];
  }
  return (data ?? []) as PortfolioItem[];
}

/**
 * Admin read — every item, regardless of published flag. Sorted
 * the way the admin grid renders them (newest first by default).
 */
export async function getAllItemsForAdmin(
  filterSlug?: PortfolioServiceSlug | null
): Promise<PortfolioItem[]> {
  if (!isSupabaseConfigured()) return [];

  let supabase;
  try {
    supabase = createServerClient();
  } catch {
    return [];
  }

  let query = supabase
    .from("portfolio_items")
    .select("*")
    .order("service_slug", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (filterSlug) query = query.eq("service_slug", filterSlug);

  const { data, error } = await query;
  if (error) {
    console.warn("portfolio: getAllItemsForAdmin query failed:", error);
    return [];
  }
  return (data ?? []) as PortfolioItem[];
}
