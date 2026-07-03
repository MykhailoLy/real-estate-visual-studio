import { expect, test, type Page } from "@playwright/test";
import { expectNavigationResponseOk } from "../support/network";

const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TURNSTILE_DUMMY_SITE_KEY = "1x00000000000000000000AA";
const hasTurnstileSiteKey =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ===
  TURNSTILE_DUMMY_SITE_KEY;
const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const hasSupabaseEnv = Boolean(
  configuredSupabaseUrl && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
);

type CapturedSupabaseCall = {
  pathname: string;
  search: string;
  body: Record<string, unknown>;
};

type TurnstileTestState = {
  renderCount: number;
  resetCount: number;
  removeCount: number;
  widgets: Array<{
    id: string;
    action: string | null;
    sitekey: string | null;
  }>;
};

const dormantAuthRoutes = [
  {
    route: "/login",
    heading: "Welcome back",
    button: "Sign in to your account",
  },
  {
    route: "/signup",
    heading: "Create your account",
    button: "Create account",
  },
  {
    route: "/forgot-password",
    heading: "Forgot your password?",
    button: "Send reset link",
  },
] as const;

test.describe("auth Turnstile dormant state", () => {
  test.skip(hasTurnstileSiteKey, "This check needs a build without a site key.");

  for (const { route, heading, button } of dormantAuthRoutes) {
    test(`${route} does not load Turnstile without a site key`, async ({
      page,
    }) => {
      let turnstileRequests = 0;
      await page.route("https://challenges.cloudflare.com/**", async (route) => {
        turnstileRequests += 1;
        await route.abort("blockedbyclient");
      });

      const response = await page.goto(route);

      expectNavigationResponseOk(response, route);
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: button })).toBeEnabled();
      await expect(
        page.locator(`script[src="${TURNSTILE_SCRIPT_SRC}"]`),
      ).toHaveCount(0);
      await expect(
        page.locator('iframe[src*="challenges.cloudflare.com"]'),
      ).toHaveCount(0);
      await expect(page.getByText("Completing security check...")).toHaveCount(
        0,
      );
      expect(turnstileRequests).toBe(0);
    });
  }
});

test.describe("auth Turnstile enabled state", () => {
  test.skip(
    !hasTurnstileSiteKey || !hasSupabaseEnv,
    "Run with the dummy Turnstile key and dummy Supabase env to exercise enabled auth flows.",
  );

  test("requests the Turnstile script once across auth page navigation", async ({
    page,
  }) => {
    const turnstile = await installFakeTurnstile(page);

    const loginResponse = await page.goto("/login");
    expectNavigationResponseOk(loginResponse, "/login");
    await expect(page.locator("[data-testid='fake-turnstile-widget']")).toHaveText(
      "Security check (login)",
    );

    await page.getByRole("link", { name: "Create one" }).click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.locator("[data-testid='fake-turnstile-widget']")).toHaveText(
      "Security check (signup)",
    );

    expect(turnstile.requestCount()).toBe(1);
    const state = await getTurnstileState(page);
    expect(state.renderCount).toBe(2);
    expect(state.widgets.map((widget) => widget.action)).toEqual([
      "login",
      "signup",
    ]);
  });

  test("successful, expired, failed, and retry callbacks update token state", async ({
    page,
  }) => {
    await installFakeTurnstile(page);

    const response = await page.goto("/login");
    expectNavigationResponseOk(response, "/login");

    const submit = page.getByRole("button", {
      name: "Sign in to your account",
    });
    await expect(submit).toBeEnabled();

    await expireTurnstile(page);
    await expect(submit).toBeDisabled();
    await expect(page.getByText("Completing security check...")).toBeVisible();

    await failTurnstile(page);
    await expect(submit).toBeDisabled();
    await expect(page.getByText(
      "Security check failed. Please try again.",
    )).toBeVisible();

    await page.getByRole("button", { name: "Retry security check" }).click();
    await expect(submit).toBeEnabled();
    expect((await getTurnstileState(page)).resetCount).toBe(1);
  });

  test("login passes captchaToken and resets Turnstile after auth failure", async ({
    page,
  }) => {
    await installFakeTurnstile(page);
    const supabase = await installSupabaseAuthStub(page, {
      "/auth/v1/token": {
        status: 400,
        body: {
          error: "invalid_grant",
          error_description: "Invalid login credentials",
          msg: "Invalid login credentials",
        },
      },
    });

    const response = await page.goto("/login");
    expectNavigationResponseOk(response, "/login");
    await expect(
      page.getByRole("button", { name: "Sign in to your account" }),
    ).toBeEnabled();

    await page.getByLabel("Email address").fill("client@example.com");
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in to your account" }).click();

    await expect(page.getByText(
      "Incorrect email or password. Please try again.",
    )).toBeVisible();
    const calls = await supabase.calls();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.pathname).toBe("/auth/v1/token");
    expect(readCaptchaToken(calls[0])).toMatch(/^token-login-/);
    expect((await getTurnstileState(page)).resetCount).toBe(1);
  });

  test("signup preserves local validation and passes captchaToken with signup options", async ({
    page,
  }) => {
    await installFakeTurnstile(page);
    const supabase = await installSupabaseAuthStub(page, {
      "/auth/v1/signup": {
        status: 400,
        body: {
          error: "user_already_exists",
          msg: "Unable to create account.",
        },
      },
    });

    const response = await page.goto("/signup");
    expectNavigationResponseOk(response, "/signup");
    await expect(page.getByRole("button", { name: "Create account" })).toBeEnabled();

    await page.getByLabel("Email address").fill("new-client@example.com");
    await page.getByLabel("Password", { exact: true }).fill("password123");
    await page.getByLabel("Confirm password").fill("different123");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText(
      "Please enter your full name.",
    )).toBeVisible();
    expect(await supabase.calls()).toHaveLength(0);
    expect((await getTurnstileState(page)).resetCount).toBe(0);

    await page.getByLabel("Full name").fill("Jane Smith");
    await page.getByLabel("Confirm password").fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText(
      "Unable to create account.",
    )).toBeVisible();
    const calls = await supabase.calls();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.pathname).toBe("/auth/v1/signup");
    expect(readCaptchaToken(calls[0])).toMatch(/^token-signup-/);

    const signupData = calls[0]?.body.data as
      | Record<string, unknown>
      | undefined;
    expect(signupData?.full_name).toBe("Jane Smith");
    expect((await getTurnstileState(page)).resetCount).toBe(1);
  });

  test("forgot password passes captchaToken and keeps non-enumerating success copy", async ({
    page,
  }) => {
    await installFakeTurnstile(page);
    const supabase = await installSupabaseAuthStub(page, {
      "/auth/v1/recover": {
        status: 200,
        body: {},
      },
    });

    const response = await page.goto("/forgot-password");
    expectNavigationResponseOk(response, "/forgot-password");

    await page.getByLabel("Email address").fill("client@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(page.getByText("Reset link sent")).toBeVisible();
    await expect(
      page.getByText(/If an account exists for that address, you.ll receive/),
    ).toBeVisible();
    const calls = await supabase.calls();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.pathname).toBe("/auth/v1/recover");
    expect(readCaptchaToken(calls[0])).toMatch(
      /^token-password_reset-/,
    );
  });

  test("forgot password resets Turnstile after auth failure", async ({
    page,
  }) => {
    await installFakeTurnstile(page);
    const supabase = await installSupabaseAuthStub(page, {
      "/auth/v1/recover": {
        status: 400,
        body: {
          error: "captcha_failed",
          msg: "Recovery request failed.",
        },
      },
    });

    const response = await page.goto("/forgot-password");
    expectNavigationResponseOk(response, "/forgot-password");

    await page.getByLabel("Email address").fill("client@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(page.getByText(
      "Recovery request failed.",
    )).toBeVisible();
    const calls = await supabase.calls();
    expect(calls).toHaveLength(1);
    expect(readCaptchaToken(calls[0])).toMatch(
      /^token-password_reset-/,
    );
    expect((await getTurnstileState(page)).resetCount).toBe(1);
  });
});

async function installFakeTurnstile(page: Page) {
  let scriptRequests = 0;

  await page.route(TURNSTILE_SCRIPT_SRC, async (route) => {
    scriptRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
(() => {
  const state = {
    renderCount: 0,
    resetCount: 0,
    removeCount: 0,
    latestOptions: null,
    widgets: [],
  };

  window.__turnstileTest = {
    state: () => ({
      renderCount: state.renderCount,
      resetCount: state.resetCount,
      removeCount: state.removeCount,
      widgets: state.widgets.map((widget) => ({ ...widget })),
    }),
    expire: () => state.latestOptions && state.latestOptions["expired-callback"](),
    fail: () => state.latestOptions && state.latestOptions["error-callback"](),
  };

  window.turnstile = {
    render: (container, options) => {
      state.renderCount += 1;
      state.latestOptions = options;

      const id = "turnstile-widget-" + state.renderCount;
      state.widgets.push({
        id,
        action: options.action || null,
        sitekey: options.sitekey || null,
      });

      const widget = document.createElement("div");
      widget.setAttribute("data-testid", "fake-turnstile-widget");
      widget.textContent = "Security check (" + options.action + ")";
      container.replaceChildren(widget);

      queueMicrotask(() => {
        options.callback("token-" + options.action + "-" + state.renderCount);
      });

      return id;
    },
    reset: () => {
      state.resetCount += 1;
      const options = state.latestOptions;
      if (options) {
        queueMicrotask(() => {
          options.callback("token-reset-" + state.resetCount);
        });
      }
    },
    remove: () => {
      state.removeCount += 1;
    },
  };
})();
      `,
    });
  });

  return {
    requestCount() {
      return scriptRequests;
    },
  };
}

async function installSupabaseAuthStub(
  page: Page,
  responses: Record<string, { status: number; body: Record<string, unknown> }>,
) {
  if (!configuredSupabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required for this test.");
  }

  await page.addInitScript((stubResponses) => {
    const windowWithStub = window as unknown as {
      __supabaseAuthCalls: CapturedSupabaseCall[];
    };
    const originalFetch = window.fetch.bind(window);

    windowWithStub.__supabaseAuthCalls = [];

    window.fetch = async (input, init) => {
      const request =
        input instanceof Request ? input : new Request(input, init);
      const requestUrl = new URL(request.url);

      if (!requestUrl.pathname.startsWith("/auth/v1/")) {
        return originalFetch(input, init);
      }

      let body: Record<string, unknown> = {};
      const bodyText = await request.clone().text();
      if (bodyText) {
        body = JSON.parse(bodyText) as Record<string, unknown>;
      }

      windowWithStub.__supabaseAuthCalls.push({
        pathname: requestUrl.pathname,
        search: requestUrl.search,
        body,
      });

      const response = stubResponses[requestUrl.pathname] ?? {
        status: 404,
        body: { error: "not_found", msg: "Unexpected auth request." },
      };

      return new Response(JSON.stringify(response.body), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    };
  }, responses);

  return {
    calls: () =>
      page.evaluate(() => {
        const windowWithStub = window as unknown as {
          __supabaseAuthCalls: CapturedSupabaseCall[];
        };

        return windowWithStub.__supabaseAuthCalls;
      }),
  };
}

function readCaptchaToken(call: CapturedSupabaseCall | undefined) {
  const security = call?.body.gotrue_meta_security as
    | { captcha_token?: unknown }
    | undefined;

  return String(security?.captcha_token ?? "");
}

async function getTurnstileState(page: Page): Promise<TurnstileTestState> {
  return page.evaluate(() => {
    const windowWithTest = window as unknown as {
      __turnstileTest: { state: () => TurnstileTestState };
    };

    return windowWithTest.__turnstileTest.state();
  });
}

async function expireTurnstile(page: Page) {
  await page.evaluate(() => {
    const windowWithTest = window as unknown as {
      __turnstileTest: { expire: () => void };
    };

    windowWithTest.__turnstileTest.expire();
  });
}

async function failTurnstile(page: Page) {
  await page.evaluate(() => {
    const windowWithTest = window as unknown as {
      __turnstileTest: { fail: () => void };
    };

    windowWithTest.__turnstileTest.fail();
  });
}
