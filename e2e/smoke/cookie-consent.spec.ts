import { expect, test, type Page } from "@playwright/test";
import {
  expectNavigationResponseOk,
  installSmokeNetworkGuards,
} from "../support/network";

const CONSENT_STORAGE_KEY = "picchuspot_cookie_consent";
const MOBILE_VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
] as const;

type ConsentChoice = "accepted" | "rejected";

async function installConsentRecorder(page: Page) {
  await page.addInitScript(() => {
    const browserWindow = window as Window & {
      dataLayer?: unknown[];
      gtag?: (...args: unknown[]) => void;
    };

    browserWindow.dataLayer = [];
    browserWindow.gtag = (...args: unknown[]) => {
      browserWindow.dataLayer?.push(args);
    };
  });
}

async function getStoredConsent(page: Page) {
  return page.evaluate((storageKey) => localStorage.getItem(storageKey), CONSENT_STORAGE_KEY);
}

async function hasConsentModeUpdate(
  page: Page,
  analyticsStorage: "granted" | "denied",
) {
  return page.evaluate((expectedAnalyticsStorage) => {
    const entries = (window.dataLayer ?? []) as unknown[];

    return entries.some((entry) => {
      const args = Array.from(entry as ArrayLike<unknown>);
      const state = args[2] as { analytics_storage?: unknown } | undefined;

      return (
        args[0] === "consent" &&
        args[1] === "update" &&
        state?.analytics_storage === expectedAnalyticsStorage
      );
    });
  }, analyticsStorage);
}

for (const viewport of MOBILE_VIEWPORTS) {
  test(`cookie banner stays compact at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    const guard = await installSmokeNetworkGuards(page, testInfo);
    const response = await page.goto("/");

    expectNavigationResponseOk(response, "/");

    const banner = page.getByRole("complementary", { name: "Cookie consent" });
    const privacyLink = banner.getByRole("link", { name: "Privacy Policy" });
    const rejectButton = banner.getByRole("button", { name: "Reject" });
    const acceptButton = banner.getByRole("button", { name: "Accept analytics" });

    await expect(banner).toBeVisible();
    await expect(banner.getByText("Analytics cookies", { exact: true })).toBeVisible();
    await expect(privacyLink).toHaveAttribute("href", "/privacy");
    await expect(rejectButton).toBeVisible();
    await expect(acceptButton).toBeVisible();

    const [bannerBox, privacyBox, rejectBox, acceptBox, pageWidths] = await Promise.all([
      banner.boundingBox(),
      privacyLink.boundingBox(),
      rejectButton.boundingBox(),
      acceptButton.boundingBox(),
      page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      })),
    ]);

    expect(bannerBox?.height).toBeLessThanOrEqual(200);
    expect(privacyBox?.height).toBeGreaterThanOrEqual(44);
    expect(rejectBox?.height).toBeGreaterThanOrEqual(44);
    expect(acceptBox?.height).toBeGreaterThanOrEqual(44);
    expect(pageWidths.scrollWidth).toBeLessThanOrEqual(pageWidths.clientWidth);
    await guard.expectClean();
  });
}

for (const choice of ["accepted", "rejected"] as const) {
  test(`${choice} consent persists, updates consent mode, and suppresses the banner`, async ({
    page,
  }, testInfo) => {
    await installConsentRecorder(page);
    const guard = await installSmokeNetworkGuards(page, testInfo);
    await page.goto("/");

    const banner = page.getByRole("complementary", { name: "Cookie consent" });
    await expect(banner).toBeVisible();

    await banner
      .getByRole("button", {
        name: choice === "accepted" ? "Accept analytics" : "Reject",
      })
      .click();

    await expect(banner).toBeHidden();
    await expect.poll(() => getStoredConsent(page)).toBe(choice);
    await expect
      .poll(() =>
        hasConsentModeUpdate(page, choice === "accepted" ? "granted" : "denied"),
      )
      .toBe(true);

    await page.reload();
    await expect(banner).toBeHidden();
    await expect.poll(() => getStoredConsent(page)).toBe(choice);
    await guard.expectClean();
  });
}

for (const choice of ["accepted", "rejected"] as const) {
  test(`stored ${choice} consent prevents the banner from reappearing`, async ({
    page,
  }, testInfo) => {
    await page.addInitScript(
      ({ storageKey, storedChoice }: { storageKey: string; storedChoice: ConsentChoice }) => {
        localStorage.setItem(storageKey, storedChoice);
      },
      { storageKey: CONSENT_STORAGE_KEY, storedChoice: choice },
    );
    const guard = await installSmokeNetworkGuards(page, testInfo);

    await page.goto("/");

    await expect(
      page.getByRole("complementary", { name: "Cookie consent" }),
    ).toBeHidden();
    await guard.expectClean();
  });
}

test("privacy policy link keeps the consent banner routing intact", async ({
  page,
}, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await page.goto("/");

  await page
    .getByRole("complementary", { name: "Cookie consent" })
    .getByRole("link", { name: "Privacy Policy" })
    .click();

  await expect(page).toHaveURL(/\/privacy$/);
  await expect(
    page.getByRole("heading", {
      name: "How we handle client and project information",
    }),
  ).toBeVisible();
  await guard.expectClean();
});
