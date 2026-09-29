import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { WELCOME_OFFER_PUBLIC_COPY } from "../../lib/welcome-offer.ts";

const source = (path: string) => readFileSync(path, "utf8");

test("authenticated dedicated order pages server-load current eligibility", () => {
  for (const path of [
    "src/app/(default)/(dashboard)/dashboard/orders/new/(ordering)/virtual-staging/page.tsx",
    "src/app/(default)/(dashboard)/dashboard/orders/new/(ordering)/image-enhancement/single-exposure/page.tsx",
    "src/app/(default)/(dashboard)/dashboard/orders/new/(ordering)/day-to-dusk/page.tsx",
  ]) {
    const page = source(path);
    assert.match(page, /getWelcomeOfferAvailability\(userId\)/);
    assert.match(page, /welcomeOfferAvailability=\{welcomeOfferAvailability\}/);
  }
});

test("shared order pricing keeps discounts separate and explains a free total", () => {
  for (const path of [
    "src/components/order/OrderSummary.tsx",
    "src/components/order/OrderReviewHeader.tsx",
  ]) {
    const presentation = source(path);
    const base = presentation.indexOf("Base subtotal");
    const addOns = presentation.indexOf(
      path.endsWith("OrderReviewHeader.tsx") ? "{addOnLabel}" : "Add-ons",
    );
    const welcome = presentation.indexOf("Welcome Offer");
    const volume = presentation.indexOf("Volume discount");
    const total = presentation.indexOf("Estimated total");
    assert.ok(base >= 0 && base < addOns);
    assert.ok(addOns < welcome);
    assert.ok(welcome < volume);
    assert.ok(volume < total);
    assert.match(presentation, /quote\.totalCents === 0/);
    assert.match(presentation, /No payment required/);
  }
});

test("no-payment-required state cannot render the Stripe payment action", () => {
  const panel = source("src/components/payments/OrderPaymentPanel.tsx");
  assert.match(panel, /summary\.state === "no_payment_required"/);
  assert.match(panel, /const canOpenCheckout = isPaymentRequired \|\| isProcessing/);
  assert.match(panel, /No payment required/);
  assert.match(panel, /No payment is due for this Welcome Offer order/);
});

test("approved public Welcome Offer copy is present in English and Spanish", () => {
  assert.equal(
    WELCOME_OFFER_PUBLIC_COPY.en.short,
    "Welcome Offer — 1 Image Enhancement free, 1 Day to Dusk free, and 50% off your first Virtual Staging image.",
  );
  assert.equal(
    WELCOME_OFFER_PUBLIC_COPY.es.short,
    "Oferta de bienvenida — 1 mejora de imagen gratis, 1 conversión Day to Dusk gratis y un 50 % de descuento en tu primera imagen de Virtual Staging.",
  );
  assert.match(WELCOME_OFFER_PUBLIC_COPY.en.rules, /once per account/);
  assert.match(WELCOME_OFFER_PUBLIC_COPY.es.rules, /una sola vez por cuenta/);
});

test("eligible review flows submit an expectation built from their displayed quote", () => {
  for (const path of [
    "src/components/order/virtual-staging/VirtualStagingOrderForm.tsx",
    "src/components/order/image-enhancement/SingleExposureOrderForm.tsx",
    "src/components/order/day-to-dusk/DayToDuskOrderForm.tsx",
  ]) {
    const form = source(path);
    assert.match(form, /createPricingExpectation\(/);
    assert.match(form, /calculateOrderQuote\(/);
    assert.match(form, /activeWelcomeOfferAvailability/);
    assert.match(form, /submit(?:VirtualStagingDraft|Order)\(/);
  }
});

test("pricing conflicts reconcile the current benefit from the authoritative snapshot", () => {
  for (const path of [
    "src/components/order/virtual-staging/VirtualStagingOrderForm.tsx",
    "src/components/order/image-enhancement/SingleExposureOrderForm.tsx",
    "src/components/order/day-to-dusk/DayToDuskOrderForm.tsx",
  ]) {
    const form = source(path);
    assert.match(form, /applyAuthoritativeWelcomeOfferSnapshot\(/);
    assert.match(form, /currentPricingSnapshot/);
    assert.doesNotMatch(
      form,
      /errorCode === "pricing-changed"[\s\S]{0,220}(?:virtualStagingAvailable|imageEnhancementAvailable|dayToDuskAvailable): false/,
    );
  }
});
