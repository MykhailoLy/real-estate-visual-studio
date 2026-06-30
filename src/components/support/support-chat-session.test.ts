import assert from "node:assert/strict";
import test from "node:test";
import type { SupportChatMessage } from "./support-chat-client.ts";
import {
  SUPPORT_CHAT_SESSION_MAX_CHARACTERS,
  SUPPORT_CHAT_SESSION_MAX_MESSAGES,
  SUPPORT_CHAT_SESSION_STORAGE_KEY,
  SUPPORT_CHAT_SESSION_VERSION,
  clearSupportChatSession,
  readSupportChatSession,
  sanitizeSupportChatSessionMessages,
  writeSupportChatSession,
  type SupportChatSessionStorage,
} from "./support-chat-session.ts";

class MemoryStorage implements SupportChatSessionStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

class ThrowingStorage implements SupportChatSessionStorage {
  private readonly failure: "get" | "set" | "remove";

  constructor(failure: "get" | "set" | "remove") {
    this.failure = failure;
  }

  getItem() {
    if (this.failure === "get") throw new Error("get failed");
    return null;
  }

  setItem() {
    if (this.failure === "set") throw new Error("set failed");
  }

  removeItem() {
    if (this.failure === "remove") throw new Error("remove failed");
  }
}

function message(
  overrides: Partial<SupportChatMessage> & Pick<SupportChatMessage, "id">,
): SupportChatMessage {
  return {
    id: overrides.id,
    role: "assistant",
    content: "Hello",
    origin: "remote",
    status: "complete",
    ...overrides,
  };
}

function storedPayload(
  messages: readonly unknown[],
  version = SUPPORT_CHAT_SESSION_VERSION,
) {
  return JSON.stringify({ version, messages });
}

test("valid user and remote-assistant messages round-trip", () => {
  const storage = new MemoryStorage();
  const messages = [
    message({ id: "u1", role: "user", origin: "local", content: "Hi" }),
    message({ id: "a1", role: "assistant", origin: "remote", content: "Hello" }),
  ];

  writeSupportChatSession(storage, messages);

  assert.deepEqual(readSupportChatSession(storage), messages);
});

test("message chronological order is preserved", () => {
  const storage = new MemoryStorage();
  const messages = [
    message({ id: "u1", role: "user", origin: "local", content: "First" }),
    message({ id: "a1", content: "Second" }),
    message({ id: "u2", role: "user", origin: "local", content: "Third" }),
  ];

  writeSupportChatSession(storage, messages);

  assert.deepEqual(
    readSupportChatSession(storage).map((entry) => entry.content),
    ["First", "Second", "Third"],
  );
});

test("welcome and local assistant messages are excluded", () => {
  const storage = new MemoryStorage();

  writeSupportChatSession(storage, [
    message({
      id: "welcome",
      origin: "local",
      localKind: "welcome",
      content: "Welcome",
    }),
    message({ id: "local-assistant", origin: "local", content: "Local" }),
  ]);

  assert.equal(storage.getItem(SUPPORT_CHAT_SESSION_STORAGE_KEY), null);
});

test("human-support and error local messages are excluded", () => {
  const storage = new MemoryStorage();

  writeSupportChatSession(storage, [
    message({
      id: "human",
      origin: "local",
      localKind: "human_support",
      content: "Talk to us.",
    }),
    message({
      id: "error",
      origin: "local",
      localKind: "error",
      status: "complete",
      content: "Something went wrong.",
    }),
  ]);

  assert.equal(storage.getItem(SUPPORT_CHAT_SESSION_STORAGE_KEY), null);
});

test("loading and error-status messages are excluded", () => {
  const storage = new MemoryStorage();

  writeSupportChatSession(storage, [
    message({ id: "loading", status: "loading" }),
    message({ id: "error-status", status: "error" }),
  ]);

  assert.equal(storage.getItem(SUPPORT_CHAT_SESSION_STORAGE_KEY), null);
});

test("empty and whitespace-only content is excluded", () => {
  const storage = new MemoryStorage();

  writeSupportChatSession(storage, [
    message({ id: "empty", content: "" }),
    message({ id: "blank", content: "   " }),
  ]);

  assert.equal(storage.getItem(SUPPORT_CHAT_SESSION_STORAGE_KEY), null);
});

test("invalid roles are rejected while reading", () => {
  const storage = new MemoryStorage();
  storage.setItem(
    SUPPORT_CHAT_SESSION_STORAGE_KEY,
    storedPayload([{ id: "bad", role: "system", origin: "local", status: "complete", content: "No" }]),
  );

  assert.deepEqual(readSupportChatSession(storage), []);
});

test("invalid origins are rejected while reading", () => {
  const storage = new MemoryStorage();
  storage.setItem(
    SUPPORT_CHAT_SESSION_STORAGE_KEY,
    storedPayload([{ id: "bad", role: "user", origin: "remote", status: "complete", content: "No" }]),
  );

  assert.deepEqual(readSupportChatSession(storage), []);
});

test("invalid IDs are rejected while reading", () => {
  const storage = new MemoryStorage();
  storage.setItem(
    SUPPORT_CHAT_SESSION_STORAGE_KEY,
    storedPayload([{ id: " ", role: "user", origin: "local", status: "complete", content: "No" }]),
  );

  assert.deepEqual(readSupportChatSession(storage), []);
});

test("localKind is not restored", () => {
  const storage = new MemoryStorage();
  storage.setItem(
    SUPPORT_CHAT_SESSION_STORAGE_KEY,
    storedPayload([
      {
        id: "u1",
        role: "user",
        origin: "local",
        status: "complete",
        content: "Hi",
        localKind: "welcome",
      },
    ]),
  );

  assert.deepEqual(readSupportChatSession(storage), [
    { id: "u1", role: "user", origin: "local", status: "complete", content: "Hi" },
  ]);
});

test("malformed JSON returns an empty conversation", () => {
  const storage = new MemoryStorage();
  storage.setItem(SUPPORT_CHAT_SESSION_STORAGE_KEY, "{not-json");

  assert.deepEqual(readSupportChatSession(storage), []);
});

test("wrong storage version returns an empty conversation", () => {
  const storage = new MemoryStorage();
  storage.setItem(SUPPORT_CHAT_SESSION_STORAGE_KEY, storedPayload([], 2));

  assert.deepEqual(readSupportChatSession(storage), []);
});

test("non-object and array payloads return an empty conversation", () => {
  const objectStorage = new MemoryStorage();
  objectStorage.setItem(SUPPORT_CHAT_SESSION_STORAGE_KEY, "null");

  const arrayStorage = new MemoryStorage();
  arrayStorage.setItem(SUPPORT_CHAT_SESSION_STORAGE_KEY, "[]");

  assert.deepEqual(readSupportChatSession(objectStorage), []);
  assert.deepEqual(readSupportChatSession(arrayStorage), []);
});

test("malformed payload is removed when possible", () => {
  const storage = new MemoryStorage();
  storage.setItem(SUPPORT_CHAT_SESSION_STORAGE_KEY, "{not-json");

  assert.deepEqual(readSupportChatSession(storage), []);
  assert.equal(storage.getItem(SUPPORT_CHAT_SESSION_STORAGE_KEY), null);
});

test("getItem failure returns an empty conversation", () => {
  assert.deepEqual(readSupportChatSession(new ThrowingStorage("get")), []);
});

test("setItem failure does not throw", () => {
  assert.doesNotThrow(() =>
    writeSupportChatSession(new ThrowingStorage("set"), [
      message({ id: "u1", role: "user", origin: "local" }),
    ]),
  );
});

test("removeItem failure does not throw", () => {
  assert.doesNotThrow(() => clearSupportChatSession(new ThrowingStorage("remove")));
});

test("empty eligible messages remove the key", () => {
  const storage = new MemoryStorage();
  storage.setItem(SUPPORT_CHAT_SESSION_STORAGE_KEY, storedPayload([]));

  writeSupportChatSession(storage, [message({ id: "loading", status: "loading" })]);

  assert.equal(storage.getItem(SUPPORT_CHAT_SESSION_STORAGE_KEY), null);
});

test("only the latest configured message count is retained", () => {
  const messages = Array.from({ length: SUPPORT_CHAT_SESSION_MAX_MESSAGES + 3 }, (_, index) =>
    message({
      id: `m${index}`,
      role: index % 2 === 0 ? "user" : "assistant",
      origin: index % 2 === 0 ? "local" : "remote",
      content: `Message ${index}`,
    }),
  );

  const sanitized = sanitizeSupportChatSessionMessages(messages);

  assert.equal(sanitized.length, SUPPORT_CHAT_SESSION_MAX_MESSAGES);
  assert.equal(sanitized[0]?.id, "m3");
});

test("character limits retain the newest messages that fit", () => {
  const sanitized = sanitizeSupportChatSessionMessages(
    [
      message({ id: "old", role: "user", origin: "local", content: "old" }),
      message({ id: "too-large", content: "x".repeat(SUPPORT_CHAT_SESSION_MAX_CHARACTERS + 1) }),
      message({ id: "latest", role: "user", origin: "local", content: "latest" }),
    ],
    { maxCharacters: 10 },
  );

  assert.deepEqual(
    sanitized.map((entry) => entry.id),
    ["old", "latest"],
  );
});

test("sanitization does not mutate the original input array", () => {
  const messages = [
    message({ id: "u1", role: "user", origin: "local", localKind: "welcome" }),
  ];
  const snapshot = structuredClone(messages);

  sanitizeSupportChatSessionMessages(messages);

  assert.deepEqual(messages, snapshot);
});

test("stored message objects are reconstructed rather than returned by reference", () => {
  const messages = [message({ id: "u1", role: "user", origin: "local" })];
  const sanitized = sanitizeSupportChatSessionMessages(messages);

  assert.notEqual(sanitized[0], messages[0]);
  assert.deepEqual(sanitized, messages);
});

test("user content with internal line breaks is preserved", () => {
  const storage = new MemoryStorage();
  const content = "First line\n\nSecond line";

  writeSupportChatSession(storage, [
    message({ id: "u1", role: "user", origin: "local", content }),
  ]);

  assert.equal(readSupportChatSession(storage)[0]?.content, content);
});

test("clear helper supports the successful handoff clearing sequence", () => {
  const storage = new MemoryStorage();
  writeSupportChatSession(storage, [
    message({ id: "u1", role: "user", origin: "local" }),
  ]);

  clearSupportChatSession(storage);

  assert.deepEqual(readSupportChatSession(storage), []);
  assert.equal(storage.getItem(SUPPORT_CHAT_SESSION_STORAGE_KEY), null);
});

test("failed or cancelled handoff paths can retain persisted messages", () => {
  const storage = new MemoryStorage();
  const messages = [message({ id: "u1", role: "user", origin: "local" })];
  writeSupportChatSession(storage, messages);

  assert.deepEqual(readSupportChatSession(storage), messages);
});
