import assert from "node:assert/strict";
import test from "node:test";
import {
  CRISP_COOKIE_DOMAIN,
  CRISP_COOKIE_EXPIRE_SECONDS,
  CRISP_WEBSITE_ID,
  isCrispProductionHostname,
  resetCrispSupportClientForTests,
  setActiveCrispSupportVisibility,
  startCrispSupportHandoff,
  type PicchuSpotCrispSdk,
} from "./crisp-support-client.ts";

class FakeCrispSdk implements PicchuSpotCrispSdk {
  calls: string[] = [];
  configureCalls: Array<[string, Parameters<PicchuSpotCrispSdk["configure"]>[1]]> = [];
  sessionData: Record<string, boolean | string> | null = null;
  sentTexts: string[] = [];
  loadedCallback: (() => void) | null = null;
  sessionIdentifier: string | null = null;
  autoLoad = true;
  loadSetsIdentifier = true;
  throwOnLoad = false;
  throwOnGetIdentifier = false;

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
    getIdentifier: () => {
      this.calls.push("getIdentifier");
      if (this.throwOnGetIdentifier) {
        throw new Error("not ready");
      }
      return this.sessionIdentifier;
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
    close: () => {
      this.calls.push("chat.close");
    },
    hide: () => {
      this.calls.push("chat.hide");
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
      if (this.loadSetsIdentifier) {
        this.sessionIdentifier = "session_123";
      }
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

function createTrackedAbortController() {
  const controller = new AbortController();
  const signal = controller.signal;
  const addEventListener = signal.addEventListener.bind(signal);
  const removeEventListener = signal.removeEventListener.bind(signal);
  let addCount = 0;
  let removeCount = 0;

  signal.addEventListener = ((...args: Parameters<AbortSignal["addEventListener"]>) => {
    addCount += 1;
    return addEventListener(...args);
  }) as AbortSignal["addEventListener"];
  signal.removeEventListener = ((
    ...args: Parameters<AbortSignal["removeEventListener"]>
  ) => {
    removeCount += 1;
    return removeEventListener(...args);
  }) as AbortSignal["removeEventListener"];

  return {
    controller,
    counts: () => ({ addCount, removeCount }),
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

test("native Crisp is closed and hidden during loading before show and open", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();

  const result = await startCrispSupportHandoff(options(sdk));

  assert.deepEqual(result, { ok: true });
  assert.equal(sdk.calls.indexOf("load") < sdk.calls.indexOf("chat.close"), true);
  assert.equal(sdk.calls.indexOf("chat.close") < sdk.calls.indexOf("chat.hide"), true);
  assert.equal(
    sdk.calls.indexOf("chat.hide") < sdk.calls.indexOf("sendText:handoff context"),
    true,
  );
  assert.equal(sdk.calls.at(-2), "chat.show");
  assert.equal(sdk.calls.at(-1), "chat.open");
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
  sdk.sessionIdentifier = "session_123";
  sdk.loadedCallback?.();

  assert.deepEqual(await Promise.all([first, second]), [{ ok: true }, { ok: true }]);
  assert.deepEqual(sdk.sentTexts, ["handoff context"]);
});

test("timeout maps to safe failure, cleans callback, and leaves Crisp hidden", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  sdk.autoLoad = false;

  const result = await startCrispSupportHandoff(options(sdk, { timeoutMs: 1 }));

  assert.deepEqual(result, { ok: false, code: "timeout" });
  assert.equal(sdk.loadedCallback, null);
  assert.equal(sdk.calls.filter((call) => call === "offLoaded").length, 1);
  assert.ok(sdk.calls.includes("chat.close"));
  assert.ok(sdk.calls.includes("chat.hide"));
  assert.equal(sdk.calls.includes("chat.show"), false);
  assert.equal(sdk.calls.includes("chat.open"), false);
});

test("cancellation cleans listeners and leaves native Crisp hidden", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  sdk.autoLoad = false;
  const { controller, counts } = createTrackedAbortController();

  const promise = startCrispSupportHandoff(
    options(sdk, { signal: controller.signal, timeoutMs: 500 }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  controller.abort();

  assert.deepEqual(await promise, { ok: false, code: "cancelled" });
  assert.equal(sdk.loadedCallback, null);
  assert.deepEqual(counts(), { addCount: 1, removeCount: 1 });
  assert.deepEqual(sdk.sentTexts, []);
  assert.equal(sdk.calls.includes("chat.show"), false);
  assert.equal(sdk.calls.includes("chat.open"), false);
  assert.ok(sdk.calls.includes("chat.close"));
  assert.ok(sdk.calls.includes("chat.hide"));
});

test("cancelled attempt sends no transcript and never opens Crisp", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  const controller = new AbortController();
  controller.abort();

  const result = await startCrispSupportHandoff(
    options(sdk, { signal: controller.signal }),
  );

  assert.deepEqual(result, { ok: false, code: "cancelled" });
  assert.deepEqual(sdk.sentTexts, []);
  assert.equal(sdk.calls.includes("chat.show"), false);
  assert.equal(sdk.calls.includes("chat.open"), false);
});

test("late session identifier after timeout lets retry succeed without another loaded event", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  sdk.autoLoad = false;

  const first = await startCrispSupportHandoff(options(sdk, { timeoutMs: 1 }));
  assert.deepEqual(first, { ok: false, code: "timeout" });

  sdk.sessionIdentifier = "late_session";
  const onLoadedCountBeforeRetry = sdk.calls.filter((call) => call === "onLoaded").length;
  const loadCountBeforeRetry = sdk.calls.filter((call) => call === "load").length;
  const retry = await startCrispSupportHandoff(options(sdk));

  assert.deepEqual(retry, { ok: true });
  assert.equal(
    sdk.calls.filter((call) => call === "onLoaded").length,
    onLoadedCountBeforeRetry,
  );
  assert.equal(sdk.calls.filter((call) => call === "load").length, loadCountBeforeRetry);
  assert.deepEqual(sdk.sentTexts, ["handoff context"]);
});

test("late-load retry does not duplicate context after activation", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  sdk.autoLoad = false;

  await startCrispSupportHandoff(options(sdk, { timeoutMs: 1 }));
  sdk.sessionIdentifier = "late_session";
  await startCrispSupportHandoff(options(sdk));
  const secondRetry = await startCrispSupportHandoff(options(sdk));

  assert.deepEqual(secondRetry, { ok: true });
  assert.deepEqual(sdk.sentTexts, ["handoff context"]);
});

test("already activated handoff reuses activeSdk without invoking sdkLoader", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  await startCrispSupportHandoff(options(sdk));

  let loaderCalled = false;
  const result = await startCrispSupportHandoff({
    ...options(new FakeCrispSdk()),
    sdkLoader: async () => {
      loaderCalled = true;
      throw new Error("should not load");
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(loaderCalled, false);
  assert.equal(sdk.calls.filter((call) => call === "chat.show").length, 2);
  assert.equal(sdk.calls.filter((call) => call === "chat.open").length, 2);
});

test("unexpected SDK loader rejection returns load_failed instead of rejecting", async () => {
  resetCrispSupportClientForTests();
  const result = await startCrispSupportHandoff({
    ...options(new FakeCrispSdk()),
    sdkLoader: async () => {
      throw new Error("blocked");
    },
  });

  assert.deepEqual(result, { ok: false, code: "load_failed" });
});

test("load failure maps to safe failure and leaves native Crisp hidden", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  sdk.throwOnLoad = true;

  const result = await startCrispSupportHandoff(options(sdk));

  assert.deepEqual(result, { ok: false, code: "load_failed" });
  assert.equal(sdk.loadedCallback, null);
  assert.ok(sdk.calls.includes("chat.close"));
  assert.ok(sdk.calls.includes("chat.hide"));
});

test("active Crisp visibility false closes and hides native Crisp", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  await startCrispSupportHandoff(options(sdk));

  setActiveCrispSupportVisibility(false);

  assert.equal(sdk.calls.at(-2), "chat.close");
  assert.equal(sdk.calls.at(-1), "chat.hide");
});

test("active Crisp visibility true shows launcher but does not open chat", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  await startCrispSupportHandoff(options(sdk));
  const openCount = sdk.calls.filter((call) => call === "chat.open").length;

  setActiveCrispSupportVisibility(true);

  assert.equal(sdk.calls.at(-1), "chat.show");
  assert.equal(sdk.calls.filter((call) => call === "chat.open").length, openCount);
});

test("visibility helpers do nothing before successful activation", () => {
  resetCrispSupportClientForTests();

  assert.doesNotThrow(() => setActiveCrispSupportVisibility(false));
  assert.doesNotThrow(() => setActiveCrispSupportVisibility(true));
});
