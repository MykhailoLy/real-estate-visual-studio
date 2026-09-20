import { expect, test } from "@playwright/test";
import {
  expectNavigationResponseOk,
  installSmokeNetworkGuards,
} from "../support/network";

type JsonLdObject = Record<string, unknown>;

test("llms.txt serves the existing service guide with use-case directions", async ({ request }) => {
  const response = await request.get("/llms.txt", { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/plain");
  const content = await response.text();
  expect(content).toContain("## When to use PicchuSpot");
  for (const path of ["/pricing", "/dashboard/orders/new", "/contact", "/local"]) {
    expect(content).toContain(`https://picchuspot.com${path}`);
  }
  expect(content).toContain("sign-in or registration is required");
});

function parseJsonLdObjects(html: string): JsonLdObject[] {
  return Array.from(
    html.matchAll(
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
    (match) => JSON.parse(match[1]) as JsonLdObject | JsonLdObject[],
  ).flatMap((payload) => (Array.isArray(payload) ? payload : [payload]));
}

test("document roots emit the route language and inherited metadata in the original HTML", async ({
  request,
  page,
}) => {
  for (const [path, language] of [
    ["/", "en"],
    ["/pricing/virtual-staging", "en"],
    ["/login", "en"],
    ["/signup", "en"],
    ["/es", "es"],
    ["/es/pricing/virtual-staging", "es"],
    ["/es/legal", "es"],
    ["/es/gallery", "es"],
    ["/es/login", "es"],
    ["/es/signup", "es"],
  ] as const) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(200);
    const html = await response.text();
    // Check the response, not a document that client JavaScript could repair.
    expect(html.match(/<html(?:\s|>)/gi), path).toHaveLength(1);
    expect(html.match(/<body(?:\s|>)/gi), path).toHaveLength(1);
    expect(html.match(/<\/html>/gi), path).toHaveLength(1);
    expect(html.match(/<\/body>/gi), path).toHaveLength(1);
    const document = await page.evaluate((source) => {
      const doc = new DOMParser().parseFromString(source, "text/html");
      const values = (selector: string, attribute: string) =>
        Array.from(doc.querySelectorAll(selector), (node) => node.getAttribute(attribute));
      return {
        language: doc.documentElement.lang,
        titles: Array.from(doc.querySelectorAll("title"), (node) => node.textContent),
        applicationName: values('meta[name="application-name"]', "content"),
        themeColor: values('meta[name="theme-color"]', "content"),
        viewport: values('meta[name="viewport"]', "content"),
        manifest: values('link[rel="manifest"]', "href"),
        icons: values('link[rel="icon"]', "href"),
        bodyClass: doc.body.className,
        robots: values('meta[name="robots"]', "content"),
        headings: Array.from(doc.querySelectorAll("main h1, main h2, main h3, main h4, main h5, main h6"), (node) => Number(node.tagName.slice(1))),
        benefitHeadings: Array.from(doc.querySelectorAll('[data-testid="benefits-grid"] h2'), (node) => node.textContent),
      };
    }, html);
    expect(document.language, path).toBe(language);
    if (path === "/" || path === "/es") {
      expect(document.headings.filter((level) => level === 1), path).toHaveLength(1);
      expect(document.headings[0], path).toBe(1);
      expect(document.benefitHeadings, path).toHaveLength(6);
      for (let index = 1; index < document.headings.length; index++) {
        expect(document.headings[index], `${path}: heading ${index}`).toBeLessThanOrEqual(document.headings[index - 1] + 1);
      }
    }
    expect(document.titles, path).toHaveLength(1);
    expect(document.titles[0], path).toContain("PicchuSpot");
    expect(document.applicationName, path).toEqual(["PicchuSpot"]);
    expect(document.themeColor, path).toEqual(["#071A2B"]);
    expect(document.viewport, path).toEqual(["width=device-width, initial-scale=1"]);
    expect(document.manifest, path).toEqual(["/manifest.webmanifest"]);
    expect(document.icons, path).toEqual(expect.arrayContaining([
      "/icons/favicon-16x16.png", "/icons/favicon-32x32.png",
      "/icons/favicon-48x48.png", "/icons/favicon.svg",
    ]));
    expect(document.bodyClass, path).toContain("antialiased flex flex-col min-h-screen w-full overflow-x-clip");
    if (/\/(login|signup)$/.test(path)) {
      expect(document.robots, path).toEqual(["noindex, nofollow"]);
    }
  }
});

test("both document roots retain the Virtual Staging canonical and reciprocal alternates", async ({
  request,
  page,
}) => {
  for (const prefix of ["", "/es"]) {
    const path = `${prefix}/pricing/virtual-staging`;
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    const document = await page.evaluate((source) => {
      const doc = new DOMParser().parseFromString(source, "text/html");
      return {
        canonical: Array.from(doc.querySelectorAll('link[rel="canonical"]'), (node) => node.getAttribute("href")),
        alternates: Object.fromEntries(Array.from(
          doc.querySelectorAll('link[rel="alternate"][hreflang]'),
          (node) => [node.getAttribute("hreflang"), node.getAttribute("href")],
        )),
      };
    }, await response.text());
    expect(document.canonical, path).toEqual([`https://picchuspot.com${path}`]);
    expect(document.alternates, path).toEqual({
      en: "https://picchuspot.com/pricing/virtual-staging",
      "en-US": "https://picchuspot.com/pricing/virtual-staging",
      es: "https://picchuspot.com/es/pricing/virtual-staging",
      "es-ES": "https://picchuspot.com/es/pricing/virtual-staging",
      "x-default": "https://picchuspot.com/pricing/virtual-staging",
    });
  }
});

// Keep the existing route matrix, with a fresh browser/guard per URL so one
// failed hydration cannot prevent (or contaminate) the Spanish gallery check.
for (const path of [
  "/__document_root_missing__",
  "/es/__document_root_missing__",
  "/es/blog",
  "/en",
  "/fr",
  "/fr/pricing/virtual-staging",
  "/gallery/__document_root_missing__",
  "/es/gallery/__document_root_missing__",
  "/property/__document_root_missing__",
]) {
  // English dynamic gallery/property errors are a separate, pre-existing
  // fallback. The ungenerated Spanish gallery slug uses the global document.
  const isGlobal = !path.startsWith("/gallery/") && !path.startsWith("/property/");
  test(`${isGlobal ? "global 404 document" : "unpublished dynamic route"}: ${path}`, async ({ request, page }, testInfo) => {
    const guard = await installSmokeNetworkGuards(page, testInfo, {
      expectedNavigation404Paths: isGlobal ? [path] : [],
    });
    const response = isGlobal
      ? await page.goto(path)
      : await request.get(path, { maxRedirects: 0 });
    expect(response, path).not.toBeNull();
    expect(response!.status(), path).toBe(404);
    const html = await response!.text();
    expect(html, path).toMatch(/<meta\s+name="robots"\s+content="noindex"/);
    if (isGlobal) {
      expect(new URL(page.url()).pathname, path).toBe(path);
      expect(html.match(/<html(?:\s|>)/gi), path).toHaveLength(1);
      expect(html.match(/<body(?:\s|>)/gi), path).toHaveLength(1);
      expect(html, path).toMatch(/<html\s+lang="en"/);
      expect(html, path).toMatch(/<meta\s+name="theme-color"\s+content="#071A2B"/);
      expect(html, path).toMatch(/<body\s+class="[^"]*geist_[^"]*__variable[^"]*antialiased/);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
      await expect(page.getByRole("heading", { level: 1, name: "404", exact: true })).toBeInViewport();
      await expect(page.getByRole("heading", { level: 2 })).toHaveText("This page could not be found.");
      // This banner only appears after its client effect: wait for hydration,
      // not merely the static fallback text, before inspecting runtime errors.
      await expect(page.locator('aside[aria-label="Cookie consent"], aside[aria-label="Consentimiento de cookies"]')).toBeVisible();
      await expect(page.getByRole("button", {
        name: path.startsWith("/es/")
          ? "Abrir el asistente de IA de PicchuSpot"
          : "Open PicchuSpot AI assistant",
        exact: true,
      })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.locator("body").evaluate((node) => getComputedStyle(node).fontFamily)).toContain("Geist");
      try {
        await guard.expectClean();
      } catch (error) {
        // Keep a small, readable server/client comparison in CI logs as well as
        // the existing runtime-error attachments; never swallow the failure.
        console.info("404 hydration context", JSON.stringify({
          path,
          serverSupportText: html.match(/Ask PicchuSpot|Pregunta a PicchuSpot/)?.[0],
          clientSupportText: await page.locator('button[aria-label*="PicchuSpot"]').allTextContents(),
        }));
        throw error;
      }
    }
  });
}

test("an expected document 404 does not excuse script console errors", async ({ page }, testInfo) => {
  const path = "/__document_root_missing__";
  const guard = await installSmokeNetworkGuards(page, testInfo, {
    expectedNavigation404Paths: [path],
  });
  const response = await page.goto(path);
  expect(response?.status()).toBe(404);
  await expect(page.locator('aside[aria-label="Cookie consent"]')).toBeVisible();
  await guard.expectClean();

  // Even the same text emitted by application JS must not be mistaken for
  // Chromium's expected navigation diagnostic (JS supplies console arguments).
  await page.evaluate(() => console.error(
    "Failed to load resource: the server responded with a status of 404 (Not Found)",
  ));
  await expect(guard.expectClean()).rejects.toThrow("first-party console errors");
});

test("language links cross document roots while English navigation and stored consent remain intact", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/pricing/virtual-staging");
  await page.evaluate(() => {
    localStorage.setItem("picchuspot_cookie_consent", "rejected");
  });
  await page.reload();
  await page.evaluate(() => {
    (window as Window & { documentRootSentinel?: string }).documentRootSentinel = "english";
  });
  await page.locator('a[href="/pricing"]').first().click();
  await expect(page).toHaveURL(/\/pricing$/);
  expect(await page.evaluate(() =>
    (window as Window & { documentRootSentinel?: string }).documentRootSentinel,
  )).toBe("english");
  await page.locator('a[href="/pricing/virtual-staging"]').first().click();
  await expect(page).toHaveURL(/\/pricing\/virtual-staging$/);
  expect(await page.evaluate(() =>
    (window as Window & { documentRootSentinel?: string }).documentRootSentinel,
  )).toBe("english");

  await page.getByRole("button", { name: "Select market, currency, and language" }).click();
  await page.getByRole("link", { name: "Spanish", exact: true }).click();
  await expect(page).toHaveURL(/\/es\/pricing\/virtual-staging$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  expect(await page.evaluate(() =>
    (window as Window & { documentRootSentinel?: string }).documentRootSentinel,
  )).toBeUndefined();
  expect(await page.evaluate(() => localStorage.getItem("picchuspot_cookie_consent"))).toBe("rejected");
  expect(await page.locator("body").evaluate((node) => getComputedStyle(node).fontFamily)).toContain("Geist");

  await page.getByRole("button", { name: "Seleccionar mercado, moneda e idioma" }).click();
  await page.getByRole("link", { name: "Inglés", exact: true }).click();
  await expect(page).toHaveURL(/\/pricing\/virtual-staging$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(await page.evaluate(() => localStorage.getItem("picchuspot_cookie_consent"))).toBe("rejected");
  await guard.expectClean();
});

test("about page presents the founder story, audiences, and truthful schema", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  const response = await page.goto("/about");
  expectNavigationResponseOk(response, "/about");

  await expect(page).toHaveTitle(
    "About PicchuSpot | Real Estate Visual Services",
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Meet the founder of PicchuSpot and learn how architectural experience shapes our virtual staging, photo editing, floor plan, and real estate visual services.",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Built from architecture. Focused on real estate.",
  );
  await expect(page.getByText("Mykhailo Lykin")).toHaveCount(2);
  await expect(page.getByRole("region", { name: "Founder quote" })).toContainText(
    "A property image should do more than look polished.",
  );

  for (const principle of [
    "Architectural perspective",
    "Real-estate focused",
    "Realism over decoration",
    "Built for long-term collaboration",
  ]) {
    await expect(page.getByRole("heading", { name: principle, exact: true })).toBeVisible();
  }

  for (const audience of [
    "Real Estate Agents",
    "Real Estate Photographers",
    "Developers & Property Marketers",
    "Property Managers & Home Sellers",
  ]) {
    await expect(page.getByRole("heading", { name: audience, exact: true })).toBeVisible();
  }

  await expect(page.getByText("Clear order workflow", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Revision support", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Private file delivery", { exact: true })).toHaveCount(0);

  const serviceActions = page.getByRole("link", {
    name: "Explore Services",
    exact: true,
  });
  const orderActions = page.getByRole("link", {
    name: "Start an Order",
    exact: true,
  });
  await expect(serviceActions).toHaveCount(2);
  await expect(serviceActions.first()).toHaveAttribute("href", "/pricing");
  await expect(serviceActions.last()).toHaveAttribute("href", "/pricing");
  await expect(orderActions).toHaveCount(2);
  await expect(orderActions.first()).toHaveAttribute(
    "href",
    "/dashboard/orders/new",
  );
  await expect(orderActions.last()).toHaveAttribute(
    "href",
    "/dashboard/orders/new",
  );

  const founderSection = page.getByRole("region", {
    name: "A visual business built on architectural experience",
  });
  await expect(founderSection.locator("img")).toHaveCount(0);
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.locator("body > div footer, body > footer").last()).toBeVisible();

  const schemas = parseJsonLdObjects(await response!.text());
  expect(schemas.find((schema) => schema["@type"] === "AboutPage")).toMatchObject({
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About PicchuSpot | Real Estate Visual Services",
    url: "https://picchuspot.com/about",
    inLanguage: "en-US",
    about: { "@type": "Organization", name: "PicchuSpot" },
    mainEntity: {
      "@type": "Person",
      name: "Mykhailo Lykin",
      jobTitle: "Founder",
      worksFor: { "@type": "Organization", name: "PicchuSpot" },
    },
  });

  const spanishResponse = await page.goto("/es/about");
  expectNavigationResponseOk(spanishResponse, "/es/about");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Visuales inmobiliarios creados para anuncios más claros",
    }),
  ).toBeVisible();

  await guard.expectClean();
});

test("about page reflows without horizontal overflow at required viewports", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  const response = await page.goto("/about");
  expectNavigationResponseOk(response, "/about");

  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content, `${width}px page width`).toBeLessThanOrEqual(
      dimensions.viewport,
    );
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }

  await guard.expectClean();
});

const VIRTUAL_STAGING_EXPLAINER = {
  path: "/blog/what-is-virtual-staging",
  title: "What Is Virtual Staging? A Practical Guide for Real Estate Agents",
  metadataTitle: "What Is Virtual Staging? A Guide for Agents | PicchuSpot",
  description:
    "Learn what virtual staging changes, how it works, when to use it, and how to review realistic listing photos and check disclosure requirements.",
} as const;

test("virtual staging explainer publishes truthful English metadata, schema, and sitemap identity", async ({
  page,
  request,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  const article = VIRTUAL_STAGING_EXPLAINER;
  const canonical = `https://picchuspot.com${article.path}`;
  const response = await page.goto(article.path);
  expectNavigationResponseOk(response, article.path);

  await expect(page).toHaveTitle(article.metadataTitle);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(article.title);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    article.description,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    canonical,
  );
  await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
  await expect(page.locator("article")).toContainText("US$19 per image");
  await expect(page.locator("article")).not.toContainText("US$15");
  await expect(page.locator("article")).not.toContainText("IMPLEMENTATION VISUAL:");
  await expect(page.locator("article time")).toHaveCount(1);
  await expect(page.locator("article time")).toHaveAttribute("dateTime", "2026-09-15");

  const schemas = parseJsonLdObjects(await response!.text());
  const posting = schemas.find((schema) => schema["@type"] === "BlogPosting");
  expect(posting).toMatchObject({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.description,
    url: canonical,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    datePublished: "2026-09-15",
    author: { "@type": "Person", name: "Mykhailo Lykin" },
    articleSection: "Virtual Staging",
    inLanguage: "en-US",
    image: { "@type": "ImageObject" },
  });
  expect(posting).not.toHaveProperty("dateModified");
  expect(JSON.stringify(schemas)).not.toMatch(/FAQPage|aggregateRating|reviewRating/);
  expect(schemas.find((schema) => schema["@type"] === "BreadcrumbList")).toMatchObject({
    itemListElement: [
      { position: 1, name: "Home", item: "https://picchuspot.com" },
      { position: 2, name: "Blog", item: "https://picchuspot.com/blog" },
      { position: 3, name: article.title },
    ],
  });

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const sitemapText = await sitemap.text();
  expect(sitemapText).toContain(`<loc>${canonical}</loc>`);
  expect(sitemapText).not.toContain("/es/blog/");
  const articleEntry = sitemapText.match(
    /<url>\s*<loc>https:\/\/picchuspot\.com\/blog\/what-is-virtual-staging<\/loc>[\s\S]*?<\/url>/,
  )?.[0];
  expect(articleEntry).toBeDefined();
  expect(articleEntry).not.toContain("hreflang");
  const spanishArticle = await request.get(`/es${article.path}`);
  expect(spanishArticle.status()).toBe(404);

  await guard.expectClean();
});

test("blog index discovers the new explainer and preserves the cost guide", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  const response = await page.goto("/blog");
  expectNavigationResponseOk(response, "/blog");
  await expect(page.getByRole("heading", {
    name: "Real Estate Visual Marketing Insights",
  })).toBeVisible();
  const newArticle = page.locator(`main a[href="${VIRTUAL_STAGING_EXPLAINER.path}"]`).first();
  await expect(newArticle).toBeVisible();
  await newArticle.click();
  await expect(page).toHaveURL(new RegExp(`${VIRTUAL_STAGING_EXPLAINER.path}$`));
  await page.getByRole("link", { name: "Back to Blog" }).click();
  const costArticle = page.locator('main a[href="/blog/virtual-staging-cost"]').first();
  await expect(costArticle).toBeVisible();
  await costArticle.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "How Much Does Virtual Staging Cost in 2026?",
  );
  await expect(page.locator("article")).toContainText("US$19 per image");
  await expect(page.locator("article").getByRole("link", {
    name: "Virtual staging", exact: true,
  })).toHaveAttribute("href", VIRTUAL_STAGING_EXPLAINER.path);
  await expect(page.getByAltText("Empty bedroom before PicchuSpot virtual staging")).toBeVisible();
  await expect(page.getByAltText(
    "Bedroom after PicchuSpot professional virtual staging with bed, nightstands, artwork and decor",
  )).toBeVisible();
  await guard.expectClean();
});

const BLOG_VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 1024, height: 900 },
  { width: 1440, height: 1000 },
] as const;

for (const viewport of BLOG_VIEWPORTS) {
  test(`virtual staging explainer keeps readable comparisons and tables at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(45000);
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      localStorage.setItem("picchuspot_cookie_consent", "rejected");
    });
    const guard = await installSmokeNetworkGuards(page, testInfo);
    const response = await page.goto(VIRTUAL_STAGING_EXPLAINER.path);
    expectNavigationResponseOk(response, VIRTUAL_STAGING_EXPLAINER.path);
    const article = page.locator("article");
    await expect(article.locator("img")).toHaveCount(4);

    for (const pair of [
      { name: "Office before and after virtual staging", room: "office" },
      { name: "Living room before and after virtual staging", room: "living-room" },
    ]) {
      const figure = page.getByRole("figure", { name: pair.name, exact: true });
      await figure.scrollIntoViewIfNeeded();
      await expect(figure).toBeVisible();
      await expect(figure.getByText(/^before$/i)).toBeVisible();
      await expect(figure.getByText(/^after$/i)).toBeVisible();
      const images = figure.locator("img");
      await expect(images).toHaveCount(2);
      for (const [index, version] of ["before", "after"].entries()) {
        const image = images.nth(index);
        await image.scrollIntoViewIfNeeded();
        await expect(image).toHaveAttribute("alt", /\S/);
        expect(decodeURIComponent(await image.getAttribute("src") ?? "")).toContain(
          `what-is-virtual-staging-${pair.room}-${version}.jpg`,
        );
        await expect.poll(() => image.evaluate((element: HTMLImageElement) =>
          element.complete && element.naturalWidth > 0,
        )).toBe(true);
        const ratios = await image.evaluate((element: HTMLImageElement) => {
          const bounds = element.getBoundingClientRect();
          return {
            natural: element.naturalWidth / element.naturalHeight,
            displayed: bounds.width / bounds.height,
          };
        });
        expect(ratios.natural).toBeCloseTo(1.5, 2);
        expect(ratios.displayed).toBeCloseTo(ratios.natural, 2);
      }
      const before = await images.nth(0).boundingBox();
      const after = await images.nth(1).boundingBox();
      expect(before).not.toBeNull();
      expect(after).not.toBeNull();
      if (viewport.width < 768) {
        expect(after!.y).toBeGreaterThanOrEqual(before!.y + before!.height);
      } else {
        expect(after!.x).toBeGreaterThanOrEqual(before!.x + before!.width);
        expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
      }
    }

    const realismDetails = page.getByRole("complementary", { name: "Realism details" });
    await expect(realismDetails).toBeVisible();
    for (const term of ["Perspective", "Scale", "Contact shadows", "Architecture preserved"]) {
      await expect(realismDetails.getByText(term, { exact: true })).toBeVisible();
    }
    const markers = page.locator("[data-realism-markers]");
    await expect(markers).toHaveCount(1);
    if (viewport.width < 768) {
      await expect(markers).toBeHidden();
    } else {
      await expect(markers).toBeVisible();
    }

    const tables = article.getByRole("table");
    await expect(tables).toHaveCount(4);
    for (const table of await tables.all()) {
      const region = table.locator("..");
      await expect(region).toHaveAttribute("role", "region");
      await expect(region).toHaveAttribute("aria-label", /\S/);
      await expect(region).toHaveAttribute("tabindex", "0");
      await region.focus();
      await expect(region).toBeFocused();
      const dimensions = await region.evaluate((element) => ({
        width: element.clientWidth,
        scrollWidth: element.scrollWidth,
        overflowX: getComputedStyle(element).overflowX,
      }));
      if (dimensions.scrollWidth > dimensions.width) {
        expect(["auto", "scroll"]).toContain(dimensions.overflowX);
        await region.press("ArrowRight");
        await expect.poll(() => region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
      }
    }

    const cta = article.getByRole("link", { name: "View Virtual Staging →", exact: true });
    await cta.scrollIntoViewIfNeeded();
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/pricing/virtual-staging");
    await cta.focus();
    await cta.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(cta).toBeFocused();
    for (const citation of await article.locator('a[target="_blank"]').all()) {
      await expect(citation).toHaveAttribute("href", /^https:\/\//);
      await expect(citation).toHaveAttribute("rel", /noopener/);
      await expect(citation).toHaveAttribute("rel", /noreferrer/);
    }

    const widths = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth);
    await guard.expectClean();
  });
}

test("home page loads without client or server smoke failures", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);

  const response = await page.goto("/");

  expectNavigationResponseOk(response, "/");
  await expect(
    page.getByRole("heading", {
      name: "Help Your Listings Stand Out and Sell Faster",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Order Online" }).first()).toBeVisible();
  const servicesAndPricing = page
    .getByRole("link", { name: "Services & Pricing" })
    .first();
  await expect(servicesAndPricing).toBeVisible();
  await expect(servicesAndPricing).toHaveAttribute("href", "/pricing");

  const bodyFontFamily = await page.locator("body").evaluate(
    (element) => getComputedStyle(element).fontFamily,
  );
  expect(bodyFontFamily).toContain("Geist");
  await guard.expectClean();
});

test("homepage hero keeps active-slide service context, regional pricing, and routes", async ({
  page,
}, testInfo) => {
  test.setTimeout(45000);
  const guard = await installSmokeNetworkGuards(page, testInfo);

  await page.setViewportSize({ width: 1440, height: 900 });
  let response = await page.goto("/");
  expectNavigationResponseOk(response, "/");

  const hero = page.getByRole("region", { name: "Before and after slider" });
  const heroFooter = hero.getByTestId("hero-service-footer");
  const heroStage = hero.getByTestId("homepage-hero-image-stage");
  const heroDots = heroStage.getByRole("tablist");
  await expect(heroStage.getByText("BEFORE", { exact: true })).toHaveCount(0);
  await expect(heroStage.getByText("AFTER", { exact: true })).toHaveCount(0);
  await expect(heroStage.getByRole("button")).toHaveCount(0);
  await expect(heroStage.getByTestId("hero-comparison-divider")).toBeVisible();
  await expect(heroFooter.getByText("BEFORE", { exact: true })).toBeVisible();
  await expect(heroFooter.getByText("AFTER", { exact: true })).toBeVisible();
  await expect(hero.getByRole("button", { name: "Previous slide" })).toHaveCount(0);
  await expect(hero.getByRole("button", { name: "Next slide" })).toHaveCount(0);
  await expect(heroDots).toBeVisible();
  await expect(heroDots.getByRole("tab")).toHaveCount(9);
  await expect(heroFooter.getByRole("tablist")).toHaveCount(0);
  await expect(heroFooter.getByRole("link")).toHaveCount(1);
  const imageEnhancementCta = hero.getByRole("link", {
    name: "View Image Enhancement pricing",
  });
  await expect(imageEnhancementCta).toContainText("Image Enhancement");
  await expect(imageEnhancementCta.locator("span").first()).toHaveCSS(
    "text-transform",
    "uppercase",
  );
  await expect(imageEnhancementCta).toContainText("From $1.20 / image");
  await expect(imageEnhancementCta).not.toContainText(".00");
  await expect(imageEnhancementCta.locator("svg")).toHaveCount(0);
  await expect(
    heroDots.getByRole("tab", { selected: true }).locator("span"),
  ).toHaveClass(/bg-\[#C7A94E\]/);
  await expect(
    heroDots.getByRole("tab", { selected: false }).first().locator("span"),
  ).toHaveClass(/bg-primary\/50/);

  const heroGeometry = await hero.evaluate((element) => {
    const frame = element.querySelector('[data-testid="homepage-hero-frame"]');
    const stage = element.querySelector('[data-testid="homepage-hero-image-stage"]');
    const footer = element.querySelector('[data-testid="hero-service-footer"]');
    const dots = element.querySelector('[data-testid="hero-slide-dots"]');
    const cta = footer?.querySelector("a");
    if (!frame || !stage || !footer || !dots || !cta) return null;
    const frameRect = frame.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const footerRect = footer.getBoundingClientRect();
    const dotsRect = dots.getBoundingClientRect();
    const ctaRect = cta.getBoundingClientRect();
    return {
      footerPosition: getComputedStyle(footer).position,
      footerHeight: footerRect.height,
      stageBottom: stageRect.bottom,
      footerTop: footerRect.top,
      frameBottom: frameRect.bottom,
      footerBottom: footerRect.bottom,
      dotsLeft: dotsRect.left - stageRect.left,
      stageCenterY: stageRect.top + stageRect.height / 2,
      dotsCenterY: dotsRect.top + dotsRect.height / 2,
      footerCenter: footerRect.left + footerRect.width / 2,
      ctaCenter: ctaRect.left + ctaRect.width / 2,
      footerColumns: getComputedStyle(footer).gridTemplateColumns
        .trim()
        .split(/\s+/).length,
      footerRows: getComputedStyle(footer).gridTemplateRows.trim().split(/\s+/).length,
    };
  });
  expect(heroGeometry).not.toBeNull();
  expect(heroGeometry?.footerPosition).not.toBe("absolute");
  expect(heroGeometry?.footerHeight).toBeGreaterThanOrEqual(56);
  expect(heroGeometry?.footerHeight).toBeLessThanOrEqual(58);
  expect(Math.abs((heroGeometry?.stageBottom ?? 0) - (heroGeometry?.footerTop ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((heroGeometry?.frameBottom ?? 0) - (heroGeometry?.footerBottom ?? 0))).toBeLessThanOrEqual(1);
  expect(heroGeometry?.dotsLeft).toBeGreaterThanOrEqual(19);
  expect(heroGeometry?.dotsLeft).toBeLessThanOrEqual(21);
  expect(Math.abs((heroGeometry?.stageCenterY ?? 0) - (heroGeometry?.dotsCenterY ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((heroGeometry?.footerCenter ?? 0) - (heroGeometry?.ctaCenter ?? 0))).toBeLessThanOrEqual(1);
  expect(heroGeometry?.footerColumns).toBe(3);
  expect(heroGeometry?.footerRows).toBe(1);

  const desktopHeroFontSizes = await hero.evaluate((element) => {
    const footer = element.querySelector('[data-testid="hero-service-footer"]');
    const labels = Array.from(footer?.querySelectorAll("span") ?? []).filter(
      (span) => span.textContent === "BEFORE" || span.textContent === "AFTER",
    );
    const serviceName = footer?.querySelector("a > span:first-child");
    const price = footer?.querySelector("a > span:last-child");
    return {
      labels: labels.map((label) => Number.parseFloat(getComputedStyle(label).fontSize)),
      serviceName: serviceName
        ? Number.parseFloat(getComputedStyle(serviceName).fontSize)
      : 0,
      serviceColor: serviceName ? getComputedStyle(serviceName).color : "",
      priceColor: price ? getComputedStyle(price).color : "",
    };
  });
  expect(Math.min(...desktopHeroFontSizes.labels)).toBeGreaterThanOrEqual(16);
  expect(Math.max(...desktopHeroFontSizes.labels)).toBeLessThanOrEqual(16);
  expect(desktopHeroFontSizes.serviceName).toBe(15);
  expect(desktopHeroFontSizes.serviceColor).toBe("rgb(199, 169, 78)");
  expect(desktopHeroFontSizes.priceColor).toBe("rgb(255, 255, 255)");

  await hero.hover();
  const marketSelector = page.getByRole("button", {
    name: "Select market, currency, and language",
  });
  await marketSelector.click();
  await page.getByRole("button", { name: /Europe — EUR/ }).click();
  await expect(imageEnhancementCta).toContainText("From €1 / image");

  await page.mouse.move(0, 0);
  const dayToDuskTab = heroDots.getByRole("tab", {
    name: "Show slide 2 of 9",
  });
  await expect(dayToDuskTab).toHaveAttribute("aria-selected", "true", {
    timeout: 7000,
  });

  const virtualStagingTab = heroDots.getByRole("tab", {
    name: "Show slide 3 of 9",
  });
  await virtualStagingTab.focus();
  await expect(virtualStagingTab).toBeFocused();
  await virtualStagingTab.press("Enter");
  await expect(virtualStagingTab).toHaveAttribute("aria-selected", "true");

  await dayToDuskTab.focus();
  await dayToDuskTab.press("Space");
  const dayToDuskCta = hero.getByRole("link", {
    name: "View Day to Dusk pricing",
  });
  await expect(dayToDuskCta).toBeVisible();
  await expect(hero.getByTestId("hero-service-footer").getByRole("link")).toHaveCount(
    1,
  );
  await dayToDuskCta.click();
  await expect(page).toHaveURL(/\/pricing\/day-to-dusk$/);

  await page.setViewportSize({ width: 390, height: 844 });
  response = await page.goto("/");
  expectNavigationResponseOk(response, "/");
  const mobileHero = page.getByRole("region", { name: "Before and after slider" });
  const mobileFooter = mobileHero.getByTestId("hero-service-footer");
  const mobileStage = mobileHero.getByTestId("homepage-hero-image-stage");
  const mobileDots = mobileStage.getByTestId("hero-slide-dots");
  await expect(mobileDots).toBeHidden();
  await expect(mobileFooter.getByRole("tab")).toHaveCount(0);
  await expect(mobileDots.locator('[role="tab"]')).toHaveCount(9);
  await expect(mobileStage.getByText("BEFORE", { exact: true })).toHaveCount(0);
  await expect(mobileStage.getByText("AFTER", { exact: true })).toHaveCount(0);
  await expect(mobileFooter.getByText("BEFORE", { exact: true })).toBeVisible();
  await expect(mobileFooter.getByText("AFTER", { exact: true })).toBeVisible();

  const stageBox = await mobileStage.boundingBox();
  expect(stageBox).not.toBeNull();
  for (let index = 1; index <= 3; index += 1) {
    await page.mouse.move(
      (stageBox?.x ?? 0) + (stageBox?.width ?? 0) * 0.75,
      (stageBox?.y ?? 0) + (stageBox?.height ?? 0) * 0.5,
    );
    await page.mouse.down();
    await page.mouse.move(
      (stageBox?.x ?? 0) + (stageBox?.width ?? 0) * 0.25,
      (stageBox?.y ?? 0) + (stageBox?.height ?? 0) * 0.5,
      { steps: 5 },
    );
    await page.mouse.up();
    await expect(
      mobileFooter.locator(
        `[role="tab"][aria-label="Show slide ${index + 1} of 9"]`,
      ),
    ).toHaveCount(0);
    await expect(
      mobileStage.locator(
        `[role="tab"][aria-label="Show slide ${index + 1} of 9"]`,
      ),
    ).toHaveAttribute("aria-selected", "true");
  }

  const itemRemovalCta = mobileHero.getByRole("link", {
    name: "View Item Removal & Virtual Cleaning pricing",
  });
  await expect(itemRemovalCta).toHaveAttribute(
    "href",
    "/pricing/item-removal-virtual-cleaning",
  );

  const mobileHeroFontSizes = await mobileHero.evaluate((element) => {
    const footer = element.querySelector('[data-testid="hero-service-footer"]');
    const labels = Array.from(footer?.querySelectorAll("span") ?? []).filter(
      (span) => span.textContent === "BEFORE" || span.textContent === "AFTER",
    );
    const serviceName = footer?.querySelector("a > span:first-child");
    const price = footer?.querySelector("a > span:last-child");
    const footerRect = footer?.getBoundingClientRect();
    const ctaRect = footer?.querySelector("a")?.getBoundingClientRect();
    return {
      labels: labels.map((label) => Number.parseFloat(getComputedStyle(label).fontSize)),
      serviceName: serviceName
        ? Number.parseFloat(getComputedStyle(serviceName).fontSize)
        : 0,
      serviceColor: serviceName ? getComputedStyle(serviceName).color : "",
      priceColor: price ? getComputedStyle(price).color : "",
      footerHeight: footerRect?.height ?? 0,
      footerColumns: footer
        ? getComputedStyle(footer).gridTemplateColumns.trim().split(/\s+/).length
        : 0,
      footerRows: footer
        ? getComputedStyle(footer).gridTemplateRows.trim().split(/\s+/).length
        : 0,
      centerDelta:
        footerRect && ctaRect
          ? Math.abs(
              footerRect.left + footerRect.width / 2 -
                (ctaRect.left + ctaRect.width / 2),
            )
          : Number.POSITIVE_INFINITY,
    };
  });
  expect(Math.min(...mobileHeroFontSizes.labels)).toBe(14);
  expect(mobileHeroFontSizes.serviceName).toBe(13);
  expect(mobileHeroFontSizes.serviceColor).toBe("rgb(199, 169, 78)");
  expect(mobileHeroFontSizes.priceColor).toBe("rgb(255, 255, 255)");
  expect(mobileHeroFontSizes.footerHeight).toBeGreaterThanOrEqual(60);
  expect(mobileHeroFontSizes.footerHeight).toBeLessThanOrEqual(64);
  expect(mobileHeroFontSizes.footerColumns).toBe(2);
  expect(mobileHeroFontSizes.footerRows).toBe(2);
  expect(mobileHeroFontSizes.centerDelta).toBeLessThanOrEqual(1);

  const pageWidth = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(pageWidth.scrollWidth).toBeLessThanOrEqual(pageWidth.clientWidth);

  await itemRemovalCta.click();
  await expect(page).toHaveURL(
    /\/pricing\/item-removal-virtual-cleaning$/,
  );

  await page.setViewportSize({ width: 768, height: 900 });
  response = await page.goto("/");
  expectNavigationResponseOk(response, "/");
  const unknownHero = page.getByRole("region", {
    name: "Before and after slider",
  });
  await unknownHero.getByRole("tab", { name: "Show slide 9 of 9" }).click();
  const unknownFooter = unknownHero.getByTestId("hero-service-footer");
  await expect(unknownFooter).toBeVisible();
  await expect(unknownFooter.getByText("BEFORE", { exact: true })).toBeVisible();
  await expect(unknownFooter.getByText("AFTER", { exact: true })).toBeVisible();
  await expect(unknownFooter.getByRole("tab")).toHaveCount(0);
  await expect(
    unknownHero.getByTestId("homepage-hero-image-stage").getByRole("tab"),
  ).toHaveCount(9);
  await expect(unknownFooter.getByRole("link")).toHaveCount(0);

  await guard.expectClean();
});

test.describe("homepage hero touch input", () => {
  test.use({ hasTouch: true });

  test("horizontal touch swipes change slides while vertical touch scroll and cancellation remain safe", async ({
    page,
  }, testInfo) => {
    test.setTimeout(45000);
    const guard = await installSmokeNetworkGuards(page, testInfo);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });

    const response = await page.goto("/");
    expectNavigationResponseOk(response, "/");

    const stage = page.getByTestId("homepage-hero-image-stage");
    const dots = stage.getByTestId("hero-slide-dots");
    await expect(stage).toHaveCSS("touch-action", "pan-y");
    await expect(dots).toBeHidden();

    const stageBox = await stage.boundingBox();
    expect(stageBox).not.toBeNull();
    if (!stageBox) throw new Error("Homepage hero stage has no bounding box.");

    const client = await page.context().newCDPSession(page);
    const dispatchTouch = async (
      type: "touchStart" | "touchMove" | "touchEnd" | "touchCancel",
      x?: number,
      y?: number,
    ) => {
      await client.send("Input.dispatchTouchEvent", {
        type,
        touchPoints:
          type === "touchEnd" || type === "touchCancel"
            ? []
            : [
                {
                  x: x ?? 0,
                  y: y ?? 0,
                  id: 1,
                  radiusX: 5,
                  radiusY: 5,
                  force: 1,
                },
              ],
      });
    };
    const swipe = async (
      fromX: number,
      fromY: number,
      toX: number,
      toY: number,
    ) => {
      await dispatchTouch("touchStart", fromX, fromY);
      for (let step = 1; step <= 5; step += 1) {
        await dispatchTouch(
          "touchMove",
          fromX + ((toX - fromX) * step) / 5,
          fromY + ((toY - fromY) * step) / 5,
        );
      }
      await dispatchTouch("touchEnd");
    };

    const leftX = stageBox.x + stageBox.width * 0.25;
    const rightX = stageBox.x + stageBox.width * 0.75;
    const centerY = stageBox.y + stageBox.height * 0.5;

    await swipe(rightX, centerY, leftX, centerY);
    await expect(
      dots.locator('[role="tab"][aria-label="Show slide 2 of 9"]'),
    ).toHaveAttribute("aria-selected", "true");

    await dispatchTouch("touchStart", rightX, centerY);
    await dispatchTouch("touchMove", rightX - 30, centerY);
    await dispatchTouch("touchCancel");
    await expect(
      dots.locator('[role="tab"][aria-label="Show slide 2 of 9"]'),
    ).toHaveAttribute("aria-selected", "true");

    await swipe(rightX, centerY, leftX, centerY);
    await expect(
      dots.locator('[role="tab"][aria-label="Show slide 3 of 9"]'),
    ).toHaveAttribute("aria-selected", "true");

    await swipe(leftX, centerY, rightX, centerY);
    await expect(
      dots.locator('[role="tab"][aria-label="Show slide 2 of 9"]'),
    ).toHaveAttribute("aria-selected", "true");

    await page.evaluate(() => window.scrollTo(0, 0));
    const verticalStartY = Math.min(
      stageBox.y + stageBox.height - 16,
      824,
    );
    const verticalEndY = Math.max(stageBox.y + 16, verticalStartY - 130);
    await swipe(rightX, verticalStartY, rightX, verticalEndY);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect(
      dots.locator('[role="tab"][aria-label="Show slide 2 of 9"]'),
    ).toHaveAttribute("aria-selected", "true");

    await client.detach();
    await guard.expectClean();
  });
});

test("ordinary service heroes share the mobile-hidden indicator breakpoint", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    const response = await page.goto("/pricing/virtual-staging");
    expectNavigationResponseOk(response, "/pricing/virtual-staging");

    const stage = page.getByTestId("service-hero-image-stage");
    const rail = stage.getByTestId("hero-slide-dots");
    await expect(stage).toHaveCSS("touch-action", "pan-y");
    await expect(
      page.getByRole("button", { name: "Previous slide" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Next slide" }),
    ).toHaveCount(0);

    if ((await rail.count()) > 0) {
      if (viewport.width >= 768) {
        await expect(rail).toBeVisible();
        await expect(rail.getByRole("tab").first()).toBeVisible();
      } else {
        await expect(rail).toBeHidden();
      }
    }

    const widths = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth);
  }

  await guard.expectClean();
});

test("360 heroes keep responsive panorama semantics and a truthful single fallback", async ({
  page,
}, testInfo) => {
  test.setTimeout(45000);
  const guard = await installSmokeNetworkGuards(page, testInfo);

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1440, height: 1000 },
    { width: 1980, height: 1100 },
  ]) {
    await page.setViewportSize(viewport);
    const route = "/pricing/360-virtual-staging";
    const response = await page.goto(route);
    expectNavigationResponseOk(response, route);

    const synced = page.locator(
      '[data-panorama-viewer="photo-sphere-viewer-synced-compare"]',
    );
    const single = page.locator('[data-panorama-viewer="photo-sphere-viewer"]');
    const viewer = (await synced.count()) > 0 ? synced : single;
    const footer = viewer.getByTestId("hero-service-footer");

    await expect(viewer).toBeVisible();
    await expect(viewer.getByTestId("hero-slide-dots")).toHaveCount(0);
    await expect(viewer).not.toHaveAttribute("aria-roledescription", "carousel");
    await expect(
      viewer.getByRole("button", { name: "Previous slide" }),
    ).toHaveCount(0);
    await expect(
      viewer.getByRole("button", { name: "Next slide" }),
    ).toHaveCount(0);

    if ((await synced.count()) > 0) {
      const strips = synced.getByTestId("panorama-mobile-label");
      await expect(strips).toHaveCount(2);
      const panes = synced.getByRole("img");
      await expect(panes).toHaveCount(2);

      if (viewport.width < 768) {
        await expect(strips.nth(0)).toBeVisible();
        await expect(strips.nth(1)).toBeVisible();
        await expect(footer.getByText("BEFORE", { exact: true })).toBeHidden();
        await expect(footer.getByText("AFTER", { exact: true })).toBeHidden();
      } else {
        await expect(strips.nth(0)).toBeHidden();
        await expect(strips.nth(1)).toBeHidden();
        await expect(footer.getByText("BEFORE", { exact: true })).toBeVisible();
        await expect(footer.getByText("AFTER", { exact: true })).toBeVisible();
      }

      const geometry = await synced.evaluate((element) => {
        const panes = Array.from(element.querySelectorAll('[role="img"]'));
        const paneRects = panes.map((pane) => pane.getBoundingClientRect());
        const footer = element
          .querySelector('[data-testid="hero-service-footer"]')
          ?.getBoundingClientRect();
        return {
          sameRow: Math.abs(paneRects[0].top - paneRects[1].top) <= 1,
          secondBelowFirst: paneRects[1].top >= paneRects[0].bottom,
          footerBelowPanes:
            Boolean(footer) &&
            footer!.top >= Math.max(paneRects[0].bottom, paneRects[1].bottom),
        };
      });
      expect(geometry.sameRow).toBe(viewport.width >= 768);
      expect(geometry.secondBelowFirst).toBe(viewport.width < 768);
      expect(geometry.footerBelowPanes).toBe(true);
    } else {
      await expect(single.getByTestId("panorama-mobile-label")).toHaveCount(0);
      await expect(footer.getByText("BEFORE", { exact: true })).toHaveCount(0);
      await expect(footer.getByText("AFTER", { exact: true })).toHaveCount(0);
    }

    const widths = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth);
  }

  await guard.expectClean();
});

test("Spanish homepage hero localizes its comparison labels and service route", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);

  const response = await page.goto("/es");
  expectNavigationResponseOk(response, "/es");

  const hero = page.getByRole("region", { name: "Before and after slider" });
  const stage = hero.getByTestId("homepage-hero-image-stage");
  const footer = hero.getByTestId("hero-service-footer");
  await expect(stage.getByText("ANTES", { exact: true })).toHaveCount(0);
  await expect(stage.getByText("DESPUÉS", { exact: true })).toHaveCount(0);
  await expect(footer.getByText("ANTES", { exact: true })).toBeVisible();
  await expect(footer.getByText("DESPUÉS", { exact: true })).toBeVisible();
  await expect(
    hero.getByRole("link", { name: "Ver precios de Mejora de imagen" }),
  ).toHaveAttribute("href", "/es/pricing/image-enhancement");
  await guard.expectClean();
});

test("site-level Organization JSON-LD uses the official canonical logo once", async ({
  request,
}) => {
  const schemasByPath = new Map<string, JsonLdObject[]>();

  for (const path of [
    "/",
    "/es",
    "/pricing",
    "/es/pricing",
    "/pricing/virtual-staging",
  ]) {
    const response = await request.get(path);
    expect(response.ok(), path).toBe(true);
    schemasByPath.set(path, parseJsonLdObjects(await response.text()));
  }

  const homepageSchemas = schemasByPath.get("/") ?? [];
  const organizations = homepageSchemas.filter(
    (schema) => schema["@type"] === "Organization",
  );
  expect(organizations).toHaveLength(1);

  const organization = organizations[0];
  expect(organization.name).toBe("PicchuSpot");
  expect(organization.url).toBe("https://picchuspot.com");
  expect(organization.address).toEqual({
    "@type": "PostalAddress",
    streetAddress: "C. Capitán Dema, 3",
    postalCode: "03007",
    addressLocality: "Alicante",
    addressCountry: "ES",
  });
  expect(organization.telephone).toBe("+34 614 714 337");
  expect(organization.contactPoint).toEqual({
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "hello@picchuspot.com",
  });
  const legalResponse = await request.get("/legal");
  expect(legalResponse.status()).toBe(200);
  const legalHtml = await legalResponse.text();
  for (const fact of ["C. Capitán Dema, 3", "03007 Alicante", "Spain", String(organization.telephone)]) {
    expect(legalHtml).toContain(fact);
  }
  expect(Object.keys(organization).filter((key) => key === "logo")).toHaveLength(1);

  const logo = organization.logo as JsonLdObject;
  expect(logo).toEqual({
    "@type": "ImageObject",
    url: "https://picchuspot.com/brand/picchuspot-logo-800.png",
    contentUrl: "https://picchuspot.com/brand/picchuspot-logo-800.png",
    width: 800,
    height: 600,
    caption: "PicchuSpot",
  });

  const logoUrl = new URL(String(logo.url));
  expect(logoUrl.protocol).toBe("https:");
  expect(logoUrl.hostname).toBe("picchuspot.com");
  expect(logoUrl.hostname.startsWith("www.")).toBe(false);

  const logoResponse = await request.get(logoUrl.pathname);
  expect(logoResponse.status()).toBe(200);
  expect(logoResponse.headers()["content-type"]).toContain("image/png");
  const logoBytes = await logoResponse.body();
  expect(logoBytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  expect(logoBytes.readUInt32BE(16)).toBe(800);
  expect(logoBytes.readUInt32BE(20)).toBe(600);

  for (const path of ["/es", "/pricing", "/es/pricing", "/pricing/virtual-staging"]) {
    const siteLevelOrganizations = (schemasByPath.get(path) ?? []).filter(
      (schema) => schema["@type"] === "Organization",
    );
    expect(siteLevelOrganizations, path).toHaveLength(0);
  }

  const serviceSchemas = schemasByPath.get("/pricing/virtual-staging") ?? [];
  expect(serviceSchemas.some((schema) => schema["@type"] === "Service")).toBe(true);
  expect(
    serviceSchemas.some((schema) => schema["@type"] === "BreadcrumbList"),
  ).toBe(true);
});

test("homepage, footer, and language switch use canonical pricing routes", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem("picchuspot_cookie_consent", "rejected");
  });
  const guard = await installSmokeNetworkGuards(page, testInfo);

  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Services & Pricing" }).first(),
  ).toHaveAttribute("href", "/pricing");

  const englishFooter = page.locator("footer");
  for (const [label, href] of [
    ["Virtual Staging", "/pricing/virtual-staging"],
    ["Virtual Renovation", "/pricing/virtual-renovation"],
    ["3D Floor Plans", "/pricing/floor-plans"],
    ["Photo Editing", "/pricing/photo-editing"],
    ["Photography", "/local#real-estate-photography"],
  ] as const) {
    await expect(
      englishFooter.getByRole("link", { name: label, exact: true }),
    ).toHaveAttribute("href", href);
  }
  const englishFooterHrefs = await englishFooter.locator("a").evaluateAll((links) =>
    links.map((link) => link.getAttribute("href") ?? ""),
  );

  await page.goto("/es");
  await expect(
    page.getByRole("link", { name: "Servicios y precios" }).first(),
  ).toHaveAttribute("href", "/es/pricing");

  const spanishFooter = page.locator("footer");
  for (const [label, href] of [
    ["Virtual Staging", "/es/pricing/virtual-staging"],
    ["Renovación virtual", "/es/pricing/virtual-renovation"],
    ["Planos 3D", "/es/pricing/floor-plans"],
    ["Edición fotográfica", "/es/pricing/photo-editing"],
    ["Fotografía", "/es/pricing"],
  ] as const) {
    await expect(
      spanishFooter.getByRole("link", { name: label, exact: true }),
    ).toHaveAttribute("href", href);
  }
  const spanishFooterHrefs = await spanishFooter.locator("a").evaluateAll((links) =>
    links.map((link) => link.getAttribute("href") ?? ""),
  );

  for (const hrefs of [englishFooterHrefs, spanishFooterHrefs]) {
    expect(hrefs.some((href) => /^\/es\/services(?:#|$)/.test(href))).toBe(false);
    expect(hrefs.some((href) => /^\/services(?:#|$)/.test(href))).toBe(false);
  }

  await page.goto("/pricing");
  await page
    .getByRole("button", { name: "Select market, currency, and language" })
    .click();
  await expect(page.getByRole("link", { name: "Spanish", exact: true })).toHaveAttribute(
    "href",
    "/es/pricing",
  );

  await page.goto("/es/pricing");
  await page
    .getByRole("button", { name: "Seleccionar mercado, moneda e idioma" })
    .click();
  await expect(page.getByRole("link", { name: "Inglés", exact: true })).toHaveAttribute(
    "href",
    "/pricing",
  );
  await guard.expectClean();
});

const HOMEPAGE_VIEWPORTS = [
  { width: 360, height: 800, expectedBenefitColumns: 1 },
  { width: 390, height: 844, expectedBenefitColumns: 1 },
  { width: 768, height: 900, expectedBenefitColumns: 3 },
  { width: 960, height: 900, expectedBenefitColumns: 3 },
  { width: 1024, height: 900, expectedBenefitColumns: 6 },
  { width: 1180, height: 900, expectedBenefitColumns: 6 },
  { width: 1280, height: 900, expectedBenefitColumns: 6 },
  { width: 1440, height: 1000, expectedBenefitColumns: 6 },
  { width: 1980, height: 1100, expectedBenefitColumns: 6 },
  { width: 3840, height: 1200, expectedBenefitColumns: 6 },
] as const;

test("homepage keeps its compact Welcome Offer benefits responsive and ordered", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  const guard = await installSmokeNetworkGuards(page, testInfo);

  for (const viewport of HOMEPAGE_VIEWPORTS) {
    await page.setViewportSize(viewport);
    const response = await page.goto("/");

    expectNavigationResponseOk(response, "/");
    await expect(
      page.getByRole("heading", {
        name: "Real Estate Photo Editing, Virtual Staging & Floor Plans",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Welcome Offer", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Why work with PicchuSpot", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Built for listings - not generic photo work.", {
        exact: true,
      }),
    ).toHaveCount(0);

    const responsiveHero = page.getByRole("region", {
      name: "Before and after slider",
    });
    const responsiveStage = responsiveHero.getByTestId(
      "homepage-hero-image-stage",
    );
    const responsiveFooter = responsiveHero.getByTestId("hero-service-footer");
    const responsiveDots = responsiveStage.getByTestId("hero-slide-dots");
    await expect(responsiveHero.getByRole("button", { name: "Previous slide" })).toHaveCount(0);
    await expect(responsiveHero.getByRole("button", { name: "Next slide" })).toHaveCount(0);
    await expect(responsiveStage.getByRole("button")).toHaveCount(0);
    await expect(responsiveStage.getByText("BEFORE", { exact: true })).toHaveCount(0);
    await expect(responsiveStage.getByText("AFTER", { exact: true })).toHaveCount(0);
    await expect(responsiveStage.getByTestId("hero-comparison-divider")).toBeVisible();
    await expect(responsiveFooter.getByText("BEFORE", { exact: true })).toBeVisible();
    await expect(responsiveFooter.getByText("AFTER", { exact: true })).toBeVisible();
    if (viewport.width >= 768) {
      await expect(responsiveDots).toBeVisible();
      await expect(responsiveDots.getByRole("tab")).toHaveCount(9);
    } else {
      await expect(responsiveDots).toBeHidden();
      await expect(responsiveDots.locator('[role="tab"]')).toHaveCount(9);
    }
    await expect(responsiveFooter.getByRole("tablist")).toHaveCount(0);

    const responsiveHeroGeometry = await responsiveHero.evaluate((element) => {
      const stage = element.querySelector('[data-testid="homepage-hero-image-stage"]');
      const footer = element.querySelector('[data-testid="hero-service-footer"]');
      const dots = element.querySelector('[data-testid="hero-slide-dots"]');
      const cta = footer?.querySelector("a");
      const activeDot = dots?.querySelector('[role="tab"][aria-selected="true"]');
      const inactiveDot = dots?.querySelector('[role="tab"][aria-selected="false"]');
      const activeVisual = activeDot?.querySelector("span");
      const inactiveVisual = inactiveDot?.querySelector("span");
      const labels = Array.from(footer?.querySelectorAll("span") ?? []).filter(
        (span) => span.textContent === "BEFORE" || span.textContent === "AFTER",
      );
      const serviceName = footer?.querySelector("a > span:first-child");
      const price = footer?.querySelector("a > span:last-child");
      if (
        !stage ||
        !footer ||
        !dots ||
        !cta ||
        !activeDot ||
        !inactiveDot ||
        !activeVisual ||
        !inactiveVisual
      ) {
        return null;
      }
      const stageRect = stage.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      const dotsRect = dots.getBoundingClientRect();
      const ctaRect = cta.getBoundingClientRect();
      const activeDotRect = activeDot.getBoundingClientRect();
      const inactiveDotRect = inactiveDot.getBoundingClientRect();
      const activeVisualRect = activeVisual.getBoundingClientRect();
      const inactiveVisualRect = inactiveVisual.getBoundingClientRect();
      const targetRects = Array.from(dots.querySelectorAll('[role="tab"]')).map(
        (target) => target.getBoundingClientRect(),
      );
      return {
        dotsDisplay: getComputedStyle(dots).display,
        footerHeight: footerRect.height,
        footerBackground: getComputedStyle(footer).backgroundColor,
        footerColumns: getComputedStyle(footer).gridTemplateColumns
          .trim()
          .split(/\s+/).length,
        footerRows: getComputedStyle(footer).gridTemplateRows
          .trim()
          .split(/\s+/).length,
        footerCenter: footerRect.left + footerRect.width / 2,
        ctaCenter: ctaRect.left + ctaRect.width / 2,
        dotsLeft: dotsRect.left - stageRect.left,
        dotsHeight: dotsRect.height,
        stageHeight: stageRect.height,
        stageCenterY: stageRect.top + stageRect.height / 2,
        dotsCenterY: dotsRect.top + dotsRect.height / 2,
        minimumTargetGap: Math.min(
          ...targetRects.slice(1).map((rect, index) =>
            rect.top - targetRects[index].bottom,
          ),
        ),
        activeTarget: {
          width: activeDotRect.width,
          height: activeDotRect.height,
        },
        inactiveTarget: {
          width: inactiveDotRect.width,
          height: inactiveDotRect.height,
        },
        activeVisual: {
          width: activeVisualRect.width,
          height: activeVisualRect.height,
          background: getComputedStyle(activeVisual).backgroundColor,
          borderRadius: Number.parseFloat(
            getComputedStyle(activeVisual).borderRadius,
          ),
        },
        inactiveVisual: {
          width: inactiveVisualRect.width,
          height: inactiveVisualRect.height,
          className: inactiveVisual.className,
          borderRadius: Number.parseFloat(
            getComputedStyle(inactiveVisual).borderRadius,
          ),
        },
        labelSizes: labels.map((label) =>
          Number.parseFloat(getComputedStyle(label).fontSize),
        ),
        serviceSize: serviceName
          ? Number.parseFloat(getComputedStyle(serviceName).fontSize)
          : 0,
        serviceColor: serviceName ? getComputedStyle(serviceName).color : "",
        priceColor: price ? getComputedStyle(price).color : "",
      };
    });
    expect(responsiveHeroGeometry).not.toBeNull();
    const expectedFooterHeight = viewport.width >= 768 ? 56 : 60;
    expect(responsiveHeroGeometry?.footerHeight).toBeGreaterThanOrEqual(
      expectedFooterHeight,
    );
    expect(responsiveHeroGeometry?.footerHeight).toBeLessThanOrEqual(
      expectedFooterHeight + 4,
    );
    expect(responsiveHeroGeometry?.footerBackground).toBe("rgb(7, 26, 43)");
    expect(responsiveHeroGeometry?.footerColumns).toBe(
      viewport.width >= 768 ? 3 : 2,
    );
    expect(responsiveHeroGeometry?.footerRows).toBe(
      viewport.width >= 768 ? 1 : 2,
    );
    expect(
      Math.abs(
        (responsiveHeroGeometry?.footerCenter ?? 0) -
          (responsiveHeroGeometry?.ctaCenter ?? 0),
      ),
    ).toBeLessThanOrEqual(1);
    expect(responsiveHeroGeometry?.dotsDisplay).toBe(
      viewport.width >= 768 ? "flex" : "none",
    );
    if (viewport.width >= 768) {
      const expectedDotsLeft = viewport.width >= 1024 ? 20 : 16;
      expect(responsiveHeroGeometry?.dotsLeft).toBe(expectedDotsLeft);
      expect(responsiveHeroGeometry?.dotsHeight).toBeLessThanOrEqual(
        responsiveHeroGeometry?.stageHeight ?? 0,
      );
      expect(
        Math.abs(
          (responsiveHeroGeometry?.stageCenterY ?? 0) -
            (responsiveHeroGeometry?.dotsCenterY ?? 0),
        ),
      ).toBeLessThanOrEqual(1);
      const expectedTargetHeight = viewport.width >= 1280 ? 32 : 26;
      expect(responsiveHeroGeometry?.activeTarget).toEqual({
        width: 32,
        height: expectedTargetHeight,
      });
      expect(responsiveHeroGeometry?.inactiveTarget).toEqual({
        width: 32,
        height: expectedTargetHeight,
      });
      expect(responsiveHeroGeometry?.minimumTargetGap).toBeGreaterThanOrEqual(0);
      expect(responsiveHeroGeometry?.activeVisual).toMatchObject({
        width: 12,
        height: 12,
        background: "rgb(199, 169, 78)",
      });
      expect(responsiveHeroGeometry?.activeVisual.borderRadius).toBeGreaterThanOrEqual(6);
      expect(responsiveHeroGeometry?.inactiveVisual).toMatchObject({
        width: 10,
        height: 10,
      });
      expect(responsiveHeroGeometry?.inactiveVisual.className).toContain(
        "bg-primary/50",
      );
      expect(responsiveHeroGeometry?.inactiveVisual.borderRadius).toBeGreaterThanOrEqual(5);
    } else {
      expect(responsiveHeroGeometry?.dotsHeight).toBe(0);
      expect(responsiveHeroGeometry?.activeTarget).toEqual({ width: 0, height: 0 });
      expect(responsiveHeroGeometry?.inactiveTarget).toEqual({ width: 0, height: 0 });
    }
    const expectedLabelSize = viewport.width >= 768 ? 16 : 14;
    const expectedServiceSize = viewport.width >= 1536 ? 16 : viewport.width >= 768 ? 15 : 13;
    expect(responsiveHeroGeometry?.labelSizes).toEqual([
      expectedLabelSize,
      expectedLabelSize,
    ]);
    expect(responsiveHeroGeometry?.serviceSize).toBe(expectedServiceSize);
    expect(responsiveHeroGeometry?.serviceColor).toBe("rgb(199, 169, 78)");
    expect(responsiveHeroGeometry?.priceColor).toBe("rgb(255, 255, 255)");

    const benefitGrid = page.getByTestId("benefits-grid");
    const columnCount = await benefitGrid.evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length,
    );
    expect(columnCount).toBe(viewport.expectedBenefitColumns);

    const benefitFontSizes = await benefitGrid.evaluate((element) => {
      const firstCard = element.firstElementChild;
      const title = firstCard?.querySelector("h2");
      const body = firstCard?.querySelector("p");
      return {
        title: title ? Number.parseFloat(getComputedStyle(title).fontSize) : 0,
        body: body ? Number.parseFloat(getComputedStyle(body).fontSize) : 0,
      };
    });
    const minimumBenefitTitle =
      viewport.width >= 1280 ? 18 : viewport.width >= 1024 ? 16 : 15;
    const minimumBenefitBody =
      viewport.width >= 1280 ? 16 : viewport.width >= 1024 ? 15 : 14;
    expect(benefitFontSizes.title).toBeGreaterThanOrEqual(minimumBenefitTitle);
    expect(benefitFontSizes.body).toBeGreaterThanOrEqual(minimumBenefitBody);

    if (viewport.width >= 1024) {
      const publicSubnav = page.locator(
        'nav[aria-label="Remote Digital Services services"]',
      );
      const firstSubnavLink = publicSubnav.getByRole("link").first();
      await expect(firstSubnavLink).toBeVisible();
      const subnavFontSize = await firstSubnavLink.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      );
      const minimumSubnavSize = viewport.width >= 1280 ? 15 : 14;
      expect(subnavFontSize).toBeGreaterThanOrEqual(minimumSubnavSize);

      const sectionHeadingSizes = await page
        .locator("main h2")
        .evaluateAll((elements) =>
          elements.map((element) =>
            Number.parseFloat(getComputedStyle(element).fontSize),
          ),
        );
      expect(Math.max(...sectionHeadingSizes)).toBeLessThanOrEqual(36);
    }

    const pageWidth = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scrollWidth).toBeLessThanOrEqual(pageWidth.clientWidth);
  }

  await guard.expectClean();
});

const SIGNUP_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 1024, height: 900 },
  { width: 1440, height: 1000 },
  { width: 1980, height: 1100 },
  { width: 3840, height: 1200 },
] as const;

test("signup uses public chrome and keeps its Welcome Offer compact across viewports", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);

  for (const viewport of SIGNUP_VIEWPORTS) {
    await page.setViewportSize(viewport);
    const response = await page.goto("/signup");
    expectNavigationResponseOk(response, "/signup");

    const header = page.getByRole("banner");
    await expect(header).toBeVisible();
    await expect(page.getByTestId("public-header-primary-row")).toHaveClass(
      /bg-primary/,
    );
    await expect(
      header.getByRole("link", { name: "Login", exact: true }),
    ).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Create your account", exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: "Welcome Offer", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("1 Image Enhancement free", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("1 Day to Dusk free", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("50% off your first Virtual Staging image", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Full name")).toBeVisible();
    await expect(page.getByText("Back to website", { exact: true })).toHaveCount(0);
    await expect(
      page.getByText("Each benefit can be used once per account.", {
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByTestId("signup-welcome-offer"),
    ).toHaveClass(/bg-primary/);

    if (viewport.width >= 1024) {
      await expect(
        page.locator('nav[aria-label="Remote Digital Services services"]'),
      ).toBeVisible();
    }

    const pageWidth = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scrollWidth).toBeLessThanOrEqual(pageWidth.clientWidth);
  }

  const response = await page.goto("/es/signup");
  expectNavigationResponseOk(response, "/es/signup");
  const spanishHeader = page.getByRole("banner");
  await expect(spanishHeader).toBeVisible();
  await expect(page.getByTestId("public-header-primary-row")).toHaveClass(
    /bg-primary/,
  );
  await expect(
    spanishHeader.getByRole("link", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();
  const spanishFooter = page.locator("footer");
  await expect(spanishFooter).toBeVisible();
  await expect(
    spanishFooter.getByRole("link", { name: "Aviso legal", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Oferta de bienvenida", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("1 mejora de imagen gratis", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Nombre completo")).toBeVisible();
  await expect(page.getByText("Volver al sitio", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("Cada ventaja puede utilizarse una sola vez por cuenta.", {
      exact: true,
    }),
  ).toHaveCount(0);
  await guard.expectClean();
});

const publicRoutes = [
  {
    route: "/pricing",
    heading: "Pricing",
  },
  {
    route: "/pricing/virtual-staging",
    heading: "Virtual Staging Pricing",
  },
  {
    route: "/pricing/image-enhancement",
    heading: "Image Enhancement Pricing",
  },
  {
    route: "/es/pricing",
    heading: "Precios claros, sin suscripciones",
  },
] as const;

for (const locale of ["en", "es"] as const) {
  for (const [market, staging, enhancement] of [
    ["US", "$19.00", "$1.20"], ["EU", "€16.00", "€1.00"], ["CA", "CA$26.00", "CA$1.65"],
  ] as const) {
    test(`v5 pricing catalogue displays ${market} prices and canonical SEO in ${locale}`, async ({ page }, testInfo) => {
      test.setTimeout(90000);
      const guard = await installSmokeNetworkGuards(page, testInfo);
      await page.addInitScript((region) => {
        localStorage.setItem("picchuspot-region", region);
        localStorage.setItem("picchuspot_cookie_consent", "rejected");
      }, market);
      const prefix = locale === "es" ? "/es" : "";
      for (const [service, price, seoPrice] of [
        ["virtual-staging", staging, "19.00"], ["image-enhancement", enhancement, "1.20"],
      ]) {
        const response = await page.goto(`${prefix}/pricing/${service}`);
        expectNavigationResponseOk(response, service);
        const offers = parseJsonLdObjects(await page.content())
          .filter((schema) => schema["@type"] === "Service").map((schema) => schema.offers);
        expect(offers).toContainEqual(expect.objectContaining({ price: seoPrice, priceCurrency: "USD" }));
        for (const width of [360, 390, 768, 1024, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          await expect(page.locator("main")).toContainText(price);
          const oldHeadline = `${locale === "es" ? "Desde" : "From"} ${service === "virtual-staging" ? "$15.00" : "$1.00"} / ${locale === "es" ? "imagen" : "image"}`;
          await expect(page.getByText(oldHeadline, { exact: true })).toHaveCount(0);
          const dimensions = await page.evaluate(() => ({
            content: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth,
          }));
          expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
        }
      }
      await page.goto(`${prefix}/pricing`);
      await expect(page.locator("main")).toContainText(staging);
      await expect(page.locator("main")).toContainText(enhancement);
      await guard.expectNoPageErrorsOrServerErrors();
      await guard.expectNoForbiddenApiCalls();
    });
  }
}

test("photo editing landing pages publish the correct service, metadata and alternates", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);

  let response = await page.goto("/pricing/photo-editing");
  expectNavigationResponseOk(response, "/pricing/photo-editing");
  await expect(
    page.getByRole("heading", {
      name: "Professional Real Estate Photo Editing",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page).toHaveTitle(
    "Real Estate Photo Editing Services | PicchuSpot",
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /Professional real estate photo editing/,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://picchuspot.com/pricing/photo-editing",
  );

  for (const [language, href] of [
    ["en", "https://picchuspot.com/pricing/photo-editing"],
    ["en-US", "https://picchuspot.com/pricing/photo-editing"],
    ["es", "https://picchuspot.com/es/pricing/photo-editing"],
    ["es-ES", "https://picchuspot.com/es/pricing/photo-editing"],
    ["x-default", "https://picchuspot.com/pricing/photo-editing"],
  ] as const) {
    await expect(
      page.locator(`link[rel="alternate"][hreflang="${language}"]`),
    ).toHaveAttribute("href", href);
  }

  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({
      content: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  }

  response = await page.goto("/es/pricing/photo-editing");
  expectNavigationResponseOk(response, "/es/pricing/photo-editing");
  await expect(
    page.getByRole("heading", {
      name: "Edición profesional de fotos inmobiliarias",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://picchuspot.com/es/pricing/photo-editing",
  );
  await expect(
    page.locator('link[rel="alternate"][hreflang="en"]'),
  ).toHaveAttribute("href", "https://picchuspot.com/pricing/photo-editing");

  response = await page.goto("/pricing/item-removal-virtual-cleaning");
  expectNavigationResponseOk(
    response,
    "/pricing/item-removal-virtual-cleaning",
  );
  await expect(
    page.getByRole("heading", {
      name: "Item Removal & Virtual Cleaning Pricing",
      exact: true,
    }),
  ).toBeVisible();

  await guard.expectClean();
});

test("public navigation and shared CTAs bypass legacy order URLs", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);

  for (const route of ["/", "/pricing", "/gallery", "/es", "/es/pricing"]) {
    const response = await page.goto(route);
    expectNavigationResponseOk(response, route);
    await expect(page.locator('a[href^="/order"]')).toHaveCount(0);
  }

  await guard.expectClean();
});

test("legacy Services routes permanently redirect to Pricing", async ({ request }) => {
  for (const [source, destination] of [
    ["/services", "/pricing"],
    ["/es/services", "/es/pricing"],
  ] as const) {
    const response = await request.get(source, { maxRedirects: 0 });
    expect(response.status(), source).toBe(308);
    const location = response.headers().location;
    expect(location, source).toBeTruthy();
    expect(new URL(location!, "http://localhost").pathname).toBe(destination);
  }
});

test("legacy order routes remain permanent redirects", async ({ request }) => {
  for (const [source, destination] of [
    ["/order", "/dashboard/orders/new"],
    ["/order/3d-floor-plans", "/dashboard/orders/new/3d-floor-plans"],
    ["/order/virtual-staging", "/dashboard/orders/new/virtual-staging"],
    ["/order/virtual-renovation", "/dashboard/orders/new/virtual-renovation"],
    ["/order/photo-editing", "/dashboard/orders/new/photo-editing"],
    ["/order/day-to-dusk", "/dashboard/orders/new/day-to-dusk"],
    ["/order/image-enhancement", "/dashboard/orders/new/image-enhancement"],
    [
      "/order/item-removal-virtual-cleaning",
      "/dashboard/orders/new/item-removal-virtual-cleaning",
    ],
  ] as const) {
    const response = await request.get(source, { maxRedirects: 0 });
    expect(response.status(), source).toBe(308);
    const location = response.headers().location;
    expect(location, source).toBeTruthy();
    expect(new URL(location!, "http://localhost").pathname).toBe(destination);
  }
});

test("sitemap exposes canonical Pricing routes without legacy Services URLs", async ({
  request,
}) => {
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBe(true);
  const xml = await response.text();

  expect(xml).toContain("<loc>https://picchuspot.com/pricing</loc>");
  expect(xml).toContain("<loc>https://picchuspot.com/es/pricing</loc>");
  expect(xml).toContain(
    "<loc>https://picchuspot.com/pricing/photo-editing</loc>",
  );
  expect(xml).toContain(
    "<loc>https://picchuspot.com/es/pricing/photo-editing</loc>",
  );
  expect(xml).toContain(
    "<loc>https://picchuspot.com/pricing/item-removal-virtual-cleaning</loc>",
  );
  expect(xml).toContain(
    "<loc>https://picchuspot.com/es/pricing/item-removal-virtual-cleaning</loc>",
  );
  expect(xml).not.toContain("<loc>https://picchuspot.com/services</loc>");
  expect(xml).not.toContain("<loc>https://picchuspot.com/es/services</loc>");
});

for (const { route, heading } of publicRoutes) {
  test(`public route ${route} renders expected content`, async ({
    page,
  }, testInfo) => {
    const guard = await installSmokeNetworkGuards(page, testInfo);

    const response = await page.goto(route);

    expectNavigationResponseOk(response, route);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await guard.expectNoPageErrorsOrServerErrors();
  });
}

const faqRoutes = [
  {
    route: "/faq",
    heading: "Answers before you order",
    question: "Do you offer volume discounts?",
    taxCopy:
      "For eligible fixed-price online orders, the amount shown in Stripe Checkout is tax-inclusive where applicable, and Stripe identifies the included tax. Custom quotes or manually invoiced services may state their own tax treatment.",
    oldTaxCopy: "Prices exclude applicable taxes.",
  },
  {
    route: "/es/faq",
    heading: "Respuestas antes de pedir",
    question: "¿Ofrecéis descuentos por volumen?",
    taxCopy:
      "Para los pedidos online elegibles con precio fijo, el importe que muestra Stripe Checkout incluye los impuestos cuando corresponda, y Stripe identifica el impuesto incluido. Los presupuestos personalizados o los servicios facturados manualmente pueden indicar su propio tratamiento fiscal.",
    oldTaxCopy: "Los precios no incluyen los impuestos aplicables.",
  },
] as const;

for (const { route, heading, question, taxCopy, oldTaxCopy } of faqRoutes) {
  test(`FAQ route ${route} explains Checkout tax treatment`, async ({
    page,
  }, testInfo) => {
    const guard = await installSmokeNetworkGuards(page, testInfo);

    const response = await page.goto(route);

    expectNavigationResponseOk(response, route);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();

    const volumeDiscountAnswer = page
      .getByRole("heading", { name: question, exact: true })
      .locator("..");
    await expect(volumeDiscountAnswer).toContainText(taxCopy);
    await expect(volumeDiscountAnswer).not.toContainText(oldTaxCopy);
    await guard.expectClean();
  });
}

const pricingTaxRoutes = [
  {
    route: "/pricing",
    taxCopy:
      "For eligible fixed-price online orders, the Checkout total is tax-inclusive where applicable, and Stripe identifies any included tax. Custom quotes or manually invoiced services may state their own tax treatment.",
    oldTaxCopy: "Prices exclude applicable taxes.",
  },
  {
    route: "/pricing/image-enhancement",
    taxCopy:
      "For eligible fixed-price online orders, the Checkout total is tax-inclusive where applicable, and Stripe identifies any included tax. Custom quotes or manually invoiced services may state their own tax treatment.",
    oldTaxCopy: "Prices exclude applicable taxes.",
  },
  {
    route: "/es/pricing",
    taxCopy:
      "Para los pedidos online elegibles con precio fijo, el total mostrado en Checkout incluye los impuestos cuando corresponda, y Stripe identifica cualquier impuesto incluido. Los presupuestos personalizados o los servicios facturados manualmente pueden indicar su propio tratamiento fiscal.",
    oldTaxCopy: "Los precios no incluyen los impuestos aplicables.",
  },
  {
    route: "/es/pricing/image-enhancement",
    taxCopy:
      "Para los pedidos online elegibles con precio fijo, el total mostrado en Checkout incluye los impuestos cuando corresponda, y Stripe identifica cualquier impuesto incluido. Los presupuestos personalizados o los servicios facturados manualmente pueden indicar su propio tratamiento fiscal.",
    oldTaxCopy: "Los precios no incluyen los impuestos aplicables.",
  },
] as const;

for (const { route, taxCopy, oldTaxCopy } of pricingTaxRoutes) {
  test(`pricing route ${route} explains Checkout tax treatment`, async ({
    page,
  }, testInfo) => {
    const guard = await installSmokeNetworkGuards(page, testInfo);

    const response = await page.goto(route);

    expectNavigationResponseOk(response, route);
    await expect(page.getByText(taxCopy, { exact: false }).first()).toBeVisible();
    await expect(page.getByText(oldTaxCopy, { exact: false })).toHaveCount(0);
    await guard.expectClean();
  });
}

const legalRoutes = [
  { route: "/legal", heading: "Legal Notice" },
  { route: "/terms", heading: "Terms & Conditions" },
  { route: "/privacy", heading: "Privacy Policy" },
  { route: "/cookies", heading: "Cookie Policy" },
  { route: "/refunds", heading: "Refunds & Cancellations" },
  { route: "/es/legal", heading: "Aviso legal" },
  { route: "/es/terms", heading: "Términos y condiciones" },
  { route: "/es/privacy", heading: "Política de privacidad" },
  { route: "/es/cookies", heading: "Política de cookies" },
  { route: "/es/refunds", heading: "Reembolsos y cancelaciones" },
] as const;

for (const { route, heading } of legalRoutes) {
  test("legal route " + route + " renders versioned content", async ({
    page,
  }, testInfo) => {
    const guard = await installSmokeNetworkGuards(page, testInfo);

    const response = await page.goto(route);

    expectNavigationResponseOk(response, route);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await expect(page.getByText("2026-08-30", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("navigation", {
        name: route.startsWith("/es/") ? "En esta página" : "On this page",
      }),
    ).toBeVisible();
    await guard.expectClean();
  });
}

test("Legal Notice publishes the confirmed bilingual operator identity and metadata", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem("picchuspot_cookie_consent", "rejected");
  });
  const guard = await installSmokeNetworkGuards(page, testInfo);

  await page.goto("/legal");
  await expect(page.getByRole("heading", { name: "Legal Notice" })).toBeVisible();
  await expect(page.locator("main")).toContainText("Mykhailo Lykin");
  await expect(page.locator("main")).toContainText("Y9650008G");
  await expect(page.locator("main")).toContainText("C. Capitán Dema, 3");
  await expect(page.locator("main")).toContainText("trading name");
  await expect(
    page.getByRole("link", { name: "+34 614 714 337" }).first(),
  ).toHaveAttribute("href", "tel:+34614714337");
  await expect(
    page.getByRole("link", { name: "hello@picchuspot.com" }).first(),
  ).toHaveAttribute("href", "mailto:hello@picchuspot.com");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://picchuspot.com/legal",
  );
  await expect(page.locator('link[rel="alternate"][hreflang="es"]')).toHaveAttribute(
    "href",
    "https://picchuspot.com/es/legal",
  );

  await page.goto("/es/legal");
  await expect(page.getByRole("heading", { name: "Aviso legal" })).toBeVisible();
  await expect(page.locator("main")).toContainText("Mykhailo Lykin");
  await expect(page.locator("main")).toContainText("Y9650008G");
  await expect(page.locator("main")).toContainText("nombre comercial");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://picchuspot.com/es/legal",
  );
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
    "href",
    "https://picchuspot.com/legal",
  );

  await guard.expectClean();
});

const LEGAL_VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 768, height: 900 },
  { width: 1024, height: 900 },
  { width: 1440, height: 1000 },
] as const;

for (const viewport of LEGAL_VIEWPORTS) {
  test("cookie policy remains readable at " + viewport.width + "px", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      localStorage.setItem("picchuspot_cookie_consent", "rejected");
    });
    const guard = await installSmokeNetworkGuards(page, testInfo);

    const response = await page.goto("/cookies");

    expectNavigationResponseOk(response, "/cookies");
    await expect(
      page.getByRole("heading", { name: "Cookie Policy", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", {
        name: "PicchuSpot cookies and browser storage",
      }),
    ).toBeVisible();

    const widths = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth);

    const legalBodyFontSize = await page
      .getByTestId("legal-body")
      .first()
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(legalBodyFontSize).toBeGreaterThanOrEqual(16);
    await guard.expectClean();
  });
}

test("legal footer exposes the complete policy set in each language", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem("picchuspot_cookie_consent", "rejected");
  });
  const guard = await installSmokeNetworkGuards(page, testInfo);

  await page.goto("/terms");
  const englishFooter = page.locator("footer");
  for (const link of [
    ["Legal Notice", "/legal"],
    ["Privacy Policy", "/privacy"],
    ["Cookie Policy", "/cookies"],
    ["Terms & Conditions", "/terms"],
    ["Refunds & Cancellations", "/refunds"],
  ] as const) {
    await expect(
      englishFooter.getByRole("link", { name: link[0], exact: true }),
    ).toHaveAttribute("href", link[1]);
  }

  await page.goto("/es/terms");
  const spanishFooter = page.locator("footer");
  for (const link of [
    ["Aviso legal", "/es/legal"],
    ["Política de privacidad", "/es/privacy"],
    ["Política de cookies", "/es/cookies"],
    ["Términos y condiciones", "/es/terms"],
    ["Reembolsos y cancelaciones", "/es/refunds"],
  ] as const) {
    await expect(
      spanishFooter.getByRole("link", { name: link[0], exact: true }),
    ).toHaveAttribute("href", link[1]);
  }

  await guard.expectClean();
});

test("header Explore menu exposes Blog in English order and preserves Spanish links", async ({
  page,
  request,
}, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem("picchuspot_cookie_consent", "rejected");
  });
  const guard = await installSmokeNetworkGuards(page, testInfo);

  await page.goto("/terms");
  await page.getByRole("button", { name: "Open menu" }).click();
  const englishMenu = page.getByRole("dialog", { name: "Site menu" });
  const englishExplore = englishMenu.locator("section").filter({
    has: page.getByText("Explore", { exact: true }),
  });
  await expect(englishExplore.getByRole("link")).toHaveText([
    /^About/, /^Contact Us/, /^Pricing/, /^Gallery/, /^Blog/, /^FAQ/,
    /^Terms & Conditions/, /^Privacy Policy/,
  ]);
  const blogLink = englishExplore.getByRole("link", { name: /^Blog/ });
  await expect(blogLink).toHaveAttribute("href", "/blog");
  await expect(blogLink).toContainText(
    "Practical guides on virtual staging, pricing, and real estate visuals.",
  );
  await expect(
    englishMenu.getByRole("link", { name: /Terms & Conditions/ }),
  ).toHaveAttribute("href", "/terms");
  await expect(
    englishMenu.getByRole("link", { name: /Privacy Policy/ }),
  ).toHaveAttribute("href", "/privacy");
  await expect(
    englishMenu.getByRole("link", { name: /Cookie Policy/ }),
  ).toHaveCount(0);
  await expect(
    englishMenu.getByRole("link", { name: /Refunds & Cancellations/ }),
  ).toHaveCount(0);
  await blogLink.click();
  await expect(page).toHaveURL(/\/blog$/);
  await expect(englishMenu).toBeHidden();

  await page.goto("/es/terms");
  await page.getByRole("button", { name: "Abrir menú" }).click();
  const spanishMenu = page.getByRole("dialog", { name: "Menú del sitio" });
  const spanishExplore = spanishMenu.locator("section").filter({
    has: page.getByText("Explorar", { exact: true }),
  });
  await expect(spanishExplore.getByRole("link")).toHaveText([
    /^Sobre nosotros/, /^Contacto/, /^Precios/, /^Galería/,
    /^Preguntas frecuentes/, /^Términos y condiciones/, /^Política de privacidad/,
  ]);
  await expect(spanishMenu.getByRole("link", { name: /^Blog/ })).toHaveCount(0);
  await expect(spanishMenu.locator('a[href="/es/blog"]')).toHaveCount(0);
  expect((await request.get("/es/blog")).status()).toBe(404);
  await expect(
    spanishMenu.getByRole("link", { name: /Términos y condiciones/ }),
  ).toHaveAttribute("href", "/es/terms");
  await expect(
    spanishMenu.getByRole("link", { name: /Política de privacidad/ }),
  ).toHaveAttribute("href", "/es/privacy");
  await expect(
    spanishMenu.getByRole("link", { name: /Política de cookies/ }),
  ).toHaveCount(0);
  await expect(
    spanishMenu.getByRole("link", { name: /Reembolsos y cancelaciones/ }),
  ).toHaveCount(0);

  await guard.expectClean();
});


for (const language of ["en", "es"] as const) {
  test(`staging localization: ${language} content, navigation and responsive layout`, async ({ page }, testInfo) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const spanish = language === "es";
    const path = `${spanish ? "/es" : ""}/pricing/virtual-staging`;
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await expect(page).toHaveTitle(spanish ? /Precios de Virtual Staging/ : /Virtual Staging/);
    await expect(page.locator("h1")).toHaveText(spanish ? "Precios de Virtual Staging" : "Virtual Staging Pricing");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", spanish ? /Transforma habitaciones/ : /./);
    await expect(page.getByRole("heading", { name: spanish ? "Qué archivos subir" : "What to upload", exact: true })).toBeVisible();
    await expect(page.getByText(spanish ? "Empieza ahora" : "Get Started", { exact: true })).toBeVisible();
    if (spanish) {
      await expect(page.locator("main")).not.toContainText(/What to upload|Get Started|PHOTO-REALISTIC|ACCURATE ROOM SCALE|Realistic furniture|No subscriptions|add-ons/);
    }
    for (const width of [360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const menu = page.getByRole("button", { name: spanish ? "Abrir menú" : "Open menu", exact: true });
      await menu.click();
      await expect(page.getByRole("dialog", { name: spanish ? "Menú del sitio" : "Site menu", exact: true })).toBeVisible();
      await page.getByRole("dialog").getByRole("button", { name: spanish ? "Cerrar menú" : "Close menu", exact: true }).click();
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      await menu.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(menu).toBeFocused();
      if (width === 390 || width === 1440) {
        await page.screenshot({ path: testInfo.outputPath(`staging-${language}-${width}.png`), fullPage: true });
      }
    }
    expect(pageErrors).toEqual([]);
  });
}
