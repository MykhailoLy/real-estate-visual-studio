import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
    if (specifier.startsWith("./") && !specifier.endsWith(".ts")) {
      return {
        url: new URL(`${specifier}.ts`, context.parentURL).href,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const { renderClientConfirmation } = await import("./order-client-confirmation.ts");
const { renderAdminNotification } = await import("./order-admin-notification.ts");
const { renderPaymentConfirmation } = await import("./order-payment-confirmation.ts");
const { calculateOrderQuote } = await import("../pricing/calculate.ts");
const { createPricingSnapshot } = await import("../pricing/snapshot.ts");
const PAYMENT_EMAIL_MIGRATION = readFileSync(
  "supabase/add-payment-confirmation-email.sql",
  "utf8",
);
const SEND_ORDER_EMAILS_SOURCE = readFileSync(
  "src/lib/email/send-order-emails.ts",
  "utf8",
);

function snapshot(customQuote = false) {
  return {
    pricingVersion: "2026-09-09-v4",
      partnerClient: false, partnerDiscountPercent: 0, partnerEligibleSubtotalCents: 0, partnerDiscountCents: 0,
    currency: "USD" as const,
    serviceType: "virtual-staging" as const,
    eligibleUnits: customQuote ? 50 : 1,
    volumeEligibleUnits: customQuote ? 50 : 1,
    baseSubtotalCents: customQuote ? 0 : 1500,
    addOnSubtotalCents: 0,
    welcomeDiscountCents: 0,
    welcomeOffer: {
      version: "2026-08-29",
      totalDiscountCents: 0,
      benefits: [],
    },
    volumeDiscountPercent: 0,
    volumeDiscountCents: 0,
    subtotalAfterDiscountCents: customQuote ? null : 1500,
    taxCalculated: false as const,
    taxCents: 0 as const,
    totalCents: customQuote ? null : 1500,
    customQuote,
    items: [],
    pricedAt: "2026-08-24T12:00:00.000Z",
  };
}

function clientInput(hasFixedCheckoutPrice: boolean) {
  return {
    orderNumber: "VS-0042",
    serviceType: "virtual-staging" as const,
    clientName: "A Client",
    clientEmail: "client@example.com",
    clientOrderUrl: "https://picchuspot.com/dashboard/jobs/11111111-1111-4111-8111-111111111111",
    itemCount: 1,
    estimatedTotalCents: hasFixedCheckoutPrice ? 1500 : 0,
    currency: "USD" as const,
    pricingSnapshot: snapshot(!hasFixedCheckoutPrice),
    hasFixedCheckoutPrice,
    earlyPerformanceRequest: { requested: true },
    items: [{
      index: 0,
      details: {
        room_name: "Living Room",
        additional_info: "Keep the fireplace visible",
      },
      subtotalCents: hasFixedCheckoutPrice ? 1500 : 0,
    }],
  };
}

test("client and admin confirmations display committed Partner, Welcome and Volume evidence", () => {
  const pricingSnapshot = createPricingSnapshot(calculateOrderQuote({ serviceType: "virtual-staging", currency: "USD", items: Array.from({ length: 10 }, () => ({ selectedAddons: [] })) }, {
    partnerClient: true, welcomeOfferAvailability: { virtualStagingAvailable: true, imageEnhancementAvailable: false, dayToDuskAvailable: false },
  }));
  for (const rendered of [
    renderClientConfirmation({ ...clientInput(true), pricingSnapshot, estimatedTotalCents: pricingSnapshot.totalCents! }),
    renderAdminNotification({ ...adminInput(true), pricingSnapshot, estimatedTotalCents: pricingSnapshot.totalCents! }),
  ]) {
    for (const content of [rendered.text, rendered.html]) {
      assert.match(content, /Partner pricing · 10%/);
      assert.match(content, /15\.39/);
      assert.match(content, /148\.01/);
      assert.match(content, /Welcome Offer/);
      assert.match(content, /Volume discount/);
      assert.match(content, /Any applicable tax is included/);
    }
  }
});

function adminInput(hasFixedCheckoutPrice: boolean) {
  return {
    orderNumber: "VS-0042",
    serviceType: "virtual-staging" as const,
    client: {
      name: "A Client",
      email: "client@example.com",
      phone: "+1 555 0100",
    },
    itemCount: 1,
    estimatedTotalCents: hasFixedCheckoutPrice ? 1500 : 0,
    currency: "USD" as const,
    pricingSnapshot: snapshot(!hasFixedCheckoutPrice),
    hasFixedCheckoutPrice,
    termsAcceptance: {
      accepted: true,
      version: "2026-01",
      accepted_at: "2026-08-24T12:00:00.000Z",
    },
    earlyPerformanceRequest: {
      requested: true,
      version: "2026-08-30",
      requested_at: "2026-08-24T12:00:01.000Z",
    },
    portfolioPermission: { allowed: false },
    items: [{
      index: 0,
      details: {
        room_name: "Living Room",
        additional_info: "Keep the fireplace visible",
      },
      subtotalCents: hasFixedCheckoutPrice ? 1500 : 0,
      files: {
        originalPath: "orders/source/living-room.jpg",
        referenceImagePath: null,
        originalFilename: null,
        referenceFilename: null,
        originalSizeBytes: null,
        referenceSizeBytes: null,
        originalDownloadUrl: null,
        referenceDownloadUrl: null,
      },
    }],
  };
}

const staleCopy = [
  "Estimated total before tax",
  "Taxes calculated separately where applicable.",
  "We confirm the final price and send an invoice.",
  "Once paid, our team begins work immediately.",
  "24-48 hours",
];

test("fixed-price client email uses the inclusive final total and Checkout next steps", () => {
  const rendered = renderClientConfirmation(clientInput(true));
  const combined = `${rendered.text}\n${rendered.html}`;

  assert.match(rendered.text, /Final total: \$15\.00 USD/);
  assert.match(rendered.text, /Subtotal: \$15\.00/);
  assert.match(rendered.html, /Subtotal/);
  assert.match(rendered.html, /\$15\.00/);
  assert.match(combined, /Any applicable tax is included in this amount\./);
  assert.match(combined, /Complete secure payment from the PicchuSpot order page\./);
  assert.match(combined, /Work begins after payment has been verified\./);
  assert.match(combined, /Start of service/);
  assert.match(
    combined,
    /You expressly asked PicchuSpot to begin work as soon as any required payment is confirmed, or after order confirmation where no payment is due/,
  );
  assert.match(
    combined,
    /Where consumer withdrawal rights apply, you acknowledged that if you withdraw after work has started, you may have to pay a proportionate amount for the service already provided, and that you will lose the right of withdrawal once the service has been fully performed/,
  );
  assert.doesNotMatch(
    combined,
    /acknowledged the consequences described in the order confirmation/,
  );
  assert.match(combined, /View order \/ Pay securely/);
  assert.match(combined, /dashboard\/jobs\/11111111-1111-4111-8111-111111111111/);
  for (const stale of staleCopy) assert.doesNotMatch(combined, new RegExp(stale));
});

test("zero-total Welcome Offer email shows its discount and never asks for payment", () => {
  const input = clientInput(true);
  const rendered = renderClientConfirmation({
    ...input,
    estimatedTotalCents: 0,
    noPaymentRequired: true,
    pricingSnapshot: {
      ...input.pricingSnapshot,
      volumeEligibleUnits: 1,
      baseSubtotalCents: 100,
      welcomeDiscountCents: 100,
      welcomeOffer: {
        version: "2026-08-29",
        totalDiscountCents: 100,
        benefits: [{
          key: "image-enhancement-free",
          itemIndex: 0,
          priceKey: "image-enhancement",
          discountPercent: 100,
          discountCents: 100,
        }],
      },
      subtotalAfterDiscountCents: 0,
      totalCents: 0,
    },
  });
  const combined = `${rendered.text}\n${rendered.html}`;
  assert.match(combined, /Welcome Offer/);
  assert.match(combined, /No payment required/);
  assert.match(combined, /Work can begin after the order is confirmed/);
  assert.doesNotMatch(combined, /Complete secure payment/);
  assert.doesNotMatch(combined, /View order \/ Pay securely/);
});

test("manual-review client email does not advertise a fixed payment", () => {
  const rendered = renderClientConfirmation(clientInput(false));
  const combined = `${rendered.text}\n${rendered.html}`;

  assert.match(combined, /Manual review required/);
  assert.match(combined, /confirm the scope, price, and next step/);
  assert.match(combined, /Room: Living Room/);
  assert.match(combined, /Keep the fireplace visible/);
  for (const output of [rendered.text, rendered.html]) {
    assert.doesNotMatch(output, /Subtotal/);
    assert.doesNotMatch(output, /\$0\.00/);
    assert.doesNotMatch(output, /Pay securely/);
    assert.doesNotMatch(output, /Final total/);
  }
});

test("admin email calls the stored fixed amount final and inclusive", () => {
  const fixed = renderAdminNotification(adminInput(true));
  const fixedCombined = `${fixed.text}\n${fixed.html}`;
  assert.match(fixed.text, /Final total: \$15\.00 USD/);
  assert.match(fixed.text, /Subtotal: \$15\.00/);
  assert.match(fixed.html, /Subtotal/);
  assert.match(fixed.html, /\$15\.00/);
  assert.match(fixedCombined, /Any applicable tax is included in this amount\./);
  assert.match(fixedCombined, /START OF SERVICE/);
  assert.match(fixedCombined, /Requested: yes/);
  assert.match(fixedCombined, /2026-08-30/);
  assert.match(fixedCombined, /2026-08-24T12:00:01\.000Z/);
  assert.doesNotMatch(fixedCombined, /before tax/i);

  const manual = renderAdminNotification(adminInput(false));
  const manualCombined = `${manual.text}\n${manual.html}`;
  assert.match(manualCombined, /Manual review required/);
  assert.match(manualCombined, /Room: Living Room/);
  assert.match(manualCombined, /Keep the fireplace visible/);
  assert.match(manualCombined, /orders\/source\/living-room\.jpg/);
  assert.doesNotMatch(manualCombined, /before tax/i);
  for (const output of [manual.text, manual.html]) {
    assert.doesNotMatch(output, /Subtotal/);
    assert.doesNotMatch(output, /\$0\.00/);
    assert.doesNotMatch(output, /Pay securely/);
    assert.doesNotMatch(output, /Final total/);
  }
});

test("durable email payloads read early-performance evidence from persisted item details", () => {
  assert.match(
    SEND_ORDER_EMAILS_SOURCE,
    /earlyPerformanceRequest: readEarlyPerformanceRequest\(\s*items\[0\]\?\.details/,
  );
  assert.match(
    SEND_ORDER_EMAILS_SOURCE,
    /details\?\.early_performance_request/,
  );
  assert.match(
    SEND_ORDER_EMAILS_SOURCE,
    /acknowledged_loss_after_full_performance === true[\s\S]*acknowledged_proportionate_payment === true/,
  );
  assert.match(
    SEND_ORDER_EMAILS_SOURCE,
    /requested_at: stringOrNull\(request\.requested_at\)/,
  );
});

test("payment confirmation email reports the verified inclusive amount without promising production", () => {
  const rendered = renderPaymentConfirmation({
    orderNumber: "PE-0004",
    serviceType: "photo-editing",
    serviceLabelOverride: "Image Enhancement",
    jobTitle: "Live payment smoke test",
    clientName: "A Client",
    clientOrderUrl: "https://picchuspot.com/dashboard/jobs/11111111-1111-4111-8111-111111111111",
    currency: "EUR",
    totalCents: 100,
    taxCents: 17,
  });
  const combined = `${rendered.subject}\n${rendered.text}\n${rendered.html}`;

  assert.match(rendered.subject, /Payment confirmed for order PE-0004/);
  assert.match(combined, /Amount paid: €1\.00 EUR/);
  assert.match(combined, /Tax included: €0\.17 EUR/);
  assert.match(combined, /ready for our team to review before production begins/);
  assert.match(combined, /dashboard\/jobs\/11111111-1111-4111-8111-111111111111/);
  assert.doesNotMatch(combined, /Pay securely/);
  assert.doesNotMatch(combined, /invoice/i);
  assert.doesNotMatch(combined, /24-48 hours/i);
});

test("payment confirmation migration is additive, idempotent, and backward-compatible before deploy", () => {
  assert.match(
    PAYMENT_EMAIL_MIGRATION,
    /delivery_kind IN \([\s\S]*'client_confirmation'[\s\S]*'admin_notification'[\s\S]*'payment_confirmation'/,
  );
  assert.match(
    PAYMENT_EMAIL_MIGRATION,
    /FUNCTION public\.enqueue_order_payment_confirmation_email\([\s\S]*p_order_id UUID/,
  );
  assert.match(PAYMENT_EMAIL_MIGRATION, /RETURNS BOOLEAN/);
  assert.match(PAYMENT_EMAIL_MIGRATION, /SECURITY INVOKER/);
  assert.match(PAYMENT_EMAIL_MIGRATION, /FOR UPDATE/);
  assert.match(PAYMENT_EMAIL_MIGRATION, /v_payment\.provider IS DISTINCT FROM 'stripe'/);
  assert.match(PAYMENT_EMAIL_MIGRATION, /v_payment\.payment_status IS DISTINCT FROM 'paid'/);
  assert.match(PAYMENT_EMAIL_MIGRATION, /v_payment\.paid_at IS NULL/);
  assert.match(PAYMENT_EMAIL_MIGRATION, /v_payment\.refund_status IS DISTINCT FROM 'none'/);
  assert.match(PAYMENT_EMAIL_MIGRATION, /v_payment\.refunded_amount_cents IS DISTINCT FROM 0/);
  assert.match(PAYMENT_EMAIL_MIGRATION, /'payment-confirmed-' \|\| p_order_id::TEXT \|\| '-client-v1'/);
  assert.match(PAYMENT_EMAIL_MIGRATION, /ON CONFLICT \(order_id, delivery_kind\) DO NOTHING/);
  assert.match(PAYMENT_EMAIL_MIGRATION, /GRANT EXECUTE ON FUNCTION public\.enqueue_order_payment_confirmation_email\(UUID\)[\s\S]*TO service_role/);
  assert.doesNotMatch(PAYMENT_EMAIL_MIGRATION, /CREATE TRIGGER/i);
  assert.doesNotMatch(PAYMENT_EMAIL_MIGRATION, /INSERT INTO public\.order_email_deliveries[\s\S]*SELECT/i);
  assert.doesNotMatch(PAYMENT_EMAIL_MIGRATION, /UPDATE public\.orders/);
});
