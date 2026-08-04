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
    for (const key of ["price", "listing-reference", "built-area", "plot-area"]) {
      const value = page
        .getByTestId(`property-fact-${key}`)
        .locator("span")
        .first();
      await expect(value).toBeVisible();
      const metrics = await value.evaluate((element) => {
        const style = window.getComputedStyle(element);
        return {
          height: element.getBoundingClientRect().height,
          lineHeight: Number.parseFloat(style.lineHeight),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        };
      });
      expect(metrics.height).toBeLessThanOrEqual(metrics.lineHeight * 2.5);
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    }
    const factColumns = await page.getByTestId("property-facts").evaluate(
      (element) =>
        window.getComputedStyle(element).gridTemplateColumns.split(" ").length,
    );
    expect(factColumns).toBe(
      viewport.width >= 1536
        ? 8
        : viewport.width >= 768
          ? 4
          : 2,
    );
    await expect(page.getByText("Open Mediterranean views")).toBeVisible();
    if (viewport.width >= 768) {
      await expect(page.getByRole("button", { name: "Ground floor" })).toBeVisible();
      await expect(page.getByRole("button", { name: "First floor" })).toBeVisible();
    } else {
      await expect(page.getByLabel("Floor plan")).toBeVisible();
    }
    await expect(
      page.locator("#interactive-floor-plan").getByRole("link", {
        name: "Open interactive floor plan",
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

test("360 tour stays poster-first and keeps controls outside the provider frame", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await page.setViewportSize({ width: 1440, height: 900 });

  const response = await page.goto("/property/sea-view-residence");
  expectNavigationResponseOk(response, "/property/sea-view-residence");

  const section = page.locator("#virtual-tour");
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByRole("button", { name: "View 360 tour" })).toBeVisible();
  await expect(section.getByTestId("virtual-tour-iframe")).toHaveCount(0);
  await expect(
    section.getByText("Enter the property without leaving the page"),
  ).toHaveCount(0);

  await section.getByRole("button", { name: "View 360 tour" }).click();
  const iframe = section.getByTestId("virtual-tour-iframe");
  const controls = section.getByTestId("virtual-tour-controls");
  const fullscreen = controls.getByRole("button", { name: /Fullscreen/ });
  await expect(iframe).toBeAttached();
  await expect(controls).toBeVisible();
  await expect(controls.getByRole("link", { name: "Open original tour" })).toBeVisible();
  await expect(fullscreen).toBeVisible();

  const [iframeBox, controlsBox] = await Promise.all([
    iframe.boundingBox(),
    controls.boundingBox(),
  ]);
  expect(iframeBox).not.toBeNull();
  expect(controlsBox).not.toBeNull();
  expect(controlsBox!.y).toBeGreaterThanOrEqual(iframeBox!.y + iframeBox!.height - 1);

  const launcher = page.getByRole("button", {
    name: "Open PicchuSpot AI assistant",
  });
  const [launcherBox, fullscreenBox] = await Promise.all([
    launcher.boundingBox(),
    fullscreen.boundingBox(),
  ]);
  expect(launcherBox).not.toBeNull();
  expect(fullscreenBox).not.toBeNull();
  const supportOverlapsFullscreen =
    launcherBox!.x < fullscreenBox!.x + fullscreenBox!.width &&
    launcherBox!.x + launcherBox!.width > fullscreenBox!.x &&
    launcherBox!.y < fullscreenBox!.y + fullscreenBox!.height &&
    launcherBox!.y + launcherBox!.height > fullscreenBox!.y;
  expect(supportOverlapsFullscreen).toBe(false);
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
  const html = await response!.text();
  expect(html).not.toContain("38.603912");
  expect(html).not.toContain("-0.045316");
  expect(html).not.toContain("exact-altea-parcel");
  await expect(page.getByTestId("property-facts")).toContainText("\u20ac695,000");
  await expect(page.getByTestId("property-facts")).toContainText("PS-001");
  await expect(page.getByTestId("property-facts")).toContainText("142\u00a0m\u00b2");
  await expect(page.locator("#location")).toContainText("Approximate location");
  await expect(page.getByTestId("property-map-iframe")).toBeVisible();
  await expect(page.getByTestId("approximate-map-area")).toBeVisible();
  await expect(page.getByTestId("property-map-iframe")).toHaveCSS(
    "pointer-events",
    "none",
  );
  const mapSrc = await page.getByTestId("property-map-iframe").getAttribute("src");
  expect(mapSrc).toContain("ll=38.6%2C0");
  expect(mapSrc).not.toContain("38.603912");
  expect(mapSrc).not.toContain("-0.045316");
  await expect(
    page.locator("#location").getByRole("link", { name: "Open map" }),
  ).toBeVisible();
  await expect(page.getByText("Approximate location", { exact: true })).toHaveCount(1);
  const approximateAreaBefore = await page
    .getByTestId("approximate-map-area")
    .boundingBox();
  await page.mouse.move(700, 500);
  const approximateAreaAfter = await page
    .getByTestId("approximate-map-area")
    .boundingBox();
  expect(approximateAreaAfter).toEqual(approximateAreaBefore);
  await expect(page.locator("footer")).toContainText("Equal Housing Opportunity");
  await expect(page.locator("footer")).toContainText(
    "Proudly created by Full Frame Media",
  );

  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /property-demo\/terrace\.svg$/,
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );

  const sectionOrder = await page.evaluate(() => ({
    contact: document.querySelector("#contact")?.compareDocumentPosition(
      document.querySelector("#location")!,
    ),
    location: document.querySelector("#location")?.compareDocumentPosition(
      document.querySelector("footer")!,
    ),
  }));
  expect(sectionOrder.contact! & 4).toBeTruthy();
  expect(sectionOrder.location! & 4).toBeTruthy();

  await page.getByRole("link", { name: "Location", exact: true }).click();
  await expect(page).toHaveURL(/#location$/);
  await expect(page.locator("#location")).toBeInViewport();
  await guard.expectNoPageErrorsOrServerErrors();
});

test("disabled map and empty highlights do not render empty panels", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await page.setViewportSize({ width: 768, height: 1024 });

  const response = await page.goto("/property/quiet-townhouse");

  expectNavigationResponseOk(response, "/property/quiet-townhouse");
  const html = await response!.text();
  expect(html).not.toContain("38.688771");
  expect(html).not.toContain("0.134412");
  expect(html).not.toContain("hidden-moraira-parcel");
  await expect(page.locator("[data-testid='property-highlights']")).toHaveCount(0);
  await expect(page.locator("#location")).toHaveCount(0);
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

test("hidden realtor profile does not fall back to PicchuSpot contact", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await page.setViewportSize({ width: 1024, height: 768 });

  const response = await page.goto("/property/private-contact-listing");

  expectNavigationResponseOk(response, "/property/private-contact-listing");
  await expect(
    page.getByRole("heading", { level: 1, name: "Private Contact Listing" }),
  ).toBeVisible();
  await expect(page.locator("#contact")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Request a viewing" }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: /PicchuSpot contact/i })).toHaveCount(0);
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
    name: "Open interactive floor plan",
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
