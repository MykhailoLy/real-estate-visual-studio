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

const { handleStripeWebhookRequest } = await import("./webhook-request.ts");
const orderId = "11111111-1111-4111-8111-111111111111";
const now = new Date("2026-08-25T00:00:00.000Z");

type StoredEvent = {
  stripe_event_id: string;
  processing_status: "received" | "processed" | "ignored" | "failed";
  processed_at: string | null;
  order_id: string | null;
};

class FakeRepository {
  events = new Map<string, StoredEvent>();
  payment = {
    id: "22222222-2222-4222-8222-222222222222",
    order_id: orderId,
    provider: "stripe" as const,
    payment_status: "checkout_open" as "checkout_open" | "paid",
    refund_status: "none" as const,
    refunded_amount_cents: 0,
    refunded_at: null,
    subtotal_cents: 100,
    tax_cents: null as number | null,
    total_cents: null as number | null,
    currency: "eur",
    stripe_checkout_session_id: "cs_live_test",
    stripe_payment_intent_id: null as string | null,
    stripe_customer_id: null as string | null,
    stripe_livemode: true,
    checkout_expires_at: now.toISOString() as string | null,
    paid_at: null as string | null,
  };

  async registerEvent(input: { stripeEventId: string }) {
    if (this.events.has(input.stripeEventId)) return null;
    const stored: StoredEvent = {
      stripe_event_id: input.stripeEventId,
      processing_status: "received",
      processed_at: null,
      order_id: null,
    };
    this.events.set(input.stripeEventId, stored);
    return stored;
  }

  async getEvent(stripeEventId: string) {
    return this.events.get(stripeEventId) ?? null;
  }

  async finishEvent(input: {
    stripeEventId: string;
    status: "processed" | "ignored" | "failed";
    processedAt: string | null;
    orderId: string | null;
  }) {
    const stored = this.events.get(input.stripeEventId);
    if (!stored || stored.processing_status !== "received") return false;
    stored.processing_status = input.status;
    stored.processed_at = input.processedAt;
    stored.order_id = input.orderId;
    return true;
  }

  async getPayment() {
    return this.payment;
  }

  async getPaymentByPaymentIntent() {
    return null;
  }

  async markPaid(input: {
    stripeCheckoutSessionId: string;
    stripePaymentIntentId: string;
    stripeCustomerId: string | null;
    taxCents: number;
    totalCents: number;
    paidAt: string;
  }) {
    this.payment.payment_status = "paid";
    this.payment.stripe_checkout_session_id = input.stripeCheckoutSessionId;
    this.payment.stripe_payment_intent_id = input.stripePaymentIntentId;
    this.payment.stripe_customer_id = input.stripeCustomerId;
    this.payment.tax_cents = input.taxCents;
    this.payment.total_cents = input.totalCents;
    this.payment.paid_at = input.paidAt;
    this.payment.checkout_expires_at = null;
    return true;
  }

  async markFailed() {
    return false;
  }

  async markExpired() {
    return false;
  }

  async syncRefund() {
    return false;
  }
}

function paidEvent(paymentStatus: "paid" | "unpaid" = "paid") {
  return {
    id: "evt_live_payment",
    type: "checkout.session.completed",
    livemode: true,
    created: 1787616000,
    data: {
      object: {
        id: "cs_live_test",
        object: "checkout.session",
        client_reference_id: orderId,
        metadata: { picchuspot_order_id: orderId },
        livemode: true,
        currency: "eur",
        amount_subtotal: 100,
        amount_total: 100,
        payment_status: paymentStatus,
        status: "complete",
        payment_intent: "pi_live_test",
        customer: null,
        total_details: {
          amount_tax: 17,
          amount_discount: 0,
          amount_shipping: 0,
        },
      },
    },
  };
}

function dependencies(repository: FakeRepository) {
  return {
    repository,
    retrieveCharge: async () => ({}),
    now: () => now,
    getWebhookSecret: () => "whsec_test",
    verifyEvent: () => paidEvent(),
  };
}

test("dispatches the durable order outbox only after a paid event is stored as processed", async () => {
  const repository = new FakeRepository();
  const dispatched: string[] = [];
  const result = await handleStripeWebhookRequest(
    { rawBody: "raw", stripeSignature: "signature" },
    {
      ...dependencies(repository),
      dispatchOrderEmailOutbox: async (candidateOrderId) => {
        assert.equal(repository.events.get("evt_live_payment")?.processing_status, "processed");
        dispatched.push(candidateOrderId);
      },
    },
  );

  assert.equal(result.status, 200);
  assert.deepEqual(dispatched, [orderId]);
  assert.equal(repository.payment.payment_status, "paid");
});

test("does not dispatch a payment confirmation for completed but unpaid Checkout", async () => {
  const repository = new FakeRepository();
  const dispatched: string[] = [];
  const result = await handleStripeWebhookRequest(
    { rawBody: "raw", stripeSignature: "signature" },
    {
      ...dependencies(repository),
      verifyEvent: () => paidEvent("unpaid"),
      dispatchOrderEmailOutbox: async (candidateOrderId) => {
        dispatched.push(candidateOrderId);
      },
    },
  );

  assert.equal(result.status, 200);
  assert.deepEqual(dispatched, []);
  assert.equal(repository.events.get("evt_live_payment")?.processing_status, "ignored");
});

test("email dispatch failure never changes the successful Stripe webhook acknowledgement", async () => {
  const repository = new FakeRepository();
  const originalError = console.error;
  console.error = () => {};
  try {
    const result = await handleStripeWebhookRequest(
      { rawBody: "raw", stripeSignature: "signature" },
      {
        ...dependencies(repository),
        dispatchOrderEmailOutbox: async () => {
          throw new Error("temporary email failure");
        },
      },
    );
    assert.equal(result.status, 200);
    assert.equal(repository.payment.payment_status, "paid");
  } finally {
    console.error = originalError;
  }
});
