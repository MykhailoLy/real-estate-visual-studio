import type { OrderQuote, PricingSnapshot } from "./types.ts";
import { isTransactionalCurrency } from "./format.ts";
import { PRICING_VERSION } from "./catalog.ts";
import { isWelcomeOfferBenefitKey } from "../welcome-offer.ts";

export function createPricingSnapshot(
  quote: OrderQuote,
  pricedAt = new Date().toISOString()
): PricingSnapshot {
  return { ...quote, pricedAt };
}

export function parsePricingSnapshot(value: unknown): PricingSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const snapshot = value as Partial<PricingSnapshot>;
  if (
    typeof snapshot.pricingVersion !== "string" ||
    !isTransactionalCurrency(snapshot.currency) ||
    !isSafeNonNegativeInteger(snapshot.eligibleUnits) ||
    !isSafeNonNegativeInteger(snapshot.baseSubtotalCents) ||
    !isSafeNonNegativeInteger(snapshot.addOnSubtotalCents) ||
    typeof snapshot.volumeDiscountPercent !== "number" ||
    typeof snapshot.volumeDiscountCents !== "number" ||
    snapshot.taxCalculated !== false ||
    snapshot.taxCents !== 0 ||
    typeof snapshot.customQuote !== "boolean" ||
    typeof snapshot.pricedAt !== "string" ||
    !Array.isArray(snapshot.items)
  ) {
    return null;
  }
  if (
    snapshot.totalCents !== null &&
    typeof snapshot.totalCents !== "number"
  ) {
    return null;
  }
  if (snapshot.pricingVersion !== PRICING_VERSION) {
    return {
      ...(snapshot as PricingSnapshot),
      volumeEligibleUnits: snapshot.eligibleUnits,
      welcomeDiscountCents: 0,
      welcomeOffer: {
        version: "legacy-none",
        totalDiscountCents: 0,
        benefits: [],
      },
    };
  }

  if (
    !isSafeNonNegativeInteger(snapshot.volumeEligibleUnits) ||
    !isSafeNonNegativeInteger(snapshot.welcomeDiscountCents) ||
    !isValidWelcomeOffer(snapshot.welcomeOffer) ||
    snapshot.welcomeDiscountCents !==
      snapshot.welcomeOffer.totalDiscountCents ||
    snapshot.volumeEligibleUnits !==
      snapshot.eligibleUnits - snapshot.welcomeOffer.benefits.length ||
    (snapshot.subtotalAfterDiscountCents !== null &&
      (!isSafeNonNegativeInteger(snapshot.subtotalAfterDiscountCents) ||
        snapshot.subtotalAfterDiscountCents !==
          snapshot.baseSubtotalCents +
            snapshot.addOnSubtotalCents -
            snapshot.welcomeDiscountCents -
            snapshot.volumeDiscountCents)) ||
    snapshot.totalCents !== snapshot.subtotalAfterDiscountCents
  ) {
    return null;
  }

  return snapshot as PricingSnapshot;
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function isValidWelcomeOffer(value: unknown): value is PricingSnapshot["welcomeOffer"] {
  if (!value || typeof value !== "object") return false;
  const offer = value as Partial<PricingSnapshot["welcomeOffer"]>;
  if (
    typeof offer.version !== "string" ||
    !isSafeNonNegativeInteger(offer.totalDiscountCents) ||
    !Array.isArray(offer.benefits) ||
    offer.benefits.length > 1
  ) {
    return false;
  }
  let sum = 0;
  for (const benefit of offer.benefits) {
    if (
      !benefit ||
      typeof benefit !== "object" ||
      !isWelcomeOfferBenefitKey(benefit.key) ||
      !isSafeNonNegativeInteger(benefit.itemIndex) ||
      typeof benefit.priceKey !== "string" ||
      (benefit.discountPercent !== 50 && benefit.discountPercent !== 100) ||
      !isSafeNonNegativeInteger(benefit.discountCents)
    ) {
      return false;
    }
    sum += benefit.discountCents;
  }
  return sum === offer.totalDiscountCents;
}
