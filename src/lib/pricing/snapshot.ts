import type { OrderQuote, PricingSnapshot } from "./types.ts";
import { isTransactionalCurrency } from "./format.ts";

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
    typeof snapshot.baseSubtotalCents !== "number" ||
    typeof snapshot.addOnSubtotalCents !== "number" ||
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
  return snapshot as PricingSnapshot;
}
