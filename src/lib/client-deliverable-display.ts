import type { ClientDeliverable } from "@/lib/client-deliverables";
import type { DeliverableReview } from "@/lib/client-reviews";

export interface CurrentDeliverableRow {
  deliverable: ClientDeliverable;
  review: DeliverableReview | null;
  isReplacement: boolean;
  previousFilename: string | null;
}

/**
 * Returns the client-facing file list. A rework-delivered replacement becomes
 * the current download, while the original deliverable is hidden from the
 * primary list so clients do not accidentally download the stale version.
 */
export function getCurrentDeliverableRows(
  deliverables: ClientDeliverable[],
  reviews: DeliverableReview[]
): CurrentDeliverableRow[] {
  const deliverableById = new Map(deliverables.map((d) => [d.id, d]));
  const latestReviewByDeliverable = new Map<string, DeliverableReview>();

  for (const review of reviews) {
    if (!latestReviewByDeliverable.has(review.deliverable_id)) {
      latestReviewByDeliverable.set(review.deliverable_id, review);
    }
  }

  const replacementReviewByOriginal = new Map<string, DeliverableReview>();
  const replacementReviewByReplacement = new Map<string, DeliverableReview>();

  for (const review of reviews) {
    if (
      review.status !== "rework_delivered" ||
      !review.replacement_deliverable_id ||
      !deliverableById.has(review.replacement_deliverable_id)
    ) {
      continue;
    }

    if (!replacementReviewByOriginal.has(review.deliverable_id)) {
      replacementReviewByOriginal.set(review.deliverable_id, review);
      replacementReviewByReplacement.set(review.replacement_deliverable_id, review);
    }
  }

  return deliverables.flatMap<CurrentDeliverableRow>((deliverable) => {
    const replacementReview = replacementReviewByReplacement.get(deliverable.id);
    if (replacementReview) {
      const previous = deliverableById.get(replacementReview.deliverable_id);
      const ownReview = latestReviewByDeliverable.get(deliverable.id) ?? null;
      return [{
        deliverable,
        review: ownReview ?? replacementReview,
        isReplacement: true,
        previousFilename: previous?.filename ?? null,
      }];
    }

    if (replacementReviewByOriginal.has(deliverable.id)) {
      return [];
    }

    return [{
      deliverable,
      review: latestReviewByDeliverable.get(deliverable.id) ?? null,
      isReplacement: false,
      previousFilename: null,
    }];
  });
}
