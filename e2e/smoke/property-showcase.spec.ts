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
    await expect(page.getByTestId("property-facts")).toBeVisible();
    await expect(page.getByText("Open Mediterranean views")).toBeVisible();
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

test("property showcase language switcher falls back cleanly", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await page.setViewportSize({ width: 1440, height: 900 });

  const response = await page.goto("/property/sea-view-residence");

  expectNavigationResponseOk(response, "/property/sea-view-residence");
  await page.getByRole("button", { name: "ES" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Residencia con vistas al mar" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "DE" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Residenz mit Meerblick" }),
  ).toBeVisible();
  await expect(page.getByText("Freier Mittelmeerblick")).toBeVisible();
  await guard.expectNoPageErrorsOrServerErrors();
});

test("one-language property omits the public language switcher", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await page.setViewportSize({ width: 390, height: 844 });

  const response = await page.goto("/property/quiet-townhouse");

  expectNavigationResponseOk(response, "/property/quiet-townhouse");
  await expect(
    page.getByRole("heading", { level: 1, name: "Quiet Townhouse" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Spanish" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ES" })).toHaveCount(0);
  await guard.expectNoPageErrorsOrServerErrors();
});

test("property showcase facts and map privacy render as listing details", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await page.setViewportSize({ width: 1024, height: 768 });

  const response = await page.goto("/property/sea-view-residence");

  expectNavigationResponseOk(response, "/property/sea-view-residence");
  await expect(page.getByTestId("property-facts")).toContainText("\u20ac695,000");
  await expect(page.getByTestId("property-facts")).toContainText("PS-001");
  await expect(page.getByTestId("property-facts")).toContainText("142 m\u00b2");
  await expect(page.locator("#location")).toContainText("Approximate location");
  await expect(
    page.locator("#location").getByRole("link", { name: "Open map" }),
  ).toBeVisible();
  await guard.expectNoPageErrorsOrServerErrors();
});

test("disabled map and empty highlights do not render empty panels", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await page.setViewportSize({ width: 768, height: 1024 });

  const response = await page.goto("/property/quiet-townhouse");

  expectNavigationResponseOk(response, "/property/quiet-townhouse");
  await expect(page.locator("[data-testid='property-highlights']")).toHaveCount(0);
  await expect(page.locator("#location iframe")).toHaveCount(0);
  await expect(
    page.locator("#location").getByRole("link", { name: "Open map" }),
  ).toHaveCount(0);
  await guard.expectNoPageErrorsOrServerErrors();
});

test("complete and minimal realtor profiles stay usable", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto("/property/sea-view-residence");
  await expect(page.locator("#contact")).toContainText("Costa Blanca Property Team");
  await expect(page.locator("#contact").getByRole("link", { name: "WhatsApp" })).toBeVisible();
  await expect(page.locator("#contact").getByRole("link", { name: "Instagram" })).toBeVisible();

  await page.goto("/property/quiet-townhouse");
  await expect(page.locator("#contact")).toContainText("Demo Real Estate Agency");
  await expect(page.locator("#contact").getByRole("link", { name: "WhatsApp" })).toHaveCount(0);
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
