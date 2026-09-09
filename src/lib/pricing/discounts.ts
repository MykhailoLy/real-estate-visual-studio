import type { PriceKey } from "./types.ts";

export interface VolumeDiscount {
  percent: number;
  customQuote: boolean;
}

/** Round a percentage discount once, half up, in integer minor units. */
export function percentageOfCents(cents: number, percent: number): number {
  return Number(
    (BigInt(cents) * BigInt(percent) + BigInt(50)) / BigInt(100),
  );
}

/**
 * Catalog-only 360 services are not accepted by the standard order calculator
 * and remain outside its automatic 5% / 10% / 15% discount tiers.
 */
export const STANDARD_VOLUME_DISCOUNT_EXCLUDED_PRICE_KEYS = [
  "360-image-enhancement",
  "360-virtual-staging",
] as const satisfies readonly PriceKey[];

export function getVolumeDiscount(eligibleUnits: number): VolumeDiscount {
  if (!Number.isInteger(eligibleUnits) || eligibleUnits < 0) {
    throw new Error("Eligible unit count must be a non-negative integer.");
  }
  if (eligibleUnits >= 50) return { percent: 0, customQuote: true };
  if (eligibleUnits >= 20) return { percent: 15, customQuote: false };
  if (eligibleUnits >= 10) return { percent: 10, customQuote: false };
  if (eligibleUnits >= 5) return { percent: 5, customQuote: false };
  return { percent: 0, customQuote: false };
}
