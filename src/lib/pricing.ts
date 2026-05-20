import {
  STAGING_BASE_PRICE,
  STAGING_ADDONS,
  RENOVATION_INTERNAL_OPTIONS,
  RENOVATION_EXTERNAL_OPTIONS,
  FLOOR_PLAN_TYPES,
  PHOTO_EDIT_OPTIONS,
  type AddOnOption,
  type RenovationOption,
  type PhotoEditOption,
} from "@/data/order-options";

// ============================================================
// PRICING CALCULATION FUNCTIONS
// All amounts in cents (USD). Use formatUSD() for display.
// ============================================================

/**
 * Virtual Staging: base price + selected add-ons
 */
export function calculateStagingItemTotal(selectedAddonIds: string[]): number {
  let total = STAGING_BASE_PRICE;
  for (const id of selectedAddonIds) {
    const addon = STAGING_ADDONS.find((a: AddOnOption) => a.id === id);
    if (addon) total += addon.price;
  }
  return total;
}

/**
 * Virtual Renovation: sum of selected internal + external options
 */
export function calculateRenovationItemTotal(
  selectedInternalIds: string[],
  selectedExternalIds: string[]
): number {
  let total = 0;
  for (const id of selectedInternalIds) {
    const opt = RENOVATION_INTERNAL_OPTIONS.find((o: RenovationOption) => o.id === id);
    if (opt) total += opt.price;
  }
  for (const id of selectedExternalIds) {
    const opt = RENOVATION_EXTERNAL_OPTIONS.find((o: RenovationOption) => o.id === id);
    if (opt) total += opt.price;
  }
  return total;
}

/**
 * Floor Plans: plan type price × number of floors
 */
export function calculateFloorPlanItemTotal(
  planTypeId: string,
  numberOfFloors: number
): number {
  const planType = FLOOR_PLAN_TYPES.find((t) => t.id === planTypeId);
  if (!planType) return 0;
  return planType.price * Math.max(1, numberOfFloors);
}

/**
 * Photo Editing: sum of selected editing options
 */
export function calculatePhotoEditItemTotal(selectedOptionIds: string[]): number {
  let total = 0;
  for (const id of selectedOptionIds) {
    const opt = PHOTO_EDIT_OPTIONS.find((o: PhotoEditOption) => o.id === id);
    if (opt) total += opt.price;
  }
  return total;
}

/**
 * Sum an array of item totals (all in cents)
 */
export function calculateOrderTotal(itemTotals: number[]): number {
  return itemTotals.reduce((sum, t) => sum + t, 0);
}
