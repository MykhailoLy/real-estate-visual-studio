import { expect, test, type Page } from "@playwright/test";
import { expectNavigationResponseOk } from "../support/network";

import { TURNSTILE_SCRIPT_SRC, installFakeTurnstile, getTurnstileState, expireTurnstile, failTurnstile } from "../support/turnstile-fixture";
const TURNSTILE_DUMMY_SITE_KEY = "1x00000000000000000000AA";
const hasAnyTurnstileSiteKey = Boolean(
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim(),
);
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

const dormantAuthRoutes = [
  {
    route: "/login",
    heading: "Welcome back",
    button: "Sign in to your account",
    secondaryButton: "Email me a sign-in link",
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

  for (const authRoute of dormantAuthRoutes) {
    test(`${authRoute.route} does not load Turnstile without a site key`, async ({
      page,
    }) => {
      let turnstileRequests = 0;
      await page.route("https://challenges.cloudflare.com/**", async (route) => {
        turnstileRequests += 1;
        await route.abort("blockedbyclient");
      });

      const response = await page.goto(authRoute.route);

      expectNavigationResponseOk(response, authRoute.route);
      await expect(
        page.getByRole("heading", { name: authRoute.heading, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: authRoute.button }),
      ).toBeEnabled();
      if ("secondaryButton" in authRoute) {
        await expect(
          page.getByRole("button", { name: authRoute.secondaryButton }),
        ).toBeEnabled();
      }
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

test("Spanish login page renders the Magic Link action", async ({ page }) => {
  if (hasAnyTurnstileSiteKey) {
    await installFakeTurnstile(page);
  }

  const response = await page.goto("/es/login");
  expectNavigationResponseOk(response, "/es/login");
  await expect(
    page.getByRole("heading", { name: "Bienvenido de nuevo", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enviarme un enlace de acceso" }),
  ).toBeVisible();
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
    expect(calls[0]?.body.email).toBe("client@example.com");
    expect(calls[0]?.body.password).toBe("not-the-password");
    expect(readCaptchaToken(calls[0])).toMatch(/^token-login-/);
    expect((await getTurnstileState(page)).resetCount).toBe(1);
  });

  test("magic link requires email before contacting Supabase", async ({
    page,
  }) => {
    await installFakeTurnstile(page);
    const supabase = await installSupabaseAuthStub(page, {
      "/auth/v1/otp": {
        status: 200,
        body: {},
      },
    });

    const response = await page.goto("/login");
    expectNavigationResponseOk(response, "/login");

    await page
      .getByRole("button", { name: "Email me a sign-in link" })
      .click();

    await expect(page.getByText("Enter your email address.")).toBeVisible();
    expect(await supabase.calls()).toHaveLength(0);
    expect((await getTurnstileState(page)).resetCount).toBe(0);
  });

  test("magic link requires Turnstile token without resetting local validation", async ({
    page,
  }) => {
    await installFakeTurnstile(page);
    const supabase = await installSupabaseAuthStub(page, {
      "/auth/v1/otp": {
        status: 200,
        body: {},
      },
    });

    const response = await page.goto("/login");
    expectNavigationResponseOk(response, "/login");

    await page.getByLabel("Email address").fill("client@example.com");
    await expireTurnstile(page);
    await page
      .getByRole("button", { name: "Email me a sign-in link" })
      .click();

    await expect(
      page.getByText("Please complete the security check."),
    ).toBeVisible();
    expect(await supabase.calls()).toHaveLength(0);
    expect((await getTurnstileState(page)).resetCount).toBe(0);
  });

  test("magic link sends OTP with captcha and preserves safe redirect", async ({
    page,
  }) => {
    await installFakeTurnstile(page);
    const supabase = await installSupabaseAuthStub(page, {
      "/auth/v1/otp": {
        status: 200,
        body: {},
      },
    });
    const redirectPath = "/dashboard/orders/new/virtual-staging?source=login";

    const response = await page.goto(
      `/login?redirectTo=${encodeURIComponent(redirectPath)}`,
    );
    expectNavigationResponseOk(response, "/login");

    await page.getByLabel("Email address").fill("client@example.com");
    await page
      .getByRole("button", { name: "Email me a sign-in link" })
      .click();

    await expect(
      page.getByRole("heading", { name: "Check your inbox", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/If an account exists for that email/),
    ).toBeVisible();

    const calls = await supabase.calls();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.pathname).toBe("/auth/v1/otp");
    expect(calls[0]?.body.email).toBe("client@example.com");
    expect(calls[0]?.body.create_user).toBe(false);
    expect(readCaptchaToken(calls[0])).toMatch(/^token-login-/);

    const redirectTo = readRedirectTo(calls[0]);
    const redirectUrl = new URL(redirectTo);
    expect(redirectUrl.origin).toBe(new URL(page.url()).origin);
    expect(redirectUrl.pathname).toBe("/auth/callback");
    expect(redirectUrl.searchParams.get("next")).toBe(redirectPath);
  });

  test("magic link resets Turnstile after auth failure", async ({
    page,
  }) => {
    await installFakeTurnstile(page);
    const supabase = await installSupabaseAuthStub(page, {
      "/auth/v1/otp": {
        status: 400,
        body: {
          error: "captcha_failed",
          msg: "Magic link request failed.",
        },
      },
    });

    const response = await page.goto("/login");
    expectNavigationResponseOk(response, "/login");

    await page.getByLabel("Email address").fill("client@example.com");
    await page
      .getByRole("button", { name: "Email me a sign-in link" })
      .click();

    await expect(page.getByText("Magic link request failed.")).toBeVisible();
    const calls = await supabase.calls();
    expect(calls).toHaveLength(1);
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

function readRedirectTo(call: CapturedSupabaseCall | undefined) {
  return new URLSearchParams(call?.search ?? "").get("redirect_to") ?? "";
}
