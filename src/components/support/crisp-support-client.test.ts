import assert from "node:assert/strict";
import test from "node:test";
import {
  CRISP_COOKIE_DOMAIN,
  CRISP_COOKIE_EXPIRE_SECONDS,
  CRISP_WEBSITE_ID,
  isCrispProductionHostname,
  resetCrispSupportClientForTests,
  startCrispSupportHandoff,
  type PicchuSpotCrispSdk,
} from "./crisp-support-client.ts";

class FakeCrispSdk implements PicchuSpotCrispSdk {
  calls: string[] = [];
  configureCalls: Array<[string, Parameters<PicchuSpotCrispSdk["configure"]>[1]]> = [];
  sessionData: Record<string, boolean | string> | null = null;
  sentTexts: string[] = [];
  loadedCallback: (() => void) | null = null;
  autoLoad = true;
  throwOnLoad = false;

  user = {
    setNickname: (nickname: string) => {
      this.calls.push(`setNickname:${nickname}`);
    },
    setEmail: (email: string) => {
      this.calls.push(`setEmail:${email}`);
    },
  };

  session = {
    setData: (data: Record<string, boolean | string>) => {
      this.calls.push("setData");
      this.sessionData = data;
    },
    onLoaded: (callback: () => void) => {
      this.calls.push("onLoaded");
      this.loadedCallback = callback;
    },
    offLoaded: () => {
      this.calls.push("offLoaded");
      this.loadedCallback = null;
    },
  };

  message = {
    sendText: (content: string) => {
      this.calls.push(`sendText:${content}`);
      this.sentTexts.push(content);
    },
  };

  chat = {
    show: () => {
      this.calls.push("chat.show");
    },
    open: () => {
      this.calls.push("chat.open");
    },
  };

  configure(
    websiteId: string,
    options: Parameters<PicchuSpotCrispSdk["configure"]>[1],
  ) {
    this.calls.push("configure");
    this.configureCalls.push([websiteId, options]);
  }

  load() {
    this.calls.push("load");
    if (this.throwOnLoad) {
      throw new Error("load failed");
    }
    if (this.autoLoad) {
      this.loadedCallback?.();
    }
  }

  setAvailabilityTooltip(enabled: boolean) {
    this.calls.push(`setAvailabilityTooltip:${enabled}`);
  }

  toggleOperatorCount(enabled: boolean) {
    this.calls.push(`toggleOperatorCount:${enabled}`);
  }

  setPosition(position: "right") {
    this.calls.push(`setPosition:${position}`);
  }

  setHideOnMobile(enabled: boolean) {
    this.calls.push(`setHideOnMobile:${enabled}`);
  }
}

function options(sdk: FakeCrispSdk, overrides = {}) {
  return {
    language: "en" as const,
    name: "Ada",
    email: "ada@example.com",
    pagePath: "/pricing",
    contextMessage: "handoff context",
    hostname: "picchuspot.com",
    sdkLoader: async () => sdk,
    timeoutMs: 50,
    ...overrides,
  };
}

test("production hostname guard accepts only live PicchuSpot hosts", () => {
  assert.equal(isCrispProductionHostname("picchuspot.com"), true);
  assert.equal(isCrispProductionHostname("www.picchuspot.com"), true);
  assert.equal(isCrispProductionHostname("localhost"), false);
  assert.equal(isCrispProductionHostname("127.0.0.1"), false);
  assert.equal(isCrispProductionHostname("picchuspot-git-branch.vercel.app"), false);
  assert.equal(isCrispProductionHostname("preview.picchuspot.com"), false);
});

test("non-production handoff returns safe failure before loading SDK", async () => {
  resetCrispSupportClientForTests();
  let loaderCalled = false;
  const result = await startCrispSupportHandoff({
    ...options(new FakeCrispSdk()),
    hostname: "localhost",
    sdkLoader: async () => {
      loaderCalled = true;
      return new FakeCrispSdk();
    },
  });

  assert.deepEqual(result, { ok: false, code: "production_only" });
  assert.equal(loaderCalled, false);
});

test("adapter configures Crisp with explicit loading, public website ID, locale, and cookie settings", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();

  const result = await startCrispSupportHandoff(options(sdk, { language: "es" }));

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(sdk.configureCalls, [
    [
      CRISP_WEBSITE_ID,
      {
        autoload: false,
        locale: "es",
        cookieDomain: CRISP_COOKIE_DOMAIN,
        cookieExpire: CRISP_COOKIE_EXPIRE_SECONDS,
        safeMode: true,
      },
    ],
  ]);
  assert.ok(sdk.calls.includes("setAvailabilityTooltip:false"));
  assert.ok(sdk.calls.includes("toggleOperatorCount:false"));
  assert.ok(sdk.calls.includes("setPosition:right"));
  assert.ok(sdk.calls.includes("setHideOnMobile:false"));
});

test("adapter sets name only when present and always sets email", async () => {
  resetCrispSupportClientForTests();
  const named = new FakeCrispSdk();
  await startCrispSupportHandoff(options(named, { name: "Ada" }));
  assert.ok(named.calls.includes("setNickname:Ada"));
  assert.ok(named.calls.includes("setEmail:ada@example.com"));

  resetCrispSupportClientForTests();
  const anonymous = new FakeCrispSdk();
  await startCrispSupportHandoff(options(anonymous, { name: "" }));
  assert.equal(anonymous.calls.some((call) => call.startsWith("setNickname:")), false);
  assert.ok(anonymous.calls.includes("setEmail:ada@example.com"));
});

test("adapter sets only approved session data", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();

  await startCrispSupportHandoff(options(sdk, { pagePath: "/es/services" }));

  assert.deepEqual(sdk.sessionData, {
    picchuspot_handoff: true,
    picchuspot_locale: "en",
    picchuspot_page: "/es/services",
  });
});

test("adapter sends context once, then shows and opens native Crisp after load", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();

  const result = await startCrispSupportHandoff(options(sdk));

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(sdk.sentTexts, ["handoff context"]);
  assert.equal(sdk.calls.indexOf("sendText:handoff context") > sdk.calls.indexOf("offLoaded"), true);
  assert.equal(sdk.calls.at(-2), "chat.show");
  assert.equal(sdk.calls.at(-1), "chat.open");
});

test("duplicate submissions share one load and do not duplicate transcript transfer", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  sdk.autoLoad = false;

  const first = startCrispSupportHandoff(options(sdk));
  const second = startCrispSupportHandoff(options(sdk));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(sdk.calls.filter((call) => call === "load").length, 1);
  sdk.loadedCallback?.();

  assert.deepEqual(await Promise.all([first, second]), [{ ok: true }, { ok: true }]);
  assert.deepEqual(sdk.sentTexts, ["handoff context"]);
});

test("timeout maps to safe failure and cleans loaded callback", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  sdk.autoLoad = false;

  const result = await startCrispSupportHandoff(options(sdk, { timeoutMs: 1 }));

  assert.deepEqual(result, { ok: false, code: "timeout" });
  assert.equal(sdk.loadedCallback, null);
  assert.equal(sdk.calls.filter((call) => call === "offLoaded").length, 1);
});

test("SDK import and load failures map to safe failure", async () => {
  resetCrispSupportClientForTests();
  const importFailure = await startCrispSupportHandoff({
    ...options(new FakeCrispSdk()),
    sdkLoader: async () => {
      throw new Error("blocked");
    },
  });
  assert.deepEqual(importFailure, { ok: false, code: "load_failed" });

  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  sdk.throwOnLoad = true;
  const loadFailure = await startCrispSupportHandoff(options(sdk));
  assert.deepEqual(loadFailure, { ok: false, code: "load_failed" });
  assert.equal(sdk.loadedCallback, null);
});
