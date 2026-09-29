import { expect, test, type Page } from "@playwright/test";
import { installSmokeNetworkGuards } from "../support/network";

const serviceRoute = "/dashboard/orders/new/virtual-renovation";
const requirement = "Add your name to place this order";

async function login(page: Page, destination: string) {
  await page.goto(`/login?redirectTo=${encodeURIComponent(destination)}`);
  await page.getByLabel("Email address", { exact: true }).fill("root-client@example.com");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password-only");
  await page.getByRole("button", { name: "Sign in to your account", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname + url.search === destination);
}

async function expectOrderForm(page: Page) {
  await expect(page.getByRole("heading", { name: "Virtual Renovation", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: requirement })).toHaveCount(0);
  await page.getByRole("button", { name: "Start Virtual Renovation Order", exact: true }).click();
  await expect(page.locator('input[type="file"]').first()).toBeAttached();
}

test.beforeEach(async ({ context }) => {
  await context.route("https://www.googletagmanager.com/**", (route) =>
    route.fulfill({ contentType: "application/javascript", body: "" }),
  );
});

test("incomplete profile is gated after client-side catalogue navigation and returns to the order after saving", async ({ page, request }, testInfo) => {
  await request.post("/__fixture/reset", { data: { mode: "password-login" } });
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await login(page, "/dashboard/orders/new");
  await expect(page.getByRole("heading", { name: "Start a new order", exact: true })).toBeVisible();
  await expect(page.getByText("QA Preview", { exact: true })).toHaveCount(0);

  // A document sentinel and navigation listener prove this exercises layout
  // reuse through Next Link, rather than hiding the bug with page.goto/reload.
  await page.evaluate(() => {
    (window as Window & { orderingDocumentSentinel?: string }).orderingDocumentSentinel = "catalogue";
  });
  const documentNavigations: string[] = [];
  page.on("request", (req) => {
    if (req.isNavigationRequest() && req.frame() === page.mainFrame()) {
      documentNavigations.push(req.url());
    }
  });
  const before = await (await request.get("/__fixture/state")).json();
  await page.locator(`a[href="${serviceRoute}"]`).click();
  await expect(page).toHaveURL(new RegExp(`${serviceRoute}$`));
  await expect(page.getByRole("heading", { name: requirement, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Virtual Renovation Order" })).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  expect(await page.evaluate(() =>
    (window as Window & { orderingDocumentSentinel?: string }).orderingDocumentSentinel,
  )).toBe("catalogue");
  expect(documentNavigations).toEqual([]);
  const gated = await (await request.get("/__fixture/state")).json();
  expect(gated.authenticatedUserReads).toBeGreaterThan(before.authenticatedUserReads);
  expect(gated.profile).toBeNull();
  await guard.expectClean();

  const complete = page.getByRole("link", { name: "Complete profile", exact: true });
  const back = page.getByRole("link", { name: "Back to dashboard", exact: true });
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(complete).toBeVisible();
    await expect(back).toBeVisible();
    await complete.focus();
    await page.keyboard.press("Tab");
    await expect(back).toBeFocused();
    expect(await back.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const completeBox = (await complete.boundingBox())!;
    const backBox = (await back.boundingBox())!;
    expect(width < 640
      ? backBox.y >= completeBox.y + completeBox.height
      : backBox.x >= completeBox.x + completeBox.width).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`profile-requirement-${width}.png`), fullPage: true });
  }

  // Dashboard reads its saved-draft list; allow only that read through the
  // real authenticated API into the empty local fixture. Writes stay blocked.
  await page.route("**/api/order-drafts?limit=8", (route) =>
    route.request().method() === "GET" ? route.continue() : route.fallback(),
  );
  await back.click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /^Welcome back,/ })).toBeVisible();
  await page.getByRole("navigation", { name: "Dashboard navigation", exact: true })
    .getByRole("link", { name: "New Order", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Start a new order", exact: true })).toBeVisible();
  await page.locator(`a[href="${serviceRoute}"]`).click();
  await expect(page.getByRole("heading", { name: requirement, exact: true })).toBeVisible();
  await complete.click();
  await expect(page.getByRole("heading", { name: "Complete your client profile", exact: true })).toBeVisible();
  const profileUrl = new URL(page.url());
  expect(profileUrl.pathname).toBe("/dashboard/profile");
  expect(profileUrl.searchParams.get("onboarding")).toBe("1");
  expect(profileUrl.searchParams.get("next")).toBe(serviceRoute);
  await expect(page.getByRole("link", { name: "Back to dashboard", exact: true })).toHaveAttribute("href", "/dashboard");
  expect(documentNavigations).toEqual([]);

  // A name alone is saved through the real profile API; optional fields stay empty.
  await page.getByLabel("First name", { exact: true }).fill("Client");
  await expect(page.getByLabel("Phone — Optional", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Save and continue to order", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${serviceRoute}$`));
  await expectOrderForm(page);
  const saved = await (await request.get("/__fixture/state")).json();
  expect(saved.profile).toMatchObject({
    user_id: saved.userId, full_name: "Client", phone: null,
    last_name: null, company_name: null, country: null, industry: null, how_found_us: null,
  });
  expect(saved.unsupportedOperations).toEqual([]);
  expect(saved.inviteCalls).toBe(0);
  await guard.expectClean();
});

test("complete profile opens the concrete order form directly", async ({ page, request }, testInfo) => {
  await request.post("/__fixture/reset", {
    data: { mode: "password-login", profile: { full_name: "Existing Client", phone: null, company_name: null } },
  });
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await login(page, serviceRoute);
  await expectOrderForm(page);
  const current = await (await request.get("/__fixture/state")).json();
  expect(current.authenticatedUserReads).toBeGreaterThan(0);
  expect(current.unsupportedOperations).toEqual([]);
  await guard.expectClean();
});
