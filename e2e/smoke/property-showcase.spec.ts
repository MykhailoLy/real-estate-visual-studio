import { expect, test } from "@playwright/test";
import {
  expectNavigationResponseOk,
  installSmokeNetworkGuards,
} from "../support/network";

const propertyViewports = [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const;

for (const viewport of propertyViewports) {
  test(`property showcase has no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, testInfo) => {
    const guard = await installSmokeNetworkGuards(page, testInfo);
    await page.setViewportSize(viewport);

    const response = await page.goto("/property/sea-view-residence");

    expectNavigationResponseOk(response, "/property/sea-view-residence");
    await expect(
      page.getByRole("heading", { level: 1, name: "Sea View Residence" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "About this property" }),
    ).toBeVisible();
    await expect(page.locator("#gallery")).toBeVisible();
    await expect(page.locator("#floor-plan")).toBeVisible();
    await expect(page.locator("#location")).toBeVisible();
    if (viewport.width >= 768) {
      await expect(page.getByRole("button", { name: "Ground floor" })).toBeVisible();
      await expect(page.getByRole("button", { name: "First floor" })).toBeVisible();
    } else {
      await expect(page.getByLabel("Floor plan")).toBeVisible();
    }
    await expect(
      page.locator("#interactive-floor-plan").getByRole("link", {
        name: "Open original interactive plan",
      }).first(),
    ).toBeVisible();
    await expect(
      page.locator("#interactive-floor-plan").getByRole("button", {
        name: "View fullscreen",
      }),
    ).toHaveCount(0);

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
    await guard.expectNoPageErrorsOrServerErrors();
  });
}

test("property showcase floor plan tabs switch plans on desktop", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await page.setViewportSize({ width: 1440, height: 900 });

  const response = await page.goto("/property/sea-view-residence");

  expectNavigationResponseOk(response, "/property/sea-view-residence");
  await page.getByRole("button", { name: "First floor" }).click();
  await expect(page.getByTestId("selected-floor-plan-title")).toHaveText(
    "First floor",
  );
  await guard.expectNoPageErrorsOrServerErrors();
});

test("property showcase floor plan selector works on mobile", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await page.setViewportSize({ width: 375, height: 812 });

  const response = await page.goto("/property/sea-view-residence");

  expectNavigationResponseOk(response, "/property/sea-view-residence");
  await page.getByLabel("Floor plan").selectOption("first-floor");
  await expect(page.getByTestId("selected-floor-plan-title")).toHaveText(
    "First floor",
  );
  await guard.expectNoPageErrorsOrServerErrors();
});

test("property showcase overview omits empty highlights", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await page.setViewportSize({ width: 1024, height: 768 });

  const response = await page.goto("/property/quiet-townhouse");

  expectNavigationResponseOk(response, "/property/quiet-townhouse");
  await expect(
    page.getByRole("heading", { level: 1, name: "Quiet Townhouse" }),
  ).toBeVisible();
  await expect(page.locator("[data-testid='property-highlights']")).toHaveCount(0);
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
  await guard.expectNoPageErrorsOrServerErrors();
});

test("property showcase support launcher does not cover interactive actions", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await page.setViewportSize({ width: 1440, height: 900 });

  const response = await page.goto("/property/sea-view-residence");

  expectNavigationResponseOk(response, "/property/sea-view-residence");
  await page.locator("#interactive-floor-plan").scrollIntoViewIfNeeded();

  const launcher = page.getByRole("button", {
    name: "Open PicchuSpot AI assistant",
  });
  const action = page.locator("#interactive-floor-plan").getByRole("link", {
    name: "Open original interactive plan",
  }).first();
  await expect(launcher).toBeVisible();
  await expect(action).toBeVisible();

  const boxes = await Promise.all([
    launcher.boundingBox(),
    action.boundingBox(),
  ]);
  expect(boxes[0]).not.toBeNull();
  expect(boxes[1]).not.toBeNull();

  const [launcherBox, actionBox] = boxes as [
    NonNullable<(typeof boxes)[number]>,
    NonNullable<(typeof boxes)[number]>,
  ];
  const overlaps =
    launcherBox.x < actionBox.x + actionBox.width &&
    launcherBox.x + launcherBox.width > actionBox.x &&
    launcherBox.y < actionBox.y + actionBox.height &&
    launcherBox.y + launcherBox.height > actionBox.y;
  expect(overlaps).toBe(false);
  await guard.expectNoPageErrorsOrServerErrors();
});

test("draft preview is protected for unauthenticated visitors", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);

  await page.goto("/admin/properties/00000000-0000-0000-0000-000000000000/preview");

  await expect(page).toHaveURL(/\/admin\/login/);
  await guard.expectNoPageErrorsOrServerErrors();
});
