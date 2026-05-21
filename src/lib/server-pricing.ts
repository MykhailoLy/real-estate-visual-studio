import {
  STAGING_BASE_PRICE,
  STAGING_ADDONS,
  RENOVATION_INTERNAL_OPTIONS,
  RENOVATION_EXTERNAL_OPTIONS,
  FLOOR_PLAN_TYPES,
  PHOTO_EDIT_OPTIONS,
} from "@/data/order-options";
import type {
  StagingItem,
  RenovationItem,
  FloorPlanItem,
  PhotoEditItem,
} from "./server-validation";

// ============================================================
// SERVER-SIDE PRICE RECALCULATION
// Never trust client-sent totals. Always recalculate on server.
// All values in USD cents.
// ============================================================

/**
 * Recalculate staging item subtotal from option IDs
 */
export function recalcStagingSubtotal(item: StagingItem): number {
  let total = STAGING_BASE_PRICE;
  for (const id of item.selectedAddons) {
    const addon = STAGING_ADDONS.find((a) => a.id === id);
    if (addon) total += addon.price;
  }
  return total;
}

/**
 * Recalculate renovation item subtotal from option IDs
 */
export function recalcRenovationSubtotal(item: RenovationItem): number {
  let total = 0;
  for (const id of item.selectedInternal) {
    const opt = RENOVATION_INTERNAL_OPTIONS.find((o) => o.id === id);
    if (opt) total += opt.price;
  }
  for (const id of item.selectedExternal) {
    const opt = RENOVATION_EXTERNAL_OPTIONS.find((o) => o.id === id);
    if (opt) total += opt.price;
  }
  return total;
}

/**
 * Recalculate floor plan item subtotal from plan type + floors
 */
export function recalcFloorPlanSubtotal(item: FloorPlanItem): number {
  const planType = FLOOR_PLAN_TYPES.find((t) => t.id === item.planType);
  if (!planType) return 0;
  return planType.price * Math.max(1, item.numberOfFloors);
}

/**
 * Recalculate photo editing item subtotal from option IDs
 */
export function recalcPhotoEditSubtotal(item: PhotoEditItem): number {
  let total = 0;
  for (const id of item.selectedOptions) {
    const opt = PHOTO_EDIT_OPTIONS.find((o) => o.id === id);
    if (opt) total += opt.price;
  }
  return total;
}

/**
 * Get human-readable labels for addon/option IDs
 */
export function getStagingAddonLabels(ids: string[]): string[] {
  return ids
    .map((id) => STAGING_ADDONS.find((a) => a.id === id)?.label)
    .filter((l): l is string => !!l);
}

export function getRenovationInternalLabels(ids: string[]): string[] {
  return ids
    .map((id) => RENOVATION_INTERNAL_OPTIONS.find((o) => o.id === id)?.label)
    .filter((l): l is string => !!l);
}

export function getRenovationExternalLabels(ids: string[]): string[] {
  return ids
    .map((id) => RENOVATION_EXTERNAL_OPTIONS.find((o) => o.id === id)?.label)
    .filter((l): l is string => !!l);
}

export function getFloorPlanTypeLabel(id: string): string {
  return FLOOR_PLAN_TYPES.find((t) => t.id === id)?.label ?? "Unknown";
}

export function getPhotoEditOptionLabels(ids: string[]): string[] {
  return ids
    .map((id) => PHOTO_EDIT_OPTIONS.find((o) => o.id === id)?.label)
    .filter((l): l is string => !!l);
}
