import assert from "node:assert/strict";
import test from "node:test";
import { verifyPropertyLeadTurnstile } from "./property-lead-security.ts";

function request() {
  return new Request("https://picchuspot.com/api/property-leads");
}

function configuredProductionEnvironment() {
  return {
    NODE_ENV: "production" as const,
    NEXT_PUBLIC_SITE_URL: "https://picchuspot.com",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-key",
    TURNSTILE_SECRET_KEY: "secret-key",
  };
}

test("production refuses unverified property leads when Turnstile is unconfigured", async () => {
  const result = await verifyPropertyLeadTurnstile({
    request: request(),
    token: "unused",
    env: { NODE_ENV: "production" },
  });

  assert.equal(result, "unavailable");
});

test("local and test environments retain the explicit no-key exemption", async () => {
  const result = await verifyPropertyLeadTurnstile({
    request: request(),
    token: "unused",
    env: { NODE_ENV: "test" },
  });

  assert.equal(result, "valid");
});

test("production accepts only a successful property-lead token for the canonical host", async () => {
  const result = await verifyPropertyLeadTurnstile({
    request: request(),
    token: "verified-token",
    env: configuredProductionEnvironment(),
    fetchImpl: async () => Response.json({
      success: true,
      action: "property_lead",
      hostname: "picchuspot.com",
    }),
  });

  assert.equal(result, "valid");
});

test("production rejects a successful token issued for a different hostname", async () => {
  const result = await verifyPropertyLeadTurnstile({
    request: request(),
    token: "verified-token",
    env: configuredProductionEnvironment(),
    fetchImpl: async () => Response.json({
      success: true,
      action: "property_lead",
      hostname: "preview.picchuspot.com",
    }),
  });

  assert.equal(result, "invalid");
});
