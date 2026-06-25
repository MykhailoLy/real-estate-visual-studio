import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateOrderQuote,
  PricingValidationError,
} from "./calculate.ts";
import { parsePricingSnapshot, createPricingSnapshot } from "./snapshot.ts";

function stagingItems(count: number, selectedAddons: string[] = []) {
  return Array.from({ length: count }, () => ({ selectedAddons }));
}

function photoItems(count: number, selectedOptions: string[]) {
  return Array.from({ length: count }, () => ({ selectedOptions }));
}

test("volume discount thresholds are exact", () => {
  const cases = [
    [1, 0, false],
    [4, 0, false],
    [5, 5, false],
    [9, 5, false],
    [10, 10, false],
    [19, 10, false],
    [20, 15, false],
    [49, 15, false],
    [50, 0, true],
    [51, 0, true],
  ] as const;

  for (const [count, percent, customQuote] of cases) {
    const quote = calculateOrderQuote({
      serviceType: "virtual-staging",
      currency: "USD",
      items: stagingItems(count),
    });
    assert.equal(quote.volumeDiscountPercent, percent);
    assert.equal(quote.customQuote, customQuote);
    assert.equal(quote.totalCents === null, customQuote);
  }
});

test("discount applies to base only and add-ons remain undiscounted", () => {
  const quote = calculateOrderQuote({
    serviceType: "virtual-staging",
    currency: "EUR",
    items: stagingItems(11, ["day-to-dusk"]),
  });

  assert.equal(quote.baseSubtotalCents, 13_200);
  assert.equal(quote.addOnSubtotalCents, 4_400);
  assert.equal(quote.volumeDiscountPercent, 10);
  assert.equal(quote.volumeDiscountCents, 1_320);
  assert.equal(quote.totalCents, 16_280);
});

test("generic Photo Editing uses the highest-priced option as the discounted base", () => {
  const quote = calculateOrderQuote({
    serviceType: "photo-editing",
    currency: "USD",
    items: photoItems(10, [
      "image-enhancement-re",
      "shadow-removal",
      "turn-on-lights-pe",
    ]),
  });

  assert.equal(quote.items[0].priceKey, "shadow-removal");
  assert.equal(quote.items[0].unitPriceCents, 700);
  assert.deepEqual(
    quote.items[0].addOns.map((addOn) => addOn.priceKey),
    ["image-enhancement", "turn-on-lights"]
  );
  assert.equal(quote.baseSubtotalCents, 7_000);
  assert.equal(quote.addOnSubtotalCents, 2_500);
  assert.equal(quote.volumeDiscountPercent, 10);
  assert.equal(quote.volumeDiscountCents, 700);
  assert.equal(quote.totalCents, 8_800);
});

test("USD, EUR, and CAD use fixed catalog prices", () => {
  const totals = (["USD", "EUR", "CAD"] as const).map(
    (currency) =>
      calculateOrderQuote({
        serviceType: "photo-editing",
        currency,
        items: photoItems(1, ["image-enhancement-re"]),
      }).totalCents
  );
  assert.deepEqual(totals, [150, 150, 200]);
});

test("floor-plan quantities are priced per floor and discounted by floors", () => {
  const quote = calculateOrderQuote({
    serviceType: "3d-floor-plans",
    currency: "CAD",
    items: [
      { planType: "2d-colour", numberOfFloors: 3 },
      { planType: "2d-colour", numberOfFloors: 2 },
    ],
  });
  assert.equal(quote.eligibleUnits, 5);
  assert.equal(quote.baseSubtotalCents, 14_000);
  assert.equal(quote.volumeDiscountCents, 700);
  assert.equal(quote.totalCents, 13_300);
});

test("unknown and duplicate option IDs fail clearly", () => {
  assert.throws(
    () =>
      calculateOrderQuote({
        serviceType: "virtual-staging",
        currency: "USD",
        items: stagingItems(1, ["not-real"]),
      }),
    PricingValidationError
  );
  assert.throws(
    () =>
      calculateOrderQuote({
        serviceType: "virtual-staging",
        currency: "USD",
        items: stagingItems(1, ["day-to-dusk", "day-to-dusk"]),
      }),
    PricingValidationError
  );
});

test("invalid floor-plan type never prices as zero", () => {
  assert.throws(
    () =>
      calculateOrderQuote({
        serviceType: "3d-floor-plans",
        currency: "USD",
        items: [{ planType: "unknown", numberOfFloors: 1 }],
      }),
    /Unknown floor-plan type/
  );
});

test("legacy orders without a snapshot remain legacy", () => {
  assert.equal(parsePricingSnapshot(null), null);
  assert.equal(parsePricingSnapshot({ currency: "USD" }), null);

  const quote = calculateOrderQuote({
    serviceType: "photo-editing",
    currency: "USD",
    items: photoItems(6, ["day-to-dusk-pe"]),
  });
  const snapshot = createPricingSnapshot(quote, "2026-06-25T00:00:00.000Z");
  assert.deepEqual(parsePricingSnapshot(snapshot), snapshot);
});
