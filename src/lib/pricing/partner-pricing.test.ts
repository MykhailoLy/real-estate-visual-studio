import assert from "node:assert/strict";
import test from "node:test";
import { calculateOrderQuote } from "./calculate.ts";
import { getCatalogPrice } from "./catalog.ts";
import { percentageOfCents } from "./discounts.ts";
import { createPricingSnapshot, parsePricingSnapshot } from "./snapshot.ts";
import { comparePricingExpectation, createPricingExpectation } from "./expectation.ts";
import type { OrderPricingInput, PricingSnapshot } from "./types.ts";

const welcomeOfferAvailability = { virtualStagingAvailable: true, imageEnhancementAvailable: true, dayToDuskAvailable: true };
const staging = (count: number, currency: "USD" | "EUR" | "CAD" = "USD", selectedAddons: string[] = []): OrderPricingInput => ({
  serviceType: "virtual-staging", currency, items: Array.from({ length: count }, () => ({ selectedAddons })),
});

for (const currency of ["USD", "EUR", "CAD"] as const) {
  test(`Partner stacks after Volume at every boundary in ${currency}`, () => {
    const unit = getCatalogPrice("virtual-staging", currency);
    for (const [count, percent] of [[4, 0], [5, 5], [9, 5], [10, 10], [19, 10], [20, 15], [49, 15], [50, 0]]) {
      for (const welcome of [false, true]) {
        const options = { welcomeOfferAvailability: welcome ? welcomeOfferAvailability : undefined };
        const ordinary = calculateOrderQuote(staging(count, currency), options);
        const quote = calculateOrderQuote(staging(count, currency), { ...options, partnerClient: true });
        assert.equal(quote.volumeDiscountPercent, percent);
        assert.equal(quote.volumeEligibleUnits, count);
        assert.equal(quote.volumeDiscountCents, ordinary.volumeDiscountCents);
        assert.equal(quote.welcomeDiscountCents, ordinary.welcomeDiscountCents);
        const snapshot = createPricingSnapshot(quote);
        assert.deepEqual(parsePricingSnapshot(snapshot), snapshot);
        if (count === 50) {
          assert.equal(quote.customQuote, true);
          assert.equal(quote.totalCents, null);
          assert.equal(quote.partnerDiscountCents, 0);
          assert.equal(quote.partnerEligibleSubtotalCents, 0);
          continue;
        }
        const basis = unit * (count - (welcome ? 1 : 0)) - quote.volumeDiscountCents;
        assert.equal(quote.partnerEligibleSubtotalCents, basis);
        assert.equal(quote.partnerDiscountCents, percentageOfCents(basis, 10));
        assert.equal(quote.totalCents, ordinary.totalCents! - quote.partnerDiscountCents);
        assert.equal(ordinary.partnerDiscountCents, 0);
      }
    }
  });
}

test("verified USD examples use current catalogue prices and exclude the entire Welcome base", () => {
  assert.equal(getCatalogPrice("virtual-staging", "USD"), 1900);
  assert.equal(calculateOrderQuote(staging(1)).totalCents, 1900);
  assert.equal(calculateOrderQuote(staging(1), { partnerClient: true }).totalCents, 1710);
  assert.equal(calculateOrderQuote(staging(1), { welcomeOfferAvailability }).totalCents, 950);
  assert.equal(calculateOrderQuote(staging(10)).totalCents, 17100);
  assert.equal(calculateOrderQuote(staging(10), { partnerClient: true }).totalCents, 15390);
  assert.equal(calculateOrderQuote(staging(1, "USD", ["image-enhancement"]), { partnerClient: true }).totalCents, 1818);
  const welcomeOnly = calculateOrderQuote(staging(1), { partnerClient: true, welcomeOfferAvailability });
  assert.equal(welcomeOnly.totalCents, 950);
  assert.equal(welcomeOnly.partnerEligibleSubtotalCents, 0);
  const combined = calculateOrderQuote(staging(10), { partnerClient: true, welcomeOfferAvailability });
  assert.equal(combined.baseSubtotalCents, 19000);
  assert.equal(combined.welcomeDiscountCents, 950);
  assert.equal(combined.volumeDiscountCents, 1710);
  assert.equal(combined.partnerEligibleSubtotalCents, 15390);
  assert.equal(combined.partnerDiscountCents, 1539);
  assert.equal(combined.totalCents, 14801);
  const addon = calculateOrderQuote(staging(1, "USD", ["image-enhancement"]), { partnerClient: true, welcomeOfferAvailability });
  assert.equal(addon.partnerEligibleSubtotalCents, 120);
  assert.equal(addon.partnerDiscountCents, 12);
  assert.equal(addon.totalCents, 1058);
});

test("free Welcome bases stay free while paid digital add-ons receive Partner", () => {
  for (const [dedicatedSubService, baseOptionId, addon, expected] of [
    ["image-enhancement-single-exposure", "image-enhancement-re", "day-to-dusk-pe", 315],
    ["day-to-dusk", "day-to-dusk-pe", "image-enhancement-re", 108],
  ] as const) {
    const quote = calculateOrderQuote({ serviceType: "photo-editing", currency: "USD", items: [
      { dedicatedSubService, baseOptionId, selectedOptions: [baseOptionId, addon] },
    ] }, { partnerClient: true, welcomeOfferAvailability });
    assert.equal(quote.baseSubtotalCents, quote.welcomeDiscountCents);
    assert.equal(quote.partnerEligibleSubtotalCents, quote.addOnSubtotalCents);
    assert.equal(quote.totalCents, expected);
    assert.ok(parsePricingSnapshot(createPricingSnapshot(quote)));
  }
});

test("Partner covers renovation options, floor plans and generic photo editing", () => {
  const inputs: Array<[OrderPricingInput, number]> = [
    [{ serviceType: "virtual-renovation", currency: "USD", items: [{ selectedInternal: ["replace-walls", "replace-flooring"], selectedExternal: [] }] }, 2610],
    [{ serviceType: "3d-floor-plans", currency: "USD", items: [{ planType: "2d-bw", numberOfFloors: 1 }] }, 1350],
    [{ serviceType: "photo-editing", currency: "USD", items: [{ selectedOptions: ["day-to-dusk-pe", "turn-on-lights-pe"] }] }, 360],
  ];
  for (const [input, total] of inputs) {
    const quote = calculateOrderQuote(input, { partnerClient: true });
    assert.equal(quote.totalCents, total);
    assert.ok(parsePricingSnapshot(createPricingSnapshot(quote)));
  }
});

test("rounds Volume first and Partner second, both half up in cents", () => {
  const quote = calculateOrderQuote({ serviceType: "photo-editing", currency: "USD", items: Array.from({ length: 5 }, () => ({ selectedOptions: ["day-to-dusk-pe"] })) }, { partnerClient: true });
  assert.equal(quote.volumeDiscountCents, 88);
  assert.equal(quote.partnerEligibleSubtotalCents, 1662);
  assert.equal(quote.partnerDiscountCents, 166);
  assert.equal(quote.totalCents, 1496);
  assert.equal(calculateOrderQuote(staging(5), { partnerClient: true }).partnerDiscountCents, 903);
  assert.equal(percentageOfCents(5, 10), 1);
});

test("Image Enhancement Partner uses fixed prices and rounds CAD 16.5 cents half up to 17", () => {
  for (const [currency, base, discount, total] of [
    ["USD", 120, 12, 108], ["EUR", 100, 10, 90], ["CAD", 165, 17, 148],
  ] as const) {
    const quote = calculateOrderQuote({ serviceType: "photo-editing", currency, items: [{
      dedicatedSubService: "image-enhancement-single-exposure", baseOptionId: "image-enhancement-re",
      selectedOptions: ["image-enhancement-re"],
    }] }, { partnerClient: true });
    assert.equal(quote.baseSubtotalCents, base);
    assert.equal(quote.partnerDiscountCents, discount);
    assert.equal(quote.totalCents, total);
    assert.deepEqual(parsePricingSnapshot(createPricingSnapshot(quote))?.totalCents, total);
  }
});

test("Partner toggles require a new review across every automatic service", () => {
  for (const input of [staging(10),
    { serviceType: "virtual-renovation", currency: "USD", items: [{ selectedInternal: ["replace-walls"], selectedExternal: [] }] },
    { serviceType: "3d-floor-plans", currency: "USD", items: [{ planType: "2d-bw", numberOfFloors: 1 }] },
    { serviceType: "photo-editing", currency: "USD", items: [{ selectedOptions: ["day-to-dusk-pe"] }] },
  ] as OrderPricingInput[]) {
    for (const before of [true, false]) {
      const reviewed = calculateOrderQuote(input, { partnerClient: before });
      const current = calculateOrderQuote(input, { partnerClient: !before });
      assert.deepEqual(comparePricingExpectation(createPricingExpectation(reviewed), current), { ok: false, reason: "pricing_changed" });
      assert.deepEqual(comparePricingExpectation(createPricingExpectation(current), current), { ok: true });
    }
  }
});

test("Partner snapshot evidence is required and tampering fails closed", () => {
  const original = createPricingSnapshot(calculateOrderQuote(staging(10), { partnerClient: true, welcomeOfferAvailability }));
  assert.deepEqual(parsePricingSnapshot(original), original);
  for (const patch of [
    { partnerClient: false }, { partnerDiscountPercent: 11 }, { partnerEligibleSubtotalCents: 1 },
    { partnerDiscountCents: original.partnerDiscountCents + 1 }, { partnerDiscountCents: 0.5 },
    { partnerDiscountPercent: undefined }, { pricingVersion: "2099-01-01-v5" },
    { pricingVersion: "2026-09-09-v3" },
  ]) assert.equal(parsePricingSnapshot({ ...original, ...patch }), null);
  const ordinary = createPricingSnapshot(calculateOrderQuote(staging(10)));
  for (const version of ["2026-06-25-v1", "2026-08-18-v1", "2026-08-23-v1", "2026-08-29-v2", "2026-09-09-v3"]) {
    const historical: Partial<PricingSnapshot> = { ...ordinary, pricingVersion: version };
    for (const key of ["partnerClient", "partnerDiscountPercent", "partnerEligibleSubtotalCents", "partnerDiscountCents"] as const) delete historical[key];
    if (version.endsWith("v1")) {
      delete historical.welcomeOffer; delete historical.welcomeDiscountCents; delete historical.volumeEligibleUnits;
    }
    const parsed = parsePricingSnapshot(historical);
    assert.ok(parsed);
    assert.equal(parsed.partnerClient, false);
    assert.equal(parsed.partnerDiscountCents, 0);
    assert.equal(parsed.totalCents, historical.totalCents);
    assert.equal(parsePricingSnapshot({ ...historical, partnerClient: true }), null);
  }
});
