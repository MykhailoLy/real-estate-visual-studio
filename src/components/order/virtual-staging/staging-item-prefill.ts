import { STAGING_ADDONS } from "../../../data/order-options.ts";

export interface VirtualStagingAddOnSelection {
  selectedAddons: string[];
}

export interface VirtualStagingSupportPrefillItemSource {
  file?: unknown | null;
  roomName: string;
  furnitureStyle: string;
  fileSizeLimit: string;
  disclaimerText: string;
  referenceLink: string;
  referenceFile?: unknown | null;
  additionalInfo: string;
  selectedAddons: readonly string[];
  originalFilename?: string | null;
  referenceFilename?: string | null;
}

export interface VirtualStagingSupportPrefillDraftSource {
  jobTitle: string;
  items: readonly VirtualStagingSupportPrefillItemSource[];
  orderTerms: {
    accepted: boolean;
    allowPortfolio: boolean;
  };
}

export interface VirtualStagingSupportPrefillAutosaveInput {
  currentDraftId: string | null;
  force?: boolean;
  source: VirtualStagingSupportPrefillDraftSource;
  recommendedAddOnIds: readonly string[];
  supportRecommendationApplied: boolean;
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

export function isVirtualStagingSupportPrefillOnlyState(
  source: VirtualStagingSupportPrefillDraftSource,
  recommendedAddOnIds: readonly string[],
): boolean {
  const normalizedRecommendedAddOnIds =
    normalizeVirtualStagingRecommendedAddOnIds(recommendedAddOnIds);
  if (!normalizedRecommendedAddOnIds) return false;
  if (source.items.length === 0) return false;
  if (source.jobTitle.trim() !== "") return false;
  if (source.orderTerms.accepted || source.orderTerms.allowPortfolio) {
    return false;
  }

  const recommendedAddOnIdsSet = new Set(normalizedRecommendedAddOnIds);
  return source.items.every((item) => {
    if (item.file != null || item.referenceFile != null) return false;
    if (item.roomName.trim() !== "") return false;
    if (item.furnitureStyle.trim() !== "") return false;
    if (item.fileSizeLimit.trim() !== "") return false;
    if (item.disclaimerText.trim() !== "") return false;
    if (item.referenceLink.trim() !== "") return false;
    if (item.additionalInfo.trim() !== "") return false;
    if (hasText(item.originalFilename)) return false;
    if (hasText(item.referenceFilename)) return false;

    return item.selectedAddons.every((addOnId) =>
      recommendedAddOnIdsSet.has(addOnId),
    );
  });
}

export function shouldAllowVirtualStagingSupportPrefillAutosave(
  input: VirtualStagingSupportPrefillAutosaveInput,
): boolean {
  if (input.force) return true;
  if (input.currentDraftId) return true;
  if (!input.supportRecommendationApplied) return true;

  return !isVirtualStagingSupportPrefillOnlyState(
    input.source,
    input.recommendedAddOnIds,
  );
}

function normalizeVirtualStagingRecommendedAddOnIds(
  addOnIds: readonly string[],
): string[] | null {
  const normalized: string[] = [];

  for (const addOnId of addOnIds) {
    if (!isVirtualStagingAddOnId(addOnId)) return null;
    if (!normalized.includes(addOnId)) normalized.push(addOnId);
  }

  return normalized.length > 0 ? normalized : null;
}

function isVirtualStagingAddOnId(addOnId: string): boolean {
  return STAGING_ADDONS.some((addOn) => addOn.id === addOnId);
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim() !== "";
}
