import { calculateOrderQuote } from "@/lib/pricing/calculate";
import type { TransactionalCurrency } from "@/lib/pricing/types";

// Compatibility helpers for existing item cards. All formulas delegate to
// the canonical calculator; no price values or independent arithmetic live
// in this module.

export function calculateStagingItemTotal(
  selectedAddonIds: string[],
  currency: TransactionalCurrency = "USD"
): number {
  return calculateOrderQuote({
    serviceType: "virtual-staging",
    currency,
    items: [{ selectedAddons: selectedAddonIds }],
  }).items[0].lineSubtotalCents;
}

export function calculateRenovationItemTotal(
  selectedInternalIds: string[],
  selectedExternalIds: string[],
  currency: TransactionalCurrency = "USD"
): number {
  if (selectedInternalIds.length === 0 && selectedExternalIds.length === 0) {
    return 0;
  }
  return calculateOrderQuote({
    serviceType: "virtual-renovation",
    currency,
    items: [
      {
        selectedInternal: selectedInternalIds,
        selectedExternal: selectedExternalIds,
      },
    ],
  }).items[0].lineSubtotalCents;
}

export function calculateFloorPlanItemTotal(
  planTypeId: string,
  numberOfFloors: number,
  currency: TransactionalCurrency = "USD"
): number {
  if (!planTypeId) return 0;
  return calculateOrderQuote({
    serviceType: "3d-floor-plans",
    currency,
    items: [{ planType: planTypeId, numberOfFloors }],
  }).items[0].lineSubtotalCents;
}

export function calculatePhotoEditItemTotal(
  selectedOptionIds: string[],
  currency: TransactionalCurrency = "USD",
  baseOptionId?: string,
): number {
  if (selectedOptionIds.length === 0) return 0;
  return calculateOrderQuote({
    serviceType: "photo-editing",
    currency,
    items: [{ selectedOptions: selectedOptionIds, baseOptionId }],
  }).items[0].lineSubtotalCents;
}

export function calculateOrderTotal(itemTotals: number[]): number {
  return itemTotals.reduce((sum, total) => sum + total, 0);
}
