import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import {
  expectNavigationResponseOk,
  installSmokeNetworkGuards,
} from "../support/network";

const DASHBOARD_VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 900 },
  { width: 1440, height: 1000 },
  { width: 1980, height: 1100 },
  { width: 3840, height: 1400 },
] as const;

const JOBS_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1024, height: 900 },
  { width: 1440, height: 1000 },
] as const;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("picchuspot_cookie_consent", "rejected");
  });
});

test("dashboard typography keeps its hierarchy at every control width", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const guard = await installDashboardTypographyGuards(page, testInfo);

  for (const viewport of DASHBOARD_VIEWPORTS) {
    await page.setViewportSize(viewport);
    await openQaDashboardRoute(page, "/dashboard");

    await expect(
      page.locator('[data-dashboard-section="awaiting-submission"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-dashboard-section="recently-completed"]'),
    ).toBeVisible();
    await expect(
      page.locator("[data-dashboard-services]").getByRole("heading", {
        name: "Services",
        exact: true,
      }),
    ).toBeVisible();

    const fontFamilies = await page
      .locator("body, [data-dashboard-scroll-container]")
      .evaluateAll((elements) =>
        elements.map((element) => getComputedStyle(element).fontFamily),
      );
    expect(
      fontFamilies.every((fontFamily) => fontFamily.includes("Geist")),
      `${viewport.width}px dashboard should use Geist`,
    ).toBe(true);
    expect(
      await page.evaluate(() =>
        Array.from(document.fonts).some(
          (font) => font.family.replaceAll('"', "") === "Geist" && font.status === "loaded",
        ),
      ),
      `${viewport.width}px Geist web font should be loaded`,
    ).toBe(true);

    const sectionMinimum = viewport.width >= 1024 ? 18 : 16;
    await expectVisibleFontSizeAtLeast(
      page.locator(
        [
          '[data-dashboard-section="awaiting-submission"] h2',
          '[data-dashboard-section="recently-completed"] h2',
          "[data-dashboard-services] h2.text-dashboard-section",
        ].join(", "),
      ),
      sectionMinimum,
      `${viewport.width}px primary section headings`,
      3,
    );
    await expectVisibleFontSizeAtLeast(
      page.locator(".text-dashboard-action"),
      14,
      `${viewport.width}px dashboard actions, navigation, and row titles`,
    );
    await expectVisibleFontSizeAtLeast(
      page.locator(".text-dashboard-metadata"),
      13,
      `${viewport.width}px dashboard metadata`,
    );
    await expectVisibleFontSizeAtLeast(
      page.locator("[data-dashboard-critical-title]"),
      14,
      `${viewport.width}px dashboard row and service titles`,
    );

    await expectNoVisibleTextBelow(page.locator("body"), 12, viewport.width);
    await expectNoLightSurfaceGoldText(page.locator("body"), viewport.width);
    await expectNoDocumentOverflow(page, viewport.width);

    if (viewport.width >= 1024) {
      await expectAvailableServiceExamplesDoNotOverlap(page, viewport.width, testInfo);
    }

    if (viewport.width <= 390) {
      await expectCriticalTextCanWrap(page, viewport.width);
      await expectVisibleFontSizeAtLeast(
        page.locator(
          '[aria-label="Client portal quick actions"] button > span',
        ),
        14,
        `${viewport.width}px Account and Chat actions`,
        2,
      );
    }

    if (viewport.width === 390) {
      await page
        .getByRole("button", { name: "Open dashboard menu" })
        .click();
      const drawer = page.getByRole("dialog", {
        name: "Dashboard navigation menu",
      });
      await expect(drawer).toBeVisible();
      await expectVisibleFontSizeAtLeast(
        drawer.getByText(/^(Portal|Live|Demo|Menu)$/),
        13,
        "mobile drawer labels",
        3,
      );
      await expectVisibleFontSizeAtLeast(
        drawer.locator('nav[aria-label="Dashboard navigation"] a'),
        14,
        "mobile dashboard navigation",
      );
      await drawer
        .getByRole("button", { name: "Close navigation menu" })
        .click();
    }

    if (viewport.width === 1440) {
      await expectVisibleFontSizeAtLeast(
        page.locator('nav[aria-label="Dashboard navigation"] a'),
        14,
        "desktop dashboard navigation",
      );
      await page
        .getByRole("button", { name: /^Account menu for / })
        .click();
      await expectVisibleFontSizeAtLeast(
        page.getByText("qa-preview@picchuspot.invalid", { exact: true }),
        13,
        "account dropdown email",
      );
      await page.keyboard.press("Escape");
      await expectAvailableVirtualStagingExamplesModal(page, testInfo);
    }
  }

  await guard.expectClean();
});

test("Jobs keeps readable rows and contains its desktop table scroll", async ({
  page,
}, testInfo) => {
  test.setTimeout(75_000);
  const guard = await installDashboardTypographyGuards(page, testInfo);

  for (const viewport of JOBS_VIEWPORTS) {
    await page.setViewportSize(viewport);
    await openQaDashboardRoute(page, "/dashboard/jobs");
    await expect(
      page.getByRole("heading", { name: "Jobs", exact: true }),
    ).toBeVisible();

    const controlMinimum = viewport.width < 768 ? 16 : 14;
    await expectVisibleFontSizeAtLeast(
      page.locator(
        'input[placeholder="Search by title, reference or service..."]',
      ),
      controlMinimum,
      `${viewport.width}px Jobs search`,
    );
    // The Jobs shell replaces the table select with the shared status filters.
    await expect(page.locator('select[aria-label="Filter by status"]')).toHaveCount(0);
    await expectVisibleFontSizeAtLeast(
      page.locator("[data-job-status-filter]"),
      14,
      `${viewport.width}px Jobs status filters`,
    );
    await expectVisibleFontSizeAtLeast(
      page.locator(".text-dashboard-action"),
      14,
      `${viewport.width}px Jobs actions and row titles`,
    );
    await expectVisibleFontSizeAtLeast(
      page.locator(".text-dashboard-metadata"),
      13,
      `${viewport.width}px Jobs metadata and statuses`,
    );
    const visibleJobs = page.locator(
      viewport.width >= 1024
        ? "[data-desktop-jobs-table]"
        : "[data-mobile-jobs-list]",
    );
    await expectVisibleFontSizeAtLeast(
      visibleJobs.getByText(/^(In Progress|Pending Rework|New Version Ready|Completed)$/),
      13,
      `${viewport.width}px rendered job status badges`,
      9,
    );
    await expectVisibleFontSizeAtLeast(
      visibleJobs.locator("[data-dashboard-cost]"),
      14,
      `${viewport.width}px job costs`,
      9,
    );

    if (viewport.width >= 1024) {
      const tableContainer = page.locator("[data-desktop-jobs-table]");
      await expect(tableContainer).toBeVisible();
      await expectVisibleFontSizeAtLeast(
        tableContainer.locator("th"),
        13,
        `${viewport.width}px Jobs table headers`,
      );
      const tableScroll = await tableContainer.evaluate((element) => ({
        clientWidth: element.clientWidth,
        overflowX: getComputedStyle(element).overflowX,
        scrollWidth: element.scrollWidth,
      }));
      expect(["auto", "scroll"]).toContain(tableScroll.overflowX);
      if (viewport.width === 1024) {
        expect(tableScroll.scrollWidth).toBeGreaterThan(tableScroll.clientWidth);
      }
    } else {
      await expect(page.locator("[data-mobile-jobs-list]")).toBeVisible();
    }

    await expectCriticalTextCanWrap(page, viewport.width);
    await expectNoVisibleTextBelow(page.locator("body"), 12, viewport.width);
    await expectNoLightSurfaceGoldText(page.locator("body"), viewport.width);
    await expectNoDocumentOverflow(page, viewport.width);
  }

  await guard.expectClean();
});

test("Profile, Support Chat, and New Order keep mobile controls readable", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const guard = await installDashboardTypographyGuards(page, testInfo);

  await page.setViewportSize({ width: 390, height: 844 });
  await openQaDashboardRoute(page, "/dashboard/profile");
  await expect(
    page.getByRole("heading", { name: "Profile", exact: true }),
  ).toBeVisible();
  await expectVisibleFontSizeAtLeast(
    visibleTextControls(page),
    16,
    "390px Profile fields",
  );
  await expectVisibleFontSizeAtLeast(
    page.locator("form label"),
    14,
    "390px Profile field labels",
  );
  await expectNoVisibleTextBelow(page.locator("body"), 12, 390);
  await expectNoDocumentOverflow(page, 390);

  await page
    .getByRole("button", { name: "Open PicchuSpot support chat" })
    .click();
  const chat = page.locator("#support-chat-widget");
  await expect(chat).toBeVisible();
  await expectVisibleFontSizeAtLeast(
    chat.locator("textarea"),
    16,
    "390px Support Chat textarea",
  );
  await expectVisibleFontSizeAtLeast(
    chat.locator(".text-dashboard-action"),
    14,
    "Support Chat quick actions",
  );
  await expectVisibleFontSizeAtLeast(
    chat.locator(".text-dashboard-metadata"),
    13,
    "Support Chat helper text and counters",
  );
  await expectNoVisibleTextBelow(chat, 12, 390);
  await chat.getByRole("button", { name: /close/i }).click();

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 1000 },
  ] as const) {
    await page.setViewportSize(viewport);
    await openQaDashboardRoute(page, "/dashboard/orders/new");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoVisibleTextBelow(page.locator("body"), 12, viewport.width);
    await expectNoLightSurfaceGoldText(page.locator("body"), viewport.width);
    await expectNoDocumentOverflow(page, viewport.width);

    await openQaDashboardRoute(
      page,
      "/dashboard/orders/new/virtual-staging",
    );
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectVisibleFontSizeAtLeast(
      visibleTextControls(page),
      viewport.width < 768 ? 16 : 14,
      `${viewport.width}px Virtual Staging fields`,
    );
    await expectNoVisibleTextBelow(page.locator("body"), 12, viewport.width);
    await expectNoLightSurfaceGoldText(page.locator("body"), viewport.width);
    await expectNoDocumentOverflow(page, viewport.width);
  }

  await guard.expectClean();
});

test("dashboard pages reflow at the CSS width equivalent to 200% desktop zoom", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const guard = await installDashboardTypographyGuards(page, testInfo);

  // 1440 CSS px at 200% zoom has 720 CSS px of layout space. This tests
  // reflow; browser zoom rasterization is covered by manual visual QA.
  await page.setViewportSize({ width: 720, height: 900 });
  for (const route of [
    "/dashboard",
    "/dashboard/jobs",
    "/dashboard/files",
    "/dashboard/invoices",
    "/dashboard/support",
    "/dashboard/profile",
    "/dashboard/orders/new",
    "/dashboard/orders/new/virtual-staging",
  ]) {
    await openQaDashboardRoute(page, route);
    await expectNoDocumentOverflow(page, 720);
    await expectNoVisibleTextBelow(page.locator("body"), 12, 720);
    await expectNoLightSurfaceGoldText(page.locator("body"), 720);
  }

  await guard.expectClean();
});

async function installDashboardTypographyGuards(page: Page, testInfo: TestInfo) {
  const networkGuard = await installSmokeNetworkGuards(page, testInfo);
  const consoleErrors: string[] = [];
  const localDevConsoleNotes: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location().url;
    let url: URL | null = null;
    try {
      url = new URL(location);
    } catch {
      // Console messages without source locations still need to fail the test.
    }
    const isLocal = url?.hostname === "127.0.0.1" || url?.hostname === "localhost";
    const knownDevCspMessage =
      isLocal &&
      url?.pathname.startsWith("/_next/static/") &&
      message.text().startsWith("eval() is not supported in this environment.") &&
      message.text().includes("React will never use eval() in production mode");
    const knownLocalStyleFallback =
      isLocal &&
      /^\/images\/styles\/(modern|urban-industrial|scandinavian|mid-century-modern|farmhouse|hamptons|contemporary|traditional|commercial-office|commercial-non-office)\.jpg$/.test(url?.pathname ?? "") &&
      message.text() === "Failed to load resource: the server responded with a status of 404 (Not Found)";

    if (knownDevCspMessage || knownLocalStyleFallback) {
      localDevConsoleNotes.push(`${message.text()} (${location})`);
      return;
    }
    consoleErrors.push(location ? `${message.text()} (${location})` : message.text());
  });

  return {
    async expectClean() {
      // The existing guard continues to reject uncaught errors, HTTP 500s and
      // every forbidden API request. Only exact local-dev console diagnostics
      // are separated above; deployed Preview console errors remain strict.
      await networkGuard.expectNoPageErrorsOrServerErrors();
      if (localDevConsoleNotes.length > 0) {
        await testInfo.attach("known-local-dev-console-notes", {
          contentType: "application/json",
          body: JSON.stringify(localDevConsoleNotes, null, 2),
        });
      }
      expect(consoleErrors, "unexpected Dashboard console errors").toEqual([]);
    },
  };
}

async function openQaDashboardRoute(page: Page, route: string) {
  const response = await page.goto(route);
  expectNavigationResponseOk(response, route);

  if (new URL(page.url()).pathname === "/login") {
    test.skip(
      true,
      "Dashboard QA Preview is unavailable in the normal production-build smoke server.",
    );
  }

  await expect(
    page.getByText("QA Preview", { exact: true }).first(),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

function visibleTextControls(page: Page) {
  return page.locator(
    [
      'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"])',
      "select",
      "textarea",
    ].join(", "),
  );
}

async function expectAvailableServiceExamplesDoNotOverlap(
  page: Page,
  viewportWidth: number,
  testInfo: TestInfo,
) {
  const buttons = page.locator("[data-dashboard-services]").getByRole("button", {
    name: /^View .+ examples$/,
  });
  const samples = await buttons.evaluateAll((elements) =>
    elements.map((button) => {
      const buttonRect = button.getBoundingClientRect();
      const captions = button.closest("article")?.querySelectorAll(
        "[data-dashboard-service-caption]",
      );
      return {
        service: button.getAttribute("aria-label"),
        captions: Array.from(captions ?? []).map((caption) => {
          const captionRect = caption.getBoundingClientRect();
          const overlapWidth = Math.min(buttonRect.right, captionRect.right) -
            Math.max(buttonRect.left, captionRect.left);
          const overlapHeight = Math.min(buttonRect.bottom, captionRect.bottom) -
            Math.max(buttonRect.top, captionRect.top);
          return {
            text: caption.textContent?.trim(),
            fontSize: Number.parseFloat(getComputedStyle(caption).fontSize),
            visible: captionRect.width > 0 && captionRect.height > 0,
            overlapsButton: overlapWidth > 1 && overlapHeight > 1,
          };
        }),
      };
    }),
  );

  if (samples.length === 0) {
    testInfo.annotations.push({
      type: "coverage",
      description: `${viewportWidth}px service example overlap check unavailable: QA has no portfolio examples.`,
    });
    return;
  }

  for (const sample of samples) {
    expect(sample.captions, `${sample.service} should expose both preview captions`).toHaveLength(2);
    for (const caption of sample.captions) {
      const label = `${viewportWidth}px ${sample.service}: ${caption.text}`;
      expect(caption.visible, `${label} should be rendered`).toBe(true);
      expect(caption.fontSize, `${label} should be at least 13px`).toBeGreaterThanOrEqual(13);
      expect(caption.overlapsButton, `${label} should not overlap the Examples button`).toBe(false);
    }
  }
}

async function expectAvailableVirtualStagingExamplesModal(page: Page, testInfo: TestInfo) {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    if (viewport.width === 390) {
      // The Dashboard replaces desktop service cards below its breakpoint.
      // The New Order catalog keeps Examples available on mobile.
      await openQaDashboardRoute(page, "/dashboard/orders/new");
    }
    const trigger = (viewport.width === 1440
      ? page.locator("[data-dashboard-services]")
      : page
    ).getByRole("button", {
      name: "View Virtual Staging examples",
      exact: true,
    });
    if (await trigger.count() === 0) {
      testInfo.annotations.push({
        type: "coverage",
        description: `${viewport.width}px examples modal check unavailable: QA has no Virtual Staging portfolio examples.`,
      });
      continue;
    }

    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Virtual Staging examples", exact: true });
    await expect(dialog).toBeVisible();
    await expectVisibleFontSizeAtLeast(
      dialog.locator("figure span"),
      13,
      `${viewport.width}px examples modal figure captions`,
      2,
    );
    const layout = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        fitsViewport: rect.left >= 0 && rect.right <= window.innerWidth,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        overflowingFigures: Array.from(element.querySelectorAll("figure")).flatMap((figure) => {
          const figureRect = figure.getBoundingClientRect();
          return figureRect.left < rect.left - 1 || figureRect.right > rect.right + 1
            ? [figure.textContent?.trim()]
            : [];
        }),
      };
    });
    expect(layout.fitsViewport, `${viewport.width}px examples modal should fit the viewport`).toBe(true);
    expect(layout.scrollWidth, `${viewport.width}px examples modal should not overflow horizontally`)
      .toBeLessThanOrEqual(layout.clientWidth);
    expect(layout.overflowingFigures, `${viewport.width}px examples should stay inside the modal`).toEqual([]);
    await expectNoDocumentOverflow(page, viewport.width);
    await dialog.getByRole("button", { name: "Close examples", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await openQaDashboardRoute(page, "/dashboard");
}

async function expectVisibleFontSizeAtLeast(
  locator: Locator,
  minimum: number,
  label: string,
  minimumCount = 1,
) {
  const samples = await locator.evaluateAll((elements) =>
    elements.flatMap((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (
        rect.width <= 0 ||
        rect.height <= 0 ||
        style.display === "none" ||
        style.visibility === "hidden"
      ) {
        return [];
      }

      return [
        {
          fontSize: Number.parseFloat(style.fontSize),
          text: element.textContent?.replace(/\s+/g, " ").trim().slice(0, 100) ||
            element.getAttribute("aria-label") ||
            element.tagName.toLowerCase(),
        },
      ];
    }),
  );

  expect(samples.length, `${label} should have visible samples`).toBeGreaterThanOrEqual(
    minimumCount,
  );
  for (const sample of samples) {
    expect.soft(
      sample.fontSize,
      `${label}: "${sample.text}" should be at least ${minimum}px`,
    ).toBeGreaterThanOrEqual(minimum);
  }
}

async function expectNoVisibleTextBelow(
  root: Locator,
  minimum: number,
  viewportWidth: number,
) {
  const offenders = await root.evaluate((container, minimumSize) =>
    [container, ...container.querySelectorAll("*")].flatMap((element) => {
      if (!(element instanceof HTMLElement)) return [];
      if (element.closest('[aria-hidden="true"]')) return [];

      const text = Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) return [];

      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const fontSize = Number.parseFloat(style.fontSize);
      if (
        rect.width <= 0 ||
        rect.height <= 0 ||
        style.display === "none" ||
        style.visibility === "hidden" ||
        !Number.isFinite(fontSize) ||
        fontSize >= minimumSize
      ) {
        return [];
      }

      return [{ fontSize, tag: element.tagName.toLowerCase(), text: text.slice(0, 100) }];
    }), minimum);

  expect(
    offenders,
    `${viewportWidth}px should have no visible user text below ${minimum}px`,
  ).toEqual([]);
}

async function expectNoLightSurfaceGoldText(
  root: Locator,
  viewportWidth: number,
) {
  const offenders = await root.locator(".text-secondary").evaluateAll((elements) =>
    elements.flatMap((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (
        rect.width <= 0 ||
        rect.height <= 0 ||
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.color !== "rgb(199, 169, 78)" ||
        !element.textContent?.trim()
      ) {
        return [];
      }

      const onApprovedDarkSurface = element.closest(
        '[data-dashboard-section="welcome-offer"], .bg-primary, .bg-primary-dark',
      );
      return onApprovedDarkSurface
        ? []
        : [{
            className: element.getAttribute("class") ?? "",
            text: element.textContent.replace(/\s+/g, " ").trim().slice(0, 100),
          }];
    }),
  );

  expect(
    offenders,
    `${viewportWidth}px should not use PicchuSpot Gold for text on light surfaces`,
  ).toEqual([]);
}

async function expectNoDocumentOverflow(page: Page, viewportWidth: number) {
  const widths = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(
    widths.scrollWidth,
    `${viewportWidth}px document should not overflow horizontally`,
  ).toBeLessThanOrEqual(widths.clientWidth);
}

async function expectCriticalTextCanWrap(page: Page, viewportWidth: number) {
  const samples = await page
    .locator("[data-dashboard-critical-title]")
    .evaluateAll((elements) =>
      elements.flatMap((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (
          rect.width <= 0 ||
          rect.height <= 0 ||
          style.display === "none" ||
          style.visibility === "hidden"
        ) {
          return [];
        }
        return [{
          lineClamp: style.getPropertyValue("-webkit-line-clamp"),
          text: element.textContent?.replace(/\s+/g, " ").trim().slice(0, 100) || "",
          textOverflow: style.textOverflow,
          whiteSpace: style.whiteSpace,
        }];
      }),
    );

  expect(
    samples.length,
    `${viewportWidth}px should expose critical wrapping samples`,
  ).toBeGreaterThan(0);
  for (const sample of samples) {
    expect.soft(
      sample.whiteSpace,
      `${viewportWidth}px critical text "${sample.text}" should wrap`,
    ).not.toBe("nowrap");
    expect.soft(
      sample.textOverflow,
      `${viewportWidth}px critical text "${sample.text}" should not use one-line ellipsis`,
    ).not.toBe("ellipsis");
    expect.soft(
      sample.lineClamp,
      `${viewportWidth}px critical text "${sample.text}" should not clamp to one line`,
    ).not.toBe("1");
  }
}
