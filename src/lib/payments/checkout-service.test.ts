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
    if (specifier.startsWith("@/")) {
      return {
        url: new URL(`../../${specifier.slice(2)}.ts`, import.meta.url).href,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const orderId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const orderNumber = "VS-0042";
const now = new Date("2026-07-13T12:00:00.000Z");

const { createCheckoutSession, checkoutInternals, CheckoutServiceError } =
  await import("./checkout-service.ts");
const { handleCheckoutRequest } = await import("./checkout-request.ts");

function validOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: orderId,
    order_number: orderNumber,
    user_id: userId,
    client_email: "customer@example.com",
    status: "pending",
    service_type: "virtual-staging",
    estimated_total_cents: 1350,
    currency: "USD",
    pricing_snapshot: {
      pricingVersion: "2026-06-25-v1",
      currency: "USD",
      serviceType: "virtual-staging",
      eligibleUnits: 1,
      baseSubtotalCents: 1350,
      addOnSubtotalCents: 0,
      volumeDiscountPercent: 0,
      volumeDiscountCents: 0,
      subtotalAfterDiscountCents: 1350,
      taxCalculated: false,
      taxCents: 0,
      totalCents: 1350,
      customQuote: false,
      items: [],
      pricedAt: "2026-07-13T11:00:00.000Z",
    },
    ...overrides,
  };
}

function payment(overrides: Record<string, unknown> = {}) {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    order_id: orderId,
    payment_status: "pending",
    refund_status: "none",
    subtotal_cents: 1350,
    currency: "usd",
    stripe_checkout_session_id: null,
    stripe_livemode: false,
    checkout_attempt: 0,
    checkout_expires_at: null,
    paid_at: null,
    ...overrides,
  };
}

class FakeRepository {
  order: ReturnType<typeof validOrder> | null = validOrder();
  currentPayment: ReturnType<typeof payment> | null = null;
  created: Array<Record<string, unknown>> = [];
  markedPaid = false;
  onReserveAttempt: (() => void) | null = null;
  onMarkCheckoutOpen: (() => void) | null = null;
  onMarkExpired: (() => void) | null = null;
  onMarkFailed: (() => void) | null = null;

  markPaid() {
    if (!this.currentPayment) throw new Error("missing payment");
    this.currentPayment.payment_status = "paid";
    this.currentPayment.paid_at = now.toISOString();
    this.markedPaid = true;
  }

  async getOrder() {
    return this.order;
  }

  async getPayment() {
    return this.currentPayment;
  }

  async createPayment(input: Record<string, unknown>) {
    this.created.push(input);
    this.currentPayment = payment({
      order_id: input.orderId,
      subtotal_cents: input.subtotalCents,
      currency: input.currency,
      stripe_livemode: input.stripeLivemode,
    });
    return this.currentPayment;
  }

  async reserveAttempt(input: {
    expectedAttempt: number;
    nextAttempt: number;
    leaseExpiresAt: string;
  }) {
    this.onReserveAttempt?.();
    this.onReserveAttempt = null;
    if (!this.currentPayment || this.currentPayment.checkout_attempt !== input.expectedAttempt) {
      return null;
    }
    if (
      this.currentPayment.paid_at !== null ||
      !["pending", "expired", "failed"].includes(this.currentPayment.payment_status)
    ) {
      return null;
    }
    this.currentPayment.checkout_attempt = input.nextAttempt;
    this.currentPayment.checkout_expires_at = input.leaseExpiresAt;
    return this.currentPayment;
  }

  async markCheckoutOpen(input: {
    attempt: number;
    stripeCheckoutSessionId: string;
    stripeLivemode: boolean;
    checkoutExpiresAt: string | null;
  }) {
    this.onMarkCheckoutOpen?.();
    this.onMarkCheckoutOpen = null;
    assert.equal(this.currentPayment?.checkout_attempt, input.attempt);
    if (!this.currentPayment) throw new Error("missing payment");
    if (
      this.currentPayment.paid_at !== null ||
      !["pending", "expired", "failed"].includes(this.currentPayment.payment_status)
    ) {
      return false;
    }
    this.currentPayment.payment_status = "checkout_open";
    this.currentPayment.stripe_checkout_session_id = input.stripeCheckoutSessionId;
    this.currentPayment.stripe_livemode = input.stripeLivemode;
    this.currentPayment.checkout_expires_at = input.checkoutExpiresAt;
    return true;
  }

  async markExpired(input: { attempt: number; stripeCheckoutSessionId: string }) {
    this.onMarkExpired?.();
    this.onMarkExpired = null;
    if (!this.currentPayment) throw new Error("missing payment");
    if (
      this.currentPayment.paid_at !== null ||
      this.currentPayment.payment_status !== "checkout_open" ||
      this.currentPayment.checkout_attempt !== input.attempt ||
      this.currentPayment.stripe_checkout_session_id !== input.stripeCheckoutSessionId
    ) {
      return false;
    }
    this.currentPayment.payment_status = "expired";
    return true;
  }

  async markFailed() {
    this.onMarkFailed?.();
    this.onMarkFailed = null;
    if (!this.currentPayment) throw new Error("missing payment");
    if (
      this.currentPayment.paid_at !== null ||
      !["pending", "expired", "failed"].includes(this.currentPayment.payment_status)
    ) {
      return false;
    }
    this.currentPayment.payment_status = "failed";
    this.currentPayment.checkout_expires_at = null;
    return true;
  }
}

function fakeStripe(overrides: Record<string, unknown> = {}) {
  const calls: Array<{ params: Record<string, unknown>; options: { idempotencyKey: string } }> = [];
  const stripe = {
    checkout: {
      sessions: {
        async create(params: Record<string, unknown>, options: { idempotencyKey: string }) {
          calls.push({ params, options });
          return {
            id: "cs_test_123",
            url: "https://checkout.stripe.com/c/pay/cs_test_123",
            expires_at: Math.floor(now.getTime() / 1000) + 1800,
            livemode: false,
            ...overrides,
          };
        },
        async retrieve() {
          return {
            status: "open",
            url: "https://checkout.stripe.com/c/pay/cs_test_123",
            expires_at: Math.floor(now.getTime() / 1000) + 1800,
            livemode: false,
            ...overrides,
          };
        },
      },
    },
  };
  return { stripe, calls };
}

function dependencies(repository: FakeRepository, stripe = fakeStripe().stripe) {
  return {
    repository,
    getStripeClient: () => stripe,
    getStripeMode: () => "test" as const,
    now: () => now,
  };
}

test("creates a server-authoritative Checkout Session and checkout_open payment", async () => {
  const repository = new FakeRepository();
  const { stripe, calls } = fakeStripe();

  const result = await createCheckoutSession(
    { orderId, authenticatedUserId: userId },
    dependencies(repository, stripe),
  );

  assert.equal(result.url, "https://checkout.stripe.com/c/pay/cs_test_123");
  assert.deepEqual(repository.created, [{
    orderId,
    subtotalCents: 1350,
    currency: "usd",
    stripeLivemode: false,
  }]);
  assert.equal(repository.currentPayment?.payment_status, "checkout_open");
  assert.equal(repository.currentPayment?.checkout_attempt, 1);
  assert.equal(repository.markedPaid, false);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]?.options, {
    idempotencyKey: "picchuspot-checkout-33333333-3333-4333-8333-333333333333-1",
  });
  assert.deepEqual(calls[0]?.params, {
    mode: "payment",
    payment_method_types: ["card"],
    automatic_tax: { enabled: true },
    allow_promotion_codes: false,
    client_reference_id: orderId,
    customer_email: "customer@example.com",
    success_url: `https://picchuspot.com/dashboard/jobs/${orderId}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `https://picchuspot.com/dashboard/jobs/${orderId}?payment=cancelled`,
    metadata: {
      picchuspot_order_id: orderId,
      picchuspot_order_number: orderNumber,
    },
    payment_intent_data: {
      metadata: {
        picchuspot_order_id: orderId,
        picchuspot_order_number: orderNumber,
      },
    },
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: 1350,
        product_data: { name: "PicchuSpot order VS-0042" },
      },
    }],
  });
});

test("rejects unauthenticated, malformed, extra client price fields, and non-owned orders", async () => {
  const repository = new FakeRepository();
  const unauthenticated = await handleCheckoutRequest(
    { orderId },
    { ...dependencies(repository), getAuthenticatedUser: async () => null },
  );
  assert.deepEqual(unauthenticated, { status: 401, body: { error: "Unauthorized." } });

  const invalid = await handleCheckoutRequest(
    { orderId, total: 1, currency: "usd" },
    { ...dependencies(repository), getAuthenticatedUser: async () => ({ id: userId }) },
  );
  assert.deepEqual(invalid, { status: 400, body: { error: "Invalid request." } });

  repository.order = validOrder({ user_id: "44444444-4444-4444-8444-444444444444" });
  const missing = await handleCheckoutRequest(
    { orderId },
    { ...dependencies(repository), getAuthenticatedUser: async () => ({ id: userId }) },
  );
  assert.deepEqual(missing, { status: 404, body: { error: "Order not found." } });
});

test("rejects quote, historical, large, unsupported, completed, non-USD, and mismatched orders", async () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ["quote", { pricing_snapshot: { ...validOrder().pricing_snapshot as Record<string, unknown>, customQuote: true } }],
    ["historical", { pricing_snapshot: null }],
    ["large", { pricing_snapshot: { ...validOrder().pricing_snapshot as Record<string, unknown>, eligibleUnits: 50, customQuote: true, totalCents: null, subtotalAfterDiscountCents: null } }],
    ["unsupported", { service_type: "aerial-editing" }],
    ["delivered", { status: "delivered" }],
    ["currency", { currency: "EUR" }],
    ["mismatch", { estimated_total_cents: 999 }],
  ];

  for (const [, overrides] of cases) {
    const repository = new FakeRepository();
    repository.order = validOrder(overrides);
    await assert.rejects(
      createCheckoutSession({ orderId, authenticatedUserId: userId }, dependencies(repository)),
      CheckoutServiceError,
    );
    assert.equal(repository.created.length, 0);
  }
});

test("reuses an active open Session and expires then replaces an expired Session", async () => {
  const repository = new FakeRepository();
  repository.currentPayment = payment({
    payment_status: "checkout_open",
    checkout_attempt: 1,
    stripe_checkout_session_id: "cs_test_existing",
    checkout_expires_at: new Date(now.getTime() + 60000).toISOString(),
  });
  const active = fakeStripe();
  const reused = await createCheckoutSession(
    { orderId, authenticatedUserId: userId },
    dependencies(repository, active.stripe),
  );
  assert.equal(reused.url, "https://checkout.stripe.com/c/pay/cs_test_123");
  assert.equal(active.calls.length, 0);

  repository.currentPayment = payment({
    payment_status: "checkout_open",
    checkout_attempt: 1,
    stripe_checkout_session_id: "cs_test_expired",
    checkout_expires_at: new Date(now.getTime() - 60000).toISOString(),
  });
  const expired = fakeStripe({ status: "expired", expires_at: Math.floor(now.getTime() / 1000) - 1 });
  await createCheckoutSession(
    { orderId, authenticatedUserId: userId },
    dependencies(repository, expired.stripe),
  );
  assert.equal(repository.currentPayment?.payment_status, "checkout_open");
  assert.equal(repository.currentPayment?.checkout_attempt, 2);
  assert.equal(expired.calls.length, 1);
});

test("does not create another session for paid payment or a test/live mismatch", async () => {
  for (const currentPayment of [
    payment({ payment_status: "paid" }),
    payment({ stripe_livemode: true }),
  ]) {
    const repository = new FakeRepository();
    repository.currentPayment = currentPayment;
    await assert.rejects(
      createCheckoutSession({ orderId, authenticatedUserId: userId }, dependencies(repository)),
      CheckoutServiceError,
    );
  }
});

test("does not reserve or create a Checkout Session when payment becomes paid concurrently", async () => {
  const repository = new FakeRepository();
  repository.currentPayment = payment();
  repository.onReserveAttempt = () => repository.markPaid();
  const { stripe, calls } = fakeStripe();

  await assert.rejects(
    createCheckoutSession(
      { orderId, authenticatedUserId: userId },
      dependencies(repository, stripe),
    ),
    (error: unknown) => {
      assert.ok(error instanceof CheckoutServiceError);
      assert.equal(error.code, "payment-paid");
      return true;
    },
  );
  assert.equal(calls.length, 0);
  assert.equal(repository.currentPayment?.payment_status, "paid");
});

test("never overwrites a payment that becomes paid before checkout_open is persisted", async () => {
  const repository = new FakeRepository();
  repository.currentPayment = payment();
  repository.onMarkCheckoutOpen = () => repository.markPaid();
  const { stripe, calls } = fakeStripe();

  await assert.rejects(
    createCheckoutSession(
      { orderId, authenticatedUserId: userId },
      dependencies(repository, stripe),
    ),
    (error: unknown) => {
      assert.ok(error instanceof CheckoutServiceError);
      assert.equal(error.code, "payment-paid");
      return true;
    },
  );
  assert.equal(calls.length, 1);
  assert.equal(repository.currentPayment?.payment_status, "paid");
  assert.notEqual(repository.currentPayment?.stripe_checkout_session_id, "cs_test_123");
});

test("does not reserve a replacement Session when expiry loses a race to paid", async () => {
  const repository = new FakeRepository();
  repository.currentPayment = payment({
    payment_status: "checkout_open",
    checkout_attempt: 1,
    stripe_checkout_session_id: "cs_test_expired",
    checkout_expires_at: new Date(now.getTime() - 60000).toISOString(),
  });
  repository.onMarkExpired = () => repository.markPaid();
  const expired = fakeStripe({
    status: "expired",
    expires_at: Math.floor(now.getTime() / 1000) - 1,
  });

  await assert.rejects(
    createCheckoutSession(
      { orderId, authenticatedUserId: userId },
      dependencies(repository, expired.stripe),
    ),
    (error: unknown) => {
      assert.ok(error instanceof CheckoutServiceError);
      assert.equal(error.code, "payment-paid");
      return true;
    },
  );
  assert.equal(expired.calls.length, 0);
  assert.equal(repository.currentPayment?.payment_status, "paid");
  assert.equal(repository.currentPayment?.checkout_attempt, 1);
});

test("failure handling cannot regress a concurrently paid payment", async () => {
  const repository = new FakeRepository();
  repository.currentPayment = payment();
  let createCalls = 0;
  const stripe = {
    checkout: {
      sessions: {
        async create() {
          createCalls += 1;
          repository.markPaid();
          throw new Error("provider failure");
        },
        async retrieve() {
          throw new Error("unused");
        },
      },
    },
  };

  await assert.rejects(
    createCheckoutSession(
      { orderId, authenticatedUserId: userId },
      dependencies(repository, stripe),
    ),
    CheckoutServiceError,
  );
  assert.equal(createCalls, 1);
  assert.equal(repository.currentPayment?.payment_status, "paid");
});

test("a non-null paid_at blocks Checkout even when payment_status is inconsistent", async () => {
  const repository = new FakeRepository();
  repository.currentPayment = payment({ paid_at: now.toISOString() });
  const { stripe, calls } = fakeStripe();

  await assert.rejects(
    createCheckoutSession(
      { orderId, authenticatedUserId: userId },
      dependencies(repository, stripe),
    ),
    (error: unknown) => {
      assert.ok(error instanceof CheckoutServiceError);
      assert.equal(error.code, "payment-paid");
      return true;
    },
  );
  assert.equal(calls.length, 0);
});

test("uses a stable attempt key and sanitizes configuration and Stripe errors", async () => {
  assert.equal(
    checkoutInternals.getCheckoutIdempotencyKey("payment-id", 12),
    "picchuspot-checkout-payment-id-12",
  );

  const repository = new FakeRepository();
  await assert.rejects(
    createCheckoutSession(
      { orderId, authenticatedUserId: userId },
      { ...dependencies(repository), getStripeMode: () => { throw new Error("sk_test_never-disclose"); } },
    ),
    (error: unknown) => {
      assert.ok(error instanceof CheckoutServiceError);
      assert.equal(error.message.includes("sk_test_never-disclose"), false);
      return true;
    },
  );

  const noNetworkRepository = new FakeRepository();
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    fetchCalls += 1;
    return originalFetch(...args);
  };
  try {
    await createCheckoutSession(
      { orderId, authenticatedUserId: userId },
      {
        ...dependencies(noNetworkRepository),
        getStripeClient: () => ({
          checkout: { sessions: { create: async () => { throw new Error("provider failure"); }, retrieve: async () => { throw new Error("unused"); } } },
        }),
      },
    ).catch(() => undefined);
    assert.equal(fetchCalls, 0);
    assert.equal(noNetworkRepository.currentPayment?.payment_status, "failed");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
