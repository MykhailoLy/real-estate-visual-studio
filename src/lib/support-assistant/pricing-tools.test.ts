import assert from "node:assert/strict";
import test from "node:test";
import { PRICING_VERSION } from "../pricing/catalog.ts";
import {
  GEMINI_SUPPORT_PRICING_TOOLS,
  SupportPricingToolValidationError,
  UnknownSupportPricingToolError,
  executeSupportPricingTool,
  getLocalServicePricing,
  getRemoteServiceQuote,
  type RemoteSupportPricingResult,
} from "./pricing-tools.ts";

function quoted(result: RemoteSupportPricingResult) {
  assert.equal(result.status, "quoted");
  return result;
}

test("remote tool quotes 3 USD Virtual Staging images canonically", () => {
  const result = quoted(
    getRemoteServiceQuote({
      service: "virtual-staging",
      quantity: 3,
      currency: "USD",
    }),
  );

  assert.equal(result.unitPriceCents, 1_500);
  assert.equal(result.baseSubtotalCents, 4_500);
  assert.equal(result.discountPercent, 0);
  assert.equal(result.discountAmountCents, 0);
  assert.equal(result.finalSubtotalBeforeTaxCents, 4_500);
  assert.equal(result.pricingVersion, PRICING_VERSION);
});

test("remote tool quotes 8 EUR Virtual Staging images with the canonical discount", () => {
  const result = quoted(
    getRemoteServiceQuote({
      service: "virtual-staging",
      quantity: 8,
      currency: "EUR",
    }),
  );

  assert.equal(result.baseSubtotalCents, 11_200);
  assert.equal(result.discountPercent, 5);
  assert.equal(result.discountAmountCents, 560);
  assert.equal(result.finalSubtotalBeforeTaxCents, 10_640);
});

test("remote tool quotes 10 USD Image Enhancement images", () => {
  const result = quoted(
    getRemoteServiceQuote({
      service: "image-enhancement",
      quantity: 10,
      currency: "USD",
    }),
  );

  assert.equal(result.unitPriceCents, 100);
  assert.equal(result.baseSubtotalCents, 1_000);
  assert.equal(result.discountPercent, 10);
  assert.equal(result.discountAmountCents, 100);
  assert.equal(result.finalSubtotalBeforeTaxCents, 900);
});

test("Virtual Staging add-ons remain full price", () => {
  const result = quoted(
    getRemoteServiceQuote({
      service: "virtual-staging",
      quantity: 8,
      currency: "EUR",
      addons: ["image-enhancement"],
    }),
  );

  assert.equal(result.baseSubtotalCents, 11_200);
  assert.equal(result.addOnSubtotalCents, 800);
  assert.equal(result.discountAmountCents, 560);
  assert.equal(result.finalSubtotalBeforeTaxCents, 11_440);
  assert.deepEqual(result.lineItems[1], {
    id: "image-enhancement",
    quantity: 8,
    unitPriceCents: 100,
    subtotalCents: 800,
  });
});

test("6 EUR 360 Virtual Staging panoramas receive no volume discount", () => {
  const result = quoted(
    getRemoteServiceQuote({
      service: "360-virtual-staging",
      quantity: 6,
      currency: "EUR",
    }),
  );

  assert.equal(result.unitPriceCents, 2_800);
  assert.equal(result.discountEligibility, "excluded");
  assert.equal(result.discountPercent, 0);
  assert.equal(result.discountAmountCents, 0);
  assert.equal(result.finalSubtotalBeforeTaxCents, 16_800);
});

test("Virtual Renovation remains preliminary and undiscounted", () => {
  const result = quoted(
    getRemoteServiceQuote({
      service: "virtual-renovation",
      quantity: 20,
      currency: "USD",
      renovation_options: ["replace-flooring", "add-fixtures"],
    }),
  );

  assert.equal(result.quoteKind, "preliminary");
  assert.equal(result.unitPriceCents, null);
  assert.equal(result.baseSubtotalCents, 0);
  assert.equal(result.addOnSubtotalCents, 68_000);
  assert.equal(result.discountEligibility, "excluded");
  assert.equal(result.discountPercent, 0);
  assert.equal(result.finalSubtotalBeforeTaxCents, 68_000);
});

test("CAD Aerial Full Markup uses its fixed canonical price", () => {
  const result = quoted(
    getRemoteServiceQuote({
      service: "aerial-full-markup",
      quantity: 1,
      currency: "CAD",
    }),
  );

  assert.equal(result.unitPriceCents, 750);
  assert.equal(result.finalSubtotalBeforeTaxCents, 750);
  assert.equal(
    result.currencyPolicy,
    "fixed-catalog-prices-not-live-conversion",
  );
});

test("local Photography returns canonical packages and extra-photo pricing", () => {
  const result = getLocalServicePricing({ service: "photography" });

  assert.equal(result.status, "priced");
  assert.equal(result.currency, "EUR");
  assert.deepEqual(
    result.packages.map((item) => item.priceCents),
    [9_900, 12_900, 16_900, 21_900],
  );
  assert.equal(result.extraUnit?.priceCents, 500);
  assert.equal(result.remoteVolumeDiscountsApplied, false);
});

test("local 360 pricing stays canonical and EUR-only", () => {
  const result = getLocalServicePricing({ service: "360-tours" });

  assert.equal(result.currency, "EUR");
  assert.deepEqual(
    result.packages.map((item) => item.priceCents),
    [12_900, 16_900],
  );
  assert.deepEqual(
    result.packages.map((item) => item.priceQualifier),
    ["from", "from"],
  );
});

test("local Video returns both canonical starting packages", () => {
  const result = getLocalServicePricing({ service: "video-tours" });

  assert.deepEqual(
    result.packages.map((item) => item.priceCents),
    [10_000, 29_900],
  );
  assert.match(result.packages[1]?.qualificationText ?? "", /vertical Reel/);
});

test("local Drone remains quote-only", () => {
  const result = getLocalServicePricing({ service: "drone-photography" });

  assert.equal(result.status, "quote-only");
  assert.equal(result.overviewPriceLabel, "Quote on request");
  assert.deepEqual(result.packages, []);
  assert.equal(result.extraUnit, null);
});

test("unsupported GBP, invalid services, quantities, and options are rejected", () => {
  const cases = [
    { service: "virtual-staging", quantity: 3, currency: "GBP" },
    { service: "not-a-service", quantity: 3, currency: "USD" },
    { service: "virtual-staging", quantity: 0, currency: "USD" },
    {
      service: "virtual-staging",
      quantity: 3,
      currency: "USD",
      addons: ["not-an-addon"],
    },
    {
      service: "image-enhancement",
      quantity: 3,
      currency: "USD",
      addons: ["image-enhancement"],
    },
  ];

  for (const argumentsValue of cases) {
    assert.throws(
      () => getRemoteServiceQuote(argumentsValue),
      SupportPricingToolValidationError,
    );
  }
});

test("customer-provided fake price fields cannot override the canonical result", () => {
  assert.throws(
    () =>
      getRemoteServiceQuote({
        service: "virtual-staging",
        quantity: 3,
        currency: "USD",
        unit_price_cents: 1,
      }),
    SupportPricingToolValidationError,
  );

  const result = quoted(
    getRemoteServiceQuote({
      service: "virtual-staging",
      quantity: 3,
      currency: "USD",
    }),
  );
  assert.equal(result.finalSubtotalBeforeTaxCents, 4_500);
});

test("50 or more eligible units return a typed manual-review result", () => {
  const result = getRemoteServiceQuote({
    service: "virtual-staging",
    quantity: 50,
    currency: "USD",
  });

  assert.deepEqual(result, {
    status: "manual-review",
    service: "virtual-staging",
    currency: "USD",
    quantity: 50,
    reasonCode: "custom-quote-quantity",
    explanation:
      "Orders of 50 or more eligible images or floors require a custom quote.",
    pricingVersion: PRICING_VERSION,
  });
});

test("local tool rejects extra currency fields instead of converting", () => {
  assert.throws(
    () =>
      getLocalServicePricing({
        service: "photography",
        currency: "USD",
      }),
    SupportPricingToolValidationError,
  );
});

test("tool executor uses an explicit allowlist", () => {
  assert.throws(
    () => executeSupportPricingTool("delete_order", {}),
    UnknownSupportPricingToolError,
  );
});

test("Gemini tool schemas use strict enumerated read-only arguments", () => {
  assert.deepEqual(
    GEMINI_SUPPORT_PRICING_TOOLS.map((tool) => {
      assert.equal(tool.type, "function");
      return tool.name;
    }),
    ["get_remote_service_quote", "get_local_service_pricing"],
  );
  for (const tool of GEMINI_SUPPORT_PRICING_TOOLS) {
    assert.equal(tool.type, "function");
    assert.equal(
      (tool.parameters as { additionalProperties?: boolean })
        .additionalProperties,
      false,
    );
  }
});
