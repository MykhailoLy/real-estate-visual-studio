import type {
  PropertyImageFocalPoint,
  PropertyMarketingMaterialsConfig,
  PropertyShowcase,
} from "./types.ts";

export const PROPERTY_MARKETING_PREVIEW_DEBOUNCE_MS = 400;

export function serializePropertyMarketingPreviewRequest(
  marketingMaterials: PropertyMarketingMaterialsConfig,
  focalPoints: Array<{
    mediaId: string;
    focalPoint: PropertyImageFocalPoint;
  }>,
  property?: PropertyShowcase,
): string {
  return JSON.stringify({ marketingMaterials, focalPoints, property });
}

export function shouldApplyPropertyMarketingPreview(
  responseSequence: number,
  latestSequence: number,
  aborted: boolean,
): boolean {
  return !aborted && responseSequence === latestSequence;
}
