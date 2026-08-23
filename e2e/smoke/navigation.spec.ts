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
