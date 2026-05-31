// ============================================================
// CLIENT REVIEWS — server-side helpers (Phase 5D.1)
//
// Reads and writes deliverable_reviews rows for the client portal.
// Clients can approve a deliverable or request rework with a
// written comment. All DB access uses the service role key.
//
// ⚠️  SECURITY CONTRACT (identical to client-deliverables.ts)
// ─────────────────────────────────────────────────────────
// • `email` MUST come from getClientUser() on the server.
//   NEVER accept email from URL params, query string, cookies,
//   localStorage, or request body.
// • Ownership is verified by JOINing order_deliverables → orders
//   and requiring orders.client_email = verified email.
// • client_email stored in review rows is set from the verified
//   session email — never from client input.
// • storage_path is never read or forwarded.
// • Service role key stays server-side only.
//
// Server-only. Never import from a "use client" file.
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

/** Safe subset of deliverable_reviews exposed to the client layer. */
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

/** Terminal states — no further client action permitted. */
export const TERMINAL_REVIEW_STATUSES: ReviewStatus[] = ["approved", "resolved"];

/** Active rework states — blocks a new rework submission. */
export const ACTIVE_REWORK_STATUSES: ReviewStatus[] = [
  "rework_requested",
  "rework_in_progress",
];

export const REVIEW_COMMENT_MIN = 10;
export const REVIEW_COMMENT_MAX = 1000;

// ── Private factory ───────────────────────────────────────────

function makeClient() {
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "[client-reviews] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// ── Helper ────────────────────────────────────────────────────

type RawReviewRow = DeliverableReview & {
  orders?: unknown;
  order_deliverables?: unknown;
};

/** Strips JOIN columns before returning to callers. */
function stripJoin(row: RawReviewRow): DeliverableReview {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { orders: _o, order_deliverables: _od, ...safe } = row;
  return safe as DeliverableReview;
}

// ── Public API ────────────────────────────────────────────────

/**
 * Returns all reviews for deliverables belonging to orders
 * owned by `email`. Ordered newest-first so callers can take
 * the first entry per deliverable_id as the latest review.
 *
 * Ownership enforced by JOIN: orders.client_email = email.
 * Returns [] on missing env vars or any DB error.
 */
export async function getReviewsByClientEmail(
  email: string
): Promise<DeliverableReview[]> {
  if (!email) return [];

  let supabase;
  try { supabase = makeClient(); } catch (e) {
    console.warn(String(e));
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("deliverable_reviews")
      .select(
        "id, deliverable_id, order_id, order_number, item_index, " +
        "client_email, status, comment, created_at, updated_at, " +
        "replacement_deliverable_id, " +
        "orders!inner(client_email)"
      )
      .eq("orders.client_email", email)   // ← ownership check
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[client-reviews] Fetch error:", error.message);
      return [];
    }

    return ((data ?? []) as unknown as RawReviewRow[]).map(stripJoin);
  } catch (err) {
    console.error("[client-reviews] Unexpected error in getReviewsByClientEmail:", err);
    return [];
  }
}

/**
 * Returns the most recent review for a single deliverable,
 * ownership-checked against `email`.
 * Returns null if not found, wrong owner, or any error.
 */
export async function getLatestReviewForDeliverable(
  deliverableId: string,
  email: string
): Promise<DeliverableReview | null> {
  if (!deliverableId || !email) return null;

  let supabase;
  try { supabase = makeClient(); } catch (e) {
    console.warn(String(e));
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("deliverable_reviews")
      .select(
        "id, deliverable_id, order_id, order_number, item_index, " +
        "client_email, status, comment, created_at, updated_at, " +
        "replacement_deliverable_id, " +
        "orders!inner(client_email)"
      )
      .eq("deliverable_id", deliverableId)
      .eq("orders.client_email", email)   // ← ownership check
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return stripJoin(data as unknown as RawReviewRow);
  } catch (err) {
    console.error("[client-reviews] Unexpected error in getLatestReviewForDeliverable:", err);
    return null;
  }
}

// ── Submit review ─────────────────────────────────────────────

type SubmitOk   = { ok: true;  review: DeliverableReview };
type SubmitFail = { ok: false; error: string; status: number };

/**
 * Submits a client review action (approve or rework_requested).
 *
 * SECURITY:
 *  1. Verifies the deliverable exists and belongs to `email`
 *     via a single ownership-guarded JOIN query.
 *  2. Loads the latest existing review for this deliverable.
 *  3. Rejects if latest review is terminal (approved/resolved) → 409.
 *  4. Rejects if an active rework is open
 *     (rework_requested/rework_in_progress) → 409.
 *  5. Validates comment for rework_requested (min/max length).
 *  6. Inserts the review row with client_email from the verified session.
 *     The DB partial unique index provides final atomic protection
 *     against concurrent duplicate active-rework rows (23505 → 409).
 */
export async function submitDeliverableReview(
  deliverableId: string,
  email: string,
  action: "approve" | "rework_requested",
  comment?: string
): Promise<SubmitOk | SubmitFail> {
  if (!deliverableId || !email) {
    return { ok: false, error: "Missing required parameters.", status: 400 };
  }

  // Comment validation (before touching DB)
  if (action === "rework_requested") {
    const c = (comment ?? "").trim();
    if (c.length < REVIEW_COMMENT_MIN) {
      return {
        ok: false,
        error: `Please describe what needs to change (min ${REVIEW_COMMENT_MIN} characters).`,
        status: 400,
      };
    }
    if (c.length > REVIEW_COMMENT_MAX) {
      return {
        ok: false,
        error: `Comment is too long (max ${REVIEW_COMMENT_MAX} characters).`,
        status: 400,
      };
    }
  }

  let supabase;
  try { supabase = makeClient(); } catch (e) {
    console.error(String(e));
    return { ok: false, error: "Server configuration error.", status: 500 };
  }

  try {
    // ── 1. Verify deliverable ownership ──────────────────────
    // JOIN order_deliverables → orders; require client_email = email.
    // Returns null if deliverableId is wrong or belongs to another user.
    const { data: delivData, error: delivErr } = await supabase
      .from("order_deliverables")
      .select(
        "id, order_id, order_number, item_index, " +
        "orders!inner(client_email)"
      )
      .eq("id", deliverableId)
      .eq("orders.client_email", email)   // ← ownership check
      .maybeSingle();

    if (delivErr || !delivData) {
      return { ok: false, error: "Deliverable not found.", status: 404 };
    }

    const delivRow = delivData as unknown as {
      id: string;
      order_id: string;
      order_number: string;
      item_index: number | null;
    };

    // ── 2. Load latest existing review ────────────────────────
    const { data: latestRaw, error: reviewErr } = await supabase
      .from("deliverable_reviews")
      .select("id, status")
      .eq("deliverable_id", deliverableId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reviewErr) {
      console.error("[client-reviews] Review lookup error:", reviewErr.message);
      return { ok: false, error: "Could not check review state.", status: 500 };
    }

    if (latestRaw) {
      const latest = (latestRaw as { id: string; status: ReviewStatus }).status;

      // ── 3. Terminal state guard ───────────────────────────
      if ((TERMINAL_REVIEW_STATUSES as string[]).includes(latest)) {
        return {
          ok: false,
          error: "This deliverable has already been approved or resolved.",
          status: 409,
        };
      }

      // ── 4. Active rework guard ────────────────────────────
      if ((ACTIVE_REWORK_STATUSES as string[]).includes(latest)) {
        return {
          ok: false,
          error:
            "A rework request is already open for this file. " +
            "Please wait for it to be resolved before submitting another.",
          status: 409,
        };
      }
    }

    // ── 5. Insert new review row ──────────────────────────────
    // client_email is set from the verified session — never from client input.
    const newStatus: ReviewStatus =
      action === "approve" ? "approved" : "rework_requested";

    const { data: inserted, error: insertErr } = await supabase
      .from("deliverable_reviews")
      .insert({
        deliverable_id: deliverableId,
        order_id:       delivRow.order_id,
        order_number:   delivRow.order_number,
        item_index:     delivRow.item_index,
        client_email:   email,          // ← from verified session only
        status:         newStatus,
        comment:        action === "rework_requested"
          ? (comment ?? "").trim()
          : null,
      })
      .select(
        "id, deliverable_id, order_id, order_number, item_index, " +
        "client_email, status, comment, created_at, updated_at, " +
        "replacement_deliverable_id"
      )
      .single();

    if (insertErr || !inserted) {
      // Postgres unique-constraint violation (concurrent duplicate rework)
      if (insertErr?.code === "23505") {
        return {
          ok: false,
          error: "A rework request is already open for this file.",
          status: 409,
        };
      }
      console.error("[client-reviews] Insert error:", insertErr?.message);
      return { ok: false, error: "Could not save review.", status: 500 };
    }

    return { ok: true, review: inserted as unknown as DeliverableReview };
  } catch (err) {
    console.error("[client-reviews] Unexpected error in submitDeliverableReview:", err);
    return { ok: false, error: "Unexpected server error.", status: 500 };
  }
}
