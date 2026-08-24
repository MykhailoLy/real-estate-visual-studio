import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return {
        url: new URL(`../../${specifier.slice(2)}.ts`, import.meta.url).href,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const {
  AdminPaymentGateError,
  assertAdminOrderStatusTransitionAllowed,
} = await import("./admin-status-gate.ts");
const { PRICING_VERSION } = await import("../pricing/catalog.ts");

const orderId = "11111111-1111-4111-8111-111111111111";

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: orderId,
    service_type: "virtual-staging",
    estimated_total_cents: 1500,
    currency: "USD",
    pricing_snapshot: {
      pricingVersion: PRICING_VERSION,
      currency: "USD",
      serviceType: "virtual-staging",
      eligibleUnits: 1,
      baseSubtotalCents: 1500,
      addOnSubtotalCents: 0,
      volumeDiscountPercent: 0,
      volumeDiscountCents: 0,
      subtotalAfterDiscountCents: 1500,
      taxCalculated: false,
      taxCents: 0,
      totalCents: 1500,
      customQuote: false,
      items: [],
      pricedAt: "2026-08-24T12:00:00.000Z",
    },
    ...overrides,
  };
}

function payment(overrides: Record<string, unknown> = {}) {
  return {
    order_id: orderId,
    provider: "stripe",
    payment_status: "pending",
    refund_status: "none",
    subtotal_cents: 1500,
    tax_cents: null,
    total_cents: null,
    currency: "usd",
    stripe_checkout_session_id: "cs_test_123",
    stripe_payment_intent_id: null,
    stripe_livemode: false,
    paid_at: null,
    ...overrides,
  };
}

function paymentGate(
  currentOrder: ReturnType<typeof order>,
  currentPayment: ReturnType<typeof payment> | null,
  status: string,
  expectedStripeLivemode = false,
) {
  return assertAdminOrderStatusTransitionAllowed(
    currentOrder,
    currentPayment as never,
    status,
    { getExpectedStripeLivemode: () => expectedStripeLivemode },
  );
}

function assertPaymentGateRejects(status: string): void {
  assert.throws(
    () => paymentGate(order(), null, status),
    (error: unknown) => {
      assert.ok(error instanceof AdminPaymentGateError);
      assert.match(error.message, /matching Paid payment is required/);
      return true;
    },
  );
}

test("unpaid eligible order cannot become confirmed", () => {
  assertPaymentGateRejects("confirmed");
});

test("unpaid eligible order cannot become in-progress", () => {
  assertPaymentGateRejects("in-progress");
});

test("unpaid eligible order cannot become delivered", () => {
  assertPaymentGateRejects("delivered");
});

test("every persisted unpaid Checkout state remains gated", () => {
  for (const paymentStatus of ["pending", "checkout_open", "expired", "failed"] as const) {
    assert.throws(
      () => paymentGate(
        order(),
        payment({ payment_status: paymentStatus }) as never,
        "confirmed",
      ),
      AdminPaymentGateError,
    );
  }
});

test("paid matching eligible order can advance", () => {
  const paid = payment({
    payment_status: "paid",
    tax_cents: 100,
    total_cents: 1500,
    stripe_payment_intent_id: "pi_test_123",
    paid_at: "2026-08-24T12:05:00.000Z",
  });

  for (const status of ["confirmed", "in-progress", "delivered"]) {
    assert.equal(
      paymentGate(order(), paid, status),
      "paid",
    );
  }
});

test("mismatched paid payment cannot advance", () => {
  const mismatched = payment({
    payment_status: "paid",
    subtotal_cents: 1499,
    tax_cents: 100,
    total_cents: 1499,
    stripe_payment_intent_id: "pi_test_123",
    paid_at: "2026-08-24T12:05:00.000Z",
  });
  assert.throws(
    () => paymentGate(order(), mismatched, "confirmed"),
    AdminPaymentGateError,
  );
});

test("custom-quote and Checkout-ineligible orders preserve manual workflow", () => {
  const customQuote = order({
    estimated_total_cents: 0,
    pricing_snapshot: {
      ...order().pricing_snapshot,
      eligibleUnits: 50,
      subtotalAfterDiscountCents: null,
      totalCents: null,
      customQuote: true,
    },
  });
  assert.equal(
    paymentGate(customQuote, null, "confirmed"),
    "manual_review",
  );
  assert.equal(
    paymentGate(
      order({ service_type: "local-photography" }),
      null,
      "in-progress",
    ),
    "manual_review",
  );
});

test("cancelled remains possible for an unpaid eligible order", () => {
  assert.equal(
    paymentGate(order(), null, "cancelled"),
    "payment_required",
  );
});

function paidPayment(stripeLivemode: boolean) {
  return payment({
    payment_status: "paid",
    tax_cents: 100,
    total_cents: 1500,
    stripe_checkout_session_id: "cs_mode_123",
    stripe_payment_intent_id: "pi_mode_123",
    stripe_livemode: stripeLivemode,
    paid_at: "2026-08-24T12:05:00.000Z",
  });
}

test("live expected and live Paid is allowed", () => {
  assert.equal(paymentGate(order(), paidPayment(true), "confirmed", true), "paid");
});

test("live expected and test Paid is rejected", () => {
  assert.throws(
    () => paymentGate(order(), paidPayment(false), "confirmed", true),
    AdminPaymentGateError,
  );
});

test("test expected and test Paid is allowed", () => {
  assert.equal(paymentGate(order(), paidPayment(false), "confirmed", false), "paid");
});

test("test expected and live Paid is rejected", () => {
  assert.throws(
    () => paymentGate(order(), paidPayment(true), "confirmed", false),
    AdminPaymentGateError,
  );
});

test("already-persisted partial and full refunds cannot advance", () => {
  for (const refundStatus of ["partial", "full"] as const) {
    assert.throws(
      () => paymentGate(
        order(),
        payment({
          ...paidPayment(false),
          refund_status: refundStatus,
        }),
        "confirmed",
      ),
      AdminPaymentGateError,
    );
  }
});
