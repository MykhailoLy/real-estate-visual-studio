import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSupportChatHistory,
  detectSupportChatLanguage,
  getSupportChatErrorMessage,
  isSupportChatRouteVisible,
  parseRetryAfterSeconds,
  submitSupportChatMessage,
  type SupportChatApiHistoryMessage,
  type SupportChatClientResult,
  type SupportChatMessage,
} from "./support-chat-client.ts";
import {
  getSupportChatLink,
  supportChatCopy,
  type SupportChatLanguage,
} from "./support-chat-copy.ts";

function message(
  overrides: Partial<SupportChatMessage> & Pick<SupportChatMessage, "id">,
): SupportChatMessage {
  return {
    role: "assistant",
    content: "Hello",
    origin: "remote",
    status: "complete",
    ...overrides,
  };
}

function jsonResponse(
  body: unknown,
  init: ResponseInit = { status: 200 },
): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

function errorResult(result: SupportChatClientResult) {
  assert.equal(result.ok, false);
  return result;
}

test("detects English and Spanish languages from pathname", () => {
  assert.equal(detectSupportChatLanguage("/"), "en");
  assert.equal(detectSupportChatLanguage("/pricing"), "en");
  assert.equal(detectSupportChatLanguage("/es"), "es");
  assert.equal(detectSupportChatLanguage("/es/services"), "es");
});

test("returns localized pricing, services, and contact links", () => {
  assert.equal(getSupportChatLink("en", "pricing"), "/pricing");
  assert.equal(getSupportChatLink("en", "services"), "/services");
  assert.equal(getSupportChatLink("en", "contact"), "/contact");
  assert.equal(getSupportChatLink("es", "pricing"), "/es/pricing");
  assert.equal(getSupportChatLink("es", "services"), "/es/services");
  assert.equal(getSupportChatLink("es", "contact"), "/es/contact");
});

test("public marketing routes allow the widget", () => {
  assert.equal(isSupportChatRouteVisible("/"), true);
  assert.equal(isSupportChatRouteVisible("/pricing"), true);
  assert.equal(isSupportChatRouteVisible("/es/services"), true);
});

test("admin routes exclude the widget", () => {
  assert.equal(isSupportChatRouteVisible("/admin"), false);
  assert.equal(isSupportChatRouteVisible("/admin/orders"), false);
});

test("dashboard routes exclude the widget", () => {
  assert.equal(isSupportChatRouteVisible("/dashboard"), false);
  assert.equal(isSupportChatRouteVisible("/dashboard/jobs"), false);
});

test("order routes exclude the widget", () => {
  assert.equal(isSupportChatRouteVisible("/order"), false);
  assert.equal(isSupportChatRouteVisible("/order/virtual-staging"), false);
});

test("auth, login, signup, and reset routes exclude the widget", () => {
  assert.equal(isSupportChatRouteVisible("/auth/callback"), false);
  assert.equal(isSupportChatRouteVisible("/login"), false);
  assert.equal(isSupportChatRouteVisible("/signup"), false);
  assert.equal(isSupportChatRouteVisible("/forgot-password"), false);
  assert.equal(isSupportChatRouteVisible("/reset-password"), false);
});

test("/es prefix is normalized before exclusions", () => {
  assert.equal(isSupportChatRouteVisible("/es/admin"), false);
  assert.equal(isSupportChatRouteVisible("/es/dashboard/jobs"), false);
  assert.equal(isSupportChatRouteVisible("/es/order/virtual-staging"), false);
  assert.equal(isSupportChatRouteVisible("/es/login"), false);
  assert.equal(isSupportChatRouteVisible("/es/reset-password"), false);
});

test("history excludes local welcome messages", () => {
  const history = buildSupportChatHistory([
    message({
      id: "welcome",
      origin: "local",
      localKind: "welcome",
      content: "Welcome",
    }),
  ]);

  assert.deepEqual(history, []);
});

test("history excludes local human-support placeholders", () => {
  const history = buildSupportChatHistory([
    message({
      id: "human",
      origin: "local",
      localKind: "human_support",
      content: "Contact us.",
    }),
  ]);

  assert.deepEqual(history, []);
});

test("history excludes errors and loading states", () => {
  const history = buildSupportChatHistory([
    message({ id: "error", status: "error", localKind: "error" }),
    message({ id: "loading", status: "loading" }),
  ]);

  assert.deepEqual(history, []);
});

test("history includes only completed user and remote assistant messages", () => {
  const history = buildSupportChatHistory([
    message({ id: "u1", role: "user", content: "Hi", origin: "local" }),
    message({ id: "a1", role: "assistant", content: "Hello", origin: "remote" }),
    message({ id: "a2", role: "assistant", content: "Local", origin: "local" }),
  ]);

  assert.deepEqual(history, [
    { role: "user", content: "Hi" },
    { role: "assistant", content: "Hello" },
  ]);
});

test("history contains at most 6 messages", () => {
  const messages = Array.from({ length: 8 }, (_, index) =>
    message({
      id: `m${index}`,
      role: index % 2 === 0 ? "user" : "assistant",
      content: `Message ${index}`,
      origin: index % 2 === 0 ? "local" : "remote",
    }),
  );

  assert.equal(buildSupportChatHistory(messages).length, 6);
});

test("history preserves chronological order", () => {
  const history = buildSupportChatHistory([
    message({ id: "u1", role: "user", content: "First", origin: "local" }),
    message({ id: "a1", role: "assistant", content: "Second" }),
    message({ id: "u2", role: "user", content: "Third", origin: "local" }),
  ]);

  assert.deepEqual(
    history.map((entry) => entry.content),
    ["First", "Second", "Third"],
  );
});

test("history respects the 5500-character budget", () => {
  const large = "x".repeat(5496);
  const history = buildSupportChatHistory([
    message({ id: "u1", role: "user", content: large, origin: "local" }),
    message({ id: "a1", role: "assistant", content: "answer" }),
    message({ id: "u2", role: "user", content: "latest", origin: "local" }),
  ]);

  assert.deepEqual(
    history.map((entry) => entry.content),
    ["answer", "latest"],
  );
});

test("history remains contiguous when an older eligible message exceeds the character budget", () => {
  const history = buildSupportChatHistory(
    [
      message({ id: "old-small", role: "user", content: "old", origin: "local" }),
      message({
        id: "too-large",
        role: "assistant",
        content: "x".repeat(20),
      }),
      message({ id: "new-small", role: "user", content: "new", origin: "local" }),
    ],
    { maxCharacters: 10 },
  );

  assert.deepEqual(history, [{ role: "user", content: "new" }]);
});

test("oldest complete messages are dropped rather than partially truncated", () => {
  const history = buildSupportChatHistory(
    [
      message({ id: "u1", role: "user", content: "old-long", origin: "local" }),
      message({ id: "a1", role: "assistant", content: "new" }),
    ],
    { maxCharacters: 6 },
  );

  assert.deepEqual(history, [{ role: "assistant", content: "new" }]);
});

test("current user message is not duplicated in history", () => {
  const history = buildSupportChatHistory(
    [
      message({ id: "u1", role: "user", content: "previous", origin: "local" }),
      message({ id: "current", role: "user", content: "current", origin: "local" }),
    ],
    { excludeMessageId: "current" },
  );

  assert.deepEqual(history, [{ role: "user", content: "previous" }]);
});

test("success JSON is parsed safely", async () => {
  const result = await submitSupportChatMessage({
    message: "Hello",
    history: [],
    fetcher: async () => jsonResponse({ data: { message: "Safe answer" } }),
  });

  assert.deepEqual(result, { ok: true, message: "Safe answer" });
});

test("malformed success JSON becomes a safe client error", async () => {
  const result = await submitSupportChatMessage({
    message: "Hello",
    history: [],
    fetcher: async () => jsonResponse({ data: { message: 123 } }),
  });

  assert.deepEqual(result, { ok: false, code: "generation_failed" });
});

test("429 reads a valid Retry-After value", async () => {
  const result = await submitSupportChatMessage({
    message: "Hello",
    history: [],
    fetcher: async () =>
      jsonResponse(
        { error: "raw server text", code: "rate_limited" },
        { status: 429, headers: { "Retry-After": "42" } },
      ),
  });

  assert.deepEqual(result, {
    ok: false,
    code: "rate_limited",
    retryAfterSeconds: 42,
  });
});

test("invalid or missing Retry-After uses the safe fallback", () => {
  assert.equal(parseRetryAfterSeconds(null), 60);
  assert.equal(parseRetryAfterSeconds("0"), 60);
  assert.equal(parseRetryAfterSeconds("soon"), 60);
});

test("Retry-After parsing accepts only positive integer seconds", () => {
  assert.equal(parseRetryAfterSeconds("7"), 7);
  assert.equal(parseRetryAfterSeconds(" 7 "), 7);
  assert.equal(parseRetryAfterSeconds("0"), 60);
  assert.equal(parseRetryAfterSeconds("-1"), 60);
  assert.equal(parseRetryAfterSeconds("7seconds"), 60);
  assert.equal(parseRetryAfterSeconds("7.5"), 60);
  assert.equal(parseRetryAfterSeconds("1e2"), 60);
  assert.equal(parseRetryAfterSeconds("9007199254740992"), 60);
});

test("400, 429, 502, 503, and network failures map to safe UI states", async () => {
  const cases: Array<[number, unknown, SupportChatClientResult["ok"] | string]> = [
    [400, { error: "backend details", code: "invalid_input" }, "invalid_input"],
    [429, { error: "backend details", code: "rate_limited" }, "rate_limited"],
    [502, { error: "provider details", code: "generation_failed" }, "generation_failed"],
    [503, { error: "redis details", code: "support_unavailable" }, "support_unavailable"],
  ];

  for (const [status, body, code] of cases) {
    const result = await submitSupportChatMessage({
      message: "Hello",
      history: [],
      fetcher: async () => jsonResponse(body, { status }),
    });
    assert.equal(errorResult(result).code, code);
  }

  const network = await submitSupportChatMessage({
    message: "Hello",
    history: [],
    fetcher: async () => {
      throw new TypeError("network down with raw details");
    },
  });
  assert.equal(errorResult(network).code, "network");
});

test("raw server/provider error content is never exposed through mapped UI copy", () => {
  const unsafe = "Gemini Redis stack trace API key raw body";
  const errors: Array<Extract<SupportChatClientResult, { ok: false }>> = [
    { ok: false, code: "invalid_input" },
    { ok: false, code: "rate_limited", retryAfterSeconds: 60 },
    { ok: false, code: "generation_failed" },
    { ok: false, code: "support_unavailable" },
    { ok: false, code: "network" },
  ];

  for (const language of ["en", "es"] satisfies SupportChatLanguage[]) {
    for (const error of errors) {
      assert.equal(getSupportChatErrorMessage(language, error).includes(unsafe), false);
      assert.equal(getSupportChatErrorMessage(language, error).includes("Gemini"), false);
      assert.equal(getSupportChatErrorMessage(language, error).includes("Redis"), false);
    }
  }
});

test("quick action prompts are localized", () => {
  assert.equal(
    supportChatCopy.en.prompts.howToOrder,
    "How do I place an order with PicchuSpot?",
  );
  assert.equal(
    supportChatCopy.es.prompts.howToOrder,
    "¿Cómo puedo realizar un pedido en PicchuSpot?",
  );
});

test("human-support quick action remains local and does not create an API request", () => {
  const messages = [
    message({
      id: "human",
      origin: "local",
      localKind: "human_support",
      content: supportChatCopy.en.humanSupportMessage,
    }),
  ];
  const history: SupportChatApiHistoryMessage[] = buildSupportChatHistory(messages);

  assert.deepEqual(history, []);
});
