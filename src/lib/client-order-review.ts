import type { OrderOwnership } from "@/lib/order-ownership";

export const CLIENT_ORDER_REVIEW_COMMENT_MAX = 2000;

export interface ClientOrderReview {
  id: string;
  order_id: string;
  user_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

export type ClientOrderReviewCreateOutcome =
  | { outcome: "created"; review: ClientOrderReview }
  | {
      outcome:
        | "not_found"
        | "not_delivered"
        | "active_rework"
        | "no_deliverables"
        | "duplicate";
    };

export interface ClientOrderReviewRepository {
  createIfEligible(input: {
    orderId: string;
    userId: string;
    userEmail: string;
    rating: number;
    comment: string | null;
  }): Promise<ClientOrderReviewCreateOutcome>;
}

export type SubmitClientOrderReviewResult =
  | { ok: true; review: ClientOrderReview }
  | { ok: false; error: string; status: number };

function normalizeComment(comment: string | null | undefined): string | null {
  const trimmed = comment?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export async function submitClientOrderReview(
  input: {
    orderId: string;
    rating: number;
    comment?: string | null;
  },
  ownership: OrderOwnership,
  repository: ClientOrderReviewRepository,
): Promise<SubmitClientOrderReviewResult> {
  if (!input.orderId || !ownership.userId || !ownership.email) {
    return { ok: false, error: "Missing required parameters.", status: 400 };
  }

  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    return {
      ok: false,
      error: "Rating must be an integer between 1 and 5.",
      status: 400,
    };
  }

  const comment = normalizeComment(input.comment);
  if (comment && comment.length > CLIENT_ORDER_REVIEW_COMMENT_MAX) {
    return {
      ok: false,
      error: `Comment is too long (max ${CLIENT_ORDER_REVIEW_COMMENT_MAX} characters).`,
      status: 400,
    };
  }

  try {
    const result = await repository.createIfEligible({
      orderId: input.orderId,
      userId: ownership.userId,
      userEmail: ownership.email,
      rating: input.rating,
      comment,
    });

    if (result.outcome === "created") {
      return { ok: true, review: result.review };
    }
    if (result.outcome === "not_found") {
      return { ok: false, error: "Order not found.", status: 404 };
    }
    if (result.outcome === "not_delivered") {
      return {
        ok: false,
        error: "Reviews are available after delivery.",
        status: 409,
      };
    }
    if (result.outcome === "active_rework") {
      return {
        ok: false,
        error: "Complete the active rework before submitting a review.",
        status: 409,
      };
    }
    if (result.outcome === "no_deliverables") {
      return {
        ok: false,
        error: "A review requires at least one delivered file.",
        status: 409,
      };
    }
    return {
      ok: false,
      error: "A review has already been submitted for this order.",
      status: 409,
    };
  } catch (error) {
    console.error("[client-order-review] Submit failed:", error);
    return { ok: false, error: "Could not save review.", status: 500 };
  }
}
