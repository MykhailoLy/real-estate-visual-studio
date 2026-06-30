import assert from "node:assert/strict";
import test from "node:test";
import {
  CRISP_CONTEXT_SENT_DATA_KEY,
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
  sessionData: Record<string, boolean | string | number> = {};
  sentTexts: string[] = [];
  loadedCallback: (() => void) | null = null;
  sessionIdentifier: string | null = null;
  sessionIdentifierAfterLoad: string | null = "session_123";
  autoLoad = true;
  loadSetsIdentifier = true;
  throwOnLoad = false;
  throwOnGetData = false;
  throwOnGetIdentifier = false;
  throwOnMarkerSetData = false;
  throwOnOffLoaded = false;
  throwOnSendText = false;
  throwOnOpen = false;
  throwOnShow = false;
  launcherVisible = false;
  chatOpen = false;

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
      if (
        this.throwOnMarkerSetData &&
        Object.hasOwn(data, CRISP_CONTEXT_SENT_DATA_KEY)
      ) {
        throw new Error("marker setData failed");
      }
      this.sessionData = {
        ...this.sessionData,
        ...data,
      };
    },
    getData: (key: string) => {
      this.calls.push(`getData:${key}`);
      if (this.throwOnGetData) {
        throw new Error("getData failed");
      }
      return this.sessionData[key];
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
      if (this.throwOnOffLoaded) {
        throw new Error("offLoaded failed");
      }
      this.loadedCallback = null;
    },
  };

  message = {
    sendText: (content: string) => {
      this.calls.push(`sendText:${content}`);
      if (this.throwOnSendText) {
        throw new Error("sendText failed");
      }
      this.sentTexts.push(content);
    },
  };

  chat = {
    show: () => {
      this.calls.push("chat.show");
      if (this.throwOnShow) {
        throw new Error("show failed");
      }
      this.launcherVisible = true;
    },
    open: () => {
      this.calls.push("chat.open");
      if (this.throwOnOpen) {
        throw new Error("open failed");
      }
      this.chatOpen = true;
    },
    close: () => {
      this.calls.push("chat.close");
      this.chatOpen = false;
    },
    hide: () => {
      this.calls.push("chat.hide");
      this.launcherVisible = false;
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
        this.sessionIdentifier = this.sessionIdentifierAfterLoad;
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
    context: {
      message: "handoff context",
      hasTranscript: true,
    },
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

async function expectSettled<T>(promise: Promise<T>, timeoutMs = 50) {
  const pending = Symbol("pending");
  const result = await Promise.race([
    promise,
    new Promise<typeof pending>((resolve) => {
      setTimeout(() => resolve(pending), timeoutMs);
    }),
  ]);

  assert.notEqual(result, pending);
  return result as T;
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

test("adapter preserves session data while adding metadata and context marker", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  sdk.sessionData = {
    existing_key: "preserved",
  };

  await startCrispSupportHandoff(options(sdk, { pagePath: "/es/services" }));

  assert.deepEqual(sdk.sessionData, {
    existing_key: "preserved",
    picchuspot_handoff: true,
    picchuspot_locale: "en",
    picchuspot_page: "/es/services",
    [CRISP_CONTEXT_SENT_DATA_KEY]: true,
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
  assert.equal(sdk.sessionData[CRISP_CONTEXT_SENT_DATA_KEY], true);
  assert.equal(sdk.calls.indexOf("sendText:handoff context") > sdk.calls.indexOf("offLoaded"), true);
  assert.equal(sdk.calls.at(-2), "chat.show");
  assert.equal(sdk.calls.at(-1), "chat.open");
});

test("first handoff without a transcript sends one fallback message", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();

  const result = await startCrispSupportHandoff(
    options(sdk, {
      context: {
        message: "fallback context",
        hasTranscript: false,
      },
    }),
  );

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(sdk.sentTexts, ["fallback context"]);
  assert.equal(sdk.sessionData[CRISP_CONTEXT_SENT_DATA_KEY], true);
});

test("restored session with marker and no transcript sends no automatic message", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  sdk.sessionIdentifier = "existing_session";
  sdk.sessionData[CRISP_CONTEXT_SENT_DATA_KEY] = true;

  const result = await startCrispSupportHandoff(
    options(sdk, {
      context: {
        message: "fallback context",
        hasTranscript: false,
      },
    }),
  );

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(sdk.sentTexts, []);
  assert.equal(sdk.calls.includes("load"), false);
  assert.equal(sdk.calls.at(-2), "chat.show");
  assert.equal(sdk.calls.at(-1), "chat.open");
});

test("string true marker suppresses an empty fallback", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  sdk.sessionIdentifier = "existing_session";
  sdk.sessionData[CRISP_CONTEXT_SENT_DATA_KEY] = "true";

  const result = await startCrispSupportHandoff(
    options(sdk, {
      context: {
        message: "fallback context",
        hasTranscript: false,
      },
    }),
  );

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(sdk.sentTexts, []);
});

test("missing and false marker values do not suppress an empty fallback", async () => {
  for (const marker of [undefined, false, "false", 0] as const) {
    resetCrispSupportClientForTests();
    const sdk = new FakeCrispSdk();
    sdk.sessionIdentifier = "existing_session";
    if (marker !== undefined) {
      sdk.sessionData[CRISP_CONTEXT_SENT_DATA_KEY] = marker;
    }

    const result = await startCrispSupportHandoff(
      options(sdk, {
        context: {
          message: "fallback context",
          hasTranscript: false,
        },
      }),
    );

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(sdk.sentTexts, ["fallback context"]);
    assert.equal(sdk.sessionData[CRISP_CONTEXT_SENT_DATA_KEY], true);
  }
});

test("restored session with marker and new transcript sends structured context", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  sdk.sessionIdentifier = "existing_session";
  sdk.sessionData[CRISP_CONTEXT_SENT_DATA_KEY] = true;

  const result = await startCrispSupportHandoff(options(sdk));

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(sdk.sentTexts, ["handoff context"]);
  assert.equal(sdk.sessionData[CRISP_CONTEXT_SENT_DATA_KEY], true);
});

test("existing session detection occurs before sdk.load", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();

  const result = await startCrispSupportHandoff(options(sdk));

  assert.deepEqual(result, { ok: true });
  assert.equal(sdk.calls.indexOf("getIdentifier") < sdk.calls.indexOf("load"), true);
});

test("pre-load null identifier with restored marker sends no fallback", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  sdk.sessionIdentifier = null;
  sdk.sessionIdentifierAfterLoad = "restored_session";
  sdk.sessionData[CRISP_CONTEXT_SENT_DATA_KEY] = true;
  const fallbackOptions = {
    context: {
      message: "fallback context",
      hasTranscript: false,
    },
  };

  const result = await startCrispSupportHandoff(options(sdk, fallbackOptions));

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(sdk.sentTexts, []);
  assert.equal(sdk.calls.filter((call) => call === "load").length, 1);
  assert.equal(
    sdk.calls.indexOf("load") <
      sdk.calls.indexOf(`getData:${CRISP_CONTEXT_SENT_DATA_KEY}`),
    true,
  );
  assert.equal(sdk.sessionIdentifier, "restored_session");
});

test("module reset preserves marker and prevents reload-style duplicate fallback", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  const fallbackOptions = {
    context: {
      message: "fallback context",
      hasTranscript: false,
    },
  };

  assert.deepEqual(
    await startCrispSupportHandoff(options(sdk, fallbackOptions)),
    { ok: true },
  );
  assert.equal(sdk.sessionData[CRISP_CONTEXT_SENT_DATA_KEY], true);

  resetCrispSupportClientForTests();
  sdk.sessionIdentifier = null;
  assert.deepEqual(
    await startCrispSupportHandoff(options(sdk, fallbackOptions)),
    { ok: true },
  );

  assert.deepEqual(sdk.sentTexts, ["fallback context"]);
  assert.equal(sdk.sessionData[CRISP_CONTEXT_SENT_DATA_KEY], true);
});

test("three reload-style reconnections do not duplicate the original fallback", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  const fallbackOptions = {
    context: {
      message: "fallback context",
      hasTranscript: false,
    },
  };

  await startCrispSupportHandoff(options(sdk, fallbackOptions));

  for (let reconnect = 0; reconnect < 3; reconnect += 1) {
    resetCrispSupportClientForTests();
    sdk.sessionIdentifier = null;
    assert.deepEqual(
      await startCrispSupportHandoff(options(sdk, fallbackOptions)),
      { ok: true },
    );
  }

  assert.deepEqual(sdk.sentTexts, ["fallback context"]);
});

test("timeout followed by late session retry sends and persists fallback once", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  sdk.autoLoad = false;
  const fallbackOptions = {
    context: {
      message: "fallback context",
      hasTranscript: false,
    },
  };

  const first = await startCrispSupportHandoff(
    options(sdk, { ...fallbackOptions, timeoutMs: 1 }),
  );

  assert.deepEqual(first, { ok: false, code: "timeout" });
  assert.deepEqual(sdk.sentTexts, []);

  sdk.sessionIdentifier = "late_session";
  const retry = await startCrispSupportHandoff(options(sdk, fallbackOptions));

  assert.deepEqual(retry, { ok: true });
  assert.deepEqual(sdk.sentTexts, ["fallback context"]);
  assert.equal(sdk.sessionData[CRISP_CONTEXT_SENT_DATA_KEY], true);
  assert.equal(sdk.chatOpen, true);

  const duplicate = await startCrispSupportHandoff(options(sdk, fallbackOptions));

  assert.deepEqual(duplicate, { ok: true });
  assert.deepEqual(sdk.sentTexts, ["fallback context"]);
});

test("cancellation followed by late session retry sends and persists fallback once", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  sdk.autoLoad = false;
  const controller = new AbortController();
  const fallbackOptions = {
    context: {
      message: "fallback context",
      hasTranscript: false,
    },
  };

  const first = startCrispSupportHandoff(
    options(sdk, {
      ...fallbackOptions,
      signal: controller.signal,
      timeoutMs: 500,
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  controller.abort();

  assert.deepEqual(await first, { ok: false, code: "cancelled" });
  assert.deepEqual(sdk.sentTexts, []);

  sdk.sessionIdentifier = "late_session";
  const retry = await startCrispSupportHandoff(options(sdk, fallbackOptions));

  assert.deepEqual(retry, { ok: true });
  assert.deepEqual(sdk.sentTexts, ["fallback context"]);
  assert.equal(sdk.sessionData[CRISP_CONTEXT_SENT_DATA_KEY], true);
  assert.equal(sdk.chatOpen, true);
});

test("late session retry with transcript sends structured context and marker", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  sdk.autoLoad = false;

  const first = await startCrispSupportHandoff(
    options(sdk, {
      context: {
        message: "fallback context",
        hasTranscript: false,
      },
      timeoutMs: 1,
    }),
  );

  assert.deepEqual(first, { ok: false, code: "timeout" });

  sdk.sessionIdentifier = "late_session";
  const retry = await startCrispSupportHandoff(
    options(sdk, {
      context: {
        message: "structured transcript",
        hasTranscript: true,
      },
    }),
  );

  assert.deepEqual(retry, { ok: true });
  assert.deepEqual(sdk.sentTexts, ["structured transcript"]);
  assert.equal(sdk.sessionData[CRISP_CONTEXT_SENT_DATA_KEY], true);
});

test("sendText failure stores no marker and retry persists it after success", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  sdk.throwOnSendText = true;
  const fallbackOptions = {
    context: {
      message: "fallback context",
      hasTranscript: false,
    },
  };

  const first = await startCrispSupportHandoff(options(sdk, fallbackOptions));

  assert.deepEqual(first, { ok: false, code: "load_failed" });
  assert.deepEqual(sdk.sentTexts, []);
  assert.equal(sdk.sessionData[CRISP_CONTEXT_SENT_DATA_KEY], undefined);

  sdk.throwOnSendText = false;
  const retry = await startCrispSupportHandoff(options(sdk, fallbackOptions));

  assert.deepEqual(retry, { ok: true });
  assert.deepEqual(sdk.sentTexts, ["fallback context"]);
  assert.equal(sdk.sessionData[CRISP_CONTEXT_SENT_DATA_KEY], true);
  assert.equal(sdk.chatOpen, true);
});

test("getData failure does not block fallback or marker persistence", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  sdk.throwOnGetData = true;

  const result = await startCrispSupportHandoff(
    options(sdk, {
      context: {
        message: "fallback context",
        hasTranscript: false,
      },
    }),
  );

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(sdk.sentTexts, ["fallback context"]);
  assert.equal(sdk.sessionData[CRISP_CONTEXT_SENT_DATA_KEY], true);
});

test("marker persistence failure does not resend in the same module lifecycle", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  sdk.throwOnMarkerSetData = true;
  const fallbackOptions = {
    context: {
      message: "fallback context",
      hasTranscript: false,
    },
  };

  const first = await startCrispSupportHandoff(options(sdk, fallbackOptions));
  const duplicate = await startCrispSupportHandoff(
    options(sdk, fallbackOptions),
  );

  assert.deepEqual(first, { ok: true });
  assert.deepEqual(duplicate, { ok: true });
  assert.deepEqual(sdk.sentTexts, ["fallback context"]);
  assert.equal(sdk.sessionData[CRISP_CONTEXT_SENT_DATA_KEY], undefined);
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

test("session.offLoaded throwing does not leave the handoff Promise pending", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  sdk.autoLoad = false;
  sdk.throwOnOffLoaded = true;

  const promise = startCrispSupportHandoff(options(sdk));
  await new Promise((resolve) => setTimeout(resolve, 0));
  sdk.sessionIdentifier = "session_123";
  sdk.loadedCallback?.();

  assert.deepEqual(await expectSettled(promise), { ok: true });
  assert.equal(sdk.calls.filter((call) => call === "offLoaded").length, 1);
});

test("normal session load still resolves safely when offLoaded throws", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  sdk.throwOnOffLoaded = true;

  const result = await expectSettled(startCrispSupportHandoff(options(sdk)));

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(sdk.sentTexts, ["handoff context"]);
  assert.equal(sdk.calls.at(-2), "chat.show");
  assert.equal(sdk.calls.at(-1), "chat.open");
});

test("timeout still resolves safely when offLoaded throws", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  sdk.autoLoad = false;
  sdk.throwOnOffLoaded = true;

  const result = await expectSettled(
    startCrispSupportHandoff(options(sdk, { timeoutMs: 1 })),
  );

  assert.deepEqual(result, { ok: false, code: "timeout" });
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

test("cancellation still resolves safely when offLoaded throws", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  sdk.autoLoad = false;
  sdk.throwOnOffLoaded = true;
  const { controller, counts } = createTrackedAbortController();

  const promise = startCrispSupportHandoff(
    options(sdk, { signal: controller.signal, timeoutMs: 500 }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  controller.abort();

  assert.deepEqual(await expectSettled(promise), { ok: false, code: "cancelled" });
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

test("already activated chat.open failure returns load_failed instead of rejecting", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  await startCrispSupportHandoff(options(sdk));
  sdk.throwOnOpen = true;

  let loaderCalled = false;
  const result = await startCrispSupportHandoff({
    ...options(new FakeCrispSdk()),
    sdkLoader: async () => {
      loaderCalled = true;
      throw new Error("should not load");
    },
  });

  assert.deepEqual(result, { ok: false, code: "load_failed" });
  assert.equal(loaderCalled, false);
  assert.deepEqual(sdk.sentTexts, ["handoff context"]);
  assert.equal(sdk.chatOpen, false);
  assert.equal(sdk.launcherVisible, false);
});

test("already activated chat.show failure leaves native Crisp closed and hidden", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();
  await startCrispSupportHandoff(options(sdk));
  sdk.throwOnShow = true;

  const result = await startCrispSupportHandoff(options(new FakeCrispSdk()));

  assert.deepEqual(result, { ok: false, code: "load_failed" });
  assert.deepEqual(sdk.sentTexts, ["handoff context"]);
  assert.equal(sdk.chatOpen, false);
  assert.equal(sdk.launcherVisible, false);
  assert.equal(sdk.calls.at(-2), "chat.close");
  assert.equal(sdk.calls.at(-1), "chat.hide");
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

test("unexpected internal rejection returns load_failed and clears activeAttempt for retry", async () => {
  resetCrispSupportClientForTests();
  const badOptions = options(new FakeCrispSdk());
  Object.defineProperty(badOptions, "language", {
    get() {
      throw new Error("unexpected language failure");
    },
  });

  const result = await startCrispSupportHandoff(badOptions);

  assert.deepEqual(result, { ok: false, code: "load_failed" });

  const retrySdk = new FakeCrispSdk();
  const retry = await startCrispSupportHandoff(options(retrySdk));

  assert.deepEqual(retry, { ok: true });
  assert.equal(retrySdk.calls.filter((call) => call === "load").length, 1);
  assert.deepEqual(retrySdk.sentTexts, ["handoff context"]);
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
