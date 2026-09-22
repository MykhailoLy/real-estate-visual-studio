import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import type { CheckoutRepository } from "./checkout-repository.ts";
import type { WebhookPaymentRecord, WebhookRepository } from "./webhook-repository.ts";
import { historicalStagingSnapshot } from "../pricing/historical-snapshots.fixture.ts";

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
const now = new Date("2026-07-14T12:00:00.000Z");
const { handleStripeWebhookRequest } = await import("./webhook-request.ts");
const { processVerifiedStripeWebhook } = await import("./webhook-service.ts");
const { handleCheckoutRequest } = await import("./checkout-request.ts");

function payment(overrides: Partial<WebhookPaymentRecord> = {}): WebhookPaymentRecord {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    order_id: orderId,
    provider: "stripe" as const,
    payment_status: "checkout_open" as const,
    refund_status: "none" as const,
    refunded_amount_cents: 0,
    refunded_at: null,
    subtotal_cents: 1350,
    tax_cents: null,
    total_cents: null,
    currency: "usd",
    stripe_checkout_session_id: "cs_test_123",
    stripe_payment_intent_id: null,
    stripe_customer_id: null,
    stripe_livemode: false,
    checkout_expires_at: "2026-07-14T12:30:00.000Z",
    paid_at: null,
    ...overrides,
  };
}

function paidPayment(overrides: Partial<WebhookPaymentRecord> = {}) {
  return payment({
    payment_status: "paid",
    tax_cents: 100,
    total_cents: 1350,
    stripe_payment_intent_id: "pi_test_123",
    checkout_expires_at: null,
    paid_at: now.toISOString(),
    ...overrides,
  });
}

function charge(overrides: Record<string, unknown> = {}) {
  return {
    id: "ch_test_123",
    object: "charge",
    amount: 1350,
    amount_refunded: 500,
    currency: "usd",
    livemode: false,
    paid: true,
    payment_intent: "pi_test_123",
    refunded: false,
    status: "succeeded",
    ...overrides,
  };
}

function refundEvent(
  type: "refund.created" | "refund.updated" | "refund.failed",
  refundOverrides: Record<string, unknown> = {},
  eventOverrides: Record<string, unknown> = {},
) {
  return {
    id: `evt_${type}`,
    type,
    livemode: false,
    created: 1784030400,
    data: {
      object: {
        id: "re_test_123",
        object: "refund",
        amount: 500,
        charge: "ch_test_123",
        currency: "usd",
        payment_intent: "pi_test_123",
        status: type === "refund.failed" ? "failed" : "succeeded",
        ...refundOverrides,
      },
    },
    ...eventOverrides,
  };
}

function chargeRefundedEvent(
  chargeOverrides: Record<string, unknown> = {},
  eventOverrides: Record<string, unknown> = {},
) {
  return {
    id: "evt_charge_refunded",
    type: "charge.refunded",
    livemode: false,
    created: 1784030400,
    data: { object: charge(chargeOverrides) },
    ...eventOverrides,
  };
}

function event(
  type: string,
  sessionOverrides: Record<string, unknown> = {},
  eventOverrides: Record<string, unknown> = {},
) {
  return {
    id: "evt_test_123",
    type,
    livemode: false,
    created: 1784030400,
    data: {
      object: {
        id: "cs_test_123",
        client_reference_id: orderId,
        metadata: { picchuspot_order_id: orderId, picchuspot_order_number: "VS-42" },
        livemode: false,
        currency: "USD",
        amount_subtotal: 1350,
        amount_total: 1350,
        payment_status: "paid",
        status: "complete",
        payment_intent: { id: "pi_test_123" },
        customer: { id: "cus_test_123" },
        total_details: { amount_tax: 100, amount_discount: 0, amount_shipping: 0 },
        ...sessionOverrides,
      },
    },
    ...eventOverrides,
  };
}

type EventRecord = {
  stripe_event_id: string;
  processing_status: "received" | "processed" | "ignored" | "failed";
  processed_at: string | null;
  order_id: string | null;
  error: string | null;
};

class FakeRepository implements WebhookRepository {
  currentPayment: ReturnType<typeof payment> | null = payment();
  events = new Map<string, EventRecord>();
  registrations: Array<Record<string, unknown>> = [];
  updates = 0;
  onGetPayment: (() => void) | null = null;

  async registerEvent(input: Record<string, unknown>) {
    this.registrations.push(input);
    const id = input.stripeEventId as string;
    if (this.events.has(id)) return null;
    const row: EventRecord = {
      stripe_event_id: id,
      processing_status: "received",
      processed_at: null,
      order_id: null,
      error: null,
    };
    this.events.set(id, row);
    return row;
  }

  async getEvent(stripeEventId: string) {
    return this.events.get(stripeEventId) ?? null;
  }

  async finishEvent(input: {
    stripeEventId: string;
    status: "processed" | "ignored" | "failed";
    processedAt: string | null;
    errorMessage: string | null;
    orderId: string | null;
  }) {
    const current = this.events.get(input.stripeEventId);
    if (!current) throw new Error("missing event");
    const retryable = current.processing_status === "received" ||
      (current.processing_status === "failed" && current.processed_at === null);
    if (!retryable) return false;
    current.processing_status = input.status;
    current.processed_at = input.processedAt;
    current.error = input.errorMessage;
    if (input.orderId) current.order_id = input.orderId;
    return true;
  }

  async getPayment() {
    this.onGetPayment?.();
    this.onGetPayment = null;
    return this.currentPayment;
  }

  async getPaymentByPaymentIntent(stripePaymentIntentId: string) {
    return this.currentPayment?.stripe_payment_intent_id === stripePaymentIntentId
      ? this.currentPayment
      : null;
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

  async syncRefund(input: {
    payment: ReturnType<typeof payment>;
    refundStatus: "partial" | "full";
    refundedAmountCents: number;
    refundedAt: string;
  }) {
    if (
      !this.currentPayment ||
      this.currentPayment.refund_status !== input.payment.refund_status ||
      this.currentPayment.refunded_amount_cents !== input.payment.refunded_amount_cents
    ) {
      return false;
    }
    this.currentPayment.refund_status = input.refundStatus;
    this.currentPayment.refunded_amount_cents = input.refundedAmountCents;
    this.currentPayment.refunded_at = input.refundedAt;
    this.updates += 1;
    return true;
  }
}

test("late original webhook pays the same payment after completed Checkout is blocked, and replay is idempotent", async (t) => {
  const repository = new FakeRepository();
  const snapshot = historicalStagingSnapshot("2026-09-09-v4");
  assert.ok(snapshot.totalCents !== null);
  const totalCents = snapshot.totalCents;
  const userId = "33333333-3333-4333-8333-333333333333";
  const originalSessionId = "cs_test_original_complete";
  const expiresAt = Math.floor(now.getTime() / 1000) - 60;
  repository.currentPayment = payment({
    subtotal_cents: totalCents,
    stripe_checkout_session_id: originalSessionId,
    checkout_expires_at: new Date(expiresAt * 1000).toISOString(),
  });
  const before = structuredClone(repository.currentPayment);
  let attempt = 1;
  // Share the existing webhook fixture's payment with the real Checkout service.
  // Mutations remain functional so this test exposes the original overwrite bug.
  const createPayment = t.mock.fn(async () => { throw new Error("unexpected new payment"); });
  const reserveAttempt = t.mock.fn<CheckoutRepository["reserveAttempt"]>(async (input) => {
    if (!repository.currentPayment || repository.currentPayment.paid_at || attempt !== input.expectedAttempt) return null;
    attempt = input.nextAttempt;
    repository.currentPayment.checkout_expires_at = input.leaseExpiresAt;
    return { ...repository.currentPayment, checkout_attempt: attempt };
  });
  const markCheckoutOpen = t.mock.fn<CheckoutRepository["markCheckoutOpen"]>(async (input) => {
    if (!repository.currentPayment || repository.currentPayment.paid_at || attempt !== input.attempt) return false;
    repository.currentPayment.payment_status = "checkout_open";
    repository.currentPayment.stripe_checkout_session_id = input.stripeCheckoutSessionId;
    repository.currentPayment.checkout_expires_at = input.checkoutExpiresAt;
    return true;
  });
  const markExpired = t.mock.method(repository, "markExpired");
  const markFailed = t.mock.fn(async () => { throw new Error("unexpected failed payment"); });
  const checkoutRepository: CheckoutRepository = {
    getOrder: async () => ({
      id: orderId, order_number: "VS-42", user_id: userId,
      client_email: "customer@example.com", status: "pending", service_type: "virtual-staging",
      item_count: 10, estimated_total_cents: totalCents, currency: "USD", pricing_snapshot: snapshot,
    }),
    getPayment: async () => repository.currentPayment && ({ ...repository.currentPayment, checkout_attempt: attempt }),
    createPayment, reserveAttempt, markCheckoutOpen,
    markExpired: () => repository.markExpired(), markFailed,
  };
  const create = t.mock.fn(async () => ({
    id: "cs_test_replacement", url: "https://checkout.stripe.com/c/pay/cs_test_replacement",
    expires_at: expiresAt + 1800, livemode: false,
  }));
  const retrieve = t.mock.fn(async () => ({
    id: originalSessionId, status: "complete" as const, payment_status: "paid",
    url: null, expires_at: expiresAt, livemode: false,
  }));
  const checkoutResult = await handleCheckoutRequest({ orderId }, {
    repository: checkoutRepository,
    getStripeClient: () => ({ checkout: { sessions: { create, retrieve } } }),
    getStripeMode: () => "test", getAuthenticatedUser: async () => ({ id: userId }), now: () => now,
  });
  const afterCheckout = structuredClone(repository.currentPayment);
  const lateEvent = event("checkout.session.completed", {
    id: originalSessionId, expires_at: expiresAt,
    amount_subtotal: totalCents, amount_total: totalCents,
  });
  const result = await processVerifiedStripeWebhook(lateEvent, dependencies(repository));

  if (create.mock.callCount()) {
    t.diagnostic(JSON.stringify({ checkoutResult, attempt, savedSessionId: afterCheckout?.stripe_checkout_session_id,
      expiryWrites: markExpired.mock.callCount(), webhookEvent: repository.events.get(lateEvent.id) }));
  }
  assert.deepEqual(checkoutResult, {
    status: 409, body: { error: "Payment is being processed.", state: "processing" },
  });
  assert.deepEqual(afterCheckout, before);
  assert.equal(attempt, 1);
  assert.equal(retrieve.mock.callCount(), 1);
  assert.deepEqual(retrieve.mock.calls[0]?.arguments, [originalSessionId]);
  for (const mutation of [create, createPayment, reserveAttempt, markCheckoutOpen, markExpired, markFailed]) {
    assert.equal(mutation.mock.callCount(), 0);
  }
  assert.equal(result.status, 200);
  assert.deepEqual(repository.currentPayment, {
    ...before, payment_status: "paid", tax_cents: 100, total_cents: totalCents,
    stripe_payment_intent_id: "pi_test_123", stripe_customer_id: "cus_test_123",
    checkout_expires_at: null, paid_at: now.toISOString(),
  });
  assert.equal(repository.events.get(lateEvent.id)?.processing_status, "processed");
  assert.equal(repository.updates, 1);

  const paid = structuredClone(repository.currentPayment);
  assert.equal((await processVerifiedStripeWebhook(lateEvent, dependencies(repository))).status, 200);
  assert.deepEqual(repository.currentPayment, paid);
  assert.equal(repository.updates, 1);
  assert.equal(repository.events.size, 1);
});

function dependencies(
  repository: FakeRepository,
  chargeOverrides: Record<string, unknown> = {},
) {
  return {
    repository,
    retrieveCharge: async () => charge(chargeOverrides),
    now: () => now,
  };
}

test("keeps raw-body signature behavior and does not disclose configuration errors", async () => {
  let captured: string | null = null;
  const accepted = await handleStripeWebhookRequest(
    { rawBody: "{ exact raw payload }", stripeSignature: "t=1,v1=valid" },
    {
      ...dependencies(new FakeRepository()),
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
  assert.equal(unconfigured.status, 503);
});

test("records all initial events with a null foreign key and retries missing payments safely", async () => {
  const repository = new FakeRepository();
  repository.currentPayment = null;
  const missing = await processVerifiedStripeWebhook(event("checkout.session.completed"), dependencies(repository));
  assert.equal(missing.status, 500);
  assert.deepEqual(repository.registrations[0], {
    stripeEventId: "evt_test_123",
    eventType: "checkout.session.completed",
    stripeLivemode: false,
    stripeObjectId: "cs_test_123",
    stripeCreatedAt: "2026-07-14T12:00:00.000Z",
    receivedAt: now.toISOString(),
  });
  assert.deepEqual(repository.events.get("evt_test_123"), {
    stripe_event_id: "evt_test_123",
    processing_status: "failed",
    processed_at: null,
    order_id: null,
    error: "Payment webhook processing could not be completed.",
  });
  assert.equal(repository.updates, 0);

  repository.currentPayment = payment();
  const retried = await processVerifiedStripeWebhook(event("checkout.session.completed"), dependencies(repository));
  assert.equal(retried.status, 200);
  assert.equal(repository.updates, 1);
  assert.equal(repository.events.get("evt_test_123")?.processing_status, "processed");
  assert.equal(repository.events.get("evt_test_123")?.order_id, orderId);
});

test("keeps unsupported and non-PicchuSpot events unlinked and ignored", async () => {
  for (const candidate of [
    event("payment_intent.succeeded"),
    event("checkout.session.completed", { metadata: { picchuspot_order_id: "not-an-order" } }, { id: "evt_ignored" }),
  ]) {
    const repository = new FakeRepository();
    const result = await processVerifiedStripeWebhook(candidate, dependencies(repository));
    assert.equal(result.status, 200);
    const stored = repository.events.get(candidate.id);
    assert.equal(stored?.processing_status, "ignored");
    assert.equal(stored?.order_id, null);
    assert.equal(repository.updates, 0);
  }
});

test("never regresses processed or ignored events to retryable failures", async () => {
  for (const terminalStatus of ["processed", "ignored"] as const) {
    const repository = new FakeRepository();
    repository.onGetPayment = () => {
      const current = repository.events.get("evt_test_123");
      if (!current) throw new Error("missing event");
      current.processing_status = terminalStatus;
      current.processed_at = now.toISOString();
      throw new Error("transient storage error");
    };
    const result = await processVerifiedStripeWebhook(event("checkout.session.completed"), dependencies(repository));
    assert.equal(result.status, 200);
    assert.equal(repository.events.get("evt_test_123")?.processing_status, terminalStatus);
  }
});

test("permanent failures are final while retryable failures are processed on a later delivery", async () => {
  const permanent = new FakeRepository();
  permanent.events.set("evt_test_123", {
    stripe_event_id: "evt_test_123",
    processing_status: "failed",
    processed_at: now.toISOString(),
    order_id: null,
    error: "Payment does not match its Checkout Session.",
  });
  const finalDuplicate = await processVerifiedStripeWebhook(event("checkout.session.completed"), dependencies(permanent));
  assert.equal(finalDuplicate.status, 200);
  assert.equal(permanent.updates, 0);

  const retryable = new FakeRepository();
  retryable.events.set("evt_test_123", {
    stripe_event_id: "evt_test_123",
    processing_status: "failed",
    processed_at: null,
    order_id: null,
    error: "Payment webhook processing could not be completed.",
  });
  const retried = await processVerifiedStripeWebhook(event("checkout.session.completed"), dependencies(retryable));
  assert.equal(retried.status, 200);
  assert.equal(retryable.updates, 1);
  assert.equal(retryable.events.get("evt_test_123")?.processing_status, "processed");
});

test("requires matching event, Session, and payment livemode", async () => {
  for (const sessionLivemode of [true, undefined, "false"]) {
    const repository = new FakeRepository();
    const result = await processVerifiedStripeWebhook(
      event("checkout.session.completed", { livemode: sessionLivemode }),
      dependencies(repository),
    );
    assert.equal(result.status, 200);
    assert.equal(repository.currentPayment?.payment_status, "checkout_open");
    assert.equal(repository.events.get("evt_test_123")?.processing_status, "failed");
    assert.notEqual(repository.events.get("evt_test_123")?.processed_at, null);
  }
});

test("marks complete paid and async succeeded Sessions as paid, but ignores completed unpaid Sessions", async () => {
  for (const [type, expectedStatus] of [
    ["checkout.session.completed", "paid"],
    ["checkout.session.async_payment_succeeded", "paid"],
    ["checkout.session.completed", "checkout_open"],
  ] as const) {
    const repository = new FakeRepository();
    const candidate = expectedStatus === "paid"
      ? event(type, {}, { id: `evt_${type}` })
      : event(type, { payment_status: "unpaid" }, { id: `evt_${type}` });
    const result = await processVerifiedStripeWebhook(candidate, dependencies(repository));
    assert.equal(result.status, 200);
    assert.equal(repository.currentPayment?.payment_status, expectedStatus);
    assert.equal(
      repository.events.get(candidate.id)?.processing_status,
      expectedStatus === "paid" ? "processed" : "ignored",
    );
  }
});

test("accepts an inclusive Checkout total with no tax", async () => {
  const repository = new FakeRepository();
  const result = await processVerifiedStripeWebhook(
    event("checkout.session.completed", {
      amount_subtotal: 1350,
      amount_total: 1350,
      total_details: {
        amount_tax: 0,
        amount_discount: 0,
        amount_shipping: 0,
      },
    }),
    dependencies(repository),
  );

  assert.equal(result.status, 200);
  assert.equal(repository.currentPayment?.payment_status, "paid");
  assert.equal(repository.currentPayment?.tax_cents, 0);
  assert.equal(repository.currentPayment?.total_cents, 1350);
});

test("accepts positive inclusive tax contained within the authoritative total", async () => {
  const repository = new FakeRepository();
  const result = await processVerifiedStripeWebhook(
    event("checkout.session.completed", {
      amount_subtotal: 1350,
      amount_total: 1350,
      total_details: {
        amount_tax: 100,
        amount_discount: 0,
        amount_shipping: 0,
      },
    }),
    dependencies(repository),
  );

  assert.equal(result.status, 200);
  assert.equal(repository.currentPayment?.payment_status, "paid");
  assert.equal(repository.currentPayment?.tax_cents, 100);
  assert.equal(repository.currentPayment?.total_cents, 1350);
});

test("rejects total, currency, Session, order, and livemode mismatches", async () => {
  const mismatches = [
    { id: "amount", session: { amount_total: 1450 } },
    { id: "currency", session: { currency: "eur" } },
    { id: "session", session: { id: "cs_test_other" } },
    { id: "payment-intent", session: { payment_intent: { id: "pi_test_other" } } },
    {
      id: "order",
      session: {
        client_reference_id: "33333333-3333-4333-8333-333333333333",
      },
    },
    { id: "livemode", session: { livemode: true } },
  ] as const;

  for (const mismatch of mismatches) {
    const repository = new FakeRepository();
    if (mismatch.id === "payment-intent") {
      repository.currentPayment = payment({
        stripe_payment_intent_id: "pi_test_123",
      });
    }
    const candidate = event(
      "checkout.session.completed",
      mismatch.session,
      { id: `evt_mismatch_${mismatch.id}` },
    );
    const result = await processVerifiedStripeWebhook(
      candidate,
      dependencies(repository),
    );

    assert.equal(result.status, 200);
    assert.equal(repository.currentPayment?.payment_status, "checkout_open");
    assert.notEqual(
      repository.events.get(candidate.id)?.processing_status,
      "processed",
    );
  }
});

test("failed and expired deliveries cannot regress a matching paid payment", async () => {
  for (const type of ["checkout.session.async_payment_failed", "checkout.session.expired"]) {
    const repository = new FakeRepository();
    repository.currentPayment = payment({
      payment_status: "paid",
      stripe_payment_intent_id: "pi_test_123",
      tax_cents: 100,
      total_cents: 1350,
      paid_at: now.toISOString(),
    });
    const result = await processVerifiedStripeWebhook(
      event(type, { payment_status: "unpaid" }, { id: `evt_paid_${type}` }),
      dependencies(repository),
    );
    assert.equal(result.status, 200);
    assert.equal(repository.currentPayment?.payment_status, "paid");
    assert.equal(repository.events.get(`evt_paid_${type}`)?.processing_status, "processed");
  }
});

test("adopts an early Session ID only after payment validation and never duplicates the paid mutation", async () => {
  const repository = new FakeRepository();
  repository.currentPayment = payment({ stripe_checkout_session_id: null });
  const result = await processVerifiedStripeWebhook(event("checkout.session.completed"), dependencies(repository));
  assert.equal(result.status, 200);
  assert.equal(repository.currentPayment?.stripe_checkout_session_id, "cs_test_123");
  assert.equal(repository.updates, 1);
});

test("accepts an already-paid replay only when every immutable payment field matches", async () => {
  const matching = new FakeRepository();
  matching.currentPayment = payment({
    payment_status: "paid",
    stripe_payment_intent_id: "pi_test_123",
    stripe_customer_id: "cus_test_123",
    tax_cents: 100,
    total_cents: 1350,
    paid_at: now.toISOString(),
  });
  const replay = await processVerifiedStripeWebhook(
    event("checkout.session.completed", {}, { id: "evt_matching_paid" }),
    dependencies(matching),
  );
  assert.equal(replay.status, 200);
  assert.equal(matching.events.get("evt_matching_paid")?.processing_status, "processed");
  assert.equal(matching.updates, 0);

  for (const override of [{ currency: "eur" }, { subtotal_cents: 999 }]) {
    const conflict = new FakeRepository();
    conflict.currentPayment = payment({
      payment_status: "paid",
      stripe_payment_intent_id: "pi_test_123",
      stripe_customer_id: "cus_test_123",
      tax_cents: 100,
      total_cents: 1350,
      paid_at: now.toISOString(),
      ...override,
    });
    const result = await processVerifiedStripeWebhook(
      event("checkout.session.completed", {}, { id: `evt_conflict_${override.currency ?? override.subtotal_cents}` }),
      dependencies(conflict),
    );
    assert.equal(result.status, 200);
    assert.equal(conflict.events.get(`evt_conflict_${override.currency ?? override.subtotal_cents}`)?.processing_status, "failed");
  }
});

test("persists only reconciliation metadata and sanitized static errors", async () => {
  const repository = new FakeRepository();
  repository.currentPayment = null;
  const candidate = event("checkout.session.completed", {
    customer: { email: "customer@example.com", address: { line1: "private" } },
    payment_method_types: ["card"],
  });
  const result = await processVerifiedStripeWebhook(candidate, dependencies(repository));
  assert.equal(result.status, 500);
  const serialized = JSON.stringify([...repository.events.values(), repository.registrations]);
  assert.equal(serialized.includes("customer@example.com"), false);
  assert.equal(serialized.includes("private"), false);
  assert.equal(serialized.includes("payment_method_types"), false);
});

test("refund.created synchronizes partial refunds and duplicate events are idempotent", async () => {
  const repository = new FakeRepository();
  repository.currentPayment = paidPayment();
  const candidate = refundEvent("refund.created");

  const first = await processVerifiedStripeWebhook(candidate, dependencies(repository));
  assert.equal(first.status, 200);
  assert.equal(repository.currentPayment.refund_status, "partial");
  assert.equal(repository.currentPayment.refunded_amount_cents, 500);
  assert.equal(repository.currentPayment.refunded_at, now.toISOString());
  assert.equal(repository.events.get(candidate.id)?.order_id, orderId);
  assert.equal(repository.updates, 1);

  const duplicate = await processVerifiedStripeWebhook(candidate, dependencies(repository));
  assert.equal(duplicate.status, 200);
  assert.equal(repository.currentPayment.refunded_amount_cents, 500);
  assert.equal(repository.updates, 1);
});

test("refund.created synchronizes a full aggregate refund", async () => {
  const repository = new FakeRepository();
  repository.currentPayment = paidPayment();
  const result = await processVerifiedStripeWebhook(
    refundEvent("refund.created", { amount: 1350 }),
    dependencies(repository, { amount_refunded: 1350, refunded: true }),
  );

  assert.equal(result.status, 200);
  assert.equal(repository.currentPayment.refund_status, "full");
  assert.equal(repository.currentPayment.refunded_amount_cents, 1350);
});

test("refund.updated advances an existing successful refund aggregate", async () => {
  const repository = new FakeRepository();
  repository.currentPayment = paidPayment({
    refund_status: "partial",
    refunded_amount_cents: 500,
    refunded_at: "2026-07-14T11:00:00.000Z",
  });
  const result = await processVerifiedStripeWebhook(
    refundEvent("refund.updated", { amount: 300 }),
    dependencies(repository, { amount_refunded: 800 }),
  );

  assert.equal(result.status, 200);
  assert.equal(repository.currentPayment.refund_status, "partial");
  assert.equal(repository.currentPayment.refunded_amount_cents, 800);
});

test("refund.failed is an idempotent operational event that preserves aggregate state", async () => {
  for (const current of [
    { refund_status: "none", refunded_amount_cents: 0, refunded_at: null },
    {
      refund_status: "partial",
      refunded_amount_cents: 500,
      refunded_at: "2026-07-14T11:00:00.000Z",
    },
    {
      refund_status: "full",
      refunded_amount_cents: 1350,
      refunded_at: "2026-07-14T11:00:00.000Z",
    },
  ] as const) {
    const repository = new FakeRepository();
    repository.currentPayment = paidPayment(current);
    const candidate = refundEvent("refund.failed", { amount: 100 });
    const before = { ...repository.currentPayment };

    const first = await processVerifiedStripeWebhook(candidate, dependencies(repository));
    const duplicate = await processVerifiedStripeWebhook(candidate, dependencies(repository));

    assert.equal(first.status, 200);
    assert.equal(duplicate.status, 200);
    assert.equal(repository.events.get(candidate.id)?.processing_status, "processed");
    assert.deepEqual(repository.currentPayment, before);
    assert.equal(repository.updates, 0);
  }
});

test("charge.refunded synchronizes partial and full aggregate refunds", async () => {
  for (const [amountRefunded, refunded, expectedStatus] of [
    [500, false, "partial"],
    [1350, true, "full"],
  ] as const) {
    const repository = new FakeRepository();
    repository.currentPayment = paidPayment();
    const result = await processVerifiedStripeWebhook(
      chargeRefundedEvent(
        { amount_refunded: amountRefunded, refunded },
        { id: `evt_charge_refunded_${amountRefunded}` },
      ),
      dependencies(repository),
    );

    assert.equal(result.status, 200);
    assert.equal(repository.currentPayment.refund_status, expectedStatus);
    assert.equal(repository.currentPayment.refunded_amount_cents, amountRefunded);
  }
});

test("out-of-order refund events can advance but never downgrade the Charge aggregate", async () => {
  const repository = new FakeRepository();
  repository.currentPayment = paidPayment();

  const partial = await processVerifiedStripeWebhook(
    refundEvent(
      "refund.created",
      {},
      { id: "evt_refund_order_partial", created: 1784020000 },
    ),
    dependencies(repository, { amount_refunded: 500 }),
  );
  assert.equal(partial.status, 200);
  assert.equal(repository.currentPayment.refund_status, "partial");
  assert.equal(repository.currentPayment.refunded_amount_cents, 500);

  const full = await processVerifiedStripeWebhook(
    chargeRefundedEvent(
      { amount_refunded: 1350, refunded: true },
      { id: "evt_refund_order_full" },
    ),
    dependencies(repository),
  );
  assert.equal(full.status, 200);
  assert.equal(repository.currentPayment.refund_status, "full");
  assert.equal(repository.currentPayment.refunded_amount_cents, 1350);
  const fullRefundedAt = repository.currentPayment.refunded_at;
  const updatesAfterFull = repository.updates;

  const delayedPartial = await processVerifiedStripeWebhook(
    refundEvent(
      "refund.created",
      {},
      { id: "evt_refund_order_delayed_partial", created: 1784020000 },
    ),
    dependencies(repository, { amount_refunded: 500 }),
  );
  assert.equal(delayedPartial.status, 200);
  assert.equal(repository.currentPayment.refund_status, "full");
  assert.equal(repository.currentPayment.refunded_amount_cents, 1350);
  assert.equal(repository.currentPayment.refunded_at, fullRefundedAt);
  assert.equal(repository.updates, updatesAfterFull);
});

test("refund reconciliation rejects Payment Intent, amount, currency, and livemode mismatches", async () => {
  const cases = [
    {
      id: "payment-intent",
      candidate: refundEvent("refund.created", {}, { id: "evt_refund_pi" }),
      charge: { payment_intent: "pi_test_other" },
    },
    {
      id: "amount",
      candidate: refundEvent("refund.created", {}, { id: "evt_refund_amount" }),
      charge: { amount: 1450 },
    },
    {
      id: "currency",
      candidate: refundEvent(
        "refund.created",
        { currency: "eur" },
        { id: "evt_refund_currency" },
      ),
      charge: {},
    },
    {
      id: "livemode",
      candidate: refundEvent(
        "refund.created",
        {},
        { id: "evt_refund_livemode", livemode: true },
      ),
      charge: { livemode: true },
    },
  ];

  for (const mismatch of cases) {
    const repository = new FakeRepository();
    repository.currentPayment = paidPayment();
    const result = await processVerifiedStripeWebhook(
      mismatch.candidate,
      dependencies(repository, mismatch.charge),
    );

    assert.equal(result.status, 200, mismatch.id);
    assert.equal(repository.currentPayment.refund_status, "none", mismatch.id);
    assert.equal(repository.currentPayment.refunded_amount_cents, 0, mismatch.id);
    assert.equal(
      repository.events.get(mismatch.candidate.id)?.processing_status,
      "failed",
      mismatch.id,
    );
  }
});

test("malformed refund events are terminal and cannot mutate payment state", async () => {
  const repository = new FakeRepository();
  repository.currentPayment = paidPayment();
  const candidate = refundEvent(
    "refund.created",
    { amount: "500" },
    { id: "evt_refund_malformed" },
  );

  const result = await processVerifiedStripeWebhook(candidate, dependencies(repository));
  assert.equal(result.status, 200);
  assert.equal(repository.events.get(candidate.id)?.processing_status, "failed");
  assert.equal(repository.currentPayment.refund_status, "none");
  assert.equal(repository.updates, 0);
});
