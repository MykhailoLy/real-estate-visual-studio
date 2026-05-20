import type { RemoteServiceType } from "@/types";

/**
 * Pricing constants for remote digital services.
 * TODO: Replace placeholder values with actual pricing.
 */
export const PRICING: Record<RemoteServiceType, { pricePerItem: number; unit: string }> = {
  "virtual-staging": {
    pricePerItem: 35, // €XX per image — update with real price
    unit: "per image",
  },
  "virtual-renovation": {
    pricePerItem: 55, // €XX per image — update with real price
    unit: "per image",
  },
  "floor-plans": {
    pricePerItem: 45, // €XX per floor — update with real price
    unit: "per floor",
  },
  "photo-editing": {
    pricePerItem: 15, // €XX per image — update with real price
    unit: "per image",
  },
};

/**
 * Calculate estimated total for an order
 */
export function calculateEstimate(serviceType: RemoteServiceType, itemCount: number): number {
  const pricing = PRICING[serviceType];
  if (!pricing) return 0;
  return pricing.pricePerItem * itemCount;
}

/**
 * Volume discount tiers (future use)
 */
export const VOLUME_DISCOUNTS = [
  { minItems: 5, maxItems: 9, discount: 0.1 },
  { minItems: 10, maxItems: 19, discount: 0.15 },
  { minItems: 20, maxItems: Infinity, discount: 0.2 },
];
