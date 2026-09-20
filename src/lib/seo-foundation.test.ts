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

test("document roots stay static-safe and proxy remains dashboard-only", () => {
  const defaultLayout = readSource("src/app/(default)/layout.tsx");
  const localizedLayout = readSource("src/app/(localized)/[locale]/layout.tsx");
  const document = readSource("src/components/layout/DocumentRoot.tsx");
  const proxy = readSource("src/proxy.ts");

  assert.match(defaultLayout, /<DocumentRoot lang="en">/);
  assert.match(localizedLayout, /<DocumentRoot lang=\{locale\}>/);
  assert.match(localizedLayout, /export const dynamicParams = false/);
  assert.match(localizedLayout, /return \[\{ locale: "es" \}\]/);
  assert.match(localizedLayout, /if \(locale !== "es"\) notFound\(\)/);
  assert.match(document, /<html lang=\{lang\}>/);
  for (const layout of [defaultLayout, localizedLayout]) {
    assert.match(layout, /export const metadata: Metadata = documentMetadata/);
    assert.match(layout, /export const viewport: Viewport = documentViewport/);
  }
  for (const source of [defaultLayout, localizedLayout, document]) {
    assert.doesNotMatch(source, /next\/headers|headers\(\)|cookies\(\)|DocumentLanguage|force-dynamic/);
  }
  assert.match(proxy, /matcher: \["\/dashboard\/:path\*"\]/);
  assert.doesNotMatch(proxy, /DOCUMENT_LANGUAGE|document-language/);
});

test("photo editing and item removal have separate canonical bilingual landing pages", () => {
  const englishPhotoEditing = readSource(
    "src/app/(default)/(public)/pricing/photo-editing/page.tsx",
  );
  const spanishPhotoEditing = readSource(
    "src/app/(localized)/[locale]/(public)/pricing/photo-editing/page.tsx",
  );
  const englishItemRemoval = readSource(
    "src/app/(default)/(public)/pricing/item-removal-virtual-cleaning/page.tsx",
  );
  const spanishItemRemoval = readSource(
    "src/app/(localized)/[locale]/(public)/pricing/item-removal-virtual-cleaning/page.tsx",
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
  const publicSources = [
    ...sourceFilesUnder("src/app/(default)/(public)"),
    ...sourceFilesUnder("src/app/(localized)/[locale]/(public)"),
  ].filter((path) => {
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
    ["src/app/(default)/(public)/order/page.tsx", "/dashboard/orders/new"],
    [
      "src/app/(default)/(public)/order/3d-floor-plans/page.tsx",
      "/dashboard/orders/new/3d-floor-plans",
    ],
    [
      "src/app/(default)/(public)/order/photo-editing/page.tsx",
      "/dashboard/orders/new/photo-editing",
    ],
    [
      "src/app/(default)/(public)/order/item-removal-virtual-cleaning/page.tsx",
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
  const page = readSource("src/app/(default)/(public)/blog/page.tsx");
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
  const route = readSource("src/app/(default)/(public)/blog/[slug]/page.tsx");
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
  const route = readSource("src/app/(default)/(public)/blog/[slug]/page.tsx");
  const pricingPage = readSource(
    "src/app/(default)/(public)/pricing/virtual-staging/page.tsx",
  );
  const comparison = readSource("src/components/blog/ArticleBeforeAfter.tsx");
  const articleElements = readSource("src/components/blog/ArticleElements.tsx");

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
    /src: "\/images\/blog\/virtual-staging-bedroom-before\.jpg"/,
  );
  assert.match(
    content,
    /src: "\/images\/blog\/virtual-staging-bedroom-after\.jpg"/,
  );
  assert.ok(
    content.indexOf("virtual-staging-bedroom-before.jpg") <
      content.indexOf("virtual-staging-bedroom-after.jpg"),
  );
  assert.match(content, /<ArticleBeforeAfter/);
  assert.match(comparison, />\s*BEFORE\s*<\/span>/);
  assert.match(comparison, />\s*AFTER\s*<\/span>/);
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
  assert.match(articleElements, /target="_blank"/);
  assert.match(articleElements, /rel="noopener noreferrer"/);
  assert.match(pricingPage, /href="\/blog\/virtual-staging-cost"/);
});

test("virtual staging cost metadata and BlogPosting schema match the visible article", () => {
  const route = readSource("src/app/(default)/(public)/blog/[slug]/page.tsx");
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
  const route = readSource("src/app/(default)/(public)/blog/[slug]/page.tsx");
  const sitemap = readSource("src/app/sitemap.ts");
  const appFiles = sourceFilesUnder("src/app");

  assert.match(route, /export const dynamicParams = false/);
  assert.match(route, /generateStaticParams/);
  assert.match(route, /getPublishedBlogArticles\(\)\.map/);
  assert.doesNotMatch(route, /headers\(\)|cookies\(\)|next\/headers/);
  assert.match(sitemap, /getPublishedBlogArticles\(\)\.map/);
  assert.equal(
    appFiles.some((path) =>
      path.replaceAll("\\", "/").includes("/[locale]/(public)/blog/virtual-staging-cost"),
    ),
    false,
  );
});

test("virtual staging explainer is published with its approved identity", () => {
  const registry = readSource("src/lib/blog.ts");
  const article = registry.match(
    /\{\s*slug: "what-is-virtual-staging",[\s\S]*?\n  \}/,
  )?.[0];

  assert.ok(article, "The explainer must be registered as an article");
  assert.match(article, /status: "published"/);
  assert.match(article, /Content: WhatIsVirtualStagingArticle/);
  assert.match(article, /canonicalPath: "\/blog\/what-is-virtual-staging"/);
  assert.match(
    article,
    /What Is Virtual Staging\? A Practical Guide for Real Estate Agents/,
  );
  assert.match(
    article,
    /What Is Virtual Staging\? A Guide for Agents \| PicchuSpot/,
  );
  assert.match(
    article,
    /Learn what virtual staging changes, how it works, when to use it, and how to review realistic listing photos and check disclosure requirements\./,
  );
  assert.match(article, /publishedDate: "2026-09-15"/);
  assert.doesNotMatch(article, /updatedDate:/);
  assert.match(article, /category: "Virtual Staging"/);
  assert.match(article, /author: "Mykhailo Lykin"/);
  assert.match(article, /href: "\/pricing\/virtual-staging"/);
  assert.match(article, /showInArticleHeader: false/);
});

test("virtual staging explainer keeps approved price, links, and visual source order", () => {
  const content = readSource(
    "src/components/blog/WhatIsVirtualStagingArticle.tsx",
  );

  assert.match(content, /US\$19 per image/);
  assert.doesNotMatch(content, /US\$15|IMPLEMENTATION VISUAL:/);
  for (const href of [
    "/pricing/virtual-staging",
    "/blog/virtual-staging-cost",
    "/pricing/virtual-renovation",
    "/pricing/item-removal-virtual-cleaning",
    "/terms",
  ]) {
    assert.ok(content.includes(`href="${href}"`), href);
  }
  for (const room of ["office", "living-room"]) {
    const before = `what-is-virtual-staging-${room}-before.jpg`;
    const after = `what-is-virtual-staging-${room}-after.jpg`;
    assert.ok(content.includes(before), before);
    assert.ok(content.includes(after), after);
    assert.ok(content.indexOf(before) < content.indexOf(after));
  }
  for (const alt of [
    "Empty room before virtual staging, showing the original walls, windows and flooring",
    "Home office virtually staged with a desk, chairs, shelving and decor",
    "Empty living room before virtual staging, showing the original flooring, windows and fixed architectural features",
    "Living room virtually staged with sofa, armchair, coffee table, rug, artwork and TV furniture",
  ]) {
    assert.ok(content.includes(alt), alt);
  }
  assert.match(content, /Ready to stage your listing\?/);
  assert.match(content, /View Virtual Staging/);
  assert.doesNotMatch(content, /FAQPage|faqPageSchema|aggregateRating|reviewRating/);
});

test("virtual staging explainer uses the existing static English blog and schema pipeline", () => {
  const route = readSource("src/app/(default)/(public)/blog/[slug]/page.tsx");
  const sitemap = readSource("src/app/sitemap.ts");
  const registry = readSource("src/lib/blog.ts");
  const appFiles = sourceFilesUnder("src/app");

  assert.match(registry, /article\.status === "published"/);
  assert.match(route, /getPublishedBlogArticles\(\)\.map/);
  assert.match(route, /export const dynamicParams = false/);
  assert.match(route, /canonical: url/);
  assert.match(route, /<h1[^>]*>\s*\{article\.title\}/);
  assert.match(route, /blogPostingSchema\(/);
  assert.match(route, /breadcrumbSchema\(/);
  assert.match(route, /datePublished: article\.publishedDate/);
  assert.match(route, /dateModified: article\.updatedDate/);
  assert.match(sitemap, /getPublishedBlogArticles\(\)\.map/);
  assert.match(sitemap, /url: absoluteUrl\(article\.canonicalPath\)/);
  assert.doesNotMatch(
    route,
    /next\/headers|headers\(\)|cookies\(\)|force-dynamic|languages:|\/es\/blog|faqPageSchema|FAQPage/,
  );
  assert.equal(
    appFiles.some((path) =>
      path.replaceAll("\\", "/").includes("/[locale]/(public)/blog/"),
    ),
    false,
  );
});


test("Spanish staging examples translate known copy and preserve editorial fallbacks", async () => {
  const { translatePricingExampleTitle, translatePricingExampleDescription, translatePricingExampleAlt } =
    await import("../app/(localized)/[locale]/(public)/pricing/labels.ts");
  assert.equal(translatePricingExampleTitle("ACCURATE ROOM SCALE"), "PROPORCIONES REALISTAS");
  assert.equal(translatePricingExampleTitle("VIRTUAL STAGING FROM US$19"), "VIRTUAL STAGING DESDE US$19");
  assert.equal(translatePricingExampleDescription("Professional virtual staging starting from US$19 per image. No subscriptions, no hidden fees — just clear pricing per project."), "Virtual Staging profesional desde US$19 por imagen. Sin suscripciones ni cargos ocultos: precios claros para cada proyecto.");
  assert.equal(translatePricingExampleAlt("Empty bedroom room before virtual staging"), "Dormitorio vacío antes de Virtual Staging");
  for (const value of ["", "Descripción editorial sin cambios", "Unknown custom content"]) {
    assert.equal(translatePricingExampleTitle(value), value);
    assert.equal(translatePricingExampleDescription(value), value);
    assert.equal(translatePricingExampleAlt(value), value);
  }
});


test("public account menu retains destinations with Spanish labels", () => {
  const source = readSource("src/components/auth/PublicAccountMenu.tsx");
  for (const [href, en, es] of [
    ["/dashboard", "Dashboard", "Panel de control"],
    ["/dashboard/jobs", "Jobs", "Trabajos"],
    ["/dashboard/orders/new", "New Order", "Nuevo pedido"],
    ["/dashboard/profile", "My Account", "Mi cuenta"],
  ]) {
    assert.ok(source.includes(`href: "${href}", label: "${en}", esLabel: "${es}"`));
  }
  assert.ok(source.includes('pathname === "/es" || pathname.startsWith("/es/")'));
  assert.ok(source.includes('{isSpanish ? item.esLabel : item.label}'));
});
