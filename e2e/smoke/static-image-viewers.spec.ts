import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  expectNavigationResponseOk,
  installSmokeNetworkGuards,
} from "../support/network";

const requiredViewports = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 430, height: 932 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
  { width: 844, height: 390 },
  { width: 932, height: 430 },
] as const;

async function expectContainedImage(
  page: Page,
  image: Locator,
  viewport: { width: number; height: number },
  variant: "photo" | "plan",
) {
  const surface = image.locator("xpath=ancestor::*[@data-static-image-surface]");
  await expect(surface).toHaveAttribute("data-static-image-ready", "true");
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate((element) => {
        const imageElement = element as HTMLImageElement;
        return imageElement.complete && imageElement.naturalWidth > 0;
      }),
    )
    .toBe(true);
  const metrics = await image.evaluate((element) => {
    const imageElement = element as HTMLImageElement;
    const stage = imageElement.closest<HTMLElement>("[data-static-image-stage]");
    if (!stage) throw new Error("Static image stage was not found.");

    const imageStyle = getComputedStyle(imageElement);
    const stageRect = stage.getBoundingClientRect();
    const imageRect = imageElement.getBoundingClientRect();
    const surface = imageElement.closest<HTMLElement>("[data-static-image-surface]");
    if (!surface) throw new Error("Static image surface was not found.");
    const surfaceRect = surface.getBoundingClientRect();
    const surfaceStyle = getComputedStyle(surface);

    return {
      variant: stage.dataset.staticImageVariant,
      objectFit: imageStyle.objectFit,
      objectPosition: imageStyle.objectPosition,
      stage: {
        left: stageRect.left,
        top: stageRect.top,
        right: stageRect.right,
        bottom: stageRect.bottom,
        width: stageRect.width,
        height: stageRect.height,
      },
      naturalWidth: imageElement.naturalWidth,
      naturalHeight: imageElement.naturalHeight,
      image: {
        left: imageRect.left,
        top: imageRect.top,
        right: imageRect.right,
        bottom: imageRect.bottom,
        width: imageRect.width,
        height: imageRect.height,
      },
      surface: {
        width: surfaceRect.width,
        height: surfaceRect.height,
        backgroundColor: surfaceStyle.backgroundColor,
        paddingLeft: Number.parseFloat(surfaceStyle.paddingLeft),
        paddingTop: Number.parseFloat(surfaceStyle.paddingTop),
      },
    };
  });

  expect(metrics.variant).toBe(variant);
  expect(metrics.objectFit).toBe("contain");
  expect(metrics.objectPosition).toBe("50% 50%");
  expect(metrics.naturalWidth).toBeGreaterThan(0);
  expect(metrics.naturalHeight).toBeGreaterThan(0);
  expect(metrics.image.width).toBeLessThanOrEqual(metrics.stage.width + 0.5);
  expect(metrics.image.height).toBeLessThanOrEqual(metrics.stage.height + 0.5);
  expect(metrics.image.width).toBeLessThanOrEqual(metrics.naturalWidth + 0.5);
  expect(metrics.image.height).toBeLessThanOrEqual(metrics.naturalHeight + 0.5);
  expect(metrics.image.left).toBeGreaterThanOrEqual(metrics.stage.left - 0.5);
  expect(metrics.image.top).toBeGreaterThanOrEqual(metrics.stage.top - 0.5);
  expect(metrics.image.right).toBeLessThanOrEqual(metrics.stage.right + 0.5);
  expect(metrics.image.bottom).toBeLessThanOrEqual(metrics.stage.bottom + 0.5);
  expect(
    Math.abs(
      metrics.image.width / metrics.image.height -
        metrics.naturalWidth / metrics.naturalHeight,
    ),
  ).toBeLessThan(0.002);

  if (variant === "photo") {
    expect(metrics.surface.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(metrics.surface.width).toBeCloseTo(metrics.image.width, 0);
    expect(metrics.surface.height).toBeCloseTo(metrics.image.height, 0);
  } else {
    expect(metrics.surface.backgroundColor).toBe("rgb(255, 255, 255)");
    const expectedPadding =
      viewport.width > viewport.height && viewport.height <= 500
        ? { min: 6, max: 10 }
        : viewport.width < 768
          ? { min: 8, max: 12 }
          : { min: 16, max: 24 };
    expect(metrics.surface.paddingLeft).toBeGreaterThanOrEqual(expectedPadding.min);
    expect(metrics.surface.paddingLeft).toBeLessThanOrEqual(expectedPadding.max);
    expect(metrics.surface.paddingTop).toBeGreaterThanOrEqual(expectedPadding.min);
    expect(metrics.surface.paddingTop).toBeLessThanOrEqual(expectedPadding.max);
    expect(
      metrics.surface.width < metrics.stage.width - 0.5 ||
        metrics.surface.height < metrics.stage.height - 0.5,
    ).toBe(true);
  }
  expect(metrics.stage.left).toBeGreaterThanOrEqual(0);
  expect(metrics.stage.top).toBeGreaterThanOrEqual(0);
  expect(metrics.stage.right).toBeLessThanOrEqual(viewport.width + 0.5);
  expect(metrics.stage.bottom).toBeLessThanOrEqual(viewport.height + 0.5);

  const documentState = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyOverflow: getComputedStyle(document.body).overflow,
    rootOverflow: getComputedStyle(document.documentElement).overflow,
  }));
  expect(documentState.scrollWidth).toBe(documentState.clientWidth);
  expect(documentState.bodyOverflow).toBe("hidden");
  expect(documentState.rootOverflow).toBe("hidden");
}

test("shared pricing lightbox fits landscape and extra-wide rasters at every required viewport", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await page.addInitScript(() => {
    window.localStorage.setItem("picchuspot_cookie_consent", "rejected");
  });

  for (const viewport of requiredViewports) {
    await page.setViewportSize(viewport);
    const response = await page.goto("/pricing/floor-plans");
    expectNavigationResponseOk(response, "/pricing/floor-plans");

    const trigger = page.getByRole("button", {
      name: "View Static image fit fixture — before and after",
    });
    await trigger.click();

    const dialog = page.getByRole("dialog", {
      name: "Static image fit fixture — image gallery",
    });
    const image = dialog.locator("[data-static-image-viewer-image]");
    await expectContainedImage(page, image, viewport, "plan");
    await expect(image).toHaveAttribute(
      "alt",
      "Landscape static image fit fixture",
    );
    await expect(dialog.getByRole("button", { name: "Close gallery" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Previous image" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Next image" })).toBeVisible();

    await dialog.getByRole("button", { name: "Next image" }).click();
    await expect(image).toHaveAttribute(
      "alt",
      "Extra-wide transparent static image fit fixture",
    );
    await expectContainedImage(page, image, viewport, "plan");

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }

  await guard.expectNoPageErrorsOrServerErrors();
});

test("property gallery keeps raster images and controls inside every required viewport", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await page.addInitScript(() => {
    window.localStorage.setItem("picchuspot_cookie_consent", "rejected");
  });

  for (const viewport of requiredViewports) {
    await page.setViewportSize(viewport);
    const route = "/property/sea-view-residence?galleryFixture=48";
    const response = await page.goto(route);
    expectNavigationResponseOk(response, route);

    await page
      .getByRole("button", { name: "Open gallery image: Gallery image 1" })
      .click();
    const dialog = page.locator(
      '[role="dialog"][aria-label^="Property gallery:"]',
    );
    await expect(dialog).toHaveAttribute(
      "aria-label",
      "Property gallery: Gallery image 1",
    );
    const image = dialog.getByTestId("property-gallery-lightbox-image");
    await expectContainedImage(page, image, viewport, "photo");

    for (const controlName of [
      "Close gallery",
      "Previous gallery image",
      "Next gallery image",
    ]) {
      await expect(dialog.getByRole("button", { name: controlName })).toBeVisible();
    }

    await dialog.getByRole("button", { name: "Next gallery image" }).click();
    await expect(dialog).toHaveAttribute(
      "aria-label",
      "Property gallery: Gallery image 2",
    );
    await expectContainedImage(page, image, viewport, "photo");

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }

  await guard.expectNoPageErrorsOrServerErrors();
});
