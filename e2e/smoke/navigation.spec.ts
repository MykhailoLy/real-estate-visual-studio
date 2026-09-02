import { expect, test, devices } from "@playwright/test";
import {
  expectNavigationResponseOk,
  installSmokeNetworkGuards,
} from "../support/network";

const pixel5 = devices["Pixel 5"];

test.describe("public navigation", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

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
      name: "Select market, currency, and language",
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
  test("top-level categories wait for 3xl while the burger remains clickable", async ({
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

    await page.setViewportSize({ width: 1360, height: 900 });
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
