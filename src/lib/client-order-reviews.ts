import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  submitClientOrderReview as submitClientOrderReviewWithRepository,
  type ClientOrderReview,
  type ClientOrderReviewCreateOutcome,
  type ClientOrderReviewRepository,
  type SubmitClientOrderReviewResult,
} from "@/lib/client-order-review";
import { ACTIVE_REWORK_STATUSES } from "@/lib/client-reviews";
import { isOrderOwned, type OrderOwnership } from "@/lib/order-ownership";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export interface ClientOrderReviewLookup {
  available: boolean;
  review: ClientOrderReview | null;
}

interface ReviewRpcRow {
  outcome:
    | "created"
    | "not_found"
    | "not_delivered"
    | "active_rework"
    | "no_deliverables"
    | "duplicate";
  review_id: string | null;
  order_id: string | null;
  user_id: string | null;
  rating: number | null;
  comment: string | null;
  created_at: string | null;
}

interface ReviewDeliverableEligibilityRow {
  file_size: number;
  storage_path: string;
  expires_at: string | null;
}

function isValidReviewDeliverable(
  deliverable: ReviewDeliverableEligibilityRow,
  now: number,
): boolean {
  return (
    deliverable.file_size > 0 &&
    deliverable.storage_path.trim().length > 0 &&
    (deliverable.expires_at === null ||
      Date.parse(deliverable.expires_at) > now)
  );
}

export function createSupabaseClientOrderReviewRepository(
  supabase: SupabaseClient = getSupabaseAdminClient(),
): ClientOrderReviewRepository {
  return {
    async createIfEligible(input): Promise<ClientOrderReviewCreateOutcome> {
      const { data, error } = await supabase.rpc("create_client_order_review", {
        p_order_id: input.orderId,
        p_user_id: input.userId,
        p_user_email: input.userEmail,
        p_rating: input.rating,
        p_comment: input.comment,
      });

      if (error) throw new Error(error.message);
      const row = (data as ReviewRpcRow[] | null)?.[0];
      if (!row) throw new Error("Review creation returned no result.");
      if (row.outcome !== "created") return { outcome: row.outcome };
      if (
        !row.review_id ||
        !row.order_id ||
        row.rating === null ||
        !row.created_at
      ) {
        throw new Error("Review creation returned an incomplete row.");
      }

      return {
        outcome: "created",
        review: {
          id: row.review_id,
          order_id: row.order_id,
          user_id: row.user_id,
          rating: row.rating,
          comment: row.comment,
          created_at: row.created_at,
        },
      };
    },
  };
}

export async function submitClientOrderReview(
  input: { orderId: string; rating: number; comment?: string | null },
  ownership: OrderOwnership,
  repository: ClientOrderReviewRepository = createSupabaseClientOrderReviewRepository(),
): Promise<SubmitClientOrderReviewResult> {
  return submitClientOrderReviewWithRepository(input, ownership, repository);
}

export async function getClientOrderReviewForClient(
  orderId: string,
  ownership: OrderOwnership,
  supabase: SupabaseClient = getSupabaseAdminClient(),
): Promise<ClientOrderReviewLookup> {
  try {
    const { data, error } = await supabase
      .from("client_order_reviews")
      .select(
        "id, order_id, user_id, rating, comment, created_at, " +
          "orders!inner(user_id, client_email)",
      )
      .eq("order_id", orderId)
      .maybeSingle();

    if (error) {
      console.error("[client-order-review] Lookup failed:", error.message);
      return { available: false, review: null };
    }
    if (data) {
      const row = data as unknown as ClientOrderReview & {
        orders: { user_id: string | null; client_email: string | null };
      };
      if (!isOrderOwned(row.orders, ownership)) {
        return { available: false, review: null };
      }

      return {
        available: true,
        review: {
          id: row.id,
          order_id: row.order_id,
          user_id: row.user_id,
          rating: row.rating,
          comment: row.comment,
          created_at: row.created_at,
        },
      };
    }

    const [activeReworkResult, deliverablesResult] = await Promise.all([
      supabase
        .from("deliverable_reviews")
        .select("id")
        .eq("order_id", orderId)
        .in("status", ACTIVE_REWORK_STATUSES)
        .limit(1),
      supabase
        .from("order_deliverables")
        .select("file_size, storage_path, expires_at")
        .eq("order_id", orderId),
    ]);

    if (activeReworkResult.error || deliverablesResult.error) {
      console.error(
        "[client-order-review] Eligibility lookup failed:",
        activeReworkResult.error?.message ?? deliverablesResult.error?.message,
      );
      return { available: false, review: null };
    }

    const hasActiveRework = (activeReworkResult.data?.length ?? 0) > 0;
    const hasValidDeliverable = (
      (deliverablesResult.data ?? []) as ReviewDeliverableEligibilityRow[]
    ).some((deliverable) => isValidReviewDeliverable(deliverable, Date.now()));

    return {
      available: !hasActiveRework && hasValidDeliverable,
      review: null,
    };
  } catch (error) {
    console.error("[client-order-review] Unexpected lookup failure:", error);
    return { available: false, review: null };
  }
}
