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
const { PRICING_VERSION } = await import("../pricing/catalog.ts");

function snapshot(customQuote = false) {
  return {
    pricingVersion: PRICING_VERSION,
    currency: "USD" as const,
    serviceType: "virtual-staging" as const,
    eligibleUnits: customQuote ? 50 : 1,
    baseSubtotalCents: customQuote ? 0 : 1500,
    addOnSubtotalCents: 0,
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
    items: [{ index: 0, details: {}, subtotalCents: hasFixedCheckoutPrice ? 1500 : 0 }],
  };
}

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
    portfolioPermission: { allowed: false },
    items: [{
      index: 0,
      details: {},
      subtotalCents: hasFixedCheckoutPrice ? 1500 : 0,
      files: {
        originalPath: null,
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
  assert.match(combined, /Any applicable tax is included in this amount\./);
  assert.match(combined, /Complete secure payment from the PicchuSpot order page\./);
  assert.match(combined, /Work begins after payment has been verified\./);
  assert.match(combined, /View order \/ Pay securely/);
  assert.match(combined, /dashboard\/jobs\/11111111-1111-4111-8111-111111111111/);
  for (const stale of staleCopy) assert.doesNotMatch(combined, new RegExp(stale));
});

test("manual-review client email does not advertise a fixed payment", () => {
  const rendered = renderClientConfirmation(clientInput(false));
  const combined = `${rendered.text}\n${rendered.html}`;

  assert.match(combined, /Manual review required/);
  assert.match(combined, /confirm the scope, price, and next step/);
  assert.doesNotMatch(combined, /Pay securely/);
  assert.doesNotMatch(combined, /Final total/);
});

test("admin email calls the stored fixed amount final and inclusive", () => {
  const fixed = renderAdminNotification(adminInput(true));
  const fixedCombined = `${fixed.text}\n${fixed.html}`;
  assert.match(fixed.text, /Final total: \$15\.00 USD/);
  assert.match(fixedCombined, /Any applicable tax is included in this amount\./);
  assert.doesNotMatch(fixedCombined, /before tax/i);

  const manual = renderAdminNotification(adminInput(false));
  const manualCombined = `${manual.text}\n${manual.html}`;
  assert.match(manualCombined, /Manual review required/);
  assert.doesNotMatch(manualCombined, /Final total/);
  assert.doesNotMatch(manualCombined, /before tax/i);
});
