import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,export default undefined;", shortCircuit: true };
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
const now = new Date("2026-07-13T12:00:00.000Z");
const { handleStripeWebhookRequest } = await import("./webhook-request.ts");
const { processVerifiedStripeWebhook } = await import("./webhook-service.ts");

function payment(overrides: Record<string, unknown> = {}) {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    order_id: orderId,
    provider: "stripe" as const,
    payment_status: "checkout_open" as const,
    subtotal_cents: 1350,
    tax_cents: null,
    total_cents: null,
    currency: "usd",
    stripe_checkout_session_id: "cs_test_123",
    stripe_payment_intent_id: null,
    stripe_customer_id: null,
    stripe_livemode: false,
    checkout_expires_at: "2026-07-13T12:30:00.000Z",
    paid_at: null,
    ...overrides,
  };
}

function event(type: string, overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_test_123",
    type,
    livemode: false,
    created: 1783944000,
    data: {
      object: {
        id: "cs_test_123",
        client_reference_id: orderId,
        metadata: { picchuspot_order_id: orderId, picchuspot_order_number: "VS-42" },
        livemode: false,
        currency: "USD",
        amount_subtotal: 1350,
        amount_total: 1450,
        payment_status: "paid",
        status: "complete",
        payment_intent: { id: "pi_test_123" },
        customer: { id: "cus_test_123" },
        total_details: { amount_tax: 100, amount_discount: 0, amount_shipping: 0 },
        ...overrides,
      },
    },
  };
}

class FakeRepository {
  currentPayment: ReturnType<typeof payment> | null = payment();
  events = new Map<string, { stripe_event_id: string; processing_status: "received" | "processed" | "ignored" | "failed"; error?: string | null }>();
  updates = 0;
  failStorage = false;

  async registerEvent(input: { stripeEventId: string }) {
    if (this.failStorage) throw new Error("db unavailable");
    if (this.events.has(input.stripeEventId)) return null;
    const row = { stripe_event_id: input.stripeEventId, processing_status: "received" as const };
    this.events.set(input.stripeEventId, row);
    return row;
  }

  async getEvent(stripeEventId: string) {
    return this.events.get(stripeEventId) ?? null;
  }

  async finishEvent(input: { stripeEventId: string; status: "processed" | "ignored" | "failed"; errorMessage: string | null }) {
    if (this.failStorage) throw new Error("db unavailable");
    const current = this.events.get(input.stripeEventId);
    if (!current) throw new Error("missing event");
    current.processing_status = input.status;
    current.error = input.errorMessage;
  }

  async getPayment() {
    if (this.failStorage) throw new Error("db unavailable");
    return this.currentPayment;
  }

  async markPaid(input: {
    stripeCheckoutSessionId: string;
    stripePaymentIntentId: string;
    stripeCustomerId: string | null;
    taxCents: number;
    totalCents: number;
    paidAt: string;
  }) {
    if (!this.currentPayment || this.currentPayment.payment_status === "paid") return false;
    this.currentPayment.payment_status = "paid";
    this.currentPayment.stripe_checkout_session_id = input.stripeCheckoutSessionId;
    this.currentPayment.stripe_payment_intent_id = input.stripePaymentIntentId;
    this.currentPayment.stripe_customer_id = input.stripeCustomerId;
    this.currentPayment.tax_cents = input.taxCents;
    this.currentPayment.total_cents = input.totalCents;
    this.currentPayment.paid_at = input.paidAt;
    this.currentPayment.checkout_expires_at = null;
    this.updates += 1;
    return true;
  }

  async markFailed(input: { stripeCheckoutSessionId: string; stripePaymentIntentId: string | null }) {
    if (!this.currentPayment || this.currentPayment.payment_status === "paid") return false;
    this.currentPayment.payment_status = "failed";
    this.currentPayment.stripe_checkout_session_id = input.stripeCheckoutSessionId;
    this.currentPayment.stripe_payment_intent_id = input.stripePaymentIntentId;
    this.currentPayment.checkout_expires_at = null;
    this.updates += 1;
    return true;
  }

  async markExpired() {
    if (!this.currentPayment || this.currentPayment.payment_status !== "checkout_open") return false;
    this.currentPayment.payment_status = "expired";
    this.currentPayment.checkout_expires_at = null;
    this.updates += 1;
    return true;
  }
}

function dependencies(repository: FakeRepository) {
  return { repository, now: () => now };
}

test("verifies the exact raw body once, returns 400 for invalid signatures, and 503 for absent webhook configuration", async () => {
  const repository = new FakeRepository();
  let captured: string | null = null;
  const accepted = await handleStripeWebhookRequest(
    { rawBody: "{ exact raw payload }", stripeSignature: "t=1,v1=valid" },
    {
      ...dependencies(repository),
      getWebhookSecret: () => "test-webhook-secret",
      verifyEvent: (rawBody, signature) => {
        captured = `${rawBody}|${signature}`;
        return event("checkout.session.completed");
      },
    },
  );
  assert.equal(accepted.status, 200);
  assert.equal(captured, "{ exact raw payload }|t=1,v1=valid");

  const invalid = await handleStripeWebhookRequest(
    { rawBody: "tampered", stripeSignature: "bad" },
    { ...dependencies(new FakeRepository()), getWebhookSecret: () => "test-secret", verifyEvent: () => { throw new Error("signature"); } },
  );
  assert.equal(invalid.status, 400);

  const unconfigured = await handleStripeWebhookRequest(
    { rawBody: "payload", stripeSignature: "present" },
    { ...dependencies(new FakeRepository()), getWebhookSecret: () => { throw new Error("missing configuration"); }, verifyEvent: () => event("checkout.session.completed") },
  );
  assert.deepEqual(unconfigured, { status: 503, body: { received: true } });
});

test("records signed unsupported and non-PicchuSpot events as ignored without payment effects", async () => {
  for (const candidate of [
    event("payment_intent.succeeded"),
    event("checkout.session.completed", { metadata: { picchuspot_order_id: "not-an-order" } }),
  ]) {
    const repository = new FakeRepository();
    const result = await processVerifiedStripeWebhook(candidate, dependencies(repository));
    assert.equal(result.status, 200);
    assert.equal(repository.currentPayment?.payment_status, "checkout_open");
    assert.equal(repository.events.get("evt_test_123")?.processing_status, "ignored");
  }
});

test("processes a valid paid Checkout Session exactly once with validated tax, totals, IDs, and event timestamp", async () => {
  const repository = new FakeRepository();
  const result = await processVerifiedStripeWebhook(event("checkout.session.completed"), dependencies(repository));
  assert.equal(result.status, 200);
  assert.deepEqual(repository.currentPayment, payment({
    payment_status: "paid",
    stripe_payment_intent_id: "pi_test_123",
    stripe_customer_id: "cus_test_123",
    tax_cents: 100,
    total_cents: 1450,
    checkout_expires_at: null,
    paid_at: "2026-07-13T12:00:00.000Z",
  }));
  assert.equal(repository.events.get("evt_test_123")?.processing_status, "processed");

  const duplicate = await processVerifiedStripeWebhook(event("checkout.session.completed"), dependencies(repository));
  assert.equal(duplicate.status, 200);
  assert.equal(repository.updates, 1);
});

test("rejects inconsistent paid sessions without overwriting paid history or exposing provider data", async () => {
  const repository = new FakeRepository();
  const result = await processVerifiedStripeWebhook(
    event("checkout.session.completed", { amount_total: 999, payment_intent: "pi_secret_not_logged" }),
    dependencies(repository),
  );
  assert.equal(result.status, 200);
  assert.equal(repository.currentPayment?.payment_status, "checkout_open");
  const row = repository.events.get("evt_test_123");
  assert.equal(row?.processing_status, "failed");
  assert.equal(row?.error?.includes("pi_secret_not_logged"), false);

  const paidRepository = new FakeRepository();
  paidRepository.currentPayment = payment({
    payment_status: "paid",
    paid_at: now.toISOString(),
    stripe_payment_intent_id: "pi_original",
  });
  const paidResult = await processVerifiedStripeWebhook(event("checkout.session.completed"), dependencies(paidRepository));
  assert.equal(paidResult.status, 200);
  assert.equal(paidRepository.currentPayment?.stripe_payment_intent_id, "pi_original");
});

test("marks matching async failures and expirations without regressing paid payments", async () => {
  const failedRepository = new FakeRepository();
  const failed = await processVerifiedStripeWebhook(
    event("checkout.session.async_payment_failed", { payment_status: "unpaid", payment_intent: "pi_test_123" }),
    dependencies(failedRepository),
  );
  assert.equal(failed.status, 200);
  assert.equal(failedRepository.currentPayment?.payment_status, "failed");

  const expiredRepository = new FakeRepository();
  const expired = await processVerifiedStripeWebhook(
    event("checkout.session.expired", { payment_status: "unpaid", payment_intent: null }),
    dependencies(expiredRepository),
  );
  assert.equal(expired.status, 200);
  assert.equal(expiredRepository.currentPayment?.payment_status, "expired");

  const paidRepository = new FakeRepository();
  paidRepository.currentPayment = payment({ payment_status: "paid", paid_at: now.toISOString() });
  const harmless = await processVerifiedStripeWebhook(
    event("checkout.session.async_payment_failed", { payment_status: "unpaid" }),
    dependencies(paidRepository),
  );
  assert.equal(harmless.status, 200);
  assert.equal(paidRepository.currentPayment?.payment_status, "paid");
});

test("returns 500 for transient storage failures while retaining only sanitized event errors", async () => {
  const repository = new FakeRepository();
  repository.failStorage = true;
  const result = await processVerifiedStripeWebhook(event("checkout.session.completed"), dependencies(repository));
  assert.deepEqual(result, { status: 500, body: { received: true } });
});
