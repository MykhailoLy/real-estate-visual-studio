import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { getPublishedBlogArticles } from "./blog.ts";

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

function sourceFilesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFilesUnder(path) : [path];
  });
}

test("root layout stays static-safe and proxy remains dashboard-only", () => {
  const layout = readSource("src/app/layout.tsx");
  const proxy = readSource("src/proxy.ts");

  assert.match(layout, /<html lang="en">/);
  assert.doesNotMatch(layout, /next\/headers|headers\(\)|DocumentLanguage/);
  assert.match(proxy, /matcher: \["\/dashboard\/:path\*"\]/);
  assert.doesNotMatch(proxy, /DOCUMENT_LANGUAGE|document-language/);
});

test("photo editing and item removal have separate canonical bilingual landing pages", () => {
  const englishPhotoEditing = readSource(
    "src/app/(public)/pricing/photo-editing/page.tsx",
  );
  const spanishPhotoEditing = readSource(
    "src/app/(public)/es/pricing/photo-editing/page.tsx",
  );
  const englishItemRemoval = readSource(
    "src/app/(public)/pricing/item-removal-virtual-cleaning/page.tsx",
  );
  const spanishItemRemoval = readSource(
    "src/app/(public)/es/pricing/item-removal-virtual-cleaning/page.tsx",
  );
  const localizedRoutes = readSource("src/lib/localized-routes.ts");
  const portfolioMeta = readSource("src/lib/portfolio-service-meta.ts");

  assert.match(englishPhotoEditing, /title: "Real Estate Photo Editing Services"/);
  assert.match(
    englishPhotoEditing,
    /title="Professional Real Estate Photo Editing"/,
  );
  assert.match(englishPhotoEditing, /serviceSlug="image-enhancement"/);
  assert.match(
    englishPhotoEditing,
    /orderHref="\/dashboard\/orders\/new\/photo-editing"/,
  );
  assert.doesNotMatch(
    englishPhotoEditing,
    /title="Item Removal & Virtual Cleaning Pricing"/,
  );

  assert.match(
    spanishPhotoEditing,
    /title="Edición profesional de fotos inmobiliarias"/,
  );
  assert.match(spanishPhotoEditing, /path: "\/es\/pricing\/photo-editing"/);
  assert.match(
    englishItemRemoval,
    /canonicalPath: "\/pricing\/item-removal-virtual-cleaning"/,
  );
  assert.match(
    englishItemRemoval,
    /serviceSlug="item-removal-virtual-cleaning"/,
  );
  assert.match(
    englishItemRemoval,
    /orderHref="\/dashboard\/orders\/new\/item-removal-virtual-cleaning"/,
  );
  assert.match(
    spanishItemRemoval,
    /path: "\/es\/pricing\/item-removal-virtual-cleaning"/,
  );
  assert.match(
    localizedRoutes,
    /englishPath: "\/pricing\/item-removal-virtual-cleaning"[\s\S]*?spanishPath: "\/es\/pricing\/item-removal-virtual-cleaning"/,
  );
  assert.match(
    portfolioMeta,
    /slug: "item-removal-virtual-cleaning"[\s\S]*?pricingHref: "\/pricing\/item-removal-virtual-cleaning"/,
  );
});

test("localized metadata keeps every established hreflang key", () => {
  const seo = readSource("src/lib/seo.ts");

  for (const key of ["en", '"en-US"', "es", '"es-ES"', '"x-default"']) {
    assert.match(seo, new RegExp(`${key}: absoluteUrl`));
  }
});

test("public application links bypass legacy order redirects", () => {
  const publicSources = sourceFilesUnder("src/app/(public)").filter((path) => {
    const normalized = path.replaceAll("\\", "/");
    return (
      normalized.endsWith(".tsx") &&
      !normalized.includes("/(public)/order/") &&
      !normalized.includes("/(public)/api/")
    );
  });
  const sharedSources = [
    ...sourceFilesUnder("src/components/sections").filter((path) =>
      path.endsWith(".tsx"),
    ),
    "src/components/layout/Footer.tsx",
    "src/lib/nav.ts",
  ];
  const legacyLink =
    /(?:href\s*[:=]|orderHref=|primaryHref=|secondaryHref=)\s*["']\/order(?:[\/"'?#])/;

  for (const path of [...publicSources, ...sharedSources]) {
    assert.doesNotMatch(readSource(path), legacyLink, path);
  }
});

test("legacy order routes remain permanent redirects to canonical destinations", () => {
  const redirects = [
    ["src/app/(public)/order/page.tsx", "/dashboard/orders/new"],
    [
      "src/app/(public)/order/3d-floor-plans/page.tsx",
      "/dashboard/orders/new/3d-floor-plans",
    ],
    [
      "src/app/(public)/order/photo-editing/page.tsx",
      "/dashboard/orders/new/photo-editing",
    ],
    [
      "src/app/(public)/order/item-removal-virtual-cleaning/page.tsx",
      "/dashboard/orders/new/item-removal-virtual-cleaning",
    ],
  ] as const;

  for (const [path, destination] of redirects) {
    const source = readSource(path);
    assert.match(source, /permanentRedirect\(/, path);
    assert.ok(source.includes(`permanentRedirect("${destination}")`), path);
  }
});

test("blog hub has exact English-only metadata and intentional empty content", () => {
  const page = readSource("src/app/(public)/blog/page.tsx");

  assert.match(
    page,
    /BLOG_TITLE = "Real Estate Visual Marketing Blog \| PicchuSpot"/,
  );
  assert.match(
    page,
    /Practical insights on virtual staging, real estate photo editing, floor plans, property marketing visuals, and presenting listings more effectively\./,
  );
  assert.match(page, /canonical: BLOG_URL/);
  assert.match(page, /Real Estate Visual Marketing Insights/);
  assert.match(page, /Insights coming soon/);
  assert.doesNotMatch(page, /languages:|\/es\/blog/);
  assert.equal(getPublishedBlogArticles().length, 0);
});

test("blog routes and sitemap publish only registered articles", () => {
  const route = readSource("src/app/(public)/blog/[slug]/page.tsx");
  const sitemap = readSource("src/app/sitemap.ts");
  const registry = readSource("src/lib/blog.ts");

  assert.match(route, /export const dynamicParams = false/);
  assert.match(route, /generateStaticParams/);
  assert.match(route, /getPublishedBlogArticles\(\)/);
  assert.doesNotMatch(route, /headers\(\)|cookies\(\)|next\/headers/);
  assert.match(registry, /status: BlogArticleStatus/);
  assert.match(registry, /article\.status === "published"/);
  assert.match(sitemap, /path: "\/blog"/);
  assert.match(sitemap, /getPublishedBlogArticles\(\)\.map/);
  assert.match(sitemap, /article\.canonicalPath/);
  assert.doesNotMatch(sitemap, /\/es\/blog|virtual-staging-statistics/);
});

test("blog schema support and English footer discovery are present", () => {
  const structuredData = readSource("src/lib/structured-data.ts");
  const footer = readSource("src/components/layout/Footer.tsx");

  assert.match(structuredData, /"@type": "CollectionPage"/);
  assert.match(structuredData, /"@type": "BlogPosting"/);
  assert.match(structuredData, /datePublished/);
  assert.match(structuredData, /dateModified/);
  assert.match(structuredData, /publisher/);
  assert.match(footer, /\{ href: "\/blog", label: "Blog" \}/);
  assert.doesNotMatch(footer, /\{ href: "\/es\/blog"/);
});
