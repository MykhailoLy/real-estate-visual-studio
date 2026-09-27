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
  assertAdminFulfillmentPaymentAllowed,
  assertAdminOrderStatusTransitionAllowed,
} = await import("./admin-status-gate.ts");
const { PRICING_VERSION } = await import("../pricing/catalog.ts");
const { calculateOrderQuote } = await import("../pricing/calculate.ts");
const { createPricingSnapshot } = await import("../pricing/snapshot.ts");

function subMinimumOrder(currency: "USD" | "EUR") {
  const snapshot = createPricingSnapshot(calculateOrderQuote({
    serviceType: "photo-editing", currency, items: [{
      dedicatedSubService: "image-enhancement-single-exposure", baseOptionId: "image-enhancement-re",
      selectedOptions: ["image-enhancement-re", "turn-on-lights-pe"],
    }],
  }, { partnerClient: true, welcomeOfferAvailability: {
    imageEnhancementAvailable: true, dayToDuskAvailable: false, virtualStagingAvailable: false,
  } }));
  assert.equal(snapshot.totalCents, 45);
  return { ...order(), service_type: "photo-editing", currency,
    estimated_total_cents: 45, pricing_snapshot: snapshot,
  };
}

test("F10: verified sub-minimum quotes retain manual fulfillment without Stripe configuration", () => {
  for (const currency of ["USD", "EUR"] as const) {
    const current = subMinimumOrder(currency);
    const original = structuredClone(current);
    const dependencies = { getExpectedStripeLivemode: () => { throw new Error("must not need Stripe"); } };
    for (const status of ["confirmed", "in-progress", "delivered"]) {
      assert.equal(assertAdminOrderStatusTransitionAllowed(current, null, status, dependencies), "manual_review");
    }
    assert.equal(assertAdminFulfillmentPaymentAllowed(current, null, dependencies), "manual_review");
    assert.deepEqual(current, original);
  }
});

test("F10: small totals do not exempt malformed snapshots, mismatched stored totals or currency", () => {
  const current = subMinimumOrder("USD");
  for (const invalid of [
    { ...current, estimated_total_cents: 44 },
    { ...current, currency: "EUR" },
    { ...current, pricing_snapshot: { ...current.pricing_snapshot, partnerDiscountCents: 0 } },
    { ...current, pricing_snapshot: { ...current.pricing_snapshot, totalCents: 44 } },
    { ...current, pricing_snapshot: { ...current.pricing_snapshot, items: [] } },
  ]) {
    assert.throws(() => assertAdminFulfillmentPaymentAllowed(invalid, null, {
      getExpectedStripeLivemode: () => false,
    }), AdminPaymentGateError);
  }
});

test("F10: sub-minimum manual exemption cannot bypass existing payment history", () => {
  for (const currentPayment of [
    payment({ payment_status: "checkout_open" }),
    paidPayment(false),
    payment({ ...paidPayment(false), refund_status: "partial", refunded_amount_cents: 500 }),
    payment({ ...paidPayment(false), refund_status: "full", refunded_amount_cents: 1500 }),
  ]) {
    assert.throws(() => assertAdminFulfillmentPaymentAllowed(subMinimumOrder("USD"), currentPayment as never, {
      getExpectedStripeLivemode: () => false,
    }), AdminPaymentGateError);
  }
});

const orderId = "11111111-1111-4111-8111-111111111111";

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: orderId,
    service_type: "virtual-staging",
    estimated_total_cents: 1500,
    currency: "USD",
    pricing_snapshot: {
      pricingVersion: "2026-09-09-v4",
      partnerClient: false, partnerDiscountPercent: 0, partnerEligibleSubtotalCents: 0, partnerDiscountCents: 0,
      currency: "USD",
      serviceType: "virtual-staging",
      eligibleUnits: 1,
      volumeEligibleUnits: 1,
      baseSubtotalCents: 1500,
      addOnSubtotalCents: 0,
      welcomeDiscountCents: 0,
      welcomeOffer: {
        version: "2026-08-29",
        totalDiscountCents: 0,
        benefits: [],
      },
      volumeDiscountPercent: 0,
      volumeDiscountCents: 0,
      subtotalAfterDiscountCents: 1500,
      taxCalculated: false,
      taxCents: 0,
      totalCents: 1500,
      customQuote: false,
      items: [{ itemIndex: 0, quantity: 1, priceKey: "virtual-staging", unitPriceCents: 1500, baseSubtotalCents: 1500, addOns: [], addOnSubtotalCents: 0, lineSubtotalCents: 1500 }],
      pricedAt: "2026-08-24T12:00:00.000Z",
    },
    ...overrides,
  };
}

function zeroTotalOrder(catalogPrice = 120) {
  return order({
    service_type: "photo-editing",
    estimated_total_cents: 0,
    pricing_snapshot: {
      pricingVersion: PRICING_VERSION,
      partnerClient: false, partnerDiscountPercent: 0, partnerEligibleSubtotalCents: 0, partnerDiscountCents: 0,
      currency: "USD",
      serviceType: "photo-editing",
      eligibleUnits: 1,
      volumeEligibleUnits: 1,
      baseSubtotalCents: catalogPrice,
      addOnSubtotalCents: 0,
      welcomeDiscountCents: catalogPrice,
      welcomeOffer: {
        version: "2026-08-29",
        totalDiscountCents: catalogPrice,
        benefits: [{ key: "image-enhancement-free", itemIndex: 0, priceKey: "image-enhancement", discountPercent: 100, discountCents: catalogPrice }],
      },
      volumeDiscountPercent: 0,
      volumeDiscountCents: 0,
      subtotalAfterDiscountCents: 0,
      taxCalculated: false,
      taxCents: 0,
      totalCents: 0,
      customQuote: false,
      items: [{ itemIndex: 0, quantity: 1, priceKey: "image-enhancement", unitPriceCents: catalogPrice, baseSubtotalCents: catalogPrice, addOns: [], addOnSubtotalCents: 0, lineSubtotalCents: catalogPrice }],
      pricedAt: "2026-08-29T12:00:00.000Z",
    },
  });
}

function payment(overrides: Record<string, unknown> = {}) {
  return {
    order_id: orderId,
    provider: "stripe",
    payment_status: "pending",
    refund_status: "none",
    refunded_amount_cents: 0,
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

test("trusted no-payment-required order can advance without Stripe state", () => {
  for (const status of ["confirmed", "in-progress", "delivered"]) {
    assert.equal(paymentGate(zeroTotalOrder(), null, status), "no_payment_required");
  }
});

test("tampered zero-total snapshot cannot use the production exemption", () => {
  assert.throws(
    () => paymentGate(zeroTotalOrder(99), null, "confirmed"),
    AdminPaymentGateError,
  );
});

test("malformed supported historical snapshots cannot bypass the payment gate", () => {
  for (const version of ["2026-06-25-v1", "2026-08-18-v1", "2026-08-23-v1", "2026-08-29-v2"]) {
    const current = order();
    current.pricing_snapshot = { ...current.pricing_snapshot, pricingVersion: version, totalCents: 99 };
    assert.throws(() => paymentGate(current, null, "confirmed"), AdminPaymentGateError);
  }
  const tamperedFree = zeroTotalOrder(99);
  tamperedFree.pricing_snapshot.pricingVersion = "2026-08-29-v2";
  tamperedFree.pricing_snapshot.volumeEligibleUnits = 0;
  assert.throws(() => paymentGate(tamperedFree, null, "confirmed"), AdminPaymentGateError);
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
      volumeEligibleUnits: 50,
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
    for (const status of ["confirmed", "in-progress", "delivered"]) {
      assert.throws(
        () => paymentGate(
          order(),
          payment({
            ...paidPayment(false),
            refund_status: refundStatus,
            refunded_amount_cents: refundStatus === "partial" ? 500 : 1500,
          }),
          status,
        ),
        (error: unknown) => {
          assert.ok(error instanceof AdminPaymentGateError);
          assert.equal(
            error.paymentState,
            refundStatus === "partial" ? "partially_refunded" : "refunded",
          );
          assert.match(error.message, /refunded/i);
          return true;
        },
      );
    }
  }
});
