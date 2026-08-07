import assert from "node:assert/strict";
import test from "node:test";
import {
  TURNSTILE_TIMEOUT_MS,
  verifyPropertyLeadTurnstile,
} from "./property-lead-security.ts";

function request() {
  return new Request("https://picchuspot.com/api/property-leads");
}

function configuredProductionEnvironment() {
  return {
    NODE_ENV: "production" as const,
    NEXT_PUBLIC_SITE_URL: "https://picchuspot.com",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "configured-site-key",
    TURNSTILE_SECRET_KEY: "configured-server-secret",
  };
}

function successfulSiteverifyResponse(overrides: Record<string, unknown> = {}) {
  return Response.json({
    success: true,
    action: "property_lead",
    hostname: "picchuspot.com",
    ...overrides,
  });
}

test("production refuses unverified property leads when Turnstile is unconfigured", async () => {
  const result = await verifyPropertyLeadTurnstile({
    request: request(),
    token: "unused",
    env: { NODE_ENV: "production" },
  });

  assert.deepEqual(result, {
    status: "unavailable",
    diagnostic: { reason: "missing-site-key" },
  });
});

test("local and test environments retain the explicit no-key exemption", async () => {
  const result = await verifyPropertyLeadTurnstile({
    request: request(),
    token: "unused",
    env: { NODE_ENV: "test" },
  });

  assert.deepEqual(result, { status: "valid" });
});

test("production accepts only a successful property-lead token for the canonical host", async () => {
  const result = await verifyPropertyLeadTurnstile({
    request: request(),
    token: "verified-token",
    env: configuredProductionEnvironment(),
    fetchImpl: async () => successfulSiteverifyResponse(),
  });

  assert.deepEqual(result, { status: "valid" });
});

test("production rejects a successful token issued for a different hostname", async () => {
  const result = await verifyPropertyLeadTurnstile({
    request: request(),
    token: "verified-token",
    env: configuredProductionEnvironment(),
    fetchImpl: async () =>
      successfulSiteverifyResponse({ hostname: "preview.picchuspot.com" }),
  });

  assert.deepEqual(result, {
    status: "invalid",
    diagnostic: {
      reason: "hostname-mismatch",
      expectedHostname: "picchuspot.com",
      receivedHostname: "preview.picchuspot.com",
      receivedAction: "property_lead",
    },
  });
});

test("production rejects a successful token issued for a different action", async () => {
  const result = await verifyPropertyLeadTurnstile({
    request: request(),
    token: "verified-token",
    env: configuredProductionEnvironment(),
    fetchImpl: async () => successfulSiteverifyResponse({ action: "signup" }),
  });

  assert.deepEqual(result, {
    status: "invalid",
    diagnostic: {
      reason: "action-mismatch",
      expectedHostname: "picchuspot.com",
      receivedHostname: "picchuspot.com",
      receivedAction: "signup",
    },
  });
});

test("Siteverify uses the documented ten-second abort timeout and classifies an abort", async () => {
  let timeoutMs: number | undefined;
  const result = await verifyPropertyLeadTurnstile({
    request: request(),
    token: "verified-token",
    env: configuredProductionEnvironment(),
    createTimeoutSignal: (milliseconds) => {
      timeoutMs = milliseconds;
      return AbortSignal.abort();
    },
    fetchImpl: async () => {
      throw new DOMException("aborted", "AbortError");
    },
  });

  assert.equal(TURNSTILE_TIMEOUT_MS, 10_000);
  assert.equal(timeoutMs, 10_000);
  assert.deepEqual(result, {
    status: "unavailable",
    diagnostic: {
      reason: "siteverify-timeout",
      expectedHostname: "picchuspot.com",
    },
  });
});

test("a Siteverify network exception is temporarily unavailable", async () => {
  const result = await verifyPropertyLeadTurnstile({
    request: request(),
    token: "verified-token",
    env: configuredProductionEnvironment(),
    createTimeoutSignal: () => new AbortController().signal,
    fetchImpl: async () => {
      throw new TypeError("network failed");
    },
  });

  assert.deepEqual(result, {
    status: "unavailable",
    diagnostic: {
      reason: "siteverify-network-error",
      expectedHostname: "picchuspot.com",
    },
  });
});

test("a non-2xx Siteverify response is temporarily unavailable with its status", async () => {
  const result = await verifyPropertyLeadTurnstile({
    request: request(),
    token: "verified-token",
    env: configuredProductionEnvironment(),
    fetchImpl: async () => new Response(null, { status: 502 }),
  });

  assert.deepEqual(result, {
    status: "unavailable",
    diagnostic: {
      reason: "siteverify-http-error",
      httpStatus: 502,
      expectedHostname: "picchuspot.com",
    },
  });
});

test("a malformed Siteverify JSON response is temporarily unavailable", async () => {
  const result = await verifyPropertyLeadTurnstile({
    request: request(),
    token: "verified-token",
    env: configuredProductionEnvironment(),
    fetchImpl: async () =>
      new Response("this is not JSON", {
        headers: { "Content-Type": "application/json" },
      }),
  });

  assert.deepEqual(result, {
    status: "unavailable",
    diagnostic: {
      reason: "siteverify-invalid-json",
      expectedHostname: "picchuspot.com",
    },
  });
});

test("Cloudflare internal errors are temporarily unavailable", async () => {
  const result = await verifyPropertyLeadTurnstile({
    request: request(),
    token: "verified-token",
    env: configuredProductionEnvironment(),
    fetchImpl: async () =>
      Response.json({ success: false, "error-codes": ["internal-error"] }),
  });

  assert.deepEqual(result, {
    status: "unavailable",
    diagnostic: {
      reason: "internal-error",
      expectedHostname: "picchuspot.com",
      cloudflareErrorCodes: ["internal-error"],
    },
  });
});

test("an invalid Turnstile response is a generic security failure", async () => {
  const result = await verifyPropertyLeadTurnstile({
    request: request(),
    token: "verified-token",
    env: configuredProductionEnvironment(),
    fetchImpl: async () =>
      Response.json({
        success: false,
        "error-codes": ["invalid-input-response"],
      }),
  });

  assert.deepEqual(result, {
    status: "invalid",
    diagnostic: {
      reason: "invalid-input-response",
      expectedHostname: "picchuspot.com",
      cloudflareErrorCodes: ["invalid-input-response"],
    },
  });
});

test("a duplicate or expired Turnstile token is a generic security failure", async () => {
  const result = await verifyPropertyLeadTurnstile({
    request: request(),
    token: "verified-token",
    env: configuredProductionEnvironment(),
    fetchImpl: async () =>
      Response.json({
        success: false,
        "error-codes": ["timeout-or-duplicate"],
      }),
  });

  assert.deepEqual(result, {
    status: "invalid",
    diagnostic: {
      reason: "timeout-or-duplicate",
      expectedHostname: "picchuspot.com",
      cloudflareErrorCodes: ["timeout-or-duplicate"],
    },
  });
});

test("missing individual Turnstile keys are unavailable configuration errors", async () => {
  const missingSecret = await verifyPropertyLeadTurnstile({
    request: request(),
    token: "verified-token",
    env: {
      ...configuredProductionEnvironment(),
      TURNSTILE_SECRET_KEY: "",
    },
  });
  const missingSiteKey = await verifyPropertyLeadTurnstile({
    request: request(),
    token: "verified-token",
    env: {
      ...configuredProductionEnvironment(),
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
    },
  });

  assert.deepEqual(missingSecret, {
    status: "unavailable",
    diagnostic: { reason: "missing-secret" },
  });
  assert.deepEqual(missingSiteKey, {
    status: "unavailable",
    diagnostic: { reason: "missing-site-key" },
  });
});

test("unavailable diagnostics do not contain a secret, token, or lead PII", async () => {
  const secret = "server-secret-must-not-be-logged";
  const token = "turnstile-token-must-not-be-logged";
  const result = await verifyPropertyLeadTurnstile({
    request: request(),
    token,
    env: {
      ...configuredProductionEnvironment(),
      TURNSTILE_SECRET_KEY: secret,
    },
    fetchImpl: async () => new Response(null, { status: 503 }),
  });
  const diagnostic = JSON.stringify(result);

  assert.doesNotMatch(diagnostic, new RegExp(secret));
  assert.doesNotMatch(diagnostic, new RegExp(token));
  assert.doesNotMatch(diagnostic, /alex@example\.com|\+34 600 123 456/i);
});
