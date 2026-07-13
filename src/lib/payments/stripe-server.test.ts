import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return {
        url: "data:text/javascript,export default undefined;",
        shortCircuit: true,
      };
    }

    return nextResolve(specifier, context);
  },
});

const savedStripeSecretKey = process.env.STRIPE_SECRET_KEY;
const savedStripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

test("the server module imports without Stripe configuration", async () => {
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;

  await assert.doesNotReject(import("./stripe-server.ts"));
});

test("the lazy server client is cached and makes no network request on construction", async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_1234567890abcdef";
  delete process.env.STRIPE_WEBHOOK_SECRET;

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async (...args) => {
    fetchCalls += 1;
    return originalFetch(...args);
  };

  try {
    const { getStripeServerClient } = await import("./stripe-server.ts");
    const firstClient = getStripeServerClient();
    const secondClient = getStripeServerClient();

    assert.strictEqual(firstClient, secondClient);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (savedStripeSecretKey === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = savedStripeSecretKey;
    }
    if (savedStripeWebhookSecret === undefined) {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    } else {
      process.env.STRIPE_WEBHOOK_SECRET = savedStripeWebhookSecret;
    }
  }
});
