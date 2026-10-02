import { createHmac } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { installSmokeNetworkGuards } from "../support/network";
import { installFakeTurnstile } from "../support/turnstile-fixture";

const email = "root-client@example.com";
async function login(page: Page) {
  if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()) await installFakeTurnstile(page);
  await page.goto("/login?redirectTo=%2Fdashboard%2Fprofile");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("fixture-password-only");
  await page.getByRole("button", { name: "Sign in to your account", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/profile$/);
}
test.beforeEach(async ({ request, context }) => {
  await request.post("/__fixture/reset", { data: { mode: "password-login", profile: { full_name: "Client" } } });
  await context.route("https://www.googletagmanager.com/**", (route) => route.fulfill({ contentType: "application/javascript", body: "" }));
});

test("account deletion confirmation is responsive, keyboard accessible and requires exact email", async ({ page }, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await login(page);
  const trigger = page.getByRole("button", { name: "Delete account", exact: true });
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await trigger.click();
    const modal = page.getByRole("dialog");
    const input = modal.getByRole("textbox");
    await expect(input).toBeFocused();
    const submit = modal.getByRole("button", { name: "Permanently delete account", exact: true });
    await expect(submit).toBeDisabled();
    await input.fill(email.toUpperCase()); await expect(submit).toBeDisabled();
    await input.fill(email); await expect(submit).toBeEnabled();
    await input.press("Tab");
    await expect(modal.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Tab"); await expect(submit).toBeFocused();
    await page.keyboard.press("Tab"); await expect(input).toBeFocused();
    expect(await modal.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    const box = (await modal.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`delete-account-${width}.png`) });
    await page.keyboard.press("Escape"); await expect(modal).not.toBeVisible();
    await expect(trigger).toBeFocused();
  }
  await guard.expectClean();
});

test("account deletion blocks further uploads and returns to a stable signed-out confirmation", async ({ page, context, request }, testInfo) => {
  const guard = await installSmokeNetworkGuards(page, testInfo);
  await login(page);
  await page.getByRole("button", { name: "Delete account", exact: true }).click();
  const modal = page.getByRole("dialog");
  await modal.getByRole("textbox").fill(email);
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/account/delete", async (route) => {
    const response = await route.fetch(); await held; await route.fulfill({ response });
  });
  await modal.getByRole("button", { name: "Permanently delete account" }).click();
  await expect(modal.getByRole("button", { name: "Requesting deletion…" })).toBeDisabled();
  await expect(modal.getByRole("button", { name: "Cancel" })).toBeDisabled();
  await expect.poll(async () => (await (await request.get("/__fixture/state")).json()).deletions.length).toBe(1);
  expect((await context.request.post("/api/upload-url", { data: {} })).status()).toBe(401);
  release();
  await expect(page).toHaveURL(/\/account-deletion-requested$/);
  await expect(page.getByRole("heading", { name: "Account deletion requested" })).toBeVisible();
  expect((await context.cookies()).some((cookie) => cookie.name.includes("auth-token") && cookie.value)).toBe(false);
  await page.goto("/dashboard"); await expect(page).toHaveURL(/\/login/);
  expect((await (await request.get("/__fixture/state")).json()).unsupportedOperations).toEqual([]);
  await guard.expectClean();
});

test("account deletion failure keeps confirmation retryable and does not claim success", async ({ page, request }) => {
  await login(page);
  await request.post("/__fixture/deletion-settings", { data: { fail: true } });
  await page.getByRole("button", { name: "Delete account", exact: true }).click();
  const modal = page.getByRole("dialog"); await modal.getByRole("textbox").fill(email);
  await modal.getByRole("button", { name: "Permanently delete account" }).click();
  await expect(modal.getByRole("alert")).toContainText("Deletion could not be confirmed");
  await expect(modal.getByRole("button", { name: "Permanently delete account" })).toBeEnabled();
  await expect(page).toHaveURL(/\/dashboard\/profile$/);
  expect((await (await request.get("/__fixture/state")).json()).deletions).toEqual([]);
});

test("admin account deletion selects one client and worker removes it from the listing after TTL", async ({ page, request, context }) => {
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const signature = createHmac("sha256", "isolated-partner-invite-test-password").update(`${expiry}:picchu:admin`).digest("hex");
  await context.addCookies([{ name: "picchu_admin_session", value: `${expiry}.${signature}`, url: "http://127.0.0.1:3200", httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/admin/clients");
  const row = page.getByRole("listitem").filter({ hasText: "registered@example.com" });
  await row.getByRole("button", { name: "Delete account" }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("registered@example.com");
  await page.getByRole("dialog").getByRole("button", { name: "Permanently delete account" }).click();
  await expect(row.getByRole("status").filter({ hasText: "Deletion pending" })).toContainText("Deletion pending");
  const worker = () => request.post("/api/internal/account-deletions", { headers: { Authorization: "Bearer isolated-deletion-worker-secret" } });
  expect(await (await worker()).json()).toEqual({ processed: 0 });
  await request.post("/__fixture/deletion-settings", { data: { ready: true } });
  expect(await (await worker()).json()).toEqual({ processed: 1 });
  await page.reload();
  await expect(page.getByText("registered@example.com", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Registered clients" }).getByRole("paragraph").filter({ hasText: email })).toBeVisible();
  expect((await (await request.get("/__fixture/state")).json()).unsupportedOperations).toEqual([]);
});
