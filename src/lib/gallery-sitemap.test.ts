import assert from "node:assert/strict";
import test from "node:test";
import { gallerySitemapSlugs } from "./gallery-sitemap.ts";
import { PORTFOLIO_SERVICE_SLUGS } from "./portfolio-service-meta.ts";

const ALL = PORTFOLIO_SERVICE_SLUGS;

// Non-gallery entries currently in /sitemap.xml: localized marketing and
// service routes (41 × EN/ES) plus the four extra marketing routes, the blog
// index and the published articles. Each gallery service adds two URLs.
const BASE_SITEMAP_URLS = 51;

function sitemapUrls(available: readonly string[] | null): number {
  return BASE_SITEMAP_URLS + gallerySitemapSlugs(available, ALL).length * 2;
}

test("every service is kept when the portfolio read fails", () => {
  assert.deepEqual(gallerySitemapSlugs(null, ALL), [...ALL]);
});

test("only services with a published example reach the sitemap", () => {
  const published = ALL.filter((slug) => slug !== "floor-plans");
  const slugs = gallerySitemapSlugs(published, ALL);
  assert.equal(slugs.length, ALL.length - 1);
  assert.ok(!slugs.includes("floor-plans"));
});

test("unknown slugs from the database are ignored", () => {
  assert.deepEqual(gallerySitemapSlugs(["not-a-service"], ALL), []);
});

test("unpublishing the last example of one service removes exactly its URLs", () => {
  assert.equal(sitemapUrls(ALL), 71);

  const withoutFloorPlans = ALL.filter((slug) => slug !== "floor-plans");
  assert.equal(sitemapUrls(withoutFloorPlans), 69);

  assert.equal(sitemapUrls(ALL), 71);
});
