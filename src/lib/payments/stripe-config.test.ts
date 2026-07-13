import assert from "node:assert/strict";
import test from "node:test";

import {
  parseStripeApiConfig,
  parseStripeWebhookConfig,
  StripeConfigurationError,
} from "./stripe-config.ts";

const testServerKey = "sk_test_1234567890abcdef";
const liveServerKey = "sk_live_1234567890abcdef";
const restrictedTestKey = "rk_test_1234567890abcdef";
const webhookSecret = "whsec_1234567890abcdef";

test("parses supported Stripe server API keys and their modes", () => {
  assert.deepEqual(parseStripeApiConfig({ STRIPE_SECRET_KEY: testServerKey }), {
    secretKey: testServerKey,
    mode: "test",
  });
  assert.deepEqual(parseStripeApiConfig({ STRIPE_SECRET_KEY: liveServerKey }), {
    secretKey: liveServerKey,
    mode: "live",
  });
  assert.deepEqual(
    parseStripeApiConfig({ STRIPE_SECRET_KEY: ` ${restrictedTestKey} ` }),
    {
      secretKey: restrictedTestKey,
      mode: "test",
    },
  );
});

test("rejects missing, publishable, empty, and malformed Stripe API keys", () => {
  const rejected = [
    undefined,
    "   ",
    "pk_test_1234567890abcdef",
    "sk_unknown_1234567890abcdef",
    "sk_test_not-valid!",
  ];

  for (const secretKey of rejected) {
    assert.throws(
      () => parseStripeApiConfig({ STRIPE_SECRET_KEY: secretKey }),
      StripeConfigurationError,
    );
  }
});

test("Stripe API-key errors do not disclose the supplied value", () => {
  const suppliedSecret = "sk_test_do-not-disclose-this-value";

  assert.throws(
    () => parseStripeApiConfig({ STRIPE_SECRET_KEY: `${suppliedSecret}!` }),
    (error: unknown) => {
      assert.ok(error instanceof StripeConfigurationError);
      assert.equal(error.message.includes(suppliedSecret), false);
      return true;
    },
  );
});

test("parses and trims Stripe webhook signing secrets", () => {
  assert.deepEqual(
    parseStripeWebhookConfig({ STRIPE_WEBHOOK_SECRET: ` ${webhookSecret} ` }),
    { webhookSecret },
  );
});

test("rejects missing and malformed webhook signing secrets", () => {
  for (const candidate of [undefined, "", "webhook_123", "whsec_not-valid!"]) {
    assert.throws(
      () => parseStripeWebhookConfig({ STRIPE_WEBHOOK_SECRET: candidate }),
      StripeConfigurationError,
    );
  }
});

test("webhook-secret errors do not disclose the supplied value", () => {
  const suppliedSecret = "whsec_do-not-disclose-this-value";

  assert.throws(
    () => parseStripeWebhookConfig({ STRIPE_WEBHOOK_SECRET: suppliedSecret }),
    (error: unknown) => {
      assert.ok(error instanceof StripeConfigurationError);
      assert.equal(error.message.includes(suppliedSecret), false);
      return true;
    },
  );
});
