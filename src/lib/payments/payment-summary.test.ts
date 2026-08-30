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

const { getAuthoritativePaymentSummary } = await import("./payment-summary.ts");
const { PRICING_VERSION } = await import("../pricing/catalog.ts");
const orderId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: orderId,
    order_number: "VS-0042",
    user_id: userId,
    client_email: "customer@example.com",
    status: "pending",
    service_type: "virtual-staging",
    item_count: 1,
    estimated_total_cents: 1500,
    currency: "USD",
    pricing_snapshot: {
      pricingVersion: PRICING_VERSION,
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
      items: [],
      pricedAt: "2026-08-24T12:00:00.000Z",
    },
    ...overrides,
  };
}

function noPaymentOrder(overrides: Record<string, unknown> = {}) {
  return order({
    service_type: "photo-editing",
    estimated_total_cents: 0,
    pricing_snapshot: {
      pricingVersion: PRICING_VERSION,
      currency: "USD",
      serviceType: "photo-editing",
      eligibleUnits: 1,
      volumeEligibleUnits: 0,
      baseSubtotalCents: 100,
      addOnSubtotalCents: 0,
      welcomeDiscountCents: 100,
      welcomeOffer: {
        version: "2026-08-29",
        totalDiscountCents: 100,
        benefits: [{ key: "image-enhancement-free", itemIndex: 0, priceKey: "image-enhancement", discountPercent: 100, discountCents: 100 }],
      },
      volumeDiscountPercent: 0,
      volumeDiscountCents: 0,
      subtotalAfterDiscountCents: 0,
      taxCalculated: false,
      taxCents: 0,
      totalCents: 0,
      customQuote: false,
      items: [{ itemIndex: 0, quantity: 1, priceKey: "image-enhancement", unitPriceCents: 100, baseSubtotalCents: 100, addOns: [], addOnSubtotalCents: 0, lineSubtotalCents: 100 }],
      pricedAt: "2026-08-29T12:00:00.000Z",
    },
    ...overrides,
  });
}

function payment(overrides: Record<string, unknown> = {}) {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    order_id: orderId,
    provider: "stripe",
    payment_status: "pending",
    refund_status: "none",
    refunded_amount_cents: 0,
    subtotal_cents: 1500,
    tax_cents: null,
    total_cents: null,
    currency: "usd",
    stripe_checkout_session_id: null,
    stripe_payment_intent_id: null,
    stripe_livemode: false,
    checkout_attempt: 0,
    checkout_expires_at: null,
    paid_at: null,
    ...overrides,
  };
}

function repository(
  currentOrder: ReturnType<typeof order> | null,
  currentPayment: ReturnType<typeof payment> | null,
) {
  return {
    getOrder: async () => currentOrder,
    getPayment: async () => currentPayment,
  };
}

test("returns an authoritative fixed-price payment-required summary", async () => {
  const summary = await getAuthoritativePaymentSummary(orderId, userId, {
    repository: repository(order(), null) as never,
    expectedStripeLivemode: false,
  });
  assert.deepEqual(summary, {
    orderId,
    orderNumber: "VS-0042",
    serviceLabel: "Virtual Staging",
    itemCount: 1,
    finalTotalCents: 1500,
    currency: "USD",
    paymentStatus: null,
    state: "payment_required",
  });
});

test("reports trusted zero-total Welcome Offer as no payment required without a paid record", async () => {
  const summary = await getAuthoritativePaymentSummary(orderId, userId, {
    repository: repository(noPaymentOrder(), null) as never,
    expectedStripeLivemode: false,
  });
  assert.deepEqual(summary, {
    orderId,
    orderNumber: "VS-0042",
    serviceLabel: "Photo Editing",
    itemCount: 1,
    finalTotalCents: 0,
    currency: "USD",
    paymentStatus: null,
    state: "no_payment_required",
  });
});

test("uses only persisted payment state for processing and Paid", async () => {
  const processing = await getAuthoritativePaymentSummary(orderId, userId, {
    repository: repository(order(), payment({ payment_status: "checkout_open" })) as never,
    expectedStripeLivemode: false,
  });
  assert.equal(processing?.state, "processing");

  const paid = await getAuthoritativePaymentSummary(orderId, userId, {
    repository: repository(order(), payment({
      payment_status: "paid",
      tax_cents: 100,
      total_cents: 1500,
      stripe_checkout_session_id: "cs_test_paid",
      stripe_payment_intent_id: "pi_test_paid",
      paid_at: "2026-08-24T12:05:00.000Z",
    })) as never,
    expectedStripeLivemode: false,
  });
  assert.equal(paid?.state, "paid");

  const incompletePaidRecord = await getAuthoritativePaymentSummary(orderId, userId, {
    repository: repository(order(), payment({
      payment_status: "paid",
      paid_at: "2026-08-24T12:05:00.000Z",
    })) as never,
    expectedStripeLivemode: false,
  });
  assert.equal(incompletePaidRecord?.state, "payment_required");
  assert.equal(incompletePaidRecord?.paymentStatus, null);
});

test("reports verified partial and full refunds from persisted payment state", async () => {
  const paidRecord = {
    payment_status: "paid",
    tax_cents: 100,
    total_cents: 1500,
    stripe_checkout_session_id: "cs_test_paid",
    stripe_payment_intent_id: "pi_test_paid",
    paid_at: "2026-08-24T12:05:00.000Z",
  };
  const partiallyRefunded = await getAuthoritativePaymentSummary(orderId, userId, {
    repository: repository(order(), payment({
      ...paidRecord,
      refund_status: "partial",
      refunded_amount_cents: 500,
    })) as never,
    expectedStripeLivemode: false,
  });
  const refunded = await getAuthoritativePaymentSummary(orderId, userId, {
    repository: repository(order(), payment({
      ...paidRecord,
      refund_status: "full",
      refunded_amount_cents: 1500,
    })) as never,
    expectedStripeLivemode: false,
  });

  assert.equal(partiallyRefunded?.state, "partially_refunded");
  assert.equal(partiallyRefunded?.paymentStatus, "paid");
  assert.equal(refunded?.state, "refunded");
  assert.equal(refunded?.paymentStatus, "paid");
});

test("does not report Paid from a different Stripe environment", async () => {
  const summary = await getAuthoritativePaymentSummary(orderId, userId, {
    repository: repository(order(), payment({
      payment_status: "paid",
      tax_cents: 100,
      total_cents: 1500,
      stripe_checkout_session_id: "cs_test_paid",
      stripe_payment_intent_id: "pi_test_paid",
      stripe_livemode: false,
      paid_at: "2026-08-24T12:05:00.000Z",
    })) as never,
    expectedStripeLivemode: true,
  });

  assert.equal(summary?.state, "not_available");
  assert.equal(summary?.paymentStatus, null);
});

test("keeps expired and failed attempts safely retryable", async () => {
  for (const paymentStatus of ["expired", "failed"] as const) {
    const summary = await getAuthoritativePaymentSummary(orderId, userId, {
      repository: repository(order(), payment({ payment_status: paymentStatus })) as never,
      expectedStripeLivemode: false,
    });
    assert.equal(summary?.state, "payment_required");
  }
});

test("rejects ownership failure and payment/snapshot mismatches", async () => {
  const wrongOwner = await getAuthoritativePaymentSummary(orderId, "other-user", {
    repository: repository(order(), null) as never,
    expectedStripeLivemode: false,
  });
  assert.equal(wrongOwner, null);

  const mismatched = await getAuthoritativePaymentSummary(orderId, userId, {
    repository: repository(order(), payment({ subtotal_cents: 1 })) as never,
    expectedStripeLivemode: false,
  });
  assert.equal(mismatched?.state, "not_available");
  assert.equal(mismatched?.paymentStatus, null);
});

test("does not invent a total or Checkout CTA for custom-quote orders", async () => {
  const customQuoteOrder = order({
    estimated_total_cents: 0,
    pricing_snapshot: {
      ...order().pricing_snapshot,
      eligibleUnits: 50,
      subtotalAfterDiscountCents: null,
      totalCents: null,
      customQuote: true,
    },
  });
  const summary = await getAuthoritativePaymentSummary(orderId, userId, {
    repository: repository(customQuoteOrder, null) as never,
    expectedStripeLivemode: false,
  });
  assert.equal(summary?.finalTotalCents, null);
  assert.equal(summary?.currency, null);
  assert.equal(summary?.state, "not_available");
});
