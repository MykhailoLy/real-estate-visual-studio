import assert from "node:assert/strict";
import test from "node:test";
import { supportChatCopy } from "./support-chat-copy.ts";
import type { SupportChatLanguage } from "./support-chat-copy.ts";
import type { SupportChatMessage } from "./support-chat-client.ts";
import {
  buildSupportHandoffMessage,
  normalizeHandoffPath,
  validateSupportHandoffIdentity,
} from "./support-handoff.ts";

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

function build(
  messages: readonly SupportChatMessage[],
  language: SupportChatLanguage = "en",
) {
  return buildSupportHandoffMessage({
    language,
    pathname: "/pricing?utm_source=test",
    messages,
  });
}

test("name validation trims and enforces 80 characters", () => {
  const valid = validateSupportHandoffIdentity(
    { name: "  Ada Lovelace  ", email: "ada@example.com" },
    "en",
  );
  assert.equal(valid.valid, true);
  assert.equal(valid.identity.name, "Ada Lovelace");

  const invalid = validateSupportHandoffIdentity(
    { name: "a".repeat(81), email: "ada@example.com" },
    "en",
  );
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.name, supportChatCopy.en.handoff.validation.nameTooLong);
});

test("empty name is accepted", () => {
  const result = validateSupportHandoffIdentity(
    { name: "   ", email: "visitor@example.com" },
    "en",
  );

  assert.equal(result.valid, true);
  assert.equal(result.identity.name, "");
  assert.equal(result.errors.name, undefined);
});

test("email is required, trimmed, length-limited, and practically validated", () => {
  const trimmed = validateSupportHandoffIdentity(
    { name: "", email: "  visitor@example.com  " },
    "en",
  );
  assert.equal(trimmed.valid, true);
  assert.equal(trimmed.identity.email, "visitor@example.com");

  const missing = validateSupportHandoffIdentity({ name: "", email: " " }, "en");
  assert.equal(missing.errors.email, supportChatCopy.en.handoff.validation.emailRequired);

  const tooLong = validateSupportHandoffIdentity(
    { name: "", email: `${"a".repeat(245)}@example.com` },
    "en",
  );
  assert.equal(tooLong.errors.email, supportChatCopy.en.handoff.validation.emailTooLong);

  const invalid = validateSupportHandoffIdentity(
    { name: "", email: "visitor.example.com" },
    "es",
  );
  assert.equal(
    invalid.errors.email,
    supportChatCopy.es.handoff.validation.emailInvalid,
  );
});

test("transcript excludes local welcome, errors, placeholders, and loading", () => {
  const transcript = build([
    message({ id: "welcome", origin: "local", localKind: "welcome" }),
    message({ id: "error", status: "error", localKind: "error" }),
    message({ id: "placeholder", origin: "local", localKind: "human_support" }),
    message({ id: "loading", status: "loading" }),
    message({ id: "user", role: "user", origin: "local", content: "I need pricing." }),
  ]);

  assert.match(transcript, /Visitor: I need pricing\./);
  assert.doesNotMatch(transcript, /Welcome|placeholder|loading/i);
});

test("transcript includes only completed visitor and remote AI messages", () => {
  const transcript = build([
    message({ id: "user", role: "user", origin: "local", content: "Hi" }),
    message({ id: "remote-ai", role: "assistant", origin: "remote", content: "Hello" }),
    message({ id: "local-ai", role: "assistant", origin: "local", content: "Local" }),
  ]);

  assert.match(transcript, /Visitor: Hi/);
  assert.match(transcript, /AI: Hello/);
  assert.doesNotMatch(transcript, /Local/);
});

test("transcript keeps at most 6 messages in chronological order", () => {
  const messages = Array.from({ length: 8 }, (_, index) =>
    message({
      id: `m${index}`,
      role: index % 2 === 0 ? "user" : "assistant",
      origin: index % 2 === 0 ? "local" : "remote",
      content: `Message ${index}`,
    }),
  );
  const transcript = build(messages);

  assert.doesNotMatch(transcript, /Message 0/);
  assert.doesNotMatch(transcript, /Message 1/);
  assert.match(transcript, /Message 2[\s\S]*Message 7/);
});

test("transcript stays within 3000 characters and never partially truncates messages", () => {
  const long = "x".repeat(2900);
  const transcript = build([
    message({ id: "old", role: "user", origin: "local", content: "old" }),
    message({ id: "large", role: "assistant", origin: "remote", content: long }),
    message({ id: "new", role: "user", origin: "local", content: "new" }),
  ]);

  assert.equal(transcript.length <= 3000, true);
  assert.doesNotMatch(transcript, /old/);
  assert.doesNotMatch(transcript, new RegExp(`AI: ${"x".repeat(100)}`));
  assert.match(transcript, /Visitor: new/);
});

test("transcript is a contiguous newest suffix", () => {
  const transcript = buildSupportHandoffMessage({
    language: "en",
    pathname: "/services",
    maxCharacters: 330,
    messages: [
      message({ id: "old", role: "user", origin: "local", content: "old" }),
      message({ id: "too-large", role: "assistant", content: "x".repeat(170) }),
      message({ id: "new", role: "user", origin: "local", content: "new" }),
    ],
  });

  assert.match(transcript, /Visitor: new/);
  assert.doesNotMatch(transcript, /old|too-large/);
});

test("English and Spanish transcript labels are localized", () => {
  const en = build([
    message({ id: "u", role: "user", origin: "local", content: "Hello" }),
    message({ id: "a", role: "assistant", origin: "remote", content: "Hi" }),
  ]);
  const es = build(
    [
      message({ id: "u", role: "user", origin: "local", content: "Hola" }),
      message({ id: "a", role: "assistant", origin: "remote", content: "Hola" }),
    ],
    "es",
  );

  assert.match(en, /\[Automatically shared by PicchuSpot before human handoff\]/);
  assert.match(en, /Visitor: Hello/);
  assert.match(en, /AI: Hi/);
  assert.match(es, /\[Compartido automáticamente por PicchuSpot/);
  assert.match(es, /Visitante: Hola/);
  assert.match(es, /IA: Hola/);
});

test("empty transcript produces a concise handoff message without an empty section", () => {
  const transcript = build([]);

  assert.match(transcript, /no eligible recent messages/i);
  assert.doesNotMatch(transcript, /Recent conversation:/);
});

test("handoff page path excludes query strings", () => {
  assert.equal(normalizeHandoffPath("/pricing?utm_source=test"), "/pricing");
  assert.equal(normalizeHandoffPath("services#details"), "/services");
});

test("English and Spanish handoff copy is complete", () => {
  for (const language of ["en", "es"] satisfies SupportChatLanguage[]) {
    const copy = supportChatCopy[language].handoff;
    assert.equal(Boolean(copy.heading), true);
    assert.equal(Boolean(copy.explanation), true);
    assert.equal(Boolean(copy.continuityNote), true);
    assert.equal(Boolean(copy.continueButton), true);
    assert.equal(Boolean(copy.cancelButton), true);
    assert.equal(Boolean(copy.connecting), true);
    assert.equal(Boolean(copy.productionOnly), true);
    assert.equal(Boolean(copy.retry), true);
    assert.equal(Boolean(copy.validation.emailRequired), true);
    assert.equal(Boolean(copy.validation.emailInvalid), true);
  }
});
