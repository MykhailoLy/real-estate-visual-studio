import {
  FLOOR_PLAN_PRICE_KEYS,
  PHOTO_EDIT_PRICE_KEYS,
  PRICING_VERSION,
  RENOVATION_EXTERNAL_PRICE_KEYS,
  RENOVATION_INTERNAL_PRICE_KEYS,
  STAGING_ADDON_PRICE_KEYS,
  getCatalogPrice,
} from "./catalog.ts";
import { getVolumeDiscount } from "./discounts.ts";
import type {
  OrderPricingInput,
  OrderQuote,
  PriceKey,
  PricedAddOn,
  PricedOrderItem,
  TransactionalCurrency,
} from "./types.ts";

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
      item.numberOfFloors < 1 ||
      item.numberOfFloors > 20
    ) {
      throw new PricingValidationError(
        "Floor quantity must be an integer between 1 and 20.",
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
    // Generic Photo Editing treats the highest-priced selected option as the
    // base service; every other selected option is an undiscounted add-on.
    const [base] = [...priced].sort(
      (a, b) => b.unitPriceCents - a.unitPriceCents
    );
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

export function calculateOrderQuote(input: OrderPricingInput): OrderQuote {
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
  const volume = getVolumeDiscount(eligibleUnits);
  const volumeDiscountCents = volume.customQuote
    ? 0
    : Math.round((baseSubtotalCents * volume.percent) / 100);
  const subtotalAfterDiscountCents = volume.customQuote
    ? null
    : baseSubtotalCents + addOnSubtotalCents - volumeDiscountCents;

  return {
    pricingVersion: PRICING_VERSION,
    currency: input.currency,
    serviceType: input.serviceType,
    eligibleUnits,
    baseSubtotalCents,
    addOnSubtotalCents,
    volumeDiscountPercent: volume.percent,
    volumeDiscountCents,
    subtotalAfterDiscountCents,
    taxCalculated: false,
    taxCents: 0,
    totalCents: subtotalAfterDiscountCents,
    customQuote: volume.customQuote,
    items,
  };
}
