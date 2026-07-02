import { expect, type Page, type TestInfo } from "@playwright/test";

const DEFAULT_BASE_URL = "http://127.0.0.1:3100";

const ANALYTICS_HOSTS = [
  "google-analytics.com",
  "www.google-analytics.com",
  "analytics.google.com",
  "googletagmanager.com",
  "www.googletagmanager.com",
];

const CRISP_HOST_SUFFIXES = [
  "crisp.chat",
  "crisp.website",
];

const FORBIDDEN_API_PATHS = [
  "/api/order",
  "/api/upload-url",
  "/api/order-drafts",
  "/api/support",
];

export interface SmokeNetworkGuard {
  expectClean(): Promise<void>;
  expectNoPageErrorsOrServerErrors(): Promise<void>;
  expectNoForbiddenApiCalls(): Promise<void>;
  expectNoCrispRequests(): Promise<void>;
}

interface GuardState {
  pageErrors: string[];
  consoleErrors: string[];
  sameOriginServerErrors: string[];
  forbiddenApiCalls: string[];
  crispRequests: string[];
}

export async function installSmokeNetworkGuards(
  page: Page,
  testInfo?: TestInfo,
): Promise<SmokeNetworkGuard> {
  const state: GuardState = {
    pageErrors: [],
    consoleErrors: [],
    sameOriginServerErrors: [],
    forbiddenApiCalls: [],
    crispRequests: [],
  };
  const baseOrigin = new URL(
    process.env.PLAYWRIGHT_BASE_URL?.trim() || DEFAULT_BASE_URL,
  ).origin;

  await page.route("**/*", async (route) => {
    const requestUrl = route.request().url();
    const parsedUrl = safeParseUrl(requestUrl);

    if (parsedUrl && isAnalyticsHost(parsedUrl.hostname)) {
      await route.abort("blockedbyclient");
      return;
    }

    if (parsedUrl && isCrispHost(parsedUrl.hostname)) {
      state.crispRequests.push(requestUrl);
      await route.abort("blockedbyclient");
      return;
    }

    await route.continue();
  });

  page.on("request", (request) => {
    const parsedUrl = safeParseUrl(request.url());
    if (!parsedUrl || parsedUrl.origin !== baseOrigin) return;

    if (isForbiddenApiPath(parsedUrl.pathname)) {
      state.forbiddenApiCalls.push(`${request.method()} ${parsedUrl.pathname}`);
    }
  });

  page.on("response", (response) => {
    const parsedUrl = safeParseUrl(response.url());
    if (!parsedUrl || parsedUrl.origin !== baseOrigin) return;

    if (response.status() >= 500) {
      state.sameOriginServerErrors.push(
        `${response.status()} ${parsedUrl.pathname}`,
      );
    }
  });

  page.on("pageerror", (error) => {
    state.pageErrors.push(error.stack || error.message);
  });

  page.on("console", (message) => {
    if (message.type() !== "error") return;

    const locationUrl = message.location().url;
    const parsedUrl = locationUrl ? safeParseUrl(locationUrl) : null;
    const isFirstParty = !parsedUrl || parsedUrl.origin === baseOrigin;

    if (isFirstParty) {
      state.consoleErrors.push(
        locationUrl ? `${message.text()} (${locationUrl})` : message.text(),
      );
    }
  });

  return {
    async expectClean() {
      await attachDiagnostics(testInfo, state);
      expect(state.pageErrors, "uncaught page errors").toEqual([]);
      expect(state.consoleErrors, "first-party console errors").toEqual([]);
      expect(state.sameOriginServerErrors, "same-origin HTTP 500+ responses").toEqual([]);
      expect(state.forbiddenApiCalls, "forbidden same-origin API calls").toEqual([]);
    },
    async expectNoPageErrorsOrServerErrors() {
      await attachDiagnostics(testInfo, state);
      expect(state.pageErrors, "uncaught page errors").toEqual([]);
      expect(state.sameOriginServerErrors, "same-origin HTTP 500+ responses").toEqual([]);
      expect(state.forbiddenApiCalls, "forbidden same-origin API calls").toEqual([]);
    },
    async expectNoForbiddenApiCalls() {
      await attachDiagnostics(testInfo, state);
      expect(state.forbiddenApiCalls, "forbidden same-origin API calls").toEqual([]);
    },
    async expectNoCrispRequests() {
      await attachDiagnostics(testInfo, state);
      expect(state.crispRequests, "Crisp network requests").toEqual([]);
    },
  };
}

export function expectNavigationResponseOk(
  response: Awaited<ReturnType<Page["goto"]>>,
  route: string,
) {
  expect(response, `${route} should return a navigation response`).not.toBeNull();
  expect(response?.status(), `${route} should not be 404`).not.toBe(404);
  expect(response?.status(), `${route} should not be 500+`).toBeLessThan(500);
}

function isForbiddenApiPath(pathname: string) {
  return (
    FORBIDDEN_API_PATHS.includes(pathname) ||
    pathname.startsWith("/api/order-drafts/")
  );
}

function isAnalyticsHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return ANALYTICS_HOSTS.some(
    (host) => normalized === host || normalized.endsWith(`.${host}`),
  );
}

function isCrispHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return CRISP_HOST_SUFFIXES.some(
    (host) => normalized === host || normalized.endsWith(`.${host}`),
  );
}

function safeParseUrl(url: string) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

async function attachDiagnostics(
  testInfo: TestInfo | undefined,
  state: GuardState,
) {
  if (!testInfo) return;

  await testInfo.attach("smoke-network-diagnostics", {
    contentType: "application/json",
    body: JSON.stringify(state, null, 2),
  });
}
