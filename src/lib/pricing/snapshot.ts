import type { OrderQuote, PricedOrderItem, PricingSnapshot } from "./types.ts";
import { isTransactionalCurrency } from "./format.ts";
import { FLOOR_PLAN_PRICE_KEYS, PHOTO_EDIT_PRICE_KEYS, PRICE_CATALOG } from "./catalog.ts";
import { getVolumeDiscount, PARTNER_DISCOUNT_PERCENT, percentageOfCents } from "./discounts.ts";
import { isWelcomeOfferBenefitKey, WELCOME_OFFER_BENEFIT_RULES } from "../welcome-offer.ts";

// Explicit formats emitted by the repository's calculators. A catalogue version
// change must not implicitly admit a format or reinterpret an existing order.
const PRE_WELCOME_VERSIONS = [
  "2026-06-25-v1",
  "2026-08-18-v1",
  "2026-08-23-v1",
] as const;
const SUPPORTED_PRICING_VERSIONS = [
  ...PRE_WELCOME_VERSIONS,
  "2026-08-29-v2",
  "2026-09-09-v3",
  "2026-09-09-v4",
  "2026-09-09-v5",
] as const;

export function isSupportedPricingVersion(value: unknown): value is (typeof SUPPORTED_PRICING_VERSIONS)[number] {
  return typeof value === "string" &&
    (SUPPORTED_PRICING_VERSIONS as readonly string[]).includes(value);
}

export function createPricingSnapshot(
  quote: OrderQuote,
  pricedAt = new Date().toISOString(),
): PricingSnapshot {
  return { ...quote, pricedAt };
}

export function parsePricingSnapshot(value: unknown): PricingSnapshot | null {
  if (!isRecord(value)) return null;
  const snapshot = value as Partial<PricingSnapshot>;
  if (
    !isSupportedPricingVersion(snapshot.pricingVersion) ||
    !isTransactionalCurrency(snapshot.currency) ||
    !isSafeNonNegativeInteger(snapshot.eligibleUnits) ||
    !isSafeNonNegativeInteger(snapshot.baseSubtotalCents) ||
    !isSafeNonNegativeInteger(snapshot.addOnSubtotalCents) ||
    !isSafeNonNegativeInteger(snapshot.volumeDiscountPercent) ||
    !isSafeNonNegativeInteger(snapshot.volumeDiscountCents) ||
    snapshot.taxCalculated !== false || snapshot.taxCents !== 0 ||
    typeof snapshot.customQuote !== "boolean" ||
    typeof snapshot.pricedAt !== "string" ||
    !Number.isFinite(Date.parse(snapshot.pricedAt)) ||
    !Array.isArray(snapshot.items) || snapshot.items.length === 0 ||
    !snapshot.items.every(isValidPricedItem)
  ) return null;

  let units = 0;
  let base = 0;
  let addOns = 0;
  for (const item of snapshot.items) {
    // Validate identity and arithmetic using stored prices, never today's
    // catalogue amounts or today's input limits for historical floor counts.
    switch (snapshot.serviceType) {
      case "virtual-staging":
        if (item.priceKey !== "virtual-staging" || item.quantity !== 1) return null;
        break;
      case "photo-editing":
        if (!Object.values(PHOTO_EDIT_PRICE_KEYS).some((key) => key === item.priceKey) ||
            item.quantity !== 1) return null;
        break;
      case "3d-floor-plans":
        if (!Object.values(FLOOR_PLAN_PRICE_KEYS).some((key) => key === item.priceKey) ||
            item.addOns.length !== 0) return null;
        break;
      case "virtual-renovation":
        if (item.priceKey !== null || item.unitPriceCents !== 0 ||
            item.quantity !== 1 || item.addOns.length === 0) return null;
        break;
      default:
        return null;
    }
    units += snapshot.serviceType === "virtual-renovation" ? 0 : item.quantity;
    base += item.baseSubtotalCents;
    addOns += item.addOnSubtotalCents;
  }
  if (units !== snapshot.eligibleUnits || base !== snapshot.baseSubtotalCents ||
      addOns !== snapshot.addOnSubtotalCents || !Number.isSafeInteger(base + addOns)) return null;

  const preWelcome = (PRE_WELCOME_VERSIONS as readonly string[]).includes(snapshot.pricingVersion);
  let normalized: PricingSnapshot;
  if (preWelcome) {
    // These formats had no Welcome fields. Accept their original absence or
    // this exact no-benefit display fallback (so parsing stays idempotent).
    const absent = snapshot.volumeEligibleUnits === undefined &&
      snapshot.welcomeDiscountCents === undefined && snapshot.welcomeOffer === undefined;
    const empty = snapshot.volumeEligibleUnits === units && snapshot.welcomeDiscountCents === 0 &&
      isRecord(snapshot.welcomeOffer) && snapshot.welcomeOffer.version === "legacy-none" &&
      snapshot.welcomeOffer.totalDiscountCents === 0 &&
      Array.isArray(snapshot.welcomeOffer.benefits) && snapshot.welcomeOffer.benefits.length === 0;
    if (!absent && !empty) return null;
    normalized = {
      ...(snapshot as PricingSnapshot),
      volumeEligibleUnits: units,
      welcomeDiscountCents: 0,
      welcomeOffer: { version: "legacy-none", totalDiscountCents: 0, benefits: [] },
    };
  } else {
    if (!isSafeNonNegativeInteger(snapshot.volumeEligibleUnits) ||
        !isSafeNonNegativeInteger(snapshot.welcomeDiscountCents) ||
        !isValidWelcomeOffer(snapshot.welcomeOffer, snapshot.items, snapshot.serviceType)) return null;
    normalized = snapshot as PricingSnapshot;
  }

  const benefit = normalized.welcomeOffer.benefits[0];
  const excludesWelcomeUnit = benefit &&
    (normalized.pricingVersion === "2026-08-29-v2" ||
      (normalized.pricingVersion === "2026-09-09-v3" &&
        benefit.key !== "virtual-staging-first-image-50"));
  const volumeUnits = units - (excludesWelcomeUnit ? 1 : 0);
  const originalVolume = getVolumeDiscount(units);
  const volume = originalVolume.customQuote ? originalVolume : getVolumeDiscount(volumeUnits);
  const volumeBase = base - (benefit ? normalized.items[benefit.itemIndex].baseSubtotalCents : 0);
  const volumeDiscount = volume.customQuote ? 0 : percentageOfCents(volumeBase, volume.percent);
  if (normalized.pricingVersion !== "2026-09-09-v4" &&
      normalized.pricingVersion !== "2026-09-09-v5") {
    // Older formats never had Partner pricing. Never add it retroactively.
    const absent = normalized.partnerClient === undefined &&
      normalized.partnerDiscountPercent === undefined &&
      normalized.partnerEligibleSubtotalCents === undefined && normalized.partnerDiscountCents === undefined;
    const empty = normalized.partnerClient === false && normalized.partnerDiscountPercent === 0 &&
      normalized.partnerEligibleSubtotalCents === 0 && normalized.partnerDiscountCents === 0;
    if (!absent && !empty) return null;
    normalized = { ...normalized, partnerClient: false, partnerDiscountPercent: 0,
      partnerEligibleSubtotalCents: 0, partnerDiscountCents: 0 };
  }
  if (typeof normalized.partnerClient !== "boolean" ||
      !isSafeNonNegativeInteger(normalized.partnerDiscountPercent) ||
      !isSafeNonNegativeInteger(normalized.partnerEligibleSubtotalCents) ||
      !isSafeNonNegativeInteger(normalized.partnerDiscountCents)) return null;
  const partnerPercent = normalized.partnerClient && !volume.customQuote ? PARTNER_DISCOUNT_PERCENT : 0;
  const partnerBasis = partnerPercent > 0 ? volumeBase - volumeDiscount + addOns : 0;
  const partnerDiscount = percentageOfCents(partnerBasis, partnerPercent);
  const total = volume.customQuote ? null : base + addOns - normalized.welcomeDiscountCents - volumeDiscount - partnerDiscount;
  if (
    normalized.welcomeDiscountCents !== normalized.welcomeOffer.totalDiscountCents ||
    normalized.volumeEligibleUnits !== volumeUnits ||
    normalized.customQuote !== volume.customQuote ||
    (volume.customQuote && benefit !== undefined) ||
    normalized.volumeDiscountPercent !== volume.percent ||
    normalized.volumeDiscountCents !== volumeDiscount ||
    normalized.partnerDiscountPercent !== partnerPercent ||
    normalized.partnerEligibleSubtotalCents !== partnerBasis ||
    normalized.partnerDiscountCents !== partnerDiscount ||
    (total !== null && !isSafeNonNegativeInteger(total)) ||
    normalized.subtotalAfterDiscountCents !== total || normalized.totalCents !== total
  ) return null;

  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isPriceKey(value: unknown): boolean {
  return typeof value === "string" && Object.hasOwn(PRICE_CATALOG, value);
}

function isValidPricedItem(value: unknown, index: number): value is PricedOrderItem {
  if (!isRecord(value) || value.itemIndex !== index ||
      !isSafeNonNegativeInteger(value.quantity) || value.quantity < 1 ||
      !isSafeNonNegativeInteger(value.unitPriceCents) ||
      (value.priceKey !== null && (!isPriceKey(value.priceKey) || value.unitPriceCents === 0)) ||
      !isSafeNonNegativeInteger(value.baseSubtotalCents) ||
      value.baseSubtotalCents !== value.unitPriceCents * value.quantity ||
      !isSafeNonNegativeInteger(value.addOnSubtotalCents) ||
      !isSafeNonNegativeInteger(value.lineSubtotalCents) ||
      !Array.isArray(value.addOns)) return false;

  let addOnSubtotal = 0;
  const ids = new Set<string>();
  for (const addOn of value.addOns) {
    if (!isRecord(addOn) || typeof addOn.id !== "string" || !addOn.id || ids.has(addOn.id) ||
        !isPriceKey(addOn.priceKey) ||
        !isSafeNonNegativeInteger(addOn.unitPriceCents) || addOn.unitPriceCents === 0 ||
        !isSafeNonNegativeInteger(addOn.quantity) || addOn.quantity < 1 ||
        !isSafeNonNegativeInteger(addOn.subtotalCents) ||
        addOn.subtotalCents !== addOn.unitPriceCents * addOn.quantity) return false;
    ids.add(addOn.id);
    addOnSubtotal += addOn.subtotalCents;
  }
  return addOnSubtotal === value.addOnSubtotalCents &&
    value.lineSubtotalCents === value.baseSubtotalCents + addOnSubtotal;
}

function isValidWelcomeOffer(
  value: unknown,
  items: PricedOrderItem[],
  serviceType: PricingSnapshot["serviceType"] | undefined,
): value is PricingSnapshot["welcomeOffer"] {
  if (!isRecord(value) || value.version !== "2026-08-29" ||
      !isSafeNonNegativeInteger(value.totalDiscountCents) ||
      !Array.isArray(value.benefits) || value.benefits.length > 1) return false;
  const benefit: unknown = value.benefits[0];
  if (benefit === undefined) return value.totalDiscountCents === 0;
  if (!isRecord(benefit) || !isWelcomeOfferBenefitKey(benefit.key) ||
      benefit.itemIndex !== 0 || !isSafeNonNegativeInteger(benefit.discountCents)) return false;
  const rule = WELCOME_OFFER_BENEFIT_RULES[benefit.key];
  const expectedService = benefit.key === "virtual-staging-first-image-50"
    ? "virtual-staging" : "photo-editing";
  return serviceType === expectedService &&
    items.every((item) => item.priceKey === rule.priceKey && item.quantity === 1) &&
    benefit.priceKey === rule.priceKey && benefit.discountPercent === rule.discountPercent &&
    benefit.discountCents === percentageOfCents(items[0].baseSubtotalCents, rule.discountPercent) &&
    benefit.discountCents === value.totalDiscountCents;
}
