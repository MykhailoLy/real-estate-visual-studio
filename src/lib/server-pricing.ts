import {
  STAGING_ADDONS,
  RENOVATION_INTERNAL_OPTIONS,
  RENOVATION_EXTERNAL_OPTIONS,
  FLOOR_PLAN_TYPES,
  PHOTO_EDIT_OPTIONS,
} from "@/data/order-options";

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
