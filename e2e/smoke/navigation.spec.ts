import { expect, test, devices } from "@playwright/test";
import {
  expectNavigationResponseOk,
  installSmokeNetworkGuards,
} from "../support/network";

const pixel5 = devices["Pixel 5"];

test.describe("public navigation", () => {
  test.use({ viewport: { width: 1536, height: 900 } });

  test("desktop header keeps the dark primary treatment and control behavior", async ({
    page,
  }, testInfo) => {
    const guard = await installSmokeNetworkGuards(page, testInfo);

    const response = await page.goto("/");
    expectNavigationResponseOk(response, "/");

    const header = page.getByRole("banner");
    const primaryRow = page.getByTestId("public-header-primary-row");
    await expect(primaryRow).toHaveClass(/bg-primary/);
    await expect(primaryRow.locator(":scope > div")).toHaveClass(/h-14/);
    await expect(
      header.getByRole("link", {
        name: "PicchuSpot — Real Estate Visuals home",
      }),
    ).toHaveAttribute("href", "/");

    const categoryNav = header.getByRole("navigation", {
      name: "Service categories",
    });
    const activeCategory = categoryNav.getByRole("link", {
      name: "Remote Digital Services",
    });
    await expect(activeCategory).toHaveAttribute("aria-current", "page");
    await expect(activeCategory).toHaveClass(/text-white/);
    await expect(activeCategory).not.toHaveClass(/bg-primary\/5/);
    await expect(activeCategory.locator("span")).toHaveClass(/bg-secondary/);

    const login = header.getByRole("link", { name: "Login", exact: true });
    await expect(login).toHaveAttribute("href", "/login");
    await expect(login).toHaveClass(/text-white\/80/);
    const signup = header.getByRole("link", { name: "Sign Up", exact: true });
    await expect(signup).toHaveAttribute("href", "/signup");
    await expect(signup).toHaveClass(/bg-secondary/);
    await expect(signup).toHaveClass(/text-primary/);

    const marketSelector = header.getByRole("button", {
      name: "Select market and currency",
    });
    await expect(marketSelector).toHaveClass(/border-white\/15/);
    await expect(marketSelector).toHaveClass(/bg-white\/5/);
    await marketSelector.click();
    await expect(marketSelector).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("Market", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(marketSelector).toHaveAttribute("aria-expanded", "false");

    await guard.expectClean();
  });

  test("desktop header links navigate to core public pages", async ({
    page,
  }, testInfo) => {
    const guard = await installSmokeNetworkGuards(page, testInfo);

    const response = await page.goto("/");
    expectNavigationResponseOk(response, "/");

    await page.getByRole("link", { name: "Pricing", exact: true }).first().click();
    await expect(page).toHaveURL(/\/pricing$/);
    await expect(
      page.getByRole("heading", { name: "Pricing", exact: true }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Gallery" }).first().click();
    await expect(page).toHaveURL(/\/gallery$/);
    await expect(page.getByRole("heading", { name: "Gallery" })).toBeVisible();

    await page.getByRole("link", { name: "Contact Us" }).first().click();
    await expect(page).toHaveURL(/\/contact$/);
    await expect(
      page.getByRole("heading", {
        name: /tell us what you need for your listing or property project/i,
      }),
    ).toBeVisible();

    await guard.expectClean();
  });
});

test.describe("mobile navigation", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: pixel5.deviceScaleFactor,
    hasTouch: pixel5.hasTouch,
    isMobile: pixel5.isMobile,
    userAgent: pixel5.userAgent,
  });

  test("burger menu opens and navigates to Virtual Staging", async ({
    page,
  }, testInfo) => {
    const guard = await installSmokeNetworkGuards(page, testInfo);

    const response = await page.goto("/");
    expectNavigationResponseOk(response, "/");

    await page.getByRole("button", { name: "Open menu" }).click();
    const menu = page.getByRole("dialog", { name: "Site menu" });
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();

    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(menu).toBeVisible();
    await menu.getByRole("link", { name: "Virtual Staging", exact: true }).click();

    await expect(page).toHaveURL(/\/pricing\/virtual-staging$/);
    await expect(
      page.getByRole("heading", { name: /virtual staging pricing/i }),
    ).toBeVisible();
    await guard.expectClean();
  });
});

test.describe("responsive service navigation", () => {
  test("all service categories remain reachable when the primary category navigation is hidden", async ({ page }) => {
    for (const width of [360, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await page.getByRole("button", { name: "Open menu", exact: true }).click();
      const menu = page.getByRole("dialog", { name: "Site menu", exact: true });
      const categories = menu.getByRole("navigation", { name: "Service categories" });
      for (const [name, href] of [
        ["Remote Digital Services", "/"],
        ["Local Real Estate Media", "/local"],
        ["Renders", "/renders"],
        ["Online Retail", "/online-retail"],
      ] as const) {
        const link = categories.getByRole("link", { name, exact: true });
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute("href", href);
      }
      await categories.getByRole("link", { name: "Local Real Estate Media", exact: true }).click();
      await expect(page).toHaveURL(/\/local$/);
      await expect(menu).toBeHidden();
    }
  });

  test("top-level categories wait for 2xl while the burger remains clickable", async ({
    page,
  }, testInfo) => {
    const guard = await installSmokeNetworkGuards(page, testInfo);

    await page.setViewportSize({ width: 1280, height: 900 });
    let response = await page.goto("/");
    expectNavigationResponseOk(response, "/");
    await expect(
      page.getByRole("navigation", { name: "Service categories" }),
    ).toBeHidden();
    await expect(
      page.locator('nav[aria-label="Remote Digital Services services"]'),
    ).toBeVisible();
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog", { name: "Site menu" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.setViewportSize({ width: 1536, height: 900 });
    response = await page.goto("/");
    expectNavigationResponseOk(response, "/");
    await expect(
      page.getByRole("navigation", { name: "Service categories" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog", { name: "Site menu" })).toBeVisible();

    const pageWidth = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scrollWidth).toBeLessThanOrEqual(pageWidth.clientWidth);
    await guard.expectClean();
  });

  test("service links remain in the burger menu below lg", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 960, height: 900 });
    const guard = await installSmokeNetworkGuards(page, testInfo);

    const response = await page.goto("/");
    expectNavigationResponseOk(response, "/");

    const serviceNav = page.locator(
      'nav[aria-label="Remote Digital Services services"]',
    );
    await expect(serviceNav).toBeHidden();

    await page.getByRole("button", { name: "Open menu" }).click();
    const menu = page.getByRole("dialog", { name: "Site menu" });
    await expect(
      menu.getByRole("link", { name: "Virtual Staging", exact: true }),
    ).toBeVisible();
    await guard.expectClean();
  });

  test("service links appear from lg and retain the More overflow menu", async ({
    page,
  }, testInfo) => {
    const guard = await installSmokeNetworkGuards(page, testInfo);

    for (const width of [1024, 1180, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto("/");
      expectNavigationResponseOk(response, "/");

      const serviceNav = page.locator(
        'nav[aria-label="Remote Digital Services services"]',
      );
      await expect(serviceNav).toBeVisible();
      await expect(
        serviceNav.getByRole("link", {
          name: "Image Enhancement",
          exact: true,
        }),
      ).toBeVisible();

      const pageWidth = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(pageWidth.scrollWidth).toBeLessThanOrEqual(pageWidth.clientWidth);
    }

    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "More", exact: true }).click();
    const moreMenu = page.getByRole("menu", {
      name: "Remote Digital Services more services",
    });
    await expect(moreMenu).toBeVisible();
    await moreMenu
      .getByRole("menuitem", { name: "Development Site Plans", exact: true })
      .click();
    await expect(page).toHaveURL(/\/pricing\/development-site-plans$/);
    await guard.expectClean();
  });

  test("active service links use the gold underline from the lg breakpoint", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    const guard = await installSmokeNetworkGuards(page, testInfo);

    const response = await page.goto("/pricing/image-enhancement");
    expectNavigationResponseOk(response, "/pricing/image-enhancement");

    const serviceNav = page.locator(
      'nav[aria-label="Remote Digital Services services"]',
    );
    const activeLink = serviceNav.getByRole("link", {
      name: "Image Enhancement",
      exact: true,
    });
    await expect(activeLink).toHaveAttribute("aria-current", "page");
    await expect(activeLink.locator("span")).toHaveClass(/bg-secondary/);
    await expect(activeLink.locator("span")).toHaveClass(/scale-x-100/);
    await guard.expectClean();
  });
});

test.describe("public header language and keyboard access", () => {
  test("language stays discoverable and separate from currency on narrow and wide screens", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("picchuspot-language", "es");
    });
    for (const width of [360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/pricing/virtual-staging");

      const languageNav = page.getByRole("navigation", { name: "Select language" });
      await expect(languageNav.getByRole("link", { name: "English", exact: true })).toHaveAttribute("aria-current", "page");
      const spanish = languageNav.getByRole("link", { name: "Español", exact: true });
      await expect(spanish).toBeVisible();
      await expect(spanish).toHaveAttribute("href", "/es/pricing/virtual-staging");
      const currency = page.getByRole("button", { name: "Select market and currency", exact: true });
      await expect(currency).toBeVisible();
      await currency.click();
      await page.getByRole("button", { name: /Europe — EUR/ }).click();
      await expect(page).toHaveURL(/\/pricing\/virtual-staging$/);
      await expect(currency).toContainText("EUR");

      const fits = await page.getByTestId("public-header-primary-row").evaluate((row) => {
        const controls = Array.from(row.querySelectorAll("a, button")).filter((element) => element.getClientRects().length > 0);
        return controls.every((element) => {
          const rect = element.getBoundingClientRect();
          return rect.left >= 0 && rect.right <= document.documentElement.clientWidth;
        });
      });
      expect(fits, `${width}px header controls`).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`public-discovery-en-${width}.png`) });
    }

    await page.getByRole("navigation", { name: "Select language" }).getByRole("link", { name: "Español", exact: true }).click();
    await expect(page).toHaveURL(/\/es\/pricing\/virtual-staging$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByRole("button", { name: "Seleccionar mercado y moneda", exact: true })).toContainText("EUR");
    const english = page.getByRole("navigation", { name: "Seleccionar idioma" }).getByRole("link", { name: "English", exact: true });
    await expect(english).toHaveAttribute("href", "/pricing/virtual-staging");
    const spanishPageFits = await page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth
    );
    expect(spanishPageFits, "1440px Spanish page overflow").toBe(true);
    await page.screenshot({ path: testInfo.outputPath("public-discovery-es-1440.png") });
    await english.click();
    await expect(page).toHaveURL(/\/pricing\/virtual-staging$/);
  });

  test("site menu traps keyboard focus and restores its trigger on close", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/");
    const trigger = page.getByRole("button", { name: "Open menu", exact: true });
    await trigger.focus();
    await trigger.press("Enter");
    const menu = page.getByRole("dialog", { name: "Site menu", exact: true });
    const close = menu.getByRole("button", { name: "Close menu", exact: true });
    await expect(close).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(menu.getByRole("link").last()).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.press("Enter");
    await close.click();
    await expect(trigger).toBeFocused();
  });
});

for (const width of [390, 1440]) {
  test(`service sections are reachable below the sticky header at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/pricing/virtual-staging", "/es/pricing/floor-plans", "/pricing/photo-editing"]) {
      const es = path.startsWith("/es/");
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
      const nav = page.getByRole("navigation", { name: es ? "En esta página" : "On this page", exact: true });
      await expect(nav).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`public-discovery-service-${path.split("/").at(-1)}-${es ? "es" : "en"}-${width}.png`) });
      await nav.getByRole("link", { name: es ? "Precios" : "Pricing", exact: true }).click();
      await expect(page).toHaveURL(/#pricing$/);
      await expect.poll(() => page.locator("#pricing").evaluate((section) => {
        const top = section.getBoundingClientRect().top;
        const headerBottom = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
        return top >= headerBottom - 1 && top < window.innerHeight;
      })).toBe(true);
    }
  });
}

for (const locale of ["en", "es"] as const) {
  test(`homepage discovery and first-order guide work in ${locale}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(locale === "es" ? "/es" : "/");
    await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`public-discovery-home-${locale}-390.png`) });
    await page.locator('a[href="#services"]').click();
    await expect(page.locator("#services-heading")).toBeInViewport();
    await expect(page.locator("#services").getByRole("link", { name: locale === "es" ? "Eliminación de objetos y limpieza virtual" : "Item Removal & Virtual Cleaning", exact: true }))
      .toHaveAttribute("href", `${locale === "es" ? "/es" : ""}/pricing/item-removal-virtual-cleaning`);
    await page.locator('a[href="#how-it-works"]').click();
    await expect(page.locator("#first-order-heading")).toBeInViewport();
    await expect(page.locator("#how-it-works").getByRole("link")).toHaveAttribute("href", "/dashboard/orders/new");
    await page.screenshot({ path: testInfo.outputPath(`public-discovery-first-order-${locale}-390.png`) });
  });
}
