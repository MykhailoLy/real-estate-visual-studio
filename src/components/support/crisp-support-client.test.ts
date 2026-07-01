import assert from "node:assert/strict";
import test from "node:test";
import {
  CRISP_CONTEXT_SENT_DATA_KEY,
  CRISP_COOKIE_DOMAIN,
  CRISP_COOKIE_EXPIRE_SECONDS,
  CRISP_HANDOFF_DATA_KEY,
  CRISP_WEBSITE_ID,
  isCrispProductionHostname,
  normalizeSupportEmail,
  openActiveCrispSupportChat,
  resetCrispSupportClientForTests,
  setActiveCrispSupportVisibility,
  startCrispSupportHandoff,
  type PicchuSpotCrispSdk,
} from "./crisp-support-client.ts";
import { isSupportChatRouteVisible } from "./support-chat-client.ts";

interface FakeSessionState {
  data: Record<string, boolean | string | number>;
  email: string | null;
  nickname: string | null;
  sentTexts: string[];
}

function createFakeSessionState(): FakeSessionState {
  return {
    data: {},
    email: null,
    nickname: null,
    sentTexts: [],
  };
}

class FakeCrispSdk implements PicchuSpotCrispSdk {
  calls: string[] = [];
  configureCalls: Array<[string, Parameters<PicchuSpotCrispSdk["configure"]>[1]]> = [];
  sentTexts: string[] = [];
  loadedCallback: (() => void) | null = null;
  sessionIdentifierAfterLoad: string | null = "session_123";
  sessionIdentifierAfterReset = "session_fresh";
  autoLoad = true;
  loadSetsIdentifier = true;
  autoResetLoad = true;
  resetSetsIdentifier = true;
  retainRuntimeNicknameOnReset = true;
  throwOnLoad = false;
  throwOnReset = false;
  throwOnSetNickname = false;
  throwOnGetEmail = false;
  throwOnGetData = false;
  throwOnGetIdentifier = false;
  throwOnMarkerSetData = false;
  throwOnOffLoaded = false;
  throwOnSendText = false;
  throwOnOpen = false;
  throwOnShow = false;
  launcherVisible = false;
  chatOpen = false;
  runtimeNickname: string | null = null;
  private sessions = new Map<string, FakeSessionState>();
  private pendingSession = createFakeSessionState();
  private currentSessionIdentifier: string | null = null;

  get sessionIdentifier() {
    return this.currentSessionIdentifier;
  }

  set sessionIdentifier(identifier: string | null) {
    if (identifier === this.currentSessionIdentifier) return;

    if (identifier === null) {
      if (this.currentSessionIdentifier) {
        this.pendingSession = this.currentSession();
      }
      this.currentSessionIdentifier = null;
      return;
    }

    if (!this.sessions.has(identifier)) {
      this.sessions.set(
        identifier,
        this.currentSessionIdentifier
          ? createFakeSessionState()
          : this.pendingSession,
      );
    }
    this.currentSessionIdentifier = identifier;
  }

  get sessionData() {
    return this.currentSession().data;
  }

  set sessionData(data: Record<string, boolean | string | number>) {
    this.currentSession().data = data;
  }

  getSession(identifier: string) {
    return this.sessions.get(identifier);
  }

  seedCurrentSession({
    data,
    email,
    nickname,
  }: {
    data?: Record<string, boolean | string | number>;
    email?: string | null;
    nickname?: string | null;
  }) {
    const session = this.currentSession();
    if (data) {
      session.data = { ...data };
    }
    if (email !== undefined) {
      session.email = email;
    }
    if (nickname !== undefined) {
      session.nickname = nickname;
      this.runtimeNickname = nickname;
    }
  }

  private currentSession() {
    if (!this.currentSessionIdentifier) {
      return this.pendingSession;
    }

    const session = this.sessions.get(this.currentSessionIdentifier);
    assert.ok(session);
    return session;
  }

  user = {
    setNickname: (nickname: string) => {
      this.calls.push(`setNickname:${nickname}`);
      if (this.throwOnSetNickname) {
        throw new Error("setNickname failed");
      }
      this.runtimeNickname = nickname;
      this.currentSession().nickname = nickname;
    },
    setEmail: (email: string) => {
      this.calls.push(`setEmail:${email}`);
      this.currentSession().email = email;
    },
    getEmail: () => {
      this.calls.push("getEmail");
      if (this.throwOnGetEmail) {
        throw new Error("getEmail failed");
      }
      return this.currentSession().email;
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
    reset: () => {
      this.calls.push("reset");
      if (this.throwOnReset) {
        throw new Error("reset failed");
      }

      this.currentSessionIdentifier = null;
      this.pendingSession = createFakeSessionState();
      if (this.retainRuntimeNicknameOnReset) {
        this.pendingSession.nickname = this.runtimeNickname;
      }
      if (this.resetSetsIdentifier) {
        this.sessionIdentifier = this.sessionIdentifierAfterReset;
      }
      if (this.autoResetLoad) {
        this.loadedCallback?.();
      }
    },
  };

  message = {
    sendText: (content: string) => {
      this.calls.push(`sendText:${content}`);
      if (this.throwOnSendText) {
        throw new Error("sendText failed");
      }
      this.sentTexts.push(content);
      this.currentSession().sentTexts.push(content);
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

  completeReset() {
    if (this.resetSetsIdentifier && !this.sessionIdentifier) {
      this.sessionIdentifier = this.sessionIdentifierAfterReset;
    }
    this.loadedCallback?.();
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

function createRestoredPicchuSpotSdk({
  data = {},
  email = "ada@example.com",
  handoffMarker = true,
  nickname = "Previous Visitor",
}: {
  data?: Record<string, boolean | string | number>;
  email?: string | null;
  handoffMarker?: boolean | string;
  nickname?: string | null;
} = {}) {
  const sdk = new FakeCrispSdk();
  sdk.sessionIdentifier = "session_old";
  sdk.seedCurrentSession({
    data: {
      ...data,
      [CRISP_HANDOFF_DATA_KEY]: handoffMarker,
    },
    email,
    nickname,
  });
  return sdk;
}

test("fake reset retains runtime nickname while creating fresh conversation data", () => {
  const sdk = createRestoredPicchuSpotSdk({
    data: {
      previous_private_context: "old conversation",
    },
    nickname: "Previous Name",
  });

  sdk.session.reset();

  assert.equal(sdk.sessionIdentifier, "session_fresh");
  assert.equal(sdk.getSession("session_fresh")?.nickname, "Previous Name");
  assert.deepEqual(sdk.getSession("session_fresh")?.data, {});
  assert.equal(
    sdk.getSession("session_fresh")?.data.previous_private_context,
    undefined,
  );
});

test("support email normalization trims and lowercases", () => {
  assert.equal(
    normalizeSupportEmail("  User@Example.COM  "),
    "user@example.com",
  );
});

test("support email normalization preserves provider-specific characters", () => {
  assert.equal(
    normalizeSupportEmail(" First.Last+Photos@Example.com "),
    "first.last+photos@example.com",
  );
});

test("fresh session is not reset", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();

  assert.deepEqual(await startCrispSupportHandoff(options(sdk)), { ok: true });
  assert.equal(sdk.calls.includes("reset"), false);
});

test("fresh session receives submitted identity only after load", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();

  assert.deepEqual(await startCrispSupportHandoff(options(sdk)), { ok: true });
  assert.equal(
    sdk.calls.indexOf("load") < sdk.calls.indexOf("setEmail:ada@example.com"),
    true,
  );
  assert.equal(sdk.getSession("session_123")?.email, "ada@example.com");
  assert.equal(sdk.getSession("session_123")?.nickname, "Ada");
});

test("restored PicchuSpot session with matching email is preserved", async () => {
  resetCrispSupportClientForTests();
  const sdk = createRestoredPicchuSpotSdk();

  assert.deepEqual(await startCrispSupportHandoff(options(sdk)), { ok: true });
  assert.equal(sdk.calls.includes("reset"), false);
  assert.equal(sdk.sessionIdentifier, "session_old");
});

test("restored PicchuSpot email comparison is case-insensitive", async () => {
  resetCrispSupportClientForTests();
  const sdk = createRestoredPicchuSpotSdk({
    email: "  ADA@EXAMPLE.COM ",
    handoffMarker: "true",
  });

  assert.deepEqual(
    await startCrispSupportHandoff(options(sdk, { name: "" })),
    { ok: true },
  );
  assert.equal(sdk.calls.includes("reset"), false);
  assert.equal(sdk.calls.some((call) => call.startsWith("setNickname:")), false);
  assert.equal(sdk.getSession("session_old")?.nickname, "Previous Visitor");
});

test("matching email plus empty name preserves the existing nickname", async () => {
  resetCrispSupportClientForTests();
  const sdk = createRestoredPicchuSpotSdk({
    nickname: "Existing Name",
  });

  assert.deepEqual(
    await startCrispSupportHandoff(options(sdk, { name: "" })),
    { ok: true },
  );

  assert.equal(sdk.calls.includes("reset"), false);
  assert.equal(sdk.calls.some((call) => call.startsWith("setNickname:")), false);
  assert.equal(sdk.getSession("session_old")?.nickname, "Existing Name");
});

test("matching email plus provided name updates to the trimmed nickname", async () => {
  resetCrispSupportClientForTests();
  const sdk = createRestoredPicchuSpotSdk({
    nickname: "Existing Name",
  });

  assert.deepEqual(
    await startCrispSupportHandoff(
      options(sdk, { name: "  Updated Name  " }),
    ),
    { ok: true },
  );

  assert.equal(sdk.calls.includes("reset"), false);
  assert.equal(sdk.getSession("session_old")?.nickname, "Updated Name");
  assert.ok(sdk.calls.includes("setNickname:Updated Name"));
  assert.equal(sdk.calls.includes("setNickname:Website visitor"), false);
});

test("restored PicchuSpot session with different email is reset", async () => {
  resetCrispSupportClientForTests();
  const sdk = createRestoredPicchuSpotSdk({
    email: "previous@example.com",
  });

  assert.deepEqual(await startCrispSupportHandoff(options(sdk)), { ok: true });
  assert.equal(sdk.calls.filter((call) => call === "reset").length, 1);
  assert.equal(sdk.sessionIdentifier, "session_fresh");
});

test("new identity is never written to the old session", async () => {
  resetCrispSupportClientForTests();
  const sdk = createRestoredPicchuSpotSdk({
    email: "previous@example.com",
  });

  await startCrispSupportHandoff(options(sdk));

  assert.equal(sdk.getSession("session_old")?.email, "previous@example.com");
  assert.equal(sdk.getSession("session_fresh")?.email, "ada@example.com");
});

test("previous conversation data remains attached only to the old session", async () => {
  resetCrispSupportClientForTests();
  const sdk = createRestoredPicchuSpotSdk({
    data: {
      previous_private_context: "old conversation",
    },
    email: "previous@example.com",
  });

  await startCrispSupportHandoff(options(sdk));

  assert.equal(
    sdk.getSession("session_old")?.data.previous_private_context,
    "old conversation",
  );
  assert.equal(
    sdk.getSession("session_fresh")?.data.previous_private_context,
    undefined,
  );
});

test("fresh session receives the new email after reset", async () => {
  resetCrispSupportClientForTests();
  const sdk = createRestoredPicchuSpotSdk({
    email: "previous@example.com",
  });

  await startCrispSupportHandoff(
    options(sdk, { email: "new@example.com" }),
  );

  assert.equal(sdk.getSession("session_fresh")?.email, "new@example.com");
});

test("different email plus empty name overwrites retained nickname after reset", async () => {
  resetCrispSupportClientForTests();
  const sdk = createRestoredPicchuSpotSdk({
    email: "previous@example.com",
    nickname: "Previous Name",
  });

  await startCrispSupportHandoff(options(sdk, { name: "" }));

  assert.equal(sdk.calls.includes("reset"), true);
  assert.equal(sdk.getSession("session_old")?.nickname, "Previous Name");
  assert.equal(
    sdk.getSession("session_fresh")?.nickname,
    "Website visitor",
  );
  assert.notEqual(
    sdk.getSession("session_fresh")?.nickname,
    sdk.getSession("session_old")?.nickname,
  );
  assert.ok(sdk.calls.includes("setNickname:Website visitor"));
});

test("Spanish reset uses the localized neutral nickname", async () => {
  resetCrispSupportClientForTests();
  const sdk = createRestoredPicchuSpotSdk({
    email: "previous@example.com",
    nickname: "Nombre anterior",
  });

  await startCrispSupportHandoff(
    options(sdk, {
      language: "es",
      name: "",
    }),
  );

  assert.equal(
    sdk.getSession("session_fresh")?.nickname,
    "Visitante del sitio",
  );
  assert.ok(sdk.calls.includes("setNickname:Visitante del sitio"));
});

test("neutral nickname is set after reset availability and before metadata and context", async () => {
  resetCrispSupportClientForTests();
  const sdk = createRestoredPicchuSpotSdk({
    email: "previous@example.com",
  });

  await startCrispSupportHandoff(options(sdk, { name: "" }));

  const resetLoadedIndex = sdk.calls.indexOf("offLoaded");
  const nicknameIndex = sdk.calls.indexOf("setNickname:Website visitor");
  assert.equal(sdk.calls.indexOf("reset") < nicknameIndex, true);
  assert.equal(resetLoadedIndex < nicknameIndex, true);
  assert.equal(nicknameIndex < sdk.calls.indexOf("setData"), true);
  assert.equal(
    nicknameIndex < sdk.calls.indexOf("sendText:handoff context"),
    true,
  );
});

test("different email plus provided name uses only the trimmed submitted name", async () => {
  resetCrispSupportClientForTests();
  const sdk = createRestoredPicchuSpotSdk({
    email: "previous@example.com",
  });

  await startCrispSupportHandoff(
    options(sdk, { name: "  New Visitor  " }),
  );

  assert.equal(sdk.getSession("session_fresh")?.nickname, "New Visitor");
  assert.ok(sdk.calls.includes("setNickname:New Visitor"));
  assert.equal(sdk.calls.includes("setNickname:Website visitor"), false);
});

test("missing existing email plus empty name resets and uses neutral nickname", async () => {
  resetCrispSupportClientForTests();
  const sdk = createRestoredPicchuSpotSdk({ email: null });

  assert.deepEqual(
    await startCrispSupportHandoff(options(sdk, { name: "" })),
    { ok: true },
  );
  assert.equal(sdk.calls.includes("reset"), true);
  assert.equal(sdk.getSession("session_fresh")?.nickname, "Website visitor");
});

test("getEmail failure plus empty name resets and uses neutral nickname", async () => {
  resetCrispSupportClientForTests();
  const sdk = createRestoredPicchuSpotSdk();
  sdk.throwOnGetEmail = true;

  assert.deepEqual(
    await startCrispSupportHandoff(options(sdk, { name: "" })),
    { ok: true },
  );
  assert.equal(sdk.calls.includes("reset"), true);
  assert.equal(sdk.getSession("session_fresh")?.email, "ada@example.com");
  assert.equal(sdk.getSession("session_fresh")?.nickname, "Website visitor");
});

test("reset occurs before transcript sending", async () => {
  resetCrispSupportClientForTests();
  const sdk = createRestoredPicchuSpotSdk({
    email: "previous@example.com",
  });

  await startCrispSupportHandoff(options(sdk));

  assert.equal(
    sdk.calls.indexOf("reset") <
      sdk.calls.indexOf("sendText:handoff context"),
    true,
  );
});

test("reset occurs before PicchuSpot metadata is written", async () => {
  resetCrispSupportClientForTests();
  const sdk = createRestoredPicchuSpotSdk({
    email: "previous@example.com",
  });

  await startCrispSupportHandoff(options(sdk));

  assert.equal(sdk.calls.indexOf("reset") < sdk.calls.indexOf("setData"), true);
});

test("fresh identity and metadata follow the required order after reset", async () => {
  resetCrispSupportClientForTests();
  const sdk = createRestoredPicchuSpotSdk({
    email: "previous@example.com",
  });

  await startCrispSupportHandoff(options(sdk, { name: "New Visitor" }));

  const resetIndex = sdk.calls.indexOf("reset");
  const emailIndex = sdk.calls.indexOf("setEmail:ada@example.com");
  const nicknameIndex = sdk.calls.indexOf("setNickname:New Visitor");
  const metadataIndex = sdk.calls.indexOf("setData");
  assert.equal(resetIndex < emailIndex, true);
  assert.equal(emailIndex < nicknameIndex, true);
  assert.equal(nicknameIndex < metadataIndex, true);
});

test("reset waits for the registered loaded callback before using a fresh session", async () => {
  resetCrispSupportClientForTests();
  const sdk = createRestoredPicchuSpotSdk({
    email: "previous@example.com",
  });
  sdk.autoResetLoad = false;
  sdk.resetSetsIdentifier = false;

  const handoff = startCrispSupportHandoff(
    options(sdk, { name: "", timeoutMs: 500 }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(sdk.calls.indexOf("onLoaded") < sdk.calls.indexOf("reset"), true);
  assert.equal(sdk.calls.some((call) => call.startsWith("setEmail:")), false);
  assert.equal(sdk.calls.some((call) => call.startsWith("setNickname:")), false);
  sdk.resetSetsIdentifier = true;
  sdk.completeReset();

  assert.deepEqual(await handoff, { ok: true });
  assert.equal(sdk.sessionIdentifier, "session_fresh");
  assert.equal(sdk.getSession("session_fresh")?.nickname, "Website visitor");
  assert.equal(sdk.loadedCallback, null);
});

test("reset timeout sends no context and never opens Crisp", async () => {
  resetCrispSupportClientForTests();
  const sdk = createRestoredPicchuSpotSdk({
    email: "previous@example.com",
  });
  sdk.autoResetLoad = false;
  sdk.resetSetsIdentifier = false;

  const result = await startCrispSupportHandoff(
    options(sdk, { timeoutMs: 1 }),
  );

  assert.deepEqual(result, { ok: false, code: "timeout" });
  assert.deepEqual(sdk.sentTexts, []);
  assert.equal(sdk.calls.some((call) => call.startsWith("setEmail:")), false);
  assert.equal(sdk.calls.includes("chat.show"), false);
  assert.equal(sdk.calls.includes("chat.open"), false);
  assert.equal(sdk.launcherVisible, false);
  assert.equal(sdk.chatOpen, false);
  assert.equal(sdk.loadedCallback, null);
});

test("reset exception returns a safe failure and leaves old identity untouched", async () => {
  resetCrispSupportClientForTests();
  const sdk = createRestoredPicchuSpotSdk({
    email: "previous@example.com",
  });
  sdk.throwOnReset = true;

  const result = await startCrispSupportHandoff(options(sdk));

  assert.deepEqual(result, { ok: false, code: "load_failed" });
  assert.equal(sdk.getSession("session_old")?.email, "previous@example.com");
  assert.deepEqual(sdk.sentTexts, []);
  assert.equal(sdk.calls.includes("chat.open"), false);
  assert.equal(sdk.loadedCallback, null);
});

test("neutral nickname failure sends no context and keeps Crisp hidden", async () => {
  resetCrispSupportClientForTests();
  const sdk = createRestoredPicchuSpotSdk({
    email: "previous@example.com",
    nickname: "Previous Name",
  });
  sdk.throwOnSetNickname = true;

  const result = await startCrispSupportHandoff(
    options(sdk, { name: "" }),
  );

  assert.deepEqual(result, { ok: false, code: "load_failed" });
  assert.equal(sdk.calls.includes("reset"), true);
  assert.ok(sdk.calls.includes("setNickname:Website visitor"));
  assert.deepEqual(sdk.sentTexts, []);
  assert.equal(sdk.calls.includes("setData"), false);
  assert.equal(sdk.calls.includes("chat.show"), false);
  assert.equal(sdk.calls.includes("chat.open"), false);
  assert.equal(sdk.launcherVisible, false);
  assert.equal(sdk.chatOpen, false);
});

test("cancellation during reset sends nothing and keeps Crisp hidden", async () => {
  resetCrispSupportClientForTests();
  const sdk = createRestoredPicchuSpotSdk({
    email: "previous@example.com",
  });
  sdk.autoResetLoad = false;
  sdk.resetSetsIdentifier = false;
  const { controller, counts } = createTrackedAbortController();

  const handoff = startCrispSupportHandoff(
    options(sdk, {
      signal: controller.signal,
      timeoutMs: 500,
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  controller.abort();

  assert.deepEqual(await handoff, { ok: false, code: "cancelled" });
  assert.deepEqual(sdk.sentTexts, []);
  assert.equal(sdk.calls.includes("chat.open"), false);
  assert.equal(sdk.launcherVisible, false);
  assert.equal(sdk.chatOpen, false);
  assert.equal(sdk.loadedCallback, null);
  assert.deepEqual(counts(), { addCount: 1, removeCount: 1 });
});

test("reset does not accept the previous session identifier as fresh", async () => {
  resetCrispSupportClientForTests();
  const sdk = createRestoredPicchuSpotSdk({
    email: "previous@example.com",
  });
  sdk.sessionIdentifierAfterReset = "session_old";

  const result = await startCrispSupportHandoff(
    options(sdk, { timeoutMs: 1 }),
  );

  assert.deepEqual(result, { ok: false, code: "timeout" });
  assert.deepEqual(sdk.sentTexts, []);
  assert.equal(sdk.calls.includes("chat.open"), false);
});

test("fresh session does not inherit context marker or module state after reset", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();

  assert.deepEqual(await startCrispSupportHandoff(options(sdk)), { ok: true });
  const oldIdentifier = sdk.sessionIdentifier;
  assert.equal(oldIdentifier, "session_123");

  const second = await startCrispSupportHandoff(
    options(sdk, {
      email: "second@example.com",
      name: "",
      context: {
        message: "fresh fallback",
        hasTranscript: false,
      },
    }),
  );

  assert.deepEqual(second, { ok: true });
  assert.deepEqual(sdk.sentTexts, ["handoff context", "fresh fallback"]);
  assert.equal(
    sdk.getSession("session_123")?.data[CRISP_CONTEXT_SENT_DATA_KEY],
    true,
  );
  assert.equal(
    sdk.getSession("session_fresh")?.data[CRISP_CONTEXT_SENT_DATA_KEY],
    true,
  );
  assert.equal(sdk.getSession("session_fresh")?.email, "second@example.com");
  assert.equal(
    sdk.getSession("session_fresh")?.nickname,
    "Website visitor",
  );
});

test("fresh no-transcript session sends one fallback and persists marker", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();

  const result = await startCrispSupportHandoff(
    options(sdk, {
      context: {
        message: "fresh fallback",
        hasTranscript: false,
      },
    }),
  );

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(sdk.sentTexts, ["fresh fallback"]);
  assert.equal(sdk.sessionData[CRISP_CONTEXT_SENT_DATA_KEY], true);
});

test("fresh transcript session sends one structured context and persists marker", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();

  assert.deepEqual(await startCrispSupportHandoff(options(sdk)), { ok: true });
  assert.deepEqual(sdk.sentTexts, ["handoff context"]);
  assert.equal(sdk.sessionData[CRISP_CONTEXT_SENT_DATA_KEY], true);
});

test("matching restored session still suppresses duplicate fallback", async () => {
  resetCrispSupportClientForTests();
  const sdk = createRestoredPicchuSpotSdk({
    data: {
      [CRISP_CONTEXT_SENT_DATA_KEY]: true,
    },
    email: "Ada@Example.com",
  });

  const result = await startCrispSupportHandoff(
    options(sdk, {
      email: "ada@example.com",
      context: {
        message: "duplicate fallback",
        hasTranscript: false,
      },
    }),
  );

  assert.deepEqual(result, { ok: true });
  assert.equal(sdk.calls.includes("reset"), false);
  assert.deepEqual(sdk.sentTexts, []);
});

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

test("fresh adapter uses a trimmed submitted name or localized neutral nickname", async () => {
  resetCrispSupportClientForTests();
  const named = new FakeCrispSdk();
  await startCrispSupportHandoff(options(named, { name: "  Ada  " }));
  assert.ok(named.calls.includes("setNickname:Ada"));
  assert.ok(named.calls.includes("setEmail:ada@example.com"));

  resetCrispSupportClientForTests();
  const englishAnonymous = new FakeCrispSdk();
  await startCrispSupportHandoff(options(englishAnonymous, { name: "" }));
  assert.ok(englishAnonymous.calls.includes("setNickname:Website visitor"));
  assert.ok(englishAnonymous.calls.includes("setEmail:ada@example.com"));

  resetCrispSupportClientForTests();
  const spanishAnonymous = new FakeCrispSdk();
  await startCrispSupportHandoff(
    options(spanishAnonymous, { language: "es", name: "   " }),
  );
  assert.ok(
    spanishAnonymous.calls.includes("setNickname:Visitante del sitio"),
  );
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
  assert.equal(sdk.calls.indexOf("chat.close") < sdk.calls.indexOf("load"), true);
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
    ...options(new FakeCrispSdk(), { name: "  Updated Active Name  " }),
    sdkLoader: async () => {
      loaderCalled = true;
      throw new Error("should not load");
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(loaderCalled, false);
  assert.equal(
    sdk.getSession("session_123")?.nickname,
    "Updated Active Name",
  );
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

test("openActiveCrispSupportChat returns false before activation", () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();

  assert.equal(openActiveCrispSupportChat(), false);
  assert.equal(sdk.calls.includes("chat.show"), false);
  assert.equal(sdk.calls.includes("chat.open"), false);
});

test("openActiveCrispSupportChat reopens active Crisp without reload or metadata changes", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();

  assert.deepEqual(await startCrispSupportHandoff(options(sdk)), { ok: true });
  const configureCount = sdk.calls.filter((call) => call === "configure").length;
  const loadCount = sdk.calls.filter((call) => call === "load").length;
  const sentTexts = [...sdk.sentTexts];
  const sessionData = { ...sdk.sessionData };
  const email = sdk.getSession("session_123")?.email;
  const nickname = sdk.getSession("session_123")?.nickname;

  assert.equal(openActiveCrispSupportChat(), true);

  assert.equal(sdk.calls.at(-2), "chat.show");
  assert.equal(sdk.calls.at(-1), "chat.open");
  assert.equal(sdk.calls.filter((call) => call === "configure").length, configureCount);
  assert.equal(sdk.calls.filter((call) => call === "load").length, loadCount);
  assert.deepEqual(sdk.sentTexts, sentTexts);
  assert.deepEqual(sdk.sessionData, sessionData);
  assert.equal(sdk.getSession("session_123")?.email, email);
  assert.equal(sdk.getSession("session_123")?.nickname, nickname);
  assert.equal(
    sdk.calls.filter((call) => call.startsWith("setEmail:")).length,
    1,
  );
  assert.equal(
    sdk.calls.filter((call) => call.startsWith("setNickname:")).length,
    1,
  );
});

test("openActiveCrispSupportChat failure returns false without throwing", async () => {
  resetCrispSupportClientForTests();
  const sdk = new FakeCrispSdk();

  assert.deepEqual(await startCrispSupportHandoff(options(sdk)), { ok: true });
  sdk.throwOnOpen = true;

  assert.doesNotThrow(() => {
    assert.equal(openActiveCrispSupportChat(), false);
  });
  assert.equal(sdk.chatOpen, false);
  assert.equal(sdk.launcherVisible, false);
  assert.equal(sdk.calls.at(-2), "chat.close");
  assert.equal(sdk.calls.at(-1), "chat.hide");
});

test("active Crisp route visibility includes dashboard and excludes order", () => {
  assert.equal(isSupportChatRouteVisible("/dashboard"), true);
  assert.equal(isSupportChatRouteVisible("/dashboard/jobs"), true);
  assert.equal(isSupportChatRouteVisible("/dashboard/drafts/example"), true);
  assert.equal(isSupportChatRouteVisible("/dashboard/orders/new"), true);
  assert.equal(
    isSupportChatRouteVisible("/dashboard/orders/new/virtual-staging"),
    true,
  );
  assert.equal(
    isSupportChatRouteVisible("/es/dashboard/orders/new/virtual-staging"),
    true,
  );
  assert.equal(isSupportChatRouteVisible("/order"), false);
  assert.equal(isSupportChatRouteVisible("/admin"), false);
});

test("visibility helpers do nothing before successful activation", () => {
  resetCrispSupportClientForTests();

  assert.doesNotThrow(() => setActiveCrispSupportVisibility(false));
  assert.doesNotThrow(() => setActiveCrispSupportVisibility(true));
});
