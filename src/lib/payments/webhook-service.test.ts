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
const now = new Date("2026-07-14T12:00:00.000Z");
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
    checkout_expires_at: "2026-07-14T12:30:00.000Z",
    paid_at: null,
    ...overrides,
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
        amount_total: 1450,
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

class FakeRepository {
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

test("failed and expired deliveries cannot regress a matching paid payment", async () => {
  for (const type of ["checkout.session.async_payment_failed", "checkout.session.expired"]) {
    const repository = new FakeRepository();
    repository.currentPayment = payment({
      payment_status: "paid",
      stripe_payment_intent_id: "pi_test_123",
      tax_cents: 100,
      total_cents: 1450,
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
    total_cents: 1450,
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
      total_cents: 1450,
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
