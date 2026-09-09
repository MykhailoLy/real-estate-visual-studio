import {
  FLOOR_PLAN_MAX_FLOORS,
  FLOOR_PLAN_MIN_FLOORS,
  FLOOR_PLAN_PRICE_KEYS,
  PHOTO_EDIT_PRICE_KEYS,
  PRICING_VERSION,
  RENOVATION_EXTERNAL_PRICE_KEYS,
  RENOVATION_INTERNAL_PRICE_KEYS,
  STAGING_ADDON_PRICE_KEYS,
  getCatalogPrice,
} from "./catalog.ts";
import { getVolumeDiscount, PARTNER_DISCOUNT_PERCENT, percentageOfCents } from "./discounts.ts";
import {
  WELCOME_OFFER_BENEFIT_RULES,
  WELCOME_OFFER_VERSION,
  type WelcomeOfferAvailability,
  type WelcomeOfferBenefitKey,
} from "../welcome-offer.ts";
import type {
  AppliedWelcomeOffer,
  OrderPricingInput,
  OrderQuote,
  PriceKey,
  PricedAddOn,
  PricedOrderItem,
  TransactionalCurrency,
} from "./types.ts";

export interface CalculateOrderQuoteOptions {
  /** Presentation may pass this value, but order submission resolves it again server-side. */
  welcomeOfferAvailability?: WelcomeOfferAvailability;
  /** Preview only in the browser; submission reloads the authenticated account. */
  partnerClient?: boolean;
}

export class PricingValidationError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "PricingValidationError";
    this.code = code;
  }
}

function assertUniqueKnownIds<T extends Record<string, PriceKey>>(
  ids: string[],
  mapping: T,
  fieldName: string
): Array<keyof T & string> {
  const seen = new Set<string>();
  return ids.map((id) => {
    if (!(id in mapping)) {
      throw new PricingValidationError(
        `Unknown ${fieldName} ID: ${id}`,
        "unknown-option-id"
      );
    }
    if (seen.has(id)) {
      throw new PricingValidationError(
        `Duplicate ${fieldName} ID: ${id}`,
        "duplicate-option-id"
      );
    }
    seen.add(id);
    return id as keyof T & string;
  });
}

function pricedAddOn(
  id: string,
  priceKey: PriceKey,
  currency: TransactionalCurrency,
  quantity = 1
): PricedAddOn {
  const unitPriceCents = getCatalogPrice(priceKey, currency);
  return {
    id,
    priceKey,
    unitPriceCents,
    quantity,
    subtotalCents: unitPriceCents * quantity,
  };
}

function calculateStagingItems(
  input: Extract<OrderPricingInput, { serviceType: "virtual-staging" }>
): PricedOrderItem[] {
  const unitPriceCents = getCatalogPrice("virtual-staging", input.currency);
  return input.items.map((item, itemIndex) => {
    const ids = assertUniqueKnownIds(
      item.selectedAddons,
      STAGING_ADDON_PRICE_KEYS,
      "staging add-on"
    );
    const addOns = ids.map((id) =>
      pricedAddOn(id, STAGING_ADDON_PRICE_KEYS[id], input.currency)
    );
    const addOnSubtotalCents = addOns.reduce(
      (sum, addOn) => sum + addOn.subtotalCents,
      0
    );
    return {
      itemIndex,
      quantity: 1,
      priceKey: "virtual-staging",
      unitPriceCents,
      baseSubtotalCents: unitPriceCents,
      addOns,
      addOnSubtotalCents,
      lineSubtotalCents: unitPriceCents + addOnSubtotalCents,
    };
  });
}

function calculateRenovationItems(
  input: Extract<OrderPricingInput, { serviceType: "virtual-renovation" }>
): PricedOrderItem[] {
  return input.items.map((item, itemIndex) => {
    const internalIds = assertUniqueKnownIds(
      item.selectedInternal,
      RENOVATION_INTERNAL_PRICE_KEYS,
      "renovation internal option"
    );
    const externalIds = assertUniqueKnownIds(
      item.selectedExternal,
      RENOVATION_EXTERNAL_PRICE_KEYS,
      "renovation external option"
    );
    const allIds = [...internalIds, ...externalIds];
    if (allIds.length === 0) {
      throw new PricingValidationError(
        "At least one renovation option is required.",
        "missing-renovation-option"
      );
    }
    const addOns = [
      ...internalIds.map((id) =>
        pricedAddOn(id, RENOVATION_INTERNAL_PRICE_KEYS[id], input.currency)
      ),
      ...externalIds.map((id) =>
        pricedAddOn(id, RENOVATION_EXTERNAL_PRICE_KEYS[id], input.currency)
      ),
    ];
    const addOnSubtotalCents = addOns.reduce(
      (sum, addOn) => sum + addOn.subtotalCents,
      0
    );
    return {
      itemIndex,
      quantity: 1,
      priceKey: null,
      unitPriceCents: 0,
      baseSubtotalCents: 0,
      addOns,
      addOnSubtotalCents,
      lineSubtotalCents: addOnSubtotalCents,
    };
  });
}

function calculateFloorPlanItems(
  input: Extract<OrderPricingInput, { serviceType: "3d-floor-plans" }>
): PricedOrderItem[] {
  return input.items.map((item, itemIndex) => {
    if (
      !Number.isInteger(item.numberOfFloors) ||
      item.numberOfFloors < FLOOR_PLAN_MIN_FLOORS ||
      item.numberOfFloors > FLOOR_PLAN_MAX_FLOORS
    ) {
      throw new PricingValidationError(
        `Floor quantity must be an integer between ${FLOOR_PLAN_MIN_FLOORS} and ${FLOOR_PLAN_MAX_FLOORS}.`,
        "invalid-quantity"
      );
    }
    if (!(item.planType in FLOOR_PLAN_PRICE_KEYS)) {
      throw new PricingValidationError(
        `Unknown floor-plan type ID: ${item.planType}`,
        "unknown-floor-plan-type"
      );
    }
    const priceKey =
      FLOOR_PLAN_PRICE_KEYS[item.planType as keyof typeof FLOOR_PLAN_PRICE_KEYS];
    const unitPriceCents = getCatalogPrice(priceKey, input.currency);
    const baseSubtotalCents = unitPriceCents * item.numberOfFloors;
    return {
      itemIndex,
      quantity: item.numberOfFloors,
      priceKey,
      unitPriceCents,
      baseSubtotalCents,
      addOns: [],
      addOnSubtotalCents: 0,
      lineSubtotalCents: baseSubtotalCents,
    };
  });
}

function calculatePhotoEditingItems(
  input: Extract<OrderPricingInput, { serviceType: "photo-editing" }>
): PricedOrderItem[] {
  return input.items.map((item, itemIndex) => {
    const ids = assertUniqueKnownIds(
      item.selectedOptions,
      PHOTO_EDIT_PRICE_KEYS,
      "photo-editing option"
    );
    if (ids.length === 0) {
      throw new PricingValidationError(
        "At least one photo-editing option is required.",
        "missing-photo-editing-option"
      );
    }

    const priced = ids.map((id) => ({
      id,
      priceKey: PHOTO_EDIT_PRICE_KEYS[id],
      unitPriceCents: getCatalogPrice(
        PHOTO_EDIT_PRICE_KEYS[id],
        input.currency
      ),
    }));
    // Dedicated photo-editing flows can identify their base service so a
    // higher-priced add-on never receives the volume discount. Legacy generic
    // Photo Editing retains its highest-price-as-base behaviour.
    const explicitBase = item.baseOptionId
      ? priced.find((option) => option.id === item.baseOptionId)
      : null;
    if (item.baseOptionId && !explicitBase) {
      throw new PricingValidationError(
        `Base photo-editing option is not selected: ${item.baseOptionId}`,
        "invalid-base-option-id"
      );
    }
    const base =
      explicitBase ??
      [...priced].sort((a, b) => b.unitPriceCents - a.unitPriceCents)[0];
    const addOns = priced
      .filter((option) => option.id !== base.id)
      .map((option) =>
        pricedAddOn(option.id, option.priceKey, input.currency)
      );
    const addOnSubtotalCents = addOns.reduce(
      (sum, addOn) => sum + addOn.subtotalCents,
      0
    );
    return {
      itemIndex,
      quantity: 1,
      priceKey: base.priceKey,
      unitPriceCents: base.unitPriceCents,
      baseSubtotalCents: base.unitPriceCents,
      addOns,
      addOnSubtotalCents,
      lineSubtotalCents: base.unitPriceCents + addOnSubtotalCents,
    };
  });
}

function getWelcomeOfferBenefitKey(
  input: OrderPricingInput,
  availability: WelcomeOfferAvailability | undefined,
): WelcomeOfferBenefitKey | null {
  if (!availability) return null;
  if (
    input.serviceType === "virtual-staging" &&
    availability.virtualStagingAvailable
  ) {
    return "virtual-staging-first-image-50";
  }
  if (input.serviceType !== "photo-editing") return null;

  const dedicatedServices = new Set(
    input.items.map((item) => item.dedicatedSubService),
  );
  if (
    dedicatedServices.size === 1 &&
    dedicatedServices.has("image-enhancement-single-exposure") &&
    availability.imageEnhancementAvailable
  ) {
    return "image-enhancement-free";
  }
  if (
    dedicatedServices.size === 1 &&
    dedicatedServices.has("day-to-dusk") &&
    availability.dayToDuskAvailable
  ) {
    return "day-to-dusk-free";
  }
  return null;
}

function calculateWelcomeOffer(
  input: OrderPricingInput,
  items: PricedOrderItem[],
  availability: WelcomeOfferAvailability | undefined,
  customQuote: boolean,
): AppliedWelcomeOffer {
  const empty: AppliedWelcomeOffer = {
    version: WELCOME_OFFER_VERSION,
    totalDiscountCents: 0,
    benefits: [],
  };
  if (customQuote) return empty;

  const key = getWelcomeOfferBenefitKey(input, availability);
  if (!key) return empty;
  const rule = WELCOME_OFFER_BENEFIT_RULES[key];
  const item = items.find((candidate) => candidate.priceKey === rule.priceKey);
  if (!item) return empty;

  const discountCents = percentageOfCents(
    item.baseSubtotalCents,
    rule.discountPercent,
  );
  return {
    version: WELCOME_OFFER_VERSION,
    totalDiscountCents: discountCents,
    benefits: [
      {
        key,
        itemIndex: item.itemIndex,
        priceKey: rule.priceKey,
        discountPercent: rule.discountPercent,
        discountCents,
      },
    ],
  };
}

export function calculateOrderQuote(
  input: OrderPricingInput,
  options: CalculateOrderQuoteOptions = {},
): OrderQuote {
  if (input.items.length < 1) {
    throw new PricingValidationError(
      "Order quantity must contain at least one item.",
      "invalid-quantity"
    );
  }

  let items: PricedOrderItem[];
  let eligibleUnits: number;

  switch (input.serviceType) {
    case "virtual-staging":
      items = calculateStagingItems(input);
      eligibleUnits = input.items.length;
      break;
    case "virtual-renovation":
      items = calculateRenovationItems(input);
      eligibleUnits = 0;
      break;
    case "3d-floor-plans":
      items = calculateFloorPlanItems(input);
      eligibleUnits = input.items.reduce(
        (sum, item) => sum + item.numberOfFloors,
        0
      );
      break;
    case "photo-editing":
      items = calculatePhotoEditingItems(input);
      eligibleUnits = input.items.length;
      break;
  }

  const baseSubtotalCents = items.reduce(
    (sum, item) => sum + item.baseSubtotalCents,
    0
  );
  const addOnSubtotalCents = items.reduce(
    (sum, item) => sum + item.addOnSubtotalCents,
    0
  );
  const originalVolume = getVolumeDiscount(eligibleUnits);
  const welcomeOffer = calculateWelcomeOffer(
    input,
    items,
    options.welcomeOfferAvailability,
    originalVolume.customQuote,
  );
  const discountedItemIndexes = new Set(
    welcomeOffer.benefits.map((benefit) => benefit.itemIndex),
  );
  // Welcome bases count toward the tier but never its monetary discount basis.
  const volumeEligibleUnits = eligibleUnits;
  const volume = originalVolume.customQuote
    ? originalVolume
    : getVolumeDiscount(volumeEligibleUnits);
  const volumeDiscountBaseCents = items.reduce(
    (sum, item) =>
      discountedItemIndexes.has(item.itemIndex)
        ? sum
        : sum + item.baseSubtotalCents,
    0,
  );
  const volumeDiscountCents = volume.customQuote
    ? 0
    : percentageOfCents(volumeDiscountBaseCents, volume.percent);
  const partnerClient = options.partnerClient === true;
  const partnerDiscountPercent = partnerClient && !volume.customQuote
    ? PARTNER_DISCOUNT_PERCENT : 0;
  const partnerEligibleSubtotalCents = partnerDiscountPercent > 0
    ? volumeDiscountBaseCents - volumeDiscountCents + addOnSubtotalCents : 0;
  const partnerDiscountCents = percentageOfCents(
    partnerEligibleSubtotalCents,
    partnerDiscountPercent,
  );
  const subtotalAfterDiscountCents = volume.customQuote
    ? null
    : baseSubtotalCents +
      addOnSubtotalCents -
      welcomeOffer.totalDiscountCents -
      volumeDiscountCents -
      partnerDiscountCents;

  return {
    pricingVersion: PRICING_VERSION,
    currency: input.currency,
    serviceType: input.serviceType,
    eligibleUnits,
    volumeEligibleUnits,
    baseSubtotalCents,
    addOnSubtotalCents,
    welcomeDiscountCents: welcomeOffer.totalDiscountCents,
    welcomeOffer,
    volumeDiscountPercent: volume.percent,
    volumeDiscountCents,
    partnerClient,
    partnerDiscountPercent,
    partnerEligibleSubtotalCents,
    partnerDiscountCents,
    subtotalAfterDiscountCents,
    taxCalculated: false,
    taxCents: 0,
    totalCents: subtotalAfterDiscountCents,
    customQuote: volume.customQuote,
    items,
  };
}
