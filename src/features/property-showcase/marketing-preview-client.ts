import type {
  PropertyImageFocalPoint,
  PropertyMarketingMaterialsConfig,
} from "./types.ts";

export const PROPERTY_MARKETING_PREVIEW_DEBOUNCE_MS = 400;

export function serializePropertyMarketingPreviewRequest(
  marketingMaterials: PropertyMarketingMaterialsConfig,
  focalPoints: Array<{
    mediaId: string;
    focalPoint: PropertyImageFocalPoint;
  }>,
): string {
  return JSON.stringify({ marketingMaterials, focalPoints });
}

export function shouldApplyPropertyMarketingPreview(
  responseSequence: number,
  latestSequence: number,
  aborted: boolean,
): boolean {
  return !aborted && responseSequence === latestSequence;
}
