import { expect, test } from "@playwright/test";
import {
  expectNavigationResponseOk,
  installSmokeNetworkGuards,
} from "../support/network";

const propertyViewports = [
  { width: 320, height: 568 },
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
      const value = page
        .getByTestId(`property-fact-value-${key}`);
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
  const languageSelect = page.locator("nav select");
  await expect(languageSelect).toHaveCount(1);
  await languageSelect.selectOption("es");
  await expect(
    page.getByRole("heading", { level: 1, name: "Residencia con vistas al mar" }),
  ).toBeVisible();
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

  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://picchuspot.com/property/sea-view-residence/opengraph-image",
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
    /PS-001.*3 bedrooms.*2 bathrooms.*142\u00a0m\u00b2/,
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

  await mobileNav.getByRole("button", { name: "More sections" }).click();
  const moreMenu = page.getByRole("menu", { name: "More property sections" });
  await expect(moreMenu.getByRole("menuitem", { name: "Floor plans" })).toBeVisible();
  await expect(moreMenu.getByRole("menuitem", { name: "Interactive plan" })).toBeVisible();
  await expect(moreMenu.getByRole("menuitem", { name: "Contact" })).toBeVisible();
  await expect(moreMenu.getByRole("menuitem", { name: "Location" })).toBeVisible();

  const launcher = page.getByRole("button", {
    name: "Open PicchuSpot AI assistant",
  });
  if ((await launcher.count()) > 0) {
    await expect(launcher).toBeVisible();
    const [menuBox, launcherBox] = await Promise.all([
      moreMenu.boundingBox(),
      launcher.boundingBox(),
    ]);
    expect(menuBox).not.toBeNull();
    expect(launcherBox).not.toBeNull();
    const overlaps =
      menuBox!.x < launcherBox!.x + launcherBox!.width &&
      menuBox!.x + menuBox!.width > launcherBox!.x &&
      menuBox!.y < launcherBox!.y + launcherBox!.height &&
      menuBox!.y + menuBox!.height > launcherBox!.y;
    expect(overlaps).toBe(false);
  }

  await moreMenu.getByRole("menuitem", { name: "Contact" }).click();
  await expect(page).toHaveURL(/#contact$/);
  await expect(moreMenu).toHaveCount(0);
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

test("compact contact actions do not overlap the support launcher on mobile", async ({
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
  const launcher = page.getByRole("button", {
    name: "Open PicchuSpot AI assistant",
  });
  await expect(action).toBeVisible();
  if ((await launcher.count()) > 0) {
    await expect(launcher).toBeVisible();
    const [actionBox, launcherBox] = await Promise.all([
      action.boundingBox(),
      launcher.boundingBox(),
    ]);
    expect(actionBox).not.toBeNull();
    expect(launcherBox).not.toBeNull();
    const overlaps =
      actionBox!.x < launcherBox!.x + launcherBox!.width &&
      actionBox!.x + actionBox!.width > launcherBox!.x &&
      actionBox!.y < launcherBox!.y + launcherBox!.height &&
      actionBox!.y + actionBox!.height > launcherBox!.y;
    expect(overlaps).toBe(false);

    await socialLink.scrollIntoViewIfNeeded();
    await expect(socialLink).toBeVisible();
    const [socialBox, socialLauncherBox] = await Promise.all([
      socialLink.boundingBox(),
      launcher.boundingBox(),
    ]);
    expect(socialBox).not.toBeNull();
    expect(socialLauncherBox).not.toBeNull();
    const socialOverlaps =
      socialBox!.x < socialLauncherBox!.x + socialLauncherBox!.width &&
      socialBox!.x + socialBox!.width > socialLauncherBox!.x &&
      socialBox!.y < socialLauncherBox!.y + socialLauncherBox!.height &&
      socialBox!.y + socialBox!.height > socialLauncherBox!.y;
    expect(socialOverlaps).toBe(false);

    await highlights.scrollIntoViewIfNeeded();
    const highlightItems = highlights.locator("li");
    const highlightCount = await highlightItems.count();
    expect(highlightCount).toBeGreaterThan(0);
    const finalHighlight = highlightItems.nth(highlightCount - 1);
    await expect(finalHighlight).toBeVisible();
    const [highlightBox, highlightLauncherBox] = await Promise.all([
      finalHighlight.boundingBox(),
      launcher.boundingBox(),
    ]);
    expect(highlightBox).not.toBeNull();
    expect(highlightLauncherBox).not.toBeNull();
    const highlightOverlaps =
      highlightBox!.x < highlightLauncherBox!.x + highlightLauncherBox!.width &&
      highlightBox!.x + highlightBox!.width > highlightLauncherBox!.x &&
      highlightBox!.y < highlightLauncherBox!.y + highlightLauncherBox!.height &&
      highlightBox!.y + highlightBox!.height > highlightLauncherBox!.y;
    expect(highlightOverlaps).toBe(false);
  }
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
