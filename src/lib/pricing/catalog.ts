import type {
  PriceKey,
  TransactionalCurrency,
} from "./types.ts";

export const PRICING_VERSION = "2026-09-09-v3";
export const FLOOR_PLAN_MIN_FLOORS = 1;
export const FLOOR_PLAN_MAX_FLOORS = 20;

type FixedCurrencyPrice = Record<TransactionalCurrency, number>;

export const PRICE_CATALOG: Record<PriceKey, FixedCurrencyPrice> = {
  "image-enhancement": { USD: 100, EUR: 100, CAD: 150 },
  "day-to-dusk": { USD: 350, EUR: 300, CAD: 450 },
  "virtual-staging": { USD: 1500, EUR: 1400, CAD: 1900 },
  "item-removal-virtual-cleaning": { USD: 500, EUR: 450, CAD: 650 },
  "shadow-removal": { USD: 500, EUR: 450, CAD: 650 },
  "background-removal": { USD: 150, EUR: 150, CAD: 200 },
  "background-change": { USD: 450, EUR: 400, CAD: 650 },
  "colour-change": { USD: 200, EUR: 150, CAD: 250 },
  "turn-on-lights": { USD: 50, EUR: 50, CAD: 100 },
  "aerial-colour-fade": { USD: 250, EUR: 250, CAD: 350 },
  "aerial-drop-pin": { USD: 250, EUR: 250, CAD: 350 },
  "aerial-single-lot-highlight": { USD: 250, EUR: 250, CAD: 350 },
  "aerial-multiple-lot-highlight": { USD: 450, EUR: 400, CAD: 650 },
  "aerial-full-markup": { USD: 550, EUR: 500, CAD: 750 },
  "water-effect": { USD: 450, EUR: 400, CAD: 650 },
  "360-image-enhancement": { USD: 350, EUR: 350, CAD: 500 },
  "360-virtual-staging": { USD: 3000, EUR: 2800, CAD: 4000 },
  "floor-plan-2d-bw": { USD: 1500, EUR: 1350, CAD: 2100 },
  "floor-plan-2d-colour": { USD: 2000, EUR: 1800, CAD: 2800 },
  "floor-plan-3d": { USD: 3500, EUR: 3150, CAD: 4900 },
  "floor-plan-2d-3d-bundle": { USD: 4500, EUR: 4050, CAD: 6300 },
  "renovation-replace-walls": { USD: 1200, EUR: 1100, CAD: 1700 },
  "renovation-replace-ceiling": { USD: 1200, EUR: 1100, CAD: 1700 },
  "renovation-replace-flooring": { USD: 1700, EUR: 1550, CAD: 2400 },
  "renovation-add-fixtures": { USD: 1700, EUR: 1550, CAD: 2400 },
  "renovation-add-leaves": { USD: 1700, EUR: 1550, CAD: 2400 },
  "renovation-basic-landscaping": { USD: 1700, EUR: 1550, CAD: 2400 },
  "renovation-replace-driveway": { USD: 1700, EUR: 1550, CAD: 2400 },
  "renovation-replace-roof": { USD: 1700, EUR: 1550, CAD: 2400 },
  "renovation-pool-surrounds": { USD: 2400, EUR: 2150, CAD: 3400 },
  "renovation-add-remove-walls": { USD: 3000, EUR: 2700, CAD: 4200 },
  "renovation-add-pool": { USD: 3000, EUR: 2700, CAD: 4200 },
  "renovation-remove-pool-cover": { USD: 3000, EUR: 2700, CAD: 4200 },
  "renovation-replace-exterior-walls": { USD: 3500, EUR: 3150, CAD: 4900 },
  "renovation-add-patio-balcony": { USD: 3500, EUR: 3150, CAD: 4900 },
  "renovation-kitchen-fit-out": { USD: 4500, EUR: 4050, CAD: 6300 },
  "renovation-bathroom-fit-out": { USD: 4500, EUR: 4050, CAD: 6300 },
  "renovation-full-landscaping": { USD: 4500, EUR: 4050, CAD: 6300 },
  "renovation-season-change-landscaping": { USD: 4500, EUR: 4050, CAD: 6300 },
  "renovation-staging-residential": { USD: 1500, EUR: 1400, CAD: 1900 },
  "renovation-staging-commercial-office": { USD: 1500, EUR: 1400, CAD: 1900 },
  "renovation-staging-commercial-non-office": { USD: 1500, EUR: 1400, CAD: 1900 },
  "renovation-exterior-staging": { USD: 1500, EUR: 1400, CAD: 1900 },
  "renovation-item-removal-cleaning": { USD: 500, EUR: 450, CAD: 650 },
  "renovation-colour-change-interior": { USD: 200, EUR: 150, CAD: 250 },
  "renovation-colour-change-exterior": { USD: 200, EUR: 150, CAD: 250 },
};

export const STAGING_ADDON_PRICE_KEYS = {
  "image-enhancement": "image-enhancement",
  "day-to-dusk": "day-to-dusk",
  "item-removal": "item-removal-virtual-cleaning",
  "shadow-removal": "shadow-removal",
  "turn-on-lights": "turn-on-lights",
  "colour-change": "colour-change",
} as const satisfies Record<string, PriceKey>;

export const RENOVATION_INTERNAL_PRICE_KEYS = {
  "replace-flooring": "renovation-replace-flooring",
  "replace-walls": "renovation-replace-walls",
  "replace-ceiling": "renovation-replace-ceiling",
  "item-removal-cleaning": "renovation-item-removal-cleaning",
  "add-remove-walls": "renovation-add-remove-walls",
  "kitchen-fit-out": "renovation-kitchen-fit-out",
  "bathroom-fit-out": "renovation-bathroom-fit-out",
  "add-fixtures": "renovation-add-fixtures",
  "staging-residential": "renovation-staging-residential",
  "staging-commercial-office": "renovation-staging-commercial-office",
  "staging-commercial-non-office": "renovation-staging-commercial-non-office",
  "color-change-interior": "renovation-colour-change-interior",
} as const satisfies Record<string, PriceKey>;

export const RENOVATION_EXTERNAL_PRICE_KEYS = {
  "add-pool": "renovation-add-pool",
  "add-pool-surrounds": "renovation-pool-surrounds",
  "remove-pool-cover": "renovation-remove-pool-cover",
  "add-leaves": "renovation-add-leaves",
  "basic-landscaping": "renovation-basic-landscaping",
  "full-landscaping": "renovation-full-landscaping",
  "season-change-landscaping": "renovation-season-change-landscaping",
  "ext-staging": "renovation-exterior-staging",
  "ext-item-removal": "renovation-item-removal-cleaning",
  "ext-add-fixtures": "renovation-add-fixtures",
  "replace-driveway": "renovation-replace-driveway",
  "replace-roof": "renovation-replace-roof",
  "replace-exterior-walls": "renovation-replace-exterior-walls",
  "add-patio-balcony": "renovation-add-patio-balcony",
  "color-change-exterior": "renovation-colour-change-exterior",
} as const satisfies Record<string, PriceKey>;

export const FLOOR_PLAN_PRICE_KEYS = {
  "2d-bw": "floor-plan-2d-bw",
  "2d-colour": "floor-plan-2d-colour",
  "3d": "floor-plan-3d",
  "2d-3d-bundle": "floor-plan-2d-3d-bundle",
} as const satisfies Record<string, PriceKey>;

export const PHOTO_EDIT_PRICE_KEYS = {
  "image-enhancement-re": "image-enhancement",
  "item-removal-cleaning-pe": "item-removal-virtual-cleaning",
  "shadow-removal": "shadow-removal",
  "background-removal": "background-removal",
  "background-change": "background-change",
  "colour-change-pe": "colour-change",
  "turn-on-lights-pe": "turn-on-lights",
  "aerial-colour-fade-pe": "aerial-colour-fade",
  "aerial-drop-pin-pe": "aerial-drop-pin",
  "aerial-single-lot-highlight-pe": "aerial-single-lot-highlight",
  "aerial-multiple-lot-highlight-pe": "aerial-multiple-lot-highlight",
  "aerial-full-markup-pe": "aerial-full-markup",
  "day-to-dusk-pe": "day-to-dusk",
  "water-effect": "water-effect",
} as const satisfies Record<string, PriceKey>;

export const STAGING_ADDON_IDS = Object.keys(
  STAGING_ADDON_PRICE_KEYS
) as Array<keyof typeof STAGING_ADDON_PRICE_KEYS>;
export const RENOVATION_INTERNAL_IDS = Object.keys(
  RENOVATION_INTERNAL_PRICE_KEYS
) as Array<keyof typeof RENOVATION_INTERNAL_PRICE_KEYS>;
export const RENOVATION_EXTERNAL_IDS = Object.keys(
  RENOVATION_EXTERNAL_PRICE_KEYS
) as Array<keyof typeof RENOVATION_EXTERNAL_PRICE_KEYS>;
export const FLOOR_PLAN_TYPE_IDS = Object.keys(
  FLOOR_PLAN_PRICE_KEYS
) as Array<keyof typeof FLOOR_PLAN_PRICE_KEYS>;
export const PHOTO_EDIT_OPTION_IDS = Object.keys(
  PHOTO_EDIT_PRICE_KEYS
) as Array<keyof typeof PHOTO_EDIT_PRICE_KEYS>;

export function getCatalogPrice(
  priceKey: PriceKey,
  currency: TransactionalCurrency
): number {
  return PRICE_CATALOG[priceKey][currency];
}
