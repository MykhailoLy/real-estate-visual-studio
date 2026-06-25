export const TRANSACTIONAL_CURRENCIES = ["USD", "EUR", "CAD"] as const;

export type TransactionalCurrency =
  (typeof TRANSACTIONAL_CURRENCIES)[number];

export type PriceKey =
  | "image-enhancement"
  | "day-to-dusk"
  | "virtual-staging"
  | "item-removal-virtual-cleaning"
  | "shadow-removal"
  | "background-removal"
  | "background-change"
  | "colour-change"
  | "turn-on-lights"
  | "water-effect"
  | "360-image-enhancement"
  | "360-virtual-staging"
  | "floor-plan-2d-bw"
  | "floor-plan-2d-colour"
  | "floor-plan-3d"
  | "floor-plan-2d-3d-bundle"
  | "renovation-replace-walls"
  | "renovation-replace-ceiling"
  | "renovation-replace-flooring"
  | "renovation-add-fixtures"
  | "renovation-add-leaves"
  | "renovation-basic-landscaping"
  | "renovation-replace-driveway"
  | "renovation-replace-roof"
  | "renovation-pool-surrounds"
  | "renovation-add-remove-walls"
  | "renovation-add-pool"
  | "renovation-remove-pool-cover"
  | "renovation-replace-exterior-walls"
  | "renovation-add-patio-balcony"
  | "renovation-kitchen-fit-out"
  | "renovation-bathroom-fit-out"
  | "renovation-full-landscaping"
  | "renovation-season-change-landscaping"
  | "renovation-staging-residential"
  | "renovation-staging-commercial-office"
  | "renovation-staging-commercial-non-office"
  | "renovation-exterior-staging"
  | "renovation-item-removal-cleaning"
  | "renovation-colour-change-interior"
  | "renovation-colour-change-exterior";

export type TransactionalServiceType =
  | "virtual-staging"
  | "virtual-renovation"
  | "3d-floor-plans"
  | "photo-editing";

export interface StagingPricingItem {
  selectedAddons: string[];
}

export interface RenovationPricingItem {
  selectedInternal: string[];
  selectedExternal: string[];
}

export interface FloorPlanPricingItem {
  planType: string;
  numberOfFloors: number;
}

export interface PhotoEditingPricingItem {
  selectedOptions: string[];
}

export type OrderPricingInput =
  | {
      serviceType: "virtual-staging";
      currency: TransactionalCurrency;
      items: StagingPricingItem[];
    }
  | {
      serviceType: "virtual-renovation";
      currency: TransactionalCurrency;
      items: RenovationPricingItem[];
    }
  | {
      serviceType: "3d-floor-plans";
      currency: TransactionalCurrency;
      items: FloorPlanPricingItem[];
    }
  | {
      serviceType: "photo-editing";
      currency: TransactionalCurrency;
      items: PhotoEditingPricingItem[];
    };

export type OrderPricingPreviewInput =
  | Omit<
      Extract<OrderPricingInput, { serviceType: "virtual-staging" }>,
      "currency"
    >
  | Omit<
      Extract<OrderPricingInput, { serviceType: "virtual-renovation" }>,
      "currency"
    >
  | Omit<
      Extract<OrderPricingInput, { serviceType: "3d-floor-plans" }>,
      "currency"
    >
  | Omit<
      Extract<OrderPricingInput, { serviceType: "photo-editing" }>,
      "currency"
    >;

export interface PricedAddOn {
  id: string;
  priceKey: PriceKey;
  unitPriceCents: number;
  quantity: number;
  subtotalCents: number;
}

export interface PricedOrderItem {
  itemIndex: number;
  quantity: number;
  priceKey: PriceKey | null;
  unitPriceCents: number;
  baseSubtotalCents: number;
  addOns: PricedAddOn[];
  addOnSubtotalCents: number;
  lineSubtotalCents: number;
}

export interface OrderQuote {
  pricingVersion: string;
  currency: TransactionalCurrency;
  serviceType: TransactionalServiceType;
  eligibleUnits: number;
  baseSubtotalCents: number;
  addOnSubtotalCents: number;
  volumeDiscountPercent: number;
  volumeDiscountCents: number;
  subtotalAfterDiscountCents: number | null;
  taxCalculated: false;
  taxCents: 0;
  totalCents: number | null;
  customQuote: boolean;
  items: PricedOrderItem[];
}

export interface PricingSnapshot extends OrderQuote {
  pricedAt: string;
}
