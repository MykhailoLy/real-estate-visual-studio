import { isDedicatedPhotoEditingSubService } from "./dedicated-photo-editing.ts";

interface OneToOneImageEditingInput {
  details: Record<string, unknown>;
  hasOriginalSource: boolean;
  deliverableCount: number;
}

/**
 * Dedicated photo-editing orders are submitted with one original image for
 * each item. We only opt into the paired presentation when that source shape
 * is still intact. Reference files are item-local supporting material and do
 * not change the original-to-result relationship.
 *
 * Generic/batch and historical jobs deliberately fall back to the existing
 * file workflow because their eventual delivery mapping is not knowable before
 * delivery without a persisted capability flag.
 */
export function isOneToOneImageEditingPresentation({
  details,
  hasOriginalSource,
  deliverableCount,
}: OneToOneImageEditingInput): boolean {
  return (
    hasOriginalSource &&
    deliverableCount <= 1 &&
    isDedicatedPhotoEditingSubService(details.sub_service)
  );
}

/**
 * Rework is an existing deliverable-level client action. This display gate
 * keeps its entry point out of pre-delivery order states without changing the
 * action, its server-side ownership checks, or any order status.
 */
export function canShowCompletedReworkAction(
  orderStatus: string,
  hasDeliveredFile: boolean,
): boolean {
  return hasDeliveredFile && (orderStatus === "delivered" || orderStatus === "completed");
}
