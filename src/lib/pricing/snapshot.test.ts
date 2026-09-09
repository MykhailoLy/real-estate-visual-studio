import assert from "node:assert/strict";
import test from "node:test";
import { PRICING_VERSION } from "./catalog.ts";
import { calculateOrderQuote } from "./calculate.ts";
import { createPricingSnapshot, isSupportedPricingVersion, parsePricingSnapshot } from "./snapshot.ts";
import type { PricingSnapshot } from "./types.ts";

function currentSnapshot() {
  return createPricingSnapshot(calculateOrderQuote(
    { serviceType: "virtual-staging", currency: "USD", items: Array.from({ length: 10 }, () => ({ selectedAddons: ["image-enhancement"] })) },
    { welcomeOfferAvailability: { virtualStagingAvailable: true, imageEnhancementAvailable: false, dayToDuskAvailable: false } },
  ), "2026-09-09T12:00:00.000Z");
}

// Exact original prices/format from main history: 75edfa8, b614052, 5936984.
// Deliberately independent of the current calculator and catalogue.
function preWelcomeSnapshot(pricingVersion: string) {
  const unit = pricingVersion === "2026-08-23-v1" ? 1500 : 1350;
  return {
    pricingVersion, currency: "USD", serviceType: "virtual-staging",
    eligibleUnits: 10, baseSubtotalCents: unit * 10, addOnSubtotalCents: 0,
    volumeDiscountPercent: 10, volumeDiscountCents: unit,
    subtotalAfterDiscountCents: unit * 9, totalCents: unit * 9,
    taxCalculated: false, taxCents: 0, customQuote: false,
    pricedAt: "2026-08-24T12:00:00.000Z",
    items: Array.from({ length: 10 }, (_, itemIndex) => ({
      itemIndex, quantity: 1, priceKey: "virtual-staging", unitPriceCents: unit,
      baseSubtotalCents: unit, addOns: [], addOnSubtotalCents: 0, lineSubtotalCents: unit,
    })),
  };
}

function v2Snapshot(): PricingSnapshot {
  return {
    ...currentSnapshot(), pricingVersion: "2026-08-29-v2",
    volumeEligibleUnits: 9, volumeDiscountPercent: 5, volumeDiscountCents: 675,
    subtotalAfterDiscountCents: 14575, totalCents: 14575,
  };
}

test("current snapshots validate without losing any stored pricing evidence", () => {
  assert.equal(isSupportedPricingVersion(PRICING_VERSION), true);
  const snapshot = currentSnapshot();
  assert.deepEqual(parsePricingSnapshot(snapshot), snapshot);
  assert.equal(snapshot.totalCents, 13900);
});

test("v2 preserves Welcome and its original volume rule without repricing", () => {
  const snapshot = v2Snapshot();
  const original = structuredClone(snapshot);
  assert.deepEqual(parsePricingSnapshot(snapshot), original);
  assert.deepEqual(snapshot, original);
  assert.equal(parsePricingSnapshot(snapshot)?.totalCents, 14575);
  assert.notEqual(snapshot.totalCents, currentSnapshot().totalCents);
  assert.equal(parsePricingSnapshot({ ...snapshot, volumeEligibleUnits: 10 }), null);
});

for (const version of ["2026-06-25-v1", "2026-08-18-v1", "2026-08-23-v1"]) {
  test(`pre-Welcome ${version} preserves stored prices and adds only an explicit empty fallback`, () => {
    const snapshot = preWelcomeSnapshot(version);
    const original = structuredClone(snapshot);
    const parsed = parsePricingSnapshot(snapshot);
    assert.ok(parsed);
    assert.deepEqual(parsed, {
      ...snapshot, volumeEligibleUnits: 10, welcomeDiscountCents: 0,
      welcomeOffer: { version: "legacy-none", totalDiscountCents: 0, benefits: [] },
    });
    assert.deepEqual(parsePricingSnapshot(parsed), parsed);
    assert.deepEqual(snapshot, original);
    assert.equal(Object.hasOwn(snapshot, "welcomeOffer"), false);
    assert.equal(parsePricingSnapshot({ ...snapshot, welcomeDiscountCents: 0 }), null);
    assert.equal(parsePricingSnapshot({ ...snapshot, welcomeDiscountCents: 750, welcomeOffer: currentSnapshot().welcomeOffer }), null);
  });
}

test("unknown, future, missing and malformed snapshot versions are rejected", () => {
  for (const version of [undefined, null, "", "legacy", "2026-08-29-v3", "2099-01-01-v1", 3]) {
    assert.equal(parsePricingSnapshot({ ...currentSnapshot(), pricingVersion: version }), null);
    assert.equal(isSupportedPricingVersion(version), false);
  }
  for (const value of [null, [], {}, "snapshot"]) assert.equal(parsePricingSnapshot(value), null);
});

test("corrupted totals, nested items and discount evidence fail closed for current and v2 snapshots", () => {
  const corruptions: Array<(snapshot: PricingSnapshot) => void> = [
    (s) => { s.currency = "GBP" as never; },
    (s) => { s.serviceType = "local" as never; },
    (s) => { s.serviceType = "photo-editing"; },
    (s) => { s.eligibleUnits++; },
    (s) => { s.volumeEligibleUnits++; },
    (s) => { s.baseSubtotalCents++; },
    (s) => { s.addOnSubtotalCents++; },
    (s) => { s.totalCents = s.totalCents! + 1; },
    (s) => { s.totalCents = null; },
    (s) => { s.subtotalAfterDiscountCents = undefined as never; },
    (s) => { s.volumeDiscountCents = -1; },
    (s) => { s.volumeDiscountCents = 0.5; },
    (s) => { s.volumeDiscountCents = Number.NaN; },
    (s) => { s.volumeDiscountCents = Number.MAX_SAFE_INTEGER + 1; },
    (s) => { s.volumeDiscountPercent = 99; },
    (s) => { s.taxCalculated = true as never; },
    (s) => { s.taxCents = 1 as never; },
    (s) => { s.pricedAt = "invalid"; },
    (s) => { s.customQuote = true; },
    (s) => { s.items = []; },
    (s) => { s.items[0] = null as never; },
    (s) => { s.items[0].itemIndex = 1; },
    (s) => { s.items[0].quantity = 2; },
    (s) => { s.items[0].unitPriceCents++; },
    (s) => { s.items[0].priceKey = "unknown" as never; },
    (s) => { s.items[0].addOns[0].subtotalCents++; },
    (s) => { s.items[0].addOns.push(s.items[0].addOns[0]); },
    (s) => { s.items[0].lineSubtotalCents++; },
    (s) => { s.welcomeOffer = undefined as never; },
    (s) => { s.welcomeOffer.version = "unknown"; },
    (s) => { s.welcomeOffer.benefits[0].itemIndex = 10; },
    (s) => { s.welcomeOffer.benefits[0].key = "unknown" as never; },
    (s) => { s.welcomeOffer.benefits[0].priceKey = "day-to-dusk"; },
    (s) => { s.welcomeOffer.benefits[0].discountPercent = 100; },
    (s) => { s.welcomeOffer.benefits[0].discountCents++; },
    (s) => { s.welcomeOffer.benefits.push(s.welcomeOffer.benefits[0]); },
    (s) => { s.welcomeOffer.totalDiscountCents++; },
    (s) => { s.welcomeDiscountCents++; },
  ];
  for (const original of [currentSnapshot(), v2Snapshot()]) {
    for (const [index, corrupt] of corruptions.entries()) {
      const snapshot = structuredClone(original);
      corrupt(snapshot);
      assert.equal(parsePricingSnapshot(snapshot), null, `${original.pricingVersion}, corruption ${index}`);
    }
  }
});

test("pre-Welcome snapshots also require coherent stored amounts and structure", () => {
  const original = preWelcomeSnapshot("2026-06-25-v1");
  for (const patch of [
    { totalCents: original.totalCents + 1 }, { volumeDiscountCents: -1 },
    { volumeDiscountPercent: 5 }, { items: [] }, { eligibleUnits: 49 },
    { subtotalAfterDiscountCents: null }, { currency: "GBP" }, { serviceType: "local" },
  ]) assert.equal(parsePricingSnapshot({ ...original, ...patch }), null);
});

test("valid custom quotes stay readable but cannot contain a payable amount or Welcome benefit", () => {
  const snapshot = createPricingSnapshot(calculateOrderQuote({
    serviceType: "virtual-staging", currency: "USD",
    items: Array.from({ length: 50 }, () => ({ selectedAddons: [] })),
  }));
  assert.deepEqual(parsePricingSnapshot(snapshot), snapshot);
  assert.equal(parsePricingSnapshot({ ...snapshot, totalCents: 1 }), null);
  assert.equal(parsePricingSnapshot({ ...snapshot, welcomeOffer: currentSnapshot().welcomeOffer }), null);
});

test("historical floor quantities aggregate across items without repricing", () => {
  const snapshot = preWelcomeSnapshot("2026-06-25-v1");
  const historical = {
    ...snapshot, serviceType: "3d-floor-plans", eligibleUnits: 21,
    baseSubtotalCents: 31500, volumeDiscountPercent: 15, volumeDiscountCents: 4725,
    subtotalAfterDiscountCents: 26775, totalCents: 26775,
    items: [20, 1].map((quantity, itemIndex) => ({
      itemIndex, quantity, priceKey: "floor-plan-2d-bw", unitPriceCents: 1500,
      baseSubtotalCents: 1500 * quantity, addOns: [], addOnSubtotalCents: 0,
      lineSubtotalCents: 1500 * quantity,
    })),
  };
  assert.equal(parsePricingSnapshot(historical)?.totalCents, 26775);
});
