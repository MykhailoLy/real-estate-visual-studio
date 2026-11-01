import type { PortfolioServiceSlug } from "./portfolio-service-meta";

/**
 * Service slugs whose gallery belongs in /sitemap.xml.
 *
 * `available` is the set of services that currently have a gallery-eligible
 * item. `null` means the portfolio could not be read (Supabase error or not
 * configured) — in that case every service is kept, because a failed read is
 * not evidence that the admin unpublished everything.
 */
export function gallerySitemapSlugs(
  available: readonly string[] | null,
  all: readonly PortfolioServiceSlug[],
): PortfolioServiceSlug[] {
  if (available === null) return [...all];
  const found = new Set(available);
  return all.filter((slug) => found.has(slug));
}
