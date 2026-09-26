// ============================================================
// CLIENT REVIEWS — server-side helpers (Phase 5D.1)
//
// All DB access uses the service role key (bypasses RLS).
// Clients have no direct INSERT access to deliverable_reviews.
//
// SECURITY CONTRACT:
// • email MUST come from getClientUser() on the server.
// • Ownership verified via JOIN: order_deliverables → orders
//   WHERE orders.client_email = verified email.
// • client_email in review rows set from verified session only.
// • Abandoned reference paths are used server-side for cleanup, never forwarded.
// • Service role key stays server-side only.
//
// Server-only. Never import from "use client" files.
// ============================================================

import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getOwnedOrderIds } from "@/lib/client-orders";
import { isOrderOwned, type OrderOwnership } from "@/lib/order-ownership";
import { REWORK_REFERENCES_MAX_FILES } from "@/lib/rework-references-config";
import { ORDER_FILES_BUCKET } from "@/lib/upload-config";

// ── Types ─────────────────────────────────────────────────────

export type ReviewStatus =
  | "pending_review"
  | "approved"
  | "rework_requested"
  | "rework_in_progress"
  | "rework_delivered"
  | "resolved";

export interface DeliverableReview {
  id: string;
  deliverable_id: string;
  order_id: string;
  order_number: string;
  item_index: number | null;
  client_email: string;
  status: ReviewStatus;
  comment: string | null;
  created_at: string;
  updated_at: string;
  replacement_deliverable_id: string | null;
}

export const TERMINAL_REVIEW_STATUSES: ReviewStatus[] = [
  "approved",
  "resolved",
];
export const ACTIVE_REWORK_STATUSES: ReviewStatus[] = [
  "rework_requested",
  "rework_in_progress",
];

export const REVIEW_COMMENT_MIN = 10;
export const REVIEW_COMMENT_MAX = 1000;

// ── Private factory ───────────────────────────────────────────

function makeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "[client-reviews] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// ── Helpers ───────────────────────────────────────────────────

type RawRow = DeliverableReview & {
  orders?: unknown;
  order_deliverables?: unknown;
};

function stripJoin(row: RawRow): DeliverableReview {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { orders: _o, order_deliverables: _od, ...safe } = row;
  return safe as DeliverableReview;
}

// ── Public API ────────────────────────────────────────────────

/**
 * All reviews for deliverables owned by the authenticated account.
 * Newest-first. Ownership resolved via getOwnedOrderIds() and scoped
 * with `order_id IN (ownedIds)`.
 */
export async function getReviewsForClient(
  ownership: OrderOwnership,
): Promise<DeliverableReview[]> {
  if (!ownership?.userId || !ownership?.email) return [];
  let supabase;
  try {
    supabase = makeClient();
  } catch (e) {
    console.warn(String(e));
    return [];
  }

  try {
    const ownedOrderIds = await getOwnedOrderIds(ownership);
    if (ownedOrderIds.length === 0) return [];

    const { data, error } = await supabase
      .from("deliverable_reviews")
      .select(
        "id, deliverable_id, order_id, order_number, item_index, " +
          "client_email, status, comment, created_at, updated_at, " +
          "replacement_deliverable_id",
      )
      .in("order_id", ownedOrderIds)
      .neq("status", "pending_review")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[client-reviews] Fetch:", error.message);
      return [];
    }
    return ((data ?? []) as unknown as RawRow[]).map(stripJoin);
  } catch (err) {
    console.error("[client-reviews] Unexpected:", err);
    return [];
  }
}

/**
 * Most recent review for one deliverable, ownership-checked.
 */
export async function getLatestReviewForDeliverable(
  deliverableId: string,
  ownership: OrderOwnership,
): Promise<DeliverableReview | null> {
  if (!deliverableId || !ownership?.userId || !ownership?.email) return null;
  let supabase;
  try {
    supabase = makeClient();
  } catch (e) {
    console.warn(String(e));
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("deliverable_reviews")
      .select(
        "id, deliverable_id, order_id, order_number, item_index, " +
          "client_email, status, comment, created_at, updated_at, " +
          "replacement_deliverable_id, orders!inner(user_id, client_email)",
      )
      .eq("deliverable_id", deliverableId)
      .neq("status", "pending_review")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as unknown as RawRow & {
      orders: { user_id: string | null; client_email: string | null };
    };
    if (!isOrderOwned(row.orders, ownership)) return null;
    return stripJoin(row);
  } catch (err) {
    console.error("[client-reviews] Unexpected:", err);
    return null;
  }
}

// ── Submit ────────────────────────────────────────────────────

type SubmitOk = { ok: true; review: DeliverableReview };
type SubmitFail = { ok: false; error: string; status: number };

export async function submitDeliverableReview(
  deliverableId: string,
  ownership: OrderOwnership,
  action: "approve" | "rework_requested",
  comment?: string,
  referenceFileCount = 0,
): Promise<SubmitOk | SubmitFail> {
  if (!deliverableId || !ownership?.userId || !ownership?.email) {
    return { ok: false, error: "Missing required parameters.", status: 400 };
  }

  if (action === "rework_requested") {
    if (!Number.isInteger(referenceFileCount) || referenceFileCount < 0 || referenceFileCount > REWORK_REFERENCES_MAX_FILES) {
      return { ok: false, error: "Invalid reference file count.", status: 400 };
    }
    const c = (comment ?? "").trim();
    if (c.length < REVIEW_COMMENT_MIN)
      return {
        ok: false,
        error: `Please describe what needs to change (min ${REVIEW_COMMENT_MIN} characters).`,
        status: 400,
      };
    if (c.length > REVIEW_COMMENT_MAX)
      return {
        ok: false,
        error: `Comment is too long (max ${REVIEW_COMMENT_MAX} characters).`,
        status: 400,
      };
  }

  let supabase;
  try {
    supabase = makeClient();
  } catch (e) {
    console.error(String(e));
    return { ok: false, error: "Server configuration error.", status: 500 };
  }

  try {
    // 1. Verify deliverable ownership
    const { data: delivData, error: delivErr } = await supabase
      .from("order_deliverables")
      .select(
        "id, order_id, order_number, item_index, orders!inner(user_id, client_email)",
      )
      .eq("id", deliverableId)
      .maybeSingle();

    if (delivErr || !delivData)
      return { ok: false, error: "Deliverable not found.", status: 404 };

    const delivJoinRow = delivData as unknown as {
      id: string;
      order_id: string;
      order_number: string;
      item_index: number | null;
      orders: { user_id: string | null; client_email: string | null };
    };

    // Ownership check — wrong owner is indistinguishable from not found.
    if (!isOrderOwned(delivJoinRow.orders, ownership))
      return { ok: false, error: "Deliverable not found.", status: 404 };

    const delivRow = {
      id: delivJoinRow.id,
      order_id: delivJoinRow.order_id,
      order_number: delivJoinRow.order_number,
      item_index: delivJoinRow.item_index,
    };

    // An internal preparation must never mask any older active rework.
    const { data: active, error: activeError } = await supabase
      .from("deliverable_reviews").select("id")
      .eq("deliverable_id", deliverableId).in("status", ACTIVE_REWORK_STATUSES)
      .limit(1).maybeSingle();
    if (activeError) return { ok: false, error: "Could not check review state.", status: 500 };
    if (active) return { ok: false, error: "A rework request is already open for this file.", status: 409 };

    // 2. Load latest visible review
    const { data: latestRaw, error: reviewErr } = await supabase
      .from("deliverable_reviews")
      .select("id, status")
      .eq("deliverable_id", deliverableId)
      .neq("status", "pending_review")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reviewErr) {
      console.error("[client-reviews] Review lookup failed.");
      return { ok: false, error: "Could not check review state.", status: 500 };
    }

    if (latestRaw) {
      const latest = (latestRaw as { status: ReviewStatus }).status;

      // 3. Terminal state guard — scoped to the approve action only.
      //
      // rework_requested is intentionally allowed after terminal states
      // (approved / resolved) so clients can request changes at any time
      // without being locked out by a prior approval (Phase 5H.3).
      //
      // The approve action retains the guard for safety even though it is
      // no longer exposed in the client UI (Phase 5H.3 removed the button).
      if (
        action === "approve" &&
        (TERMINAL_REVIEW_STATUSES as string[]).includes(latest)
      )
        return {
          ok: false,
          error: "This deliverable has already been approved or resolved.",
          status: 409,
        };

    }

    if (action === "rework_requested" && referenceFileCount > 0) {
      // Capture paths before FK cascade, but delete only still-pending parents.
      // A concurrent finalization must not cause committed attachments to be removed.
      const { data: abandoned, error: abandonedError } = await supabase
        .from("deliverable_reviews").select("id")
        .eq("deliverable_id", deliverableId).eq("status", "pending_review");
      if (abandonedError) return { ok: false, error: "Could not prepare rework request.", status: 500 };
      const ids = (abandoned ?? []).map((row) => row.id as string);
      if (ids.length > 0) {
        const { data: files, error: filesError } = await supabase
          .from("deliverable_review_files").select("review_id, storage_path").in("review_id", ids);
        if (filesError) return { ok: false, error: "Could not prepare rework request.", status: 500 };
        const { data: retired, error: retireError } = await supabase
          .from("deliverable_reviews").delete().in("id", ids)
          .eq("deliverable_id", deliverableId).eq("status", "pending_review").select("id");
        if (retireError || !retired) return { ok: false, error: "Could not prepare rework request.", status: 500 };
        const retiredIds = new Set(retired.map((row) => row.id as string));
        const paths = (files ?? []).filter((file) => retiredIds.has(file.review_id))
          .map((file) => file.storage_path as string);
        if (paths.length > 0) {
          try {
            const { error } = await supabase.storage.from(ORDER_FILES_BUCKET).remove(paths);
            if (error) console.warn("[client-reviews] Abandoned reference Storage cleanup failed.");
          } catch {
            console.warn("[client-reviews] Abandoned reference Storage cleanup failed.");
          }
        }
        if (retiredIds.size !== ids.length) {
          return { ok: false, error: "Review state changed. Please refresh and try again.", status: 409 };
        }
      }
    }

    // 5. Attachments commit only through the finalization RPC.
    const newStatus: ReviewStatus =
      action === "approve" ? "approved" : referenceFileCount > 0 ? "pending_review" : "rework_requested";
    const { data: inserted, error: insertErr } = await supabase
      .from("deliverable_reviews")
      .insert({
        deliverable_id: deliverableId,
        order_id: delivRow.order_id,
        order_number: delivRow.order_number,
        item_index: delivRow.item_index,
        client_email: ownership.email,
        status: newStatus,
        comment: action === "rework_requested" ? (comment ?? "").trim() : null,
      })
      .select(
        "id, deliverable_id, order_id, order_number, item_index, " +
          "client_email, status, comment, created_at, updated_at, replacement_deliverable_id",
      )
      .single();

    if (insertErr || !inserted) {
      if (insertErr?.code === "23505")
        return {
          ok: false,
          error: "A rework request is already open for this file.",
          status: 409,
        };
      console.error("[client-reviews] Review insert failed.");
      return { ok: false, error: "Could not save review.", status: 500 };
    }

    return { ok: true, review: inserted as unknown as DeliverableReview };
  } catch {
    console.error("[client-reviews] Review submission failed.");
    return { ok: false, error: "Unexpected server error.", status: 500 };
  }
}

/** Commit an owned preparation only after every selected file is verified. */
export async function finalizeReworkReviewSubmission(
  reviewId: string,
  ownership: OrderOwnership,
  expectedFileCount: number,
): Promise<{ ok: true; review: Pick<DeliverableReview, "id" | "status" | "comment" | "created_at"> } | SubmitFail> {
  if (!ownership?.userId || !ownership.email) return { ok: false, error: "Review not found.", status: 404 };
  if (!Number.isInteger(expectedFileCount) || expectedFileCount < 1 || expectedFileCount > REWORK_REFERENCES_MAX_FILES) {
    return { ok: false, error: "Invalid reference file count.", status: 400 };
  }
  try {
    const supabase = makeClient();
    const { data: review, error: lookupError } = await supabase.from("deliverable_reviews")
      .select("id, orders!inner(user_id, client_email)").eq("id", reviewId).maybeSingle();
    const row = review as unknown as { orders: { user_id: string | null; client_email: string | null } } | null;
    if (lookupError || !row || !isOrderOwned(row.orders, ownership)) {
      return { ok: false, error: "Review not found.", status: 404 };
    }
    const { data, error } = await supabase.rpc("finalize_rework_review_submission", {
      p_review_id: reviewId, p_expected_file_count: expectedFileCount,
    });
    const result = Array.isArray(data) && data.length === 1 ? data[0] : null;
    if (error?.code === "23505" || result?.result_code === "active_rework") {
      return { ok: false, error: "A rework request is already open for this file.", status: 409 };
    }
    if (error || !result) return { ok: false, error: "Could not submit rework request.", status: 500 };
    if (result.result_code === "not_found") return { ok: false, error: "Review not found.", status: 404 };
    if (result.result_code === "invalid_state") return { ok: false, error: "Review state changed. Please refresh and try again.", status: 409 };
    if (result.result_code === "files_incomplete" || result.result_code === "invalid_count") {
      return { ok: false, error: "Reference files are not complete. The rework request was not submitted.", status: 409 };
    }
    if (result.result_code !== "finalized" || result.review_id !== reviewId || result.status !== "rework_requested" ||
        typeof result.created_at !== "string" || (result.comment !== null && typeof result.comment !== "string")) {
      return { ok: false, error: "Could not confirm rework request.", status: 500 };
    }
    return { ok: true, review: { id: result.review_id, status: result.status, comment: result.comment, created_at: result.created_at } };
  } catch {
    console.error("[client-reviews] Rework finalization failed.");
    return { ok: false, error: "Could not submit rework request.", status: 500 };
  }
}
