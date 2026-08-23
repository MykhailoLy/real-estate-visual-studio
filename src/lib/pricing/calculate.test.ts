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

  assert.equal(quote.baseSubtotalCents, 15_400);
  assert.equal(quote.addOnSubtotalCents, 3_300);
  assert.equal(quote.volumeDiscountPercent, 10);
  assert.equal(quote.volumeDiscountCents, 1_540);
  assert.equal(quote.totalCents, 17_160);
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
  assert.equal(quote.items[0].unitPriceCents, 500);
  assert.deepEqual(
    quote.items[0].addOns.map((addOn) => addOn.priceKey),
    ["image-enhancement", "turn-on-lights"]
  );
  assert.equal(quote.baseSubtotalCents, 5_000);
  assert.equal(quote.addOnSubtotalCents, 1_500);
  assert.equal(quote.volumeDiscountPercent, 10);
  assert.equal(quote.volumeDiscountCents, 500);
  assert.equal(quote.totalCents, 6_000);
});

test("Single Exposure pins Image Enhancement as base and discounts no add-ons", () => {
  const quote = calculateOrderQuote({
    serviceType: "photo-editing",
    currency: "USD",
    items: Array.from({ length: 10 }, () => ({
      selectedOptions: [
        "image-enhancement-re",
        "shadow-removal",
        "aerial-full-markup-pe",
      ],
      baseOptionId: "image-enhancement-re",
    })),
  });
  assert.equal(quote.baseSubtotalCents, 1_000);
  assert.equal(quote.addOnSubtotalCents, 10_500);
  assert.equal(quote.volumeDiscountCents, 100);
  assert.equal(quote.totalCents, 11_400);
});

test("Shadow Removal uses approved USD, EUR and CAD prices in both services", () => {
  const currencies = ["USD", "EUR", "CAD"] as const;
  const staging = currencies.map(
    (currency) =>
      calculateOrderQuote({
        serviceType: "virtual-staging",
        currency,
        items: [{ selectedAddons: ["shadow-removal"] }],
      }).items[0]?.addOnSubtotalCents,
  );
  const singleExposure = currencies.map(
    (currency) =>
      calculateOrderQuote({
        serviceType: "photo-editing",
        currency,
        items: [
          {
            selectedOptions: ["image-enhancement-re", "shadow-removal"],
            baseOptionId: "image-enhancement-re",
          },
        ],
      }).items[0]?.addOnSubtotalCents,
  );
  assert.deepEqual(staging, [500, 450, 650]);
  assert.deepEqual(singleExposure, staging);
});

test("every Aerial Editing option uses its approved currency price", () => {
  const optionIds = [
    "aerial-colour-fade-pe",
    "aerial-drop-pin-pe",
    "aerial-single-lot-highlight-pe",
    "aerial-multiple-lot-highlight-pe",
    "aerial-full-markup-pe",
  ];
  const expected = {
    USD: [250, 250, 250, 450, 550],
    EUR: [250, 250, 250, 400, 500],
    CAD: [350, 350, 350, 650, 750],
  } as const;
  for (const currency of ["USD", "EUR", "CAD"] as const) {
    const actual = optionIds.map(
      (optionId) =>
        calculateOrderQuote({
          serviceType: "photo-editing",
          currency,
          items: [
            {
              selectedOptions: ["image-enhancement-re", optionId],
              baseOptionId: "image-enhancement-re",
            },
          ],
        }).items[0]?.addOnSubtotalCents,
    );
    assert.deepEqual(actual, expected[currency]);
  }
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
  assert.deepEqual(totals, [100, 100, 150]);
});

test("Virtual Staging base and every supported add-on use final catalog prices", () => {
  const selectedAddons = [
    "image-enhancement",
    "day-to-dusk",
    "item-removal",
    "shadow-removal",
    "turn-on-lights",
    "colour-change",
  ];
  const expected = {
    USD: { base: 1_500, addOns: [100, 350, 500, 500, 50, 200] },
    EUR: { base: 1_400, addOns: [100, 300, 450, 450, 50, 150] },
    CAD: { base: 1_900, addOns: [150, 450, 650, 650, 100, 250] },
  } as const;

  for (const currency of ["USD", "EUR", "CAD"] as const) {
    const quote = calculateOrderQuote({
      serviceType: "virtual-staging",
      currency,
      items: [{ selectedAddons }],
    });
    assert.equal(quote.items[0].baseSubtotalCents, expected[currency].base);
    assert.deepEqual(
      quote.items[0].addOns.map((addOn) => addOn.unitPriceCents),
      expected[currency].addOns,
    );
  }
});

test("Virtual Renovation keeps synchronized prices and receives no automatic discount", () => {
  const quote = calculateOrderQuote({
    serviceType: "virtual-renovation",
    currency: "USD",
    items: Array.from({ length: 20 }, () => ({
      selectedInternal: [
        "replace-flooring",
        "item-removal-cleaning",
        "staging-residential",
        "color-change-interior",
      ],
      selectedExternal: [],
    })),
  });

  assert.deepEqual(
    quote.items[0].addOns.map((addOn) => addOn.unitPriceCents),
    [1_700, 500, 1_500, 200],
  );
  assert.equal(quote.eligibleUnits, 0);
  assert.equal(quote.volumeDiscountPercent, 0);
  assert.equal(quote.volumeDiscountCents, 0);
  assert.equal(quote.totalCents, 78_000);
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
