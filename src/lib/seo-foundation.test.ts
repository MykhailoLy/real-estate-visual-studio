import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

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

test("blog hub has exact English-only metadata and renders published content", () => {
  const page = readSource("src/app/(public)/blog/page.tsx");
  const theme = readSource("src/app/globals.css");

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
  assert.match(page, /Latest Insights/);
  assert.match(
    page,
    /const \[featuredArticle, \.\.\.remainingArticles\] = articles/,
  );
  assert.match(page, /remainingArticles\.map/);
  assert.match(page, /md:grid-cols-2/);
  assert.match(page, /featuredArticle\.image \?/);
  assert.match(page, /article\.image \?/);
  assert.match(
    page,
    /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1\.78fr\)\]/,
  );
  assert.match(
    page,
    /bg-surface lg:order-2 lg:border-l lg:border-secondary/,
  );
  assert.match(page, /p-6 sm:p-7 lg:order-1/);
  assert.match(page, /className="bg-dashboard-canvas py-8"/);
  assert.match(theme, /--color-dashboard-canvas: #f8f8f6/);
  assert.match(page, /section className="border-b border-border bg-white"/);
  assert.match(page, /border border-border bg-white shadow-sm/);
  assert.match(page, /font-extrabold text-secondary-dark/);
  assert.match(page, /h-4 w-4 text-secondary transition-transform/);
  assert.doesNotMatch(page, /Practical resources|xl:grid-cols-3/);
  assert.doesNotMatch(page, /languages:|\/es\/blog/);
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

test("virtual staging cost article is published with approved metadata and service", () => {
  const registry = readSource("src/lib/blog.ts");

  assert.match(registry, /slug: "virtual-staging-cost"/);
  assert.match(
    registry,
    /metadataTitle: "How Much Does Virtual Staging Cost in 2026\? \| PicchuSpot"/,
  );
  assert.match(registry, /canonicalPath: "\/blog\/virtual-staging-cost"/);
  assert.match(registry, /publishedDate: "2026-09-13"/);
  assert.match(registry, /category: "Virtual Staging"/);
  assert.match(registry, /author: "Mykhailo Lykin"/);
  assert.match(
    registry,
    /name: "Virtual Staging",[\s\S]*?href: "\/pricing\/virtual-staging"/,
  );
  assert.match(registry, /status: "published"/);
  assert.match(registry, /Content: VirtualStagingCostArticle/);
  assert.match(
    registry,
    /src: "\/brand\/picchuspot-email-before-after-1200x450\.jpg"/,
  );
  assert.match(registry, /image\?: BlogArticleImage/);
  assert.match(registry, /showInArticleHeader\?: boolean/);
  assert.match(registry, /showInArticleHeader: false/);
  assert.match(registry, /article\.status === "published"/);
  assert.match(
    registry,
    /\.toSorted\(\(a, b\) => b\.publishedDate\.localeCompare\(a\.publishedDate\)\)/,
  );
});

test("virtual staging cost article preserves approved pricing and editorial links", () => {
  const content = readSource(
    "src/components/blog/VirtualStagingCostArticle.tsx",
  );
  const route = readSource("src/app/(public)/blog/[slug]/page.tsx");
  const pricingPage = readSource(
    "src/app/(public)/pricing/virtual-staging/page.tsx",
  );

  assert.match(content, /US\$19 per image/);
  assert.match(content, /US\$90\.25/);
  assert.match(content, /US\$171/);
  assert.match(content, /US\$323/);
  assert.doesNotMatch(content, /US\$15/);
  assert.match(content, /href="\/pricing\/virtual-staging"/);
  assert.match(content, /href="\/pricing\/item-removal-virtual-cleaning"/);
  assert.match(content, /href="\/pricing\/virtual-renovation"/);
  assert.match(content, /See Virtual Staging pricing/);
  assert.match(
    content,
    /src="\/images\/blog\/virtual-staging-bedroom-before\.jpg"/,
  );
  assert.match(
    content,
    /src="\/images\/blog\/virtual-staging-bedroom-after\.jpg"/,
  );
  assert.ok(
    content.indexOf("virtual-staging-bedroom-before.jpg") <
      content.indexOf("virtual-staging-bedroom-after.jpg"),
  );
  assert.match(content, /grid gap-3 md:grid-cols-2/);
  assert.match(content, />\s*BEFORE\s*<\/span>/);
  assert.match(content, />\s*AFTER\s*<\/span>/);
  assert.match(content, /Empty bedroom before PicchuSpot virtual staging/);
  assert.match(
    content,
    /Bedroom after PicchuSpot professional virtual staging with bed, nightstands, artwork and decor/,
  );
  assert.match(
    content,
    /The original room\s+layout and permanent architectural elements remain unchanged while\s+furniture and decor add scale, context, and a clear use for the space\./,
  );
  assert.match(content, /bg-secondary px-5 py-3/);
  assert.match(
    route,
    /article\.image && article\.image\.showInArticleHeader !== false/,
  );
  assert.match(content, /target="_blank"/);
  assert.match(content, /rel="noopener noreferrer"/);
  assert.match(pricingPage, /href="\/blog\/virtual-staging-cost"/);
});

test("virtual staging cost metadata and BlogPosting schema match the visible article", () => {
  const route = readSource("src/app/(public)/blog/[slug]/page.tsx");
  const structuredData = readSource("src/lib/structured-data.ts");

  assert.match(route, /title: \{ absolute: metadataTitle \}/);
  assert.match(route, /headline: article\.title/);
  assert.match(route, /articleSection: article\.category/);
  assert.match(route, /inLanguage: "en-US"/);
  assert.match(structuredData, /"@type": "BlogPosting"/);
  assert.match(structuredData, /"@type": "Person"/);
  assert.match(structuredData, /name: author/);
  assert.match(structuredData, /articleSection/);
  assert.match(structuredData, /inLanguage/);
  assert.match(structuredData, /\.\.\.\(dateModified \? \{ dateModified \} : \{\}\)/);
});

test("virtual staging cost article stays English-only and statically generated", () => {
  const route = readSource("src/app/(public)/blog/[slug]/page.tsx");
  const sitemap = readSource("src/app/sitemap.ts");
  const appFiles = sourceFilesUnder("src/app");

  assert.match(route, /export const dynamicParams = false/);
  assert.match(route, /generateStaticParams/);
  assert.match(route, /getPublishedBlogArticles\(\)\.map/);
  assert.doesNotMatch(route, /headers\(\)|cookies\(\)|next\/headers/);
  assert.match(sitemap, /getPublishedBlogArticles\(\)\.map/);
  assert.equal(
    appFiles.some((path) =>
      path.replaceAll("\\", "/").includes("/es/blog/virtual-staging-cost"),
    ),
    false,
  );
});
