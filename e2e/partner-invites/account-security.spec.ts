import { expect, test, type Page } from "@playwright/test";
import { installSmokeNetworkGuards } from "../support/network";

const USER_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_ID = "11111111-1111-4111-8111-111111111111";
const email = "root-client@example.com";

async function login(page: Page) {
  await page.goto("/login?redirectTo=%2Fdashboard%2Fprofile");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("fixture-password-only");
  await page.getByRole("button", { name: "Sign in to your account", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/profile$/);
  await expect(page.getByRole("heading", { name: "Account & Security" })).toBeVisible();
}

test.beforeEach(async ({ request, context }) => {
  await request.post("/__fixture/reset", { data: {
    mode: "password-login", profile: { full_name: "Client", phone: null, company_name: null },
    accountOrders: [
      { id: "legacy", user_id: null, client_email: "ROOT-CLIENT@EXAMPLE.COM" },
      { id: "padded-legacy", user_id: null, client_email: " \tRoot-Client@Example.COM\t " },
      { id: "other-email", user_id: null, client_email: "other@example.com" },
      { id: "already-owned", user_id: USER_ID, client_email: "historic@example.com" },
      { id: "other-owner", user_id: OTHER_ID, client_email: email },
    ],
  } });
  await context.route("https://www.googletagmanager.com/**", (route) =>
    route.fulfill({ contentType: "application/javascript", body: "" }),
  );
});

test("account controls are responsive and email stays pending until verified Auth confirms it", async ({ page, request }, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await login(page);
  const security = page.getByRole("region", { name: "Account & Security" });
  await expect(page.getByLabel("First name", { exact: true })).toHaveValue("Client");
  for (const label of ["Phone", "Company name", "Country", "Industry"]) {
    await expect(page.getByLabel(`${label} — Optional`, { exact: true })).toBeVisible();
  }
  await security.getByRole("button", { name: "Change email", exact: true }).click();
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const submit = security.getByRole("button", { name: "Send confirmation", exact: true });
    const cancel = security.getByRole("button", { name: "Cancel", exact: true });
    await submit.focus();
    await page.keyboard.press("Tab");
    await expect(cancel).toBeFocused();
    expect(await cancel.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
    const submitBox = (await submit.boundingBox())!;
    const cancelBox = (await cancel.boundingBox())!;
    expect(width < 640 ? cancelBox.y >= submitBox.y + submitBox.height : cancelBox.x >= submitBox.x + submitBox.width).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const passwordButton = security.getByRole("button", { name: "Update password", exact: true });
    await passwordButton.scrollIntoViewIfNeeded();
    // The existing dashboard bar overlays the viewport bottom. Exercise a
    // user's scroll through the dashboard's own scroll container, rather than
    // assuming the browser's geometric scrollIntoView accounts for overlays.
    if (width < 1024) {
      await page.locator("main[data-dashboard-scroll-container]").hover({ position: { x: 10, y: 10 } });
      await page.mouse.wheel(0, 200);
    }
    const passwordBox = (await passwordButton.boundingBox())!;
    await expect.poll(() => passwordButton.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    })).toBe(true);
    expect(passwordBox.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: testInfo.outputPath(`account-security-${width}.png`) });
  }
  await security.getByLabel("New email address", { exact: true }).fill("changed-client@example.com");
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/account/prepare-email-change", async (route) => {
    const response = await route.fetch();
    await held;
    await route.fulfill({ response });
  });
  await security.getByRole("button", { name: "Send confirmation", exact: true }).click();
  await expect(security.getByRole("button", { name: "Sending confirmation…" })).toBeDisabled();
  await expect(security.getByLabel("New email address", { exact: true })).toBeDisabled();
  release();
  await expect(security.getByRole("status")).toContainText("Check your email to confirm the change.");
  await expect(security.getByText(email, { exact: true })).toBeVisible();
  await expect(page.locator("#profile-email")).toHaveValue(email);
  await page.reload();
  await expect(security.getByRole("status")).toContainText("Check your email to confirm the change.");
  const state = await (await request.get("/__fixture/state")).json();
  expect(state.emailChanges).toBe(1);
  expect(state.accountOrders).toEqual([
    { id: "legacy", user_id: USER_ID, client_email: "ROOT-CLIENT@EXAMPLE.COM" },
    { id: "padded-legacy", user_id: USER_ID, client_email: " \tRoot-Client@Example.COM\t " },
    { id: "other-email", user_id: null, client_email: "other@example.com" },
    { id: "already-owned", user_id: USER_ID, client_email: "historic@example.com" },
    { id: "other-owner", user_id: OTHER_ID, client_email: email },
  ]);
  expect(state.unsupportedOperations).toEqual([]);
  await request.post("/__fixture/confirm-email");
  await page.reload();
  await expect(security.getByText("changed-client@example.com", { exact: true })).toBeVisible();
  await expect(page.locator("#profile-email")).toHaveValue("changed-client@example.com");
  await expect(security.getByRole("status")).toHaveCount(0);
  await guard.expectClean();
});

test("ownership and Auth errors stop the email change and retain the current email", async ({ page, request }) => {
  await login(page);
  const security = page.getByRole("region", { name: "Account & Security" });
  await security.getByRole("button", { name: "Change email", exact: true }).click();
  await security.getByLabel("New email address", { exact: true }).fill("changed-client@example.com");
  await request.post("/__fixture/account-failures", { data: { ownership: true } });
  await security.getByRole("button", { name: "Send confirmation", exact: true }).click();
  await expect(security.getByRole("alert")).toContainText("could not confirm your order ownership");
  expect((await (await request.get("/__fixture/state")).json()).emailChanges).toBe(0);
  await request.post("/__fixture/account-failures", { data: { ownership: false, claim: true } });
  await security.getByRole("button", { name: "Send confirmation", exact: true }).click();
  await expect(security.getByRole("alert")).toContainText("could not confirm your order ownership");
  const unclaimed = await (await request.get("/__fixture/state")).json();
  expect(unclaimed.emailChanges).toBe(0);
  expect(unclaimed.accountOrders.filter((order: { user_id: string | null }) => order.user_id === null)).toHaveLength(3);
  await request.post("/__fixture/account-failures", { data: { claim: false, email: true } });
  await security.getByRole("button", { name: "Send confirmation", exact: true }).click();
  await expect(security.getByRole("alert")).toContainText("Unable to change email.");
  await expect(security.getByRole("button", { name: "Send confirmation", exact: true })).toBeEnabled();
  await expect(security.getByText(email, { exact: true })).toBeVisible();
  await expect(security.getByRole("status")).toHaveCount(0);
  const state = await (await request.get("/__fixture/state")).json();
  expect(state.emailChanges).toBe(0);
  expect(state.unsupportedOperations).toEqual([]);
});

test("password validates, verifies current password, and updates directly through signed-in Supabase", async ({ page, request }) => {
  await login(page);
  const security = page.getByRole("region", { name: "Account & Security" });
  await expect(security.getByRole("link", { name: "Forgot current password?" })).toHaveAttribute("href", "/forgot-password");
  const apiRequests: string[] = [];
  page.on("request", (req) => {
    if (new URL(req.url()).pathname.startsWith("/api/")) apiRequests.push(new URL(req.url()).pathname);
  });
  const reauthEmails: string[] = [];
  await page.route("**/__supabase/auth/v1/token?grant_type=password", async (route) => {
    reauthEmails.push(route.request().postDataJSON().email);
    await route.continue();
  });
  // An editable proposed email must never become the reauthentication identity.
  await security.getByRole("button", { name: "Change email", exact: true }).click();
  await security.getByLabel("New email address", { exact: true }).fill("unverified-proposal@example.com");
  const current = security.getByLabel("Current password", { exact: true });
  const next = security.getByLabel("New password", { exact: true });
  const confirm = security.getByLabel("Confirm new password", { exact: true });
  const submit = security.getByRole("button", { name: "Update password", exact: true });
  await current.fill("wrong-fixture-current");
  await next.fill("short"); await confirm.fill("short"); await submit.click();
  await expect(security.getByRole("alert")).toContainText("at least 8 characters");
  await next.fill("fixture-new-password"); await confirm.fill("different-fixture-password"); await submit.click();
  await expect(security.getByRole("alert")).toContainText("Passwords do not match");
  await confirm.fill("fixture-new-password"); await submit.click();
  await expect(security.getByRole("alert")).toContainText("Current password is incorrect.");
  await expect(submit).toBeEnabled();
  const rejected = await (await request.get("/__fixture/state")).json();
  expect(rejected.passwordChanges).toBe(0);
  expect(rejected.passwordSignIns).toBe(1); // Original login only.
  expect(rejected.passwordSignInFailures).toBe(1);
  expect(rejected.passwordAuthEvents).toEqual(["sign-in-accepted", "sign-in-rejected"]);
  await current.fill("fixture-password-only");
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/__supabase/auth/v1/user", async (route) => {
    if (route.request().method() !== "PUT") { await route.continue(); return; }
    const attributes = route.request().postDataJSON();
    expect(attributes.password).toBe("fixture-new-password");
    expect(attributes).not.toHaveProperty("current_password");
    const response = await route.fetch();
    await held;
    await route.fulfill({ response });
  });
  await submit.click();
  await expect(security.getByRole("button", { name: "Updating password…" })).toBeDisabled();
  await expect(current).toBeDisabled();
  release();
  await expect(security.getByRole("status")).toContainText("Password updated successfully.");
  await expect(current).toHaveValue(""); await expect(next).toHaveValue(""); await expect(confirm).toHaveValue("");
  expect(apiRequests, "passwords never go to a custom PicchuSpot API").toEqual([]);
  expect(reauthEmails).toEqual([email, email]);
  const state = await (await request.get("/__fixture/state")).json();
  expect(state.currentPasswordVerified).toBe(true);
  expect(state.passwordChanges).toBe(1);
  expect(state.passwordSignIns).toBe(2);
  expect(state.passwordAuthEvents).toEqual(["sign-in-accepted", "sign-in-rejected", "sign-in-accepted", "password-update"]);
  expect(state.unsupportedOperations).toEqual([]);
});

test("password change rejects a different reauthenticated user and displays update errors", async ({ page, request }) => {
  await login(page);
  const security = page.getByRole("region", { name: "Account & Security" });
  await security.getByLabel("Current password", { exact: true }).fill("fixture-password-only");
  await security.getByLabel("New password", { exact: true }).fill("fixture-new-password");
  await security.getByLabel("Confirm new password", { exact: true }).fill("fixture-new-password");
  const submit = security.getByRole("button", { name: "Update password", exact: true });
  await request.post("/__fixture/account-failures", { data: { reauthUserMismatch: true } });
  await submit.click();
  await expect(security.getByRole("alert")).toContainText("Your session changed");
  await expect(submit).toBeEnabled();
  const mismatched = await (await request.get("/__fixture/state")).json();
  expect(mismatched.passwordSignIns).toBe(2);
  expect(mismatched.passwordChanges).toBe(0);
  expect(mismatched.currentPasswordVerified).toBe(false);
  expect(mismatched.passwordAuthEvents).not.toContain("password-update");
  await request.post("/__fixture/account-failures", { data: { reauthUserMismatch: false, password: true } });
  await submit.click();
  await expect(security.getByRole("alert")).toContainText("Unable to change password.");
  await expect(submit).toBeEnabled();
  await expect(security.getByRole("status")).toHaveCount(0);
  const failedUpdate = await (await request.get("/__fixture/state")).json();
  expect(failedUpdate.currentPasswordVerified).toBe(true);
  expect(failedUpdate.passwordChanges).toBe(0);
  expect(failedUpdate.unsupportedOperations).toEqual([]);
});

test("unauthenticated ownership preparation rejects browser identity", async ({ request }) => {
  const response = await request.post("/api/account/prepare-email-change", { data: {
    userId: USER_ID, currentEmail: email,
  } });
  expect(response.status()).toBe(401);
  const state = await (await request.get("/__fixture/state")).json();
  expect(state.accountOrders[0].user_id).toBeNull();
  expect(state.emailChanges).toBe(0);
});
