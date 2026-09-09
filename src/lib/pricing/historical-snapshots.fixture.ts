import type { PricingSnapshot } from "./types.ts";

// Stored USD examples from the v2/v3/v4 calculators on main before v5.
// No current catalogue/calculator imports: these prices must never drift.
export function historicalStagingSnapshot(
  pricingVersion: "2026-08-29-v2" | "2026-09-09-v3" | "2026-09-09-v4",
  partnerClient = false,
): PricingSnapshot {
  const v2 = pricingVersion === "2026-08-29-v2";
  const partner = pricingVersion === "2026-09-09-v4" && partnerClient;
  const total = partner ? 11685 : v2 ? 13575 : 12900;
  return {
    pricingVersion, currency: "USD", serviceType: "virtual-staging",
    eligibleUnits: 10, volumeEligibleUnits: v2 ? 9 : 10,
    baseSubtotalCents: 15000, addOnSubtotalCents: 0,
    welcomeDiscountCents: 750,
    welcomeOffer: { version: "2026-08-29", totalDiscountCents: 750, benefits: [{
      key: "virtual-staging-first-image-50", itemIndex: 0,
      priceKey: "virtual-staging", discountPercent: 50, discountCents: 750,
    }] },
    volumeDiscountPercent: v2 ? 5 : 10, volumeDiscountCents: v2 ? 675 : 1350,
    partnerClient: partner, partnerDiscountPercent: partner ? 10 : 0,
    partnerEligibleSubtotalCents: partner ? 12150 : 0, partnerDiscountCents: partner ? 1215 : 0,
    subtotalAfterDiscountCents: total, totalCents: total,
    taxCalculated: false, taxCents: 0, customQuote: false,
    pricedAt: "2026-09-09T12:00:00.000Z",
    items: Array.from({ length: 10 }, (_, itemIndex) => ({
      itemIndex, quantity: 1, priceKey: "virtual-staging", unitPriceCents: 1500,
      baseSubtotalCents: 1500, addOns: [], addOnSubtotalCents: 0, lineSubtotalCents: 1500,
    })),
  };
}

export function historicalEnhancementSnapshot(
  pricingVersion: "2026-08-29-v2" | "2026-09-09-v3" | "2026-09-09-v4",
): PricingSnapshot {
  const v4 = pricingVersion === "2026-09-09-v4";
  return {
    ...historicalStagingSnapshot(pricingVersion), serviceType: "photo-editing",
    volumeEligibleUnits: v4 ? 10 : 9, baseSubtotalCents: 1000,
    welcomeDiscountCents: 100,
    welcomeOffer: { version: "2026-08-29", totalDiscountCents: 100, benefits: [{
      key: "image-enhancement-free", itemIndex: 0,
      priceKey: "image-enhancement", discountPercent: 100, discountCents: 100,
    }] },
    volumeDiscountPercent: v4 ? 10 : 5, volumeDiscountCents: v4 ? 90 : 45,
    subtotalAfterDiscountCents: v4 ? 810 : 855, totalCents: v4 ? 810 : 855,
    items: Array.from({ length: 10 }, (_, itemIndex) => ({
      itemIndex, quantity: 1, priceKey: "image-enhancement", unitPriceCents: 100,
      baseSubtotalCents: 100, addOns: [], addOnSubtotalCents: 0, lineSubtotalCents: 100,
    })),
  };
}
