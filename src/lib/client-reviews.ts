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
// • storage_path never read or forwarded.
// • Service role key stays server-side only.
//
// Server-only. Never import from "use client" files.
// ============================================================

import "server-only";
import { createClient } from "@supabase/supabase-js";

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
 * All reviews for deliverables owned by `email`. Newest-first.
 * Ownership: JOIN orders WHERE client_email = email.
 */
export async function getReviewsByClientEmail(
  email: string,
): Promise<DeliverableReview[]> {
  if (!email) return [];
  let supabase;
  try {
    supabase = makeClient();
  } catch (e) {
    console.warn(String(e));
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("deliverable_reviews")
      .select(
        "id, deliverable_id, order_id, order_number, item_index, " +
          "client_email, status, comment, created_at, updated_at, " +
          "replacement_deliverable_id, orders!inner(client_email)",
      )
      .eq("orders.client_email", email)
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
  email: string,
): Promise<DeliverableReview | null> {
  if (!deliverableId || !email) return null;
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
          "replacement_deliverable_id, orders!inner(client_email)",
      )
      .eq("deliverable_id", deliverableId)
      .eq("orders.client_email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return stripJoin(data as unknown as RawRow);
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
  email: string,
  action: "approve" | "rework_requested",
  comment?: string,
): Promise<SubmitOk | SubmitFail> {
  if (!deliverableId || !email) {
    return { ok: false, error: "Missing required parameters.", status: 400 };
  }

  if (action === "rework_requested") {
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
        "id, order_id, order_number, item_index, orders!inner(client_email)",
      )
      .eq("id", deliverableId)
      .eq("orders.client_email", email)
      .maybeSingle();

    if (delivErr || !delivData)
      return { ok: false, error: "Deliverable not found.", status: 404 };

    const delivRow = delivData as unknown as {
      id: string;
      order_id: string;
      order_number: string;
      item_index: number | null;
    };

    // 2. Load latest review
    const { data: latestRaw, error: reviewErr } = await supabase
      .from("deliverable_reviews")
      .select("id, status")
      .eq("deliverable_id", deliverableId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reviewErr) {
      console.error("[client-reviews] Review lookup:", reviewErr.message);
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

      // 4. Active rework guard
      if ((ACTIVE_REWORK_STATUSES as string[]).includes(latest))
        return {
          ok: false,
          error: "A rework request is already open for this file.",
          status: 409,
        };
    }

    // 5. Insert
    const newStatus: ReviewStatus =
      action === "approve" ? "approved" : "rework_requested";
    const { data: inserted, error: insertErr } = await supabase
      .from("deliverable_reviews")
      .insert({
        deliverable_id: deliverableId,
        order_id: delivRow.order_id,
        order_number: delivRow.order_number,
        item_index: delivRow.item_index,
        client_email: email,
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
      console.error("[client-reviews] Insert:", insertErr?.message);
      return { ok: false, error: "Could not save review.", status: 500 };
    }

    return { ok: true, review: inserted as unknown as DeliverableReview };
  } catch (err) {
    console.error("[client-reviews] Unexpected:", err);
    return { ok: false, error: "Unexpected server error.", status: 500 };
  }
}
