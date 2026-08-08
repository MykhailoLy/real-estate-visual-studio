import { expect, test } from "@playwright/test";
import sharp from "sharp";
import {
  expectNavigationResponseOk,
  installSmokeNetworkGuards,
} from "../support/network";

const propertyViewports = [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const;

function pngDimensions(body: Buffer): { width: number; height: number } {
  expect(body.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  return {
    width: body.readUInt32BE(16),
    height: body.readUInt32BE(20),
  };
}

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
    for (const key of [
      "price",
      "listing-reference",
      "parking",
      "built-area",
      "plot-area",
    ]) {
      const value = page.getByTestId(`property-fact-value-${key}`);
      await expect(value).toBeVisible();
    }
    const factGeometry = await page.getByTestId("property-facts").evaluate(
      (container) => {
        const viewportWidth = document.documentElement.clientWidth;
        const containerRect = container.getBoundingClientRect();
        const values = Array.from(
          container.querySelectorAll<HTMLElement>(
            '[data-testid^="property-fact-value-"]',
          ),
        ).map((element) => {
          const style = window.getComputedStyle(element);
          const elementRect = element.getBoundingClientRect();
          const textRange = document.createRange();
          textRange.selectNodeContents(element);
          const textRect = textRange.getBoundingClientRect();
          const textExtendsPastElement =
            textRect.left < elementRect.left - 1 ||
            textRect.right > elementRect.right + 1 ||
            textRect.top < elementRect.top - 1 ||
            textRect.bottom > elementRect.bottom + 1;
          const clipsOverflow =
            textExtendsPastElement &&
            [style.overflowX, style.overflowY].some(
              (overflow) => overflow === "hidden" || overflow === "clip",
            );

          return {
            testId: element.getAttribute("data-testid") ?? "unknown fact",
            height: elementRect.height,
            lineHeight: Number.parseFloat(style.lineHeight),
            clipsOverflow,
            elementRect: {
              left: elementRect.left,
              right: elementRect.right,
            },
            textRect: {
              left: textRect.left,
              right: textRect.right,
              top: textRect.top,
              bottom: textRect.bottom,
            },
          };
        });
        const textOverlaps: string[] = [];

        for (let index = 0; index < values.length; index += 1) {
          for (
            let compared = index + 1;
            compared < values.length;
            compared += 1
          ) {
            const first = values[index];
            const second = values[compared];
            const horizontalOverlap =
              Math.min(first.textRect.right, second.textRect.right) -
              Math.max(first.textRect.left, second.textRect.left);
            const verticalOverlap =
              Math.min(first.textRect.bottom, second.textRect.bottom) -
              Math.max(first.textRect.top, second.textRect.top);
            if (horizontalOverlap > 1 && verticalOverlap > 1) {
              textOverlaps.push(`${first.testId} overlaps ${second.testId}`);
            }
          }
        }

        return {
          viewportWidth,
          containerRect: {
            left: containerRect.left,
            right: containerRect.right,
          },
          values,
          textOverlaps,
        };
      },
    );
    expect(factGeometry.containerRect.left).toBeGreaterThanOrEqual(-1);
    expect(factGeometry.containerRect.right).toBeLessThanOrEqual(
      factGeometry.viewportWidth + 1,
    );
    for (const value of factGeometry.values) {
      expect(
        value.height,
        `${value.testId} uses at most two lines`,
      ).toBeLessThanOrEqual(value.lineHeight * 2.5);
      expect(
        value.elementRect.left,
        `${value.testId} stays inside the viewport`,
      ).toBeGreaterThanOrEqual(-1);
      expect(
        value.elementRect.right,
        `${value.testId} stays inside the viewport`,
      ).toBeLessThanOrEqual(factGeometry.viewportWidth + 1);
      expect(
        value.textRect.left,
        `${value.testId} text stays visible`,
      ).toBeGreaterThanOrEqual(-1);
      expect(
        value.textRect.right,
        `${value.testId} text stays visible`,
      ).toBeLessThanOrEqual(factGeometry.viewportWidth + 1);
      expect(
        value.clipsOverflow,
        `${value.testId} text is not clipped`,
      ).toBe(false);
    }
    expect(factGeometry.textOverlaps).toEqual([]);
    const factColumns = await page.getByTestId("property-facts").evaluate(
      (element) =>
        window.getComputedStyle(element).gridTemplateColumns.split(" ").length,
    );
    expect(factColumns).toBe(
      viewport.width >= 1400
        ? 8
        : viewport.width >= 360
          ? 4
          : 2,
    );

    if (viewport.width === 430) {
      const factKeys = [
        "price",
        "listing-reference",
        "bedrooms",
        "bathrooms",
        "parking",
        "built-area",
        "year-built",
        "plot-area",
      ];
      const boxes = await Promise.all(
        factKeys.map((key) =>
          page.getByTestId(`property-fact-${key}`).boundingBox(),
        ),
      );
      expect(boxes.every(Boolean)).toBe(true);
      const factBoxes = boxes as NonNullable<(typeof boxes)[number]>[];
      for (const box of factBoxes.slice(1, 4)) {
        expect(Math.abs(box.y - factBoxes[0].y)).toBeLessThanOrEqual(1);
      }
      for (const box of factBoxes.slice(5)) {
        expect(Math.abs(box.y - factBoxes[4].y)).toBeLessThanOrEqual(1);
      }
      expect(factBoxes[4].y).toBeGreaterThan(factBoxes[0].y);
      expect((await page.getByTestId("property-facts").boundingBox())!.height).toBeLessThan(260);
      const iconBox = await page
        .getByTestId("property-fact-price")
        .locator(":scope > span")
        .first()
        .boundingBox();
      expect(iconBox?.width).toBeLessThanOrEqual(44);
      expect(iconBox?.height).toBeLessThanOrEqual(44);
    }
    const factsAreOpen = await page.getByTestId("property-facts").evaluate(
      (element) => {
        const containerStyle = window.getComputedStyle(element);
        const itemStyle = window.getComputedStyle(element.firstElementChild!);
        return {
          containerBackground: containerStyle.backgroundColor,
          itemBackground: itemStyle.backgroundColor,
          itemRightBorder: itemStyle.borderRightWidth,
        };
      },
    );
    expect(factsAreOpen.containerBackground).toBe("rgba(0, 0, 0, 0)");
    expect(factsAreOpen.itemBackground).toBe("rgba(0, 0, 0, 0)");
    expect(factsAreOpen.itemRightBorder).toBe("0px");

    const highlights = page.getByTestId("property-highlights");
    await expect(highlights).toBeVisible();
    const compositionOrder = await page
      .getByTestId("property-details-composition")
      .evaluate((element) => {
        const facts = element.querySelector('[data-testid="property-facts"]');
        const highlights = element.querySelector(
          '[data-testid="property-highlights"]',
        );
        return facts?.nextElementSibling === highlights;
      });
    expect(compositionOrder).toBe(true);
    const highlightColumns = await highlights.locator("ul").evaluate(
      (element) =>
        window.getComputedStyle(element).gridTemplateColumns.split(" ").length,
    );
    expect(highlightColumns).toBe(
      viewport.width >= 1280
        ? 3
        : viewport.width >= 380
          ? 2
          : 1,
    );
    const highlightHeadingMetrics = await highlights
      .getByRole("heading", { name: "Highlights" })
      .evaluate((element) => ({
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
      }));
    expect(highlightHeadingMetrics.width).toBeLessThanOrEqual(1);
    expect(highlightHeadingMetrics.height).toBeLessThanOrEqual(1);
    await expect(page.getByText("Open Mediterranean views")).toBeVisible();
    const hero = page.locator("#home");
    await expect(hero).not.toContainText("For sale");
    await expect(hero).not.toContainText("PS-001");
    await expect(hero.getByTestId("property-hero-slideshow")).toBeVisible();
    const requestViewing = page.getByTestId("hero-request-viewing");
    const downloadBrochure = page.getByTestId("hero-download-brochure");
    await expect(requestViewing).toBeVisible();
    await expect(downloadBrochure).toBeVisible();
    await downloadBrochure.click();
    const marketingDialog = page.getByTestId(
      "property-marketing-download-dialog",
    );
    await expect(marketingDialog).toBeVisible();
    await expect(
      marketingDialog.getByRole("img", {
        name: "Finished property brochure preview",
      }),
    ).toBeVisible();
    for (const action of ["Download PDF", "Download JPG", "Download PNG"]) {
      await expect(
        marketingDialog.getByRole("button", { name: new RegExp(`^${action}`) }),
      ).toBeVisible();
    }
    await expect(marketingDialog.getByRole("button", { name: /^Print/ })).toHaveCount(0);
    await expect(marketingDialog.getByText("Property flyer", { exact: true })).toBeVisible();
    await expect(marketingDialog.getByText("Portrait / A4")).toHaveCount(0);
    const dialogGeometry = await marketingDialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        viewportWidth: document.documentElement.clientWidth,
        viewportHeight: window.innerHeight,
      };
    });
    expect(dialogGeometry.left).toBeGreaterThanOrEqual(-1);
    expect(dialogGeometry.right).toBeLessThanOrEqual(
      dialogGeometry.viewportWidth + 1,
    );
    expect(dialogGeometry.top).toBeGreaterThanOrEqual(-1);
    expect(dialogGeometry.bottom).toBeLessThanOrEqual(
      dialogGeometry.viewportHeight + 1,
    );
    expect(dialogGeometry.scrollWidth).toBeLessThanOrEqual(
      dialogGeometry.clientWidth + 1,
    );
    await page.keyboard.press("Escape");
    await expect(marketingDialog).toHaveCount(0);
    await expect(requestViewing).toBeVisible();
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
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(
      dimensions.clientWidth + 1,
    );
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

test("public property tracking is first-party, per-property, and interaction-based", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  const response = await page.goto("/property/sea-view-residence");
  expectNavigationResponseOk(response, "/property/sea-view-residence");

  await expect.poll(() => guard.propertyAnalyticsEvents()).toContainEqual({
    propertySlug: "sea-view-residence",
    event: "property_page_viewed",
  });
  await expect
    .poll(
      () =>
        guard.propertyAnalyticsEvents().filter((event) =>
          event.event === "property_page_viewed" &&
          event.propertySlug === "sea-view-residence",
        ).length,
    )
    .toBe(1);

  await page
    .getByRole("button", { name: "Open gallery image: Exterior and pool" })
    .click();
  await expect.poll(() => guard.propertyAnalyticsEvents()).toContainEqual({
    propertySlug: "sea-view-residence",
    event: "gallery_opened",
  });
  await guard.expectNoPageErrorsOrServerErrors();
});

test("branded property showcase keeps contact actions, canonical analytics, and a compact mobile header", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await page.setViewportSize({ width: 390, height: 844 });

  const response = await page.goto("/property/costa-blanca-luxury-villa");
  expectNavigationResponseOk(response, "/property/costa-blanca-luxury-villa");

  const branding = page.getByTestId("property-branding");
  await expect(branding).toContainText("Costa Blanca Luxury Homes");
  await expect(branding.getByTestId("property-branding-logo")).toBeVisible();
  await expect(branding.getByTestId("property-branding-logo").locator("img")).toHaveCSS(
    "object-fit",
    "contain",
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Costa Blanca Luxury Villa" }),
  ).toBeVisible();
  const contact = page.getByTestId("property-agent-profile");
  await contact.scrollIntoViewIfNeeded();
  await expect(contact.getByTestId("property-branding-contact")).toBeVisible();
  await expect(contact.getByTestId("property-branding-contact-name")).toHaveText(
    "Costa Blanca Luxury Homes",
  );
  await expect(contact.getByTestId("property-branding-contact-logo")).toBeVisible();
  await expect(contact.getByTestId("property-agent-agency-logo")).toHaveCount(0);
  await expect(
    contact.getByRole("link", {
      name: "Visit agency website: Costa Blanca Luxury Homes",
    }),
  ).toBeVisible();
  await expect(contact).toContainText("Maria Garcia");
  await expect(contact).toContainText("Property Consultant");
  await expect(contact).toContainText("+34 600 000 000");
  await expect(contact.getByRole("link", { name: "WhatsApp" })).toBeVisible();
  await expect(
    contact.getByRole("link", { name: "Website", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("hero-request-viewing")).toBeVisible();
  await expect(page.locator("footer")).toContainText("Powered by");

  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  await expect.poll(() => guard.propertyAnalyticsEvents()).toContainEqual({
    propertySlug: "costa-blanca-luxury-villa",
    event: "property_page_viewed",
  });
  await expect.poll(() => guard.propertyAnalyticsEvents()).not.toContainEqual({
    propertySlug: "costa-blanca-luxury-homes",
    event: "property_page_viewed",
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await expect(branding).toContainText("Costa Blanca Luxury Homes");
  await expect(page.getByTestId("property-agent-profile")).toContainText("Maria Garcia");
  const desktopDimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(desktopDimensions.scrollWidth).toBeLessThanOrEqual(
    desktopDimensions.clientWidth + 1,
  );
  await guard.expectNoPageErrorsOrServerErrors();
});

test("branded property hero safely falls back to its name when the logo fails", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/property-demo/exterior.svg*", (route) => route.abort());

  const response = await page.goto("/property/costa-blanca-luxury-villa");
  expectNavigationResponseOk(response, "/property/costa-blanca-luxury-villa");

  const branding = page.getByTestId("property-branding");
  await expect(branding.getByTestId("property-branding-logo")).toHaveCount(0);
  await expect(branding).toContainText("Costa Blanca Luxury Homes");

  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  await guard.expectNoPageErrorsOrServerErrors();
});

test("property gallery modal keeps keyboard focus contained", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await page.setViewportSize({ width: 1024, height: 768 });

  const response = await page.goto("/property/sea-view-residence");
  expectNavigationResponseOk(response, "/property/sea-view-residence");

  const trigger = page
    .getByRole("button", { name: "Open gallery image: Exterior and pool" });
  await trigger.click();

  const dialog = page.getByRole("dialog", {
    name: "Property gallery: Exterior and pool",
  });
  const close = dialog.getByRole("button", { name: "Close gallery" });
  const next = dialog.getByRole("button", { name: "Next gallery image" });

  await expect(close).toBeFocused();
  await close.press("Shift+Tab");
  await expect(next).toBeFocused();
  await next.press("Tab");
  await expect(close).toBeFocused();
  await close.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
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

  await expect(page.getByRole("button", {
    name: "Open PicchuSpot AI assistant",
  })).toHaveCount(0);
  await guard.expectNoPageErrorsOrServerErrors();
});

test("property showcase language switcher falls back cleanly", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await page.setViewportSize({ width: 1440, height: 900 });

  const response = await page.goto("/property/sea-view-residence");

  expectNavigationResponseOk(response, "/property/sea-view-residence");
  const languageSelect = page.locator("nav select");
  await expect(languageSelect).toHaveCount(1);
  await languageSelect.selectOption("es");
  await expect(
    page.getByRole("heading", { level: 1, name: "Residencia con vistas al mar" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Inicio", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Resumen", exact: true })).toBeVisible();
  await languageSelect.selectOption("de");
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
  await expect(page.locator("nav select")).toHaveCount(0);
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
    page.getByTestId("property-map-external-link"),
  ).toHaveCount(0);
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
  await expect(page.locator("footer")).toContainText("Property showcase by");
  await expect(page.locator("footer")).toContainText("PicchuSpot");
  await expect(page.locator("footer")).not.toContainText("Full Frame Media");

  const socialImageUrlPattern =
    /^https:\/\/picchuspot\.com\/property\/sea-view-residence\/opengraph-image\?v=[0-9a-f]{14}$/;
  const openGraphImage = page.locator('meta[property="og:image"]');
  await expect(openGraphImage).toHaveAttribute("content", socialImageUrlPattern);
  const socialImageUrl = await openGraphImage.getAttribute("content");
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
    "content",
    socialImageUrl!,
  );
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute(
    "content",
    "1200",
  );
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute(
    "content",
    "630",
  );
  await expect(page.locator('meta[property="og:image:type"]')).toHaveAttribute(
    "content",
    "image/png",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://picchuspot.com/property/sea-view-residence",
  );
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    "content",
    /Altea, Alicante.*Bedrooms 3.*Bathrooms 2.*Built area 142\u00a0m\u00b2.*Parking Garage \+ driveway/,
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

test("mobile section navigation uses an in-viewport More menu", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await page.setViewportSize({ width: 430, height: 932 });

  const response = await page.goto("/property/sea-view-residence");
  expectNavigationResponseOk(response, "/property/sea-view-residence");

  const mobileNav = page.getByTestId("property-mobile-section-nav");
  const navMetrics = await page
    .getByTestId("property-mobile-section-nav-row")
    .evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
  expect(navMetrics.scrollWidth).toBe(navMetrics.clientWidth);
  await expect(mobileNav.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Overview" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Gallery" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "360 tour" })).toBeVisible();

  const moreButton = mobileNav.getByRole("button", {
    name: "More property sections",
  });
  await moreButton.click();
  const morePanel = page.getByTestId("property-mobile-more-panel");
  const floorPlans = morePanel.getByRole("link", { name: "Floor plans" });
  await expect(floorPlans).toBeVisible();
  await expect(floorPlans).toBeFocused();
  await expect(morePanel.getByRole("link", { name: "Interactive plan" })).toBeVisible();
  await expect(morePanel.getByRole("link", { name: "Contact" })).toBeVisible();
  await expect(morePanel.getByRole("link", { name: "Location" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(morePanel).toHaveCount(0);
  await expect(moreButton).toBeFocused();
  await moreButton.click();

  await expect(page.getByRole("button", {
    name: "Open PicchuSpot AI assistant",
  })).toHaveCount(0);

  await morePanel.getByRole("link", { name: "Contact" }).click();
  await expect(page).toHaveURL(/#contact$/);
  await expect(morePanel).toHaveCount(0);
  await expect(page.locator("#contact")).toBeInViewport();
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
  await expect(page.getByRole("link", { name: "Location" })).toHaveCount(0);
  await guard.expectNoPageErrorsOrServerErrors();
});

test("complete and minimal realtor profiles stay usable", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto("/property/sea-view-residence");
  const completeContact = page.locator("#contact");
  await expect(completeContact).toContainText("Costa Blanca Property Team");
  await expect(completeContact.getByRole("link", { name: "WhatsApp" })).toBeVisible();
  await expect(completeContact.getByRole("link", { name: "Instagram" })).toBeVisible();
  await expect(
    completeContact
      .getByRole("link", { name: "Instagram" })
      .getByTestId("social-icon-instagram"),
  ).toBeVisible();
  await expect(
    completeContact
      .getByRole("link", { name: "LinkedIn" })
      .getByTestId("social-icon-linkedin"),
  ).toBeVisible();
  await expect(completeContact.getByRole("link", { name: "Website" })).toBeVisible();
  await expect(completeContact).not.toContainText("https://picchuspot.com");
  expect((await completeContact.boundingBox())!.height).toBeLessThanOrEqual(440);

  await page.goto("/property/quiet-townhouse");
  const minimalContact = page.locator("#contact");
  await expect(minimalContact).toContainText("Demo Real Estate Agency");
  await expect(minimalContact.getByRole("link", { name: "WhatsApp" })).toHaveCount(0);
  expect((await minimalContact.boundingBox())!.height).toBeLessThanOrEqual(360);
  await guard.expectNoPageErrorsOrServerErrors();
});

test("stable property social endpoint returns a real public 1200 by 630 PNG", async ({
  request,
}) => {
  const response = await request.get(
    "/property/sea-view-residence/opengraph-image",
  );
  const body = await response.body();

  expect(response.status()).not.toBe(500);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/png");
  expect(response.headers()["content-type"]).not.toContain("text/html");
  expect(body.byteLength).toBeGreaterThan(8);
  expect(body.toString("utf8")).not.toContain("Internal Server Error");
  expect(pngDimensions(body)).toEqual({
    width: 1200,
    height: 630,
  });

  const head = await request.head(
    "/property/sea-view-residence/opengraph-image",
  );
  expect(head.status()).toBe(200);
  expect(head.headers()["content-type"]).toContain("image/png");
  expect(["generated", "fallback"]).toContain(
    head.headers()["x-picchuspot-social-image-status"],
  );
  expect(head.headers()["x-picchuspot-social-card-layout"]).toBe("balanced");
});

test("versioned property brochure route renders the automatic landscape flyer only", async ({
  page,
  request,
}) => {
  await page.goto("/property/sea-view-residence");
  await page.getByTestId("hero-download-brochure").click();
  const dialog = page.getByTestId("property-marketing-download-dialog");
  await expect(dialog.getByText("Property flyer", { exact: true })).toBeVisible();
  const href = await dialog
    .getByRole("img", { name: "Finished property brochure preview" })
    .getAttribute("src");
  expect(href).toMatch(
    /^\/property\/sea-view-residence\/materials\/brochure\.png\?v=[a-f0-9]{14}&preview=1$/,
  );

  const response = await request.get(href!);
  const body = await response.body();
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
  expect(response.headers()["content-disposition"]).toContain(
    "sea-view-residence-landscape-brochure.png",
  );
  expect(response.headers()["content-disposition"]).toContain("inline");
  expect(response.headers()["cache-control"]).toContain("immutable");
  expect(pngDimensions(body)).toEqual({ width: 960, height: 540 });

  const finalHref = href!.replace("&preview=1", "");
  const finalResponse = await request.get(finalHref);
  const finalBody = await finalResponse.body();
  expect(finalResponse.status()).toBe(200);
  expect(finalResponse.headers()["content-disposition"]).toContain("attachment");
  expect(finalResponse.headers()["cache-control"]).toContain("immutable");
  expect(pngDimensions(finalBody)).toEqual({ width: 1920, height: 1080 });
  const lowerPage = await sharp(finalBody)
    .extract({ left: 0, top: 500, width: 1920, height: 580 })
    .resize(64, 42)
    .removeAlpha()
    .raw()
    .toBuffer();
  const lowerPageColors = new Set<string>();
  for (let index = 0; index < lowerPage.length; index += 3) {
    lowerPageColors.add(
      `${Math.round(lowerPage[index] / 16)}-${Math.round(lowerPage[index + 1] / 16)}-${Math.round(lowerPage[index + 2] / 16)}`,
    );
  }
  expect(lowerPageColors.size).toBeGreaterThan(8);

  const stale = await request.get(
    "/property/sea-view-residence/materials/brochure.png?v=stale",
  );
  expect(stale.status()).toBe(404);
  expect(stale.headers()["cache-control"]).toBe("no-store");

  const portraitAsset = await request.get(
    finalHref.replace("brochure.png", "flyer.png"),
  );
  expect(portraitAsset.status()).toBe(404);

  const unauthenticatedDraft = await request.get(
    "/admin/properties/00000000-0000-0000-0000-000000000000/materials/brochure.pdf",
  );
  expect(unauthenticatedDraft.status()).toBe(401);
  expect(unauthenticatedDraft.headers()["cache-control"]).toBe("no-store");

  const unauthenticatedPreview = await request.post(
    "/api/admin/properties/00000000-0000-0000-0000-000000000000/materials/preview",
    {
      data: {
        marketingMaterials: {
          flyerMode: "automatic-landscape",
          enabled: true,
          brochure: {
            orientation: "landscape",
            template: "hero-two-square",
            supportingMediaIds: [],
          },
        },
        focalPoints: [],
      },
    },
  );
  expect(unauthenticatedPreview.status()).toBe(401);
  expect(unauthenticatedPreview.headers()["cache-control"]).toBe(
    "private, no-store",
  );
});

test("public brochure download uses the existing automatic flyer response", async ({
  page,
}) => {
  await page.goto("/property/sea-view-residence");
  await page.getByTestId("hero-download-brochure").click();
  const dialog = page.getByTestId("property-marketing-download-dialog");
  const pdf = dialog.getByRole("button", { name: /^Download PDF/ });
  const download = page.waitForEvent("download");
  await pdf.click();
  await expect(await download).toBeTruthy();
});

test("explicitly hidden media does not render sections or navigation targets", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await page.setViewportSize({ width: 1024, height: 768 });

  const response = await page.goto("/property/hidden-media-listing");
  expectNavigationResponseOk(response, "/property/hidden-media-listing");

  await expect(page.locator("#virtual-tour")).toHaveCount(0);
  await expect(page.locator("#interactive-floor-plan")).toHaveCount(0);
  await expect(page.locator("#contact")).toHaveCount(0);
  await expect(page.locator("#location")).toHaveCount(0);
  await expect(page.locator("#floor-plan")).toBeVisible();
  await expect(page.getByRole("link", { name: "360 tour" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Interactive plan" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Contact" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Location" })).toHaveCount(0);
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
  await expect(page.getByRole("link", { name: "Contact" })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Request a viewing" }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: /PicchuSpot contact/i })).toHaveCount(0);
  await guard.expectNoPageErrorsOrServerErrors();
});

test("compact property contact actions remain usable without the support launcher on mobile", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await page.setViewportSize({ width: 430, height: 932 });

  const response = await page.goto("/property/sea-view-residence");
  expectNavigationResponseOk(response, "/property/sea-view-residence");
  const contact = page.locator("#contact");
  await contact.scrollIntoViewIfNeeded();

  const action = contact.getByRole("button", { name: "Request a viewing" });
  const socialLink = contact.getByRole("link", { name: "LinkedIn" });
  const highlights = page.getByTestId("property-highlights");
  await expect(action).toBeVisible();
  await expect(page.getByRole("button", {
    name: "Open PicchuSpot AI assistant",
  })).toHaveCount(0);
  await socialLink.scrollIntoViewIfNeeded();
  await expect(socialLink).toBeVisible();
  await highlights.scrollIntoViewIfNeeded();
  await expect(highlights.locator("li")).not.toHaveCount(0);
  await action.click();
  const dialog = page.getByRole("dialog", { name: "Request a viewing" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
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

test("property showcase omits the support launcher while preserving interactive actions", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await page.setViewportSize({ width: 1440, height: 900 });

  const response = await page.goto("/property/sea-view-residence");

  expectNavigationResponseOk(response, "/property/sea-view-residence");
  await page.locator("#interactive-floor-plan").scrollIntoViewIfNeeded();

  const action = page.locator("#interactive-floor-plan").getByRole("link", {
    name: "Open interactive floor plan",
  }).first();
  await expect(page.getByRole("button", {
    name: "Open PicchuSpot AI assistant",
  })).toHaveCount(0);
  await expect(action).toBeVisible();
  await guard.expectNoPageErrorsOrServerErrors();
});

test("draft preview is protected for unauthenticated visitors", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);

  await page.goto("/admin/properties/00000000-0000-0000-0000-000000000000/preview");

  await expect(page).toHaveURL(/\/admin\/login/);
  expect(guard.propertyAnalyticsEvents()).toEqual([]);
  await guard.expectNoPageErrorsOrServerErrors();
});
