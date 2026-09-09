import { createHmac } from "node:crypto";
import { expect, test, type BrowserContext, type APIRequestContext } from "@playwright/test";

const fixture = "http://127.0.0.1:3200";
async function admin(context: BrowserContext) {
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const signature = createHmac("sha256", "isolated-partner-invite-test-password").update(`${expiry}:picchu:admin`).digest("hex");
  await context.addCookies([{ name: "picchu_admin_session", value: `${expiry}.${signature}`, url: "http://127.0.0.1:3200", httpOnly: true, sameSite: "Lax" }]);
}
async function state(request: APIRequestContext) { return (await request.get(`${fixture}/__fixture/state`)).json(); }
test.beforeEach(async ({ context, request }) => {
  await request.post(`${fixture}/__fixture/reset`, { data: {} });
  await context.route("https://www.googletagmanager.com/**", (route) => route.fulfill({ contentType: "application/javascript", body: "" }));
});

test("anonymous, customer and forged admin sessions cannot send invitations", async ({ request }) => {
  for (const cookie of ["", "sb-test-auth-token=customer", "picchu_admin_session=9999999999.forged"]) {
    const response = await request.post("/api/admin/clients/invite-partner", { headers: { Cookie: cookie }, data: { email: "future@example.com" } });
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toBe("no-store");
  }
  expect((await state(request)).inviteCalls).toBe(0);
});

test("real Clients form is keyboard usable without overflow at all requested widths", async ({ context, page }, testInfo) => {
  await admin(context);
  await page.goto("/admin/clients");
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const field = page.getByRole("textbox", { name: "Email address", exact: true });
    const send = page.getByRole("button", { name: "Send invite", exact: true });
    await expect(field).toBeVisible(); await expect(send).toBeVisible();
    await field.focus(); await page.keyboard.press("Tab"); await expect(send).toBeFocused();
    expect(await send.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const fieldBox = (await field.boundingBox())!; const sendBox = (await send.boundingBox())!;
    expect(width < 640 ? sendBox.y >= fieldBox.y + fieldBox.height : sendBox.x >= fieldBox.x + fieldBox.width).toBe(true);
    await expect(page.getByRole("switch", { name: "Partner client" })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`invite-${width}.png`), fullPage: true });
  }
});

test("valid invite shows loading/success, writes returned ID and preserves the existing Partner toggle", async ({ context, page, request }) => {
  await admin(context); await page.goto("/admin/clients");
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/admin/clients/invite-partner", async (route) => { await held; await route.continue(); });
  await page.getByLabel("Email address", { exact: true }).fill("FuTuRe@Example.com");
  await page.getByRole("button", { name: "Send invite" }).click();
  await expect(page.getByRole("button", { name: "Sending invite…" })).toBeDisabled();
  await expect(page.getByLabel("Email address", { exact: true })).toBeDisabled();
  release();
  await expect(page.getByRole("status").filter({ hasText: "Invitation sent" })).toBeVisible();
  const current = await state(request);
  expect(current.inviteCalls).toBe(1);
  expect(current.redirectTo).toBe("http://127.0.0.1:3200/auth/invite");
  expect(current.pricing[0]).toMatchObject({ user_id: current.userId, partner_client: true });
  await page.getByRole("link", { name: "Reload Admin Clients" }).click();
  const row = page.getByRole("listitem").filter({ hasText: "future@example.com" });
  const toggle = row.getByRole("switch", { name: "Partner client" });
  await expect(toggle).toBeChecked(); await toggle.click();
  await expect(row.getByRole("status")).toContainText("Saved.");
  await expect(toggle).not.toBeChecked();
  expect((await state(request)).pricing[0].partner_client).toBe(false);
  expect(await page.content()).not.toContain("never-expose-invite-metadata");
});

for (const [mode, message] of [
  ["conflict", "This email already has an account. Enable Partner Pricing from the client row."],
  ["partial", "Invitation created, but Partner Pricing could not be confirmed."],
]) {
  test(`${mode} response is actionable and never reports success`, async ({ context, page, request }) => {
    await request.post(`${fixture}/__fixture/reset`, { data: { mode } });
    await admin(context); await page.goto("/admin/clients");
    await page.getByLabel("Email address", { exact: true }).fill("future@example.com");
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page.getByRole("region", { name: "Invite Partner client" }).getByRole("alert")).toContainText(message);
    await expect(page.getByRole("link", { name: "Reload Admin Clients" })).toBeVisible();
    await expect(page.getByText("Invitation sent.", { exact: false })).toHaveCount(0);
    expect((await state(request)).pricing).toEqual([]);
  });
}

test("standard invite fragment establishes real SDK cookies, sets password and completes existing onboarding", async ({ context, page, request, browser }) => {
  await admin(context);
  expect((await context.request.post("/api/admin/clients/invite-partner", { data: { email: "future@example.com" } })).ok()).toBe(true);
  const invited = await state(request);
  // Accept in a different browser context, with no admin cookie or PKCE verifier.
  const client = await browser.newContext();
  await client.route("https://www.googletagmanager.com/**", (route) => route.fulfill({ contentType: "application/javascript", body: "" }));
  const recipient = await client.newPage();
  try {
    await recipient.goto(`http://127.0.0.1:3200/auth/invite?next=%2Fdashboard%2Fprofile#type=invite&access_token=${invited.accessToken}&refresh_token=fixture-refresh-token`);
    await expect(recipient.getByLabel("New password", { exact: true })).toBeVisible();
    await expect(recipient.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
    expect(await recipient.evaluate(() => typeof window.gtag)).toBe("undefined");
    expect(new URL(recipient.url()).hash).toBe("");
    expect((await client.cookies()).some((cookie) => cookie.name.includes("auth-token"))).toBe(true);
    await recipient.getByLabel("New password", { exact: true }).fill("New-client-password-123");
    await recipient.getByLabel("Confirm new password", { exact: true }).fill("New-client-password-123");
    await recipient.getByRole("button", { name: "Set new password" }).click();
    await expect(recipient.getByRole("heading", { name: "Complete your client profile" })).toBeVisible();
    await recipient.getByLabel("First name", { exact: true }).fill("Future");
    await recipient.getByLabel("Last name", { exact: true }).fill("Client");
    await recipient.locator("#profile-phone").fill("+34 600 000 000");
    await recipient.getByRole("button", { name: "Save and continue to dashboard" }).click();
    await expect(recipient.getByRole("heading", { name: "Profile", exact: true })).toBeVisible();
    const completed = await state(request);
    expect(completed.passwordSet).toBe(true);
    expect(completed.profile.user_id).toBe(invited.userId);
    expect(completed.pricing[0].partner_client).toBe(true);
    const response = await client.request.get("http://127.0.0.1:3200/auth/callback?type=invite&next=%2Fdashboard%2Fjobs", { maxRedirects: 0 });
    expect(response.headers().location).toBe("http://127.0.0.1:3200/dashboard/jobs");
  } finally { await client.close(); }
  await page.goto("/admin/clients");
  await expect(page.getByRole("listitem").filter({ hasText: "future@example.com" }).getByRole("switch")).toBeChecked();
});

test("missing, expired or recovery fragment cannot show an invite password form", async ({ page }) => {
  for (const fragment of ["", "#error=access_denied&error_description=private-detail&type=invite", "#type=recovery&access_token=bad&refresh_token=bad", "#type=invite&access_token=bad&refresh_token=bad"]) {
    // A real email first visits Supabase's verify URL, then a fresh document.
    // Avoid a same-document hash-only navigation between fixture scenarios.
    await page.goto("/login");
    await page.goto(`/auth/invite${fragment}`);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("This invitation could not be accepted");
    await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
    expect(new URL(page.url()).hash).toBe("");
    expect(await page.content()).not.toContain("private-detail");
  }
});
