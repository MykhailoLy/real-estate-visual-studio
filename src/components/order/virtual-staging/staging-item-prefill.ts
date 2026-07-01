import { STAGING_ADDONS } from "../../../data/order-options.ts";

export interface VirtualStagingAddOnSelection {
  selectedAddons: string[];
}

export function applyVirtualStagingInitialAddOns<
  T extends VirtualStagingAddOnSelection,
>(item: T, addOnIds: readonly string[]): T {
  const selectedAddons = normalizeVirtualStagingAddOnIds([
    ...item.selectedAddons,
    ...addOnIds,
  ]);

  return {
    ...item,
    selectedAddons,
  };
}

export function normalizeVirtualStagingAddOnIds(
  addOnIds: readonly string[],
): string[] {
  const normalized: string[] = [];

  for (const addOnId of addOnIds) {
    if (!isVirtualStagingAddOnId(addOnId)) continue;
    if (!normalized.includes(addOnId)) normalized.push(addOnId);
  }

  return normalized;
}

function isVirtualStagingAddOnId(addOnId: string): boolean {
  return STAGING_ADDONS.some((addOn) => addOn.id === addOnId);
}
