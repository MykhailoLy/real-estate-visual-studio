import { expect, test, devices } from "@playwright/test";
import {
  expectNavigationResponseOk,
  installSmokeNetworkGuards,
} from "../support/network";

const pixel5 = devices["Pixel 5"];

test.describe("public navigation", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("desktop header links navigate to core public pages", async ({
    page,
  }, testInfo) => {
    const guard = await installSmokeNetworkGuards(page, testInfo);

    const response = await page.goto("/");
    expectNavigationResponseOk(response, "/");

    await page.getByRole("link", { name: "Pricing" }).first().click();
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
    await menu.getByRole("link", { name: "Virtual Staging", exact: true }).click();

    await expect(page).toHaveURL(/\/pricing\/virtual-staging$/);
    await expect(
      page.getByRole("heading", { name: /virtual staging pricing/i }),
    ).toBeVisible();
    await guard.expectClean();
  });
});

test.describe("responsive service navigation", () => {
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
});
