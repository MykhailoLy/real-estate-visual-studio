import { expect, test, type Page } from "@playwright/test";
import { calculateOrderQuote } from "../../src/lib/pricing/calculate";
import { formatMoney } from "../../src/lib/pricing/format";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { renderComponentFixture } from "../support/render-component-fixture";
import { buildGuestState, guestQuote } from "../../src/lib/guest-order-drafts/schema";
import {
  VIRTUAL_STAGING_DRAFT_ROUTE as dashboard,
  VirtualStagingDraftStateSchema,
  type VirtualStagingDraftState,
} from "../../src/lib/order-drafts/virtual-staging";

const entry = "/order/virtual-staging?configure=1";

async function submitFixtureLogin(page: Page) {
  await page.getByLabel("Email address", { exact: true }).fill("root-client@example.com");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password-only");
  await page.getByRole("button", { name: "Sign in to your account", exact: true }).click();
}

test("disabled server keeps the public 308 and dashboard login gate", async ({ request }) => {
  const origin = "http://127.0.0.1:3203";
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "3203"],
    {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: "ignore",
      env: {
        ...process.env,
        GUEST_ORDER_DRAFTS_ENABLED: "false",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3200/__supabase",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "isolated-fixture-anon",
      },
    },
  );
  try {
    await expect
      .poll(async () => {
        try {
          return (await request.get(origin + entry, { maxRedirects: 0 })).status();
        } catch {
          return 0;
        }
      })
      .toBe(308);
    const guest = await request.get(origin + entry, { maxRedirects: 0 });
    expect(guest.headers().location).toBe(dashboard);
    const gate = await request.get(origin + dashboard, { maxRedirects: 0 });
    expect(gate.headers().location).toBe("/login?redirectTo=" + encodeURIComponent(dashboard));
  } finally {
    server.kill();
  }
});

test("guest autosave, confirmation, login and recovery of a lost claim response", async ({
  page,
  request,
}, testInfo) => {
  await request.post("/__fixture/reset", {
    data: { mode: "password-login", profile: { full_name: "Fixture Client" } },
  });
  await page.addInitScript(() => localStorage.setItem("picchuspot_cookie_consent", "rejected"));
  await page.route(/^https:\/\//, (route) => route.abort());
  let state: ReturnType<typeof buildGuestState> | null = null;
  let version = 0;
  let claims = 0;
  let conflict = false;
  let accountReads = 0;
  let accountState: VirtualStagingDraftState | null = null;
  let accountVersion = 1;
  const guestDraftId = randomUUID();
  const draftId = randomUUID();
  const saved = () => ({
    guestDraftId,
    version,
    currency: "USD",
    expiresAt: "2099-01-01",
    state,
    quote: guestQuote(state!, "USD"),
  });
  await page.route("**/api/guest-order-drafts", async (route) => {
    if (route.request().method() === "GET") {
      if (claims) return route.fulfill({ json: { claimed: true, guestDraftId, draftId } });
      if (!state) return route.fulfill({ status: 401, json: { code: "guest_draft_unauthenticated" } });
      return route.fulfill({ json: { claimed: false, ...saved() } });
    }
    const payload = route.request().postDataJSON();
    expect(payload.expectedVersion).toBe(version || undefined);
    expect(payload.guestDraftId).toBe(version ? guestDraftId : undefined);
    expect(Object.keys(payload.draft.items[0].state).sort()).toEqual([
      "additionalInfo",
      "furnitureStyle",
      "roomName",
      "selectedAddons",
    ]);
    version++;
    if (conflict) {
      conflict = false;
      state = { ...state!, jobTitle: "Other tab" };
      return route.fulfill({ status: 409, json: { code: "version_conflict" } });
    }
    state = buildGuestState(payload.draft);
    return route.fulfill({ json: saved() });
  });
  await page.route("**/api/guest-order-drafts/claim", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ guestDraftId, expectedVersion: version });
    claims++;
    await route.abort("failed"); // The transfer committed before the browser received the reply.
  });
  await page.route("**/api/order-drafts/**", async (route) => {
    if (!route.request().url().endsWith(draftId)) {
      expect(route.request().method()).toBe("GET");
      return route.fulfill({ json: { data: [] } });
    }
    const updating = route.request().method() === "PATCH";
    if (updating) {
      const input = route.request().postDataJSON();
      expect(input.expectedVersion).toBe(accountVersion);
      accountState = VirtualStagingDraftStateSchema.parse(input.state);
      expect(accountState.metadata.origin).toBe("guest");
      accountVersion++;
    } else {
      expect(route.request().method()).toBe("GET");
      accountReads++;
    }
    const draft = {
      id: draftId,
      version: accountVersion,
      serviceType: "virtual-staging",
      stateSchemaVersion: 1,
      route: dashboard,
      state: accountState ?? state,
      status: "active",
      currency: "USD",
    };
    return route.fulfill({ json: { data: updating ? { draft, version: accountVersion } : draft } });
  });
  await page.goto(dashboard);
  await expect(page).toHaveURL((url) => url.pathname + url.search === entry);
  const title = page.getByRole("textbox", { name: /Job Title/ });
  await expect(title).toBeVisible();
  await expect(page.locator("input[type=file]")).toHaveCount(0);
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
      true,
    );
    for (const field of [
      title,
      page.getByRole("combobox").first(),
      page.getByRole("button", { name: "Add Another Image" }),
    ]) {
      const box = await field.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
    if (width === 390 || width === 1440) {
      await page.screenshot({ path: testInfo.outputPath("guest-" + width + ".png") });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await title.focus();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.matches(":focus-visible"))).toBe(true);
  const titleTop = () => title.evaluate((field) => field.getBoundingClientRect().top + window.scrollY);
  const beforeSave = await titleTop();
  await title.fill("Fixture draft");
  await expect(page.getByText(/Version 1 · Estimated total/)).toBeVisible();
  expect(await titleTop()).toBe(beforeSave);
  conflict = true;
  await title.fill("Local edits");
  await page.getByRole("button", { name: "Use saved version" }).click();
  await expect(title).toHaveValue("Other tab");
  await page.getByRole("button", { name: "Add Another Image" }).click();
  const confirm = page.getByRole("button", { name: "Confirm estimate and sign in" });
  await confirm.click(); // Flush the edit, then require confirmation of the new version and total.
  await expect(page.getByText(/Version 3 · Estimated total/)).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname + url.search === entry);
  await confirm.evaluate((el: HTMLButtonElement) => {
    el.click();
    el.click();
  });
  await expect(page).toHaveURL(
    (url) => url.pathname === "/login" && url.searchParams.get("redirectTo") === entry,
  );
  await submitFixtureLogin(page);
  await page.getByRole("button", { name: "Check again" }).click();
  await expect(page).toHaveURL(
    (url) => url.pathname === dashboard && url.searchParams.get("draft") === draftId,
  );
  await expect(title).toHaveValue("Other tab");
  await expect(
    page.getByText("Choose the original photo for this image to complete your guest draft."),
  ).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Your account estimate" })).toBeVisible();
  const accountQuote = calculateOrderQuote(
    {
      serviceType: "virtual-staging",
      currency: "USD",
      items: [{ selectedAddons: [] }, { selectedAddons: [] }],
    },
    {
      welcomeOfferAvailability: {
        virtualStagingAvailable: true,
        imageEnhancementAvailable: true,
        dayToDuskAvailable: true,
      },
    },
  );
  await expect(page.getByRole("status").filter({ hasText: "Your account estimate" })).toContainText(
    formatMoney(accountQuote.totalCents!, "USD"),
  );
  expect(accountQuote.totalCents).not.toBe(saved().quote!.preview.totalCents);
  const patchResponse = page.waitForResponse(
    (res) => res.request().method() === "PATCH" && res.url().endsWith("/api/order-drafts/" + draftId),
  );
  await title.fill("Saved in account");
  expect((await patchResponse).ok()).toBe(true);
  await page.reload();
  await expect(title).toHaveValue("Saved in account");
  await expect(page.getByRole("status").filter({ hasText: "Your account estimate" })).toContainText(
    formatMoney(accountQuote.totalCents!, "USD"),
  );
  await expect(
    page.getByText("Choose the original photo for this image to complete your guest draft."),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Review Order", exact: true }).click();
  await expect(
    page.getByText("Image #1: upload an original photo.", { exact: true }).first(),
  ).toBeVisible();
  expect(accountReads).toBeGreaterThan(0);
  expect(claims).toBe(1);
  expect(version).toBe(3);
});

test("the guest editor uses account copy when its user is already signed in", async ({ page }) => {
  const markup = renderComponentFixture(
    `
    const { PathnameContext } = await import("next/dist/shared/lib/hooks-client-context.shared-runtime.js");
    const { default: Form } = await import(new URL("src/components/order/virtual-staging/VirtualStagingOrderForm.tsx", root));
    const { NO_WELCOME_OFFER_AVAILABLE } = await import(new URL("src/lib/welcome-offer.ts", root));
    const path = "/order/virtual-staging";
    process.stdout.write(renderToStaticMarkup(createElement(PathnameContext.Provider, { value: path },
      createElement(Form, {
        guest: { initial: null, fresh: false, key: 1, signedIn: true },
        clientEmail: "", orderRoute: path, exampleMediaByKey: {}, welcomeOfferAvailability: NO_WELCOME_OFFER_AVAILABLE,
      })
    )));
  `,
    null,
  );
  await page.setContent(markup);
  await expect(
    page.getByRole("button", { name: "Confirm estimate and open my draft", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm estimate and sign in" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Sign in to start in your account" })).toHaveCount(0);
});

test.describe("signed-in guest recovery", () => {
  test.beforeEach(async ({ page, context, request }) => {
    await request.post("/__fixture/reset", {
      data: { mode: "password-login", profile: { full_name: "Fixture Client" } },
    });
    await page.addInitScript(() => localStorage.setItem("picchuspot_cookie_consent", "rejected"));
    await page.route(/^https:\/\//, (route) => route.abort());
    // The dashboard looks for cookie presence. Only the loopback guest API responses are stubbed.
    await context.addCookies([
      { name: "picchu_guest_vs_draft", value: "fixture", url: "http://127.0.0.1:3200", httpOnly: true },
    ]);
    await page.goto("/login?redirectTo=" + encodeURIComponent(dashboard + "?new=1"));
    await submitFixtureLogin(page);
    await expect(page.getByRole("textbox", { name: /Job Title/ })).toBeVisible();
  });

  test("retry offers the account form and a fresh draft URL that survives reload", async ({ page }) => {
    let lookups = 0;
    await page.route("**/api/guest-order-drafts**", (route) => {
      expect(route.request().method()).toBe("GET");
      lookups++;
      return lookups === 1
        ? route.fulfill({ status: 503, json: { code: "guest_drafts_unavailable" } })
        : route.abort("failed");
    });
    await page.goto(dashboard);
    const retry = page.getByRole("button", { name: "Check again" });
    const fresh = page.getByRole("button", { name: "Start a new draft" });
    await expect(retry).toBeVisible();
    await expect(fresh).toBeVisible();
    await page.getByRole("button", { name: "Continue in account" }).click();
    const title = page.getByRole("textbox", { name: /Job Title/ });
    await expect(title).toBeVisible();
    await expect(page.getByRole("button", { name: "Review Order", exact: true })).toBeVisible();
    expect(lookups).toBe(1);

    await page.reload();
    await expect(retry).toBeVisible();
    await fresh.click();
    await expect(page).toHaveURL((url) => url.pathname + url.search === dashboard + "?new=1");
    await expect(title).toBeEmpty();
    await page.reload();
    await expect(title).toBeVisible();
    await expect(retry).toHaveCount(0);
    expect(lookups).toBe(2);
  });

  test("signed-in confirmation opens the saved draft without another login", async ({ page }) => {
    const guestDraftId = randomUUID();
    const draftId = randomUUID();
    const state = buildGuestState({
      jobTitle: "Signed-in estimate",
      defaultFurnitureStyle: "",
      items: [
        {
          clientItemId: randomUUID(),
          state: { roomName: "", furnitureStyle: "", additionalInfo: "", selectedAddons: [] },
        },
      ],
    });
    await page.route("**/api/guest-order-drafts", (route) =>
      route.fulfill({
        json: {
          claimed: false,
          guestDraftId,
          version: 3,
          currency: "USD",
          state,
          expiresAt: "2099-01-01",
          quote: guestQuote(state, "USD"),
        },
      }),
    );
    let claims = 0;
    await page.route("**/api/guest-order-drafts/claim", (route) => {
      expect(route.request().postDataJSON()).toEqual({ guestDraftId, expectedVersion: 3 });
      claims++;
      return route.fulfill({ json: { draftId, alreadyClaimed: false } });
    });
    await page.route("**/api/order-drafts/**", (route) =>
      route.fulfill({
        json: {
          data: route.request().url().endsWith(draftId)
            ? {
                id: draftId,
                version: 1,
                serviceType: "virtual-staging",
                stateSchemaVersion: 1,
                route: dashboard,
                state,
                status: "active",
                currency: "USD",
              }
            : [],
        },
      }),
    );
    await page.goto(entry);
    await expect(page.getByRole("button", { name: "Confirm estimate and sign in" })).toHaveCount(0);
    await page.getByRole("button", { name: "Confirm estimate and open my draft", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname + url.search === dashboard + "?draft=" + draftId);
    await expect(page.getByRole("textbox", { name: /Job Title/ })).toHaveValue("Signed-in estimate");
    expect(claims).toBe(1);
  });
});

test("lost create waits for explicit new, retains input and handles expiry", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("picchuspot_cookie_consent", "rejected"));
  await page.route(/^https:\/\//, (route) => route.abort());
  let puts = 0;
  let creates = 0;
  let expired = false;
  await page.route("**/api/guest-order-drafts", (route) => {
    if (route.request().method() === "PUT") {
      puts++;
      return route.abort("failed");
    }
    return route.fulfill(
      expired
        ? { status: 410, json: { code: "guest_draft_expired" } }
        : { status: 401, json: { code: "guest_draft_unauthenticated" } },
    );
  });
  await page.route("**/api/guest-order-drafts/new", (route) => {
    creates++;
    const state = buildGuestState(route.request().postDataJSON().draft);
    expect(state.jobTitle).toBe("Keep this input");
    return route.fulfill({
      json: {
        guestDraftId: randomUUID(),
        version: 1,
        currency: "USD",
        expiresAt: "2099-01-01",
        state,
        quote: guestQuote(state, "USD"),
      },
    });
  });
  await page.goto(entry);
  await page.getByLabel(/Job Title/).fill("Keep this input");
  await page.getByRole("button", { name: "Check again" }).click();
  const start = page.getByRole("button", { name: "Start a new draft" });
  await expect(start).toBeVisible();
  expect(puts).toBe(1);
  expect(creates).toBe(0);
  await start.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(page.getByText(/Version 1 · Estimated total/)).toBeVisible();
  expect(creates).toBe(1);
  expired = true;
  await page.reload();
  await expect(page.getByText(/Your guest draft expired/)).toBeVisible();
  await start.click();
  await expect(page.getByLabel(/Job Title/)).toBeEmpty();
  expect(puts).toBe(1);
  expect(creates).toBe(1);
});
