import { expect, test } from "@playwright/test";
import {
  expectNavigationResponseOk,
  installSmokeNetworkGuards,
} from "../support/network";

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
  await expect(page.getByRole("link", { name: "View Services" }).first()).toBeVisible();
  await guard.expectClean();
});

const HOMEPAGE_VIEWPORTS = [
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

    const benefitGrid = page.getByTestId("benefits-grid");
    const columnCount = await benefitGrid.evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length,
    );
    expect(columnCount).toBe(viewport.expectedBenefitColumns);

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
    route: "/services",
    heading: "Real Estate Visual Marketing Services",
  },
  {
    route: "/es/pricing",
    heading: "Precios claros, sin suscripciones",
  },
] as const;

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

test("header Explore menu keeps only the established policy links", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem("picchuspot_cookie_consent", "rejected");
  });
  const guard = await installSmokeNetworkGuards(page, testInfo);

  await page.goto("/terms");
  await page.getByRole("button", { name: "Open menu" }).click();
  const englishMenu = page.getByRole("dialog", { name: "Site menu" });
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
  await englishMenu.getByRole("button", { name: "Close menu" }).click();

  await page.goto("/es/terms");
  await page.getByRole("button", { name: "Open menu" }).click();
  const spanishMenu = page.getByRole("dialog", { name: "Menú del sitio" });
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
