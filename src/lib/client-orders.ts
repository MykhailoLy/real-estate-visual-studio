// ============================================================
// CLIENT ORDERS — server-side read helper
//
// Fetches orders from the `orders` table using the Supabase
// service role key, scoped to the AUTHENTICATED ACCOUNT.
//
// OWNERSHIP MODEL (PR 1 — account ownership foundation)
// ─────────────────────────────────────────────────────────
// An order belongs to the client when EITHER:
//   (a) orders.user_id === authenticated user id            (strong)
//   (b) orders.user_id IS NULL AND client_email matches the
//       verified session email, case-insensitively          (legacy)
//
// An order with a non-null user_id belonging to ANOTHER user is
// never returned, even if its client_email matches this user's
// email. See src/lib/order-ownership.ts for the shared rule.
//
// The userId + email ALWAYS come from getClientUser() (the verified
// SSR session) via an OrderOwnership object — NEVER from the client,
// query string, cookies, localStorage, or request body.
//
// Server-only. Never import from a "use client" file.
// ============================================================

import { createClient } from "@supabase/supabase-js";
import type { DashboardJob, DashboardJobStatus } from "@/lib/client-dashboard/mock-data";
import type { ReviewStatus } from "@/lib/client-reviews";
import { getServiceLabel as getDisplayServiceLabel } from "@/lib/display/service-labels";
import {
  isOrderOwned,
  ownedOrdersOrFilter,
  type OrderOwnership,
} from "@/lib/order-ownership";

// ── Types ─────────────────────────────────────────────────────

/**
 * The subset of `orders` columns we SELECT for the dashboard.
 * No JSONB details, no storage paths, no client PII beyond what
 * the authenticated owner already knows about themselves.
 */
export interface ClientOrder {
  id: string;
  order_number: string;
  service_type: string;
  status: string;
  item_count: number;
  estimated_total_cents: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

/**
 * Maps DB order status strings → DashboardJobStatus values.
 * "revision-requested" has no DB equivalent — it is mock-only.
 * Unknown statuses default to "awaiting-submission".
 */
const DB_STATUS_TO_DASHBOARD: Record<string, DashboardJobStatus> = {
  "pending":     "awaiting-submission",
  "confirmed":   "in-progress",
  "in-progress": "in-progress",
  "delivered":   "completed",
  "completed":   "completed",
  "cancelled":   "cancelled",
};

/**
 * Derives a cosmetic progress value (0–100) from the DB order status.
 * No real progress data exists in Phase 5A — this is display-only.
 */
const STATUS_TO_PROGRESS: Record<string, number> = {
  "pending":     0,
  "confirmed":   15,
  "in-progress": 50,
  "delivered":   100,
  "completed":   100,
  "cancelled":   0,
};

const REWORK_DASHBOARD_PROGRESS: Partial<Record<DashboardJobStatus, number>> = {
  "pending-rework": 80,
  "rework-in-progress": 85,
  "new-version-ready": 100,
};

type ReviewStatusLike = Pick<
  DeliverableReviewSummary,
  "order_id" | "deliverable_id" | "replacement_deliverable_id" | "status"
>;

export interface DeliverableReviewSummary {
  order_id: string;
  deliverable_id?: string;
  replacement_deliverable_id?: string | null;
  status: ReviewStatus;
}

// ── Private helpers ───────────────────────────────────────────

/**
 * Derive a soft estimated-completion display string.
 *  - delivered   → "Delivered"
 *  - cancelled   → "—"
 *  - pending     → "—"  (not yet confirmed, no meaningful ETA)
 *  - confirmed / in-progress → submitted date + 2 business days
 *    This is a cosmetic soft estimate ONLY — not a contractual commitment.
 */
function deriveEstimatedCompletion(dbStatus: string, createdAt: string): string {
  if (dbStatus === "delivered")  return "Delivered";
  if (dbStatus === "cancelled")  return "—";
  if (dbStatus === "pending")    return "—";

  try {
    const d = new Date(createdAt);
    if (isNaN(d.getTime())) return "—";
    let added = 0;
    while (added < 2) {
      d.setDate(d.getDate() + 1);
      const day = d.getDay();
      if (day !== 0 && day !== 6) added++; // skip Sat(6) and Sun(0)
    }
    return d.toISOString().split("T")[0]; // YYYY-MM-DD
  } catch {
    return "—";
  }
}

// ── Exported helpers (also used by detail page) ───────────────

/**
 * Returns the human-readable label for a service_type slug.
 * Re-exported so the detail page can display the same label without
 * duplicating the map.
 */
export function getServiceLabel(slug: string): string {
  return getDisplayServiceLabel(slug);
}

/**
 * Maps a raw DB status string to the dashboard DashboardJobStatus enum.
 * Unknown statuses default to "awaiting-submission".
 */
export function getDashboardStatus(dbStatus: string): DashboardJobStatus {
  return DB_STATUS_TO_DASHBOARD[dbStatus] ?? "awaiting-submission";
}

/**
 * Derives the client-facing display status without mutating orders.status.
 * Active review states intentionally override a delivered/completed order so
 * the dashboard does not call open rework "Completed".
 */
export function deriveDashboardStatusFromReviews(
  dbStatus: string,
  reviews: Array<Pick<
    DeliverableReviewSummary,
    "deliverable_id" | "replacement_deliverable_id" | "status"
  >> = []
): DashboardJobStatus {
  const latestByDeliverable = new Map<string, ReviewStatus>();
  for (const review of reviews) {
    if (review.deliverable_id && !latestByDeliverable.has(review.deliverable_id)) {
      latestByDeliverable.set(review.deliverable_id, review.status);
    }
  }

  const statuses = new Set<ReviewStatus>();
  for (const review of reviews) {
    if (
      review.status === "rework_delivered" &&
      review.replacement_deliverable_id &&
      latestByDeliverable.has(review.replacement_deliverable_id)
    ) {
      continue;
    }
    statuses.add(review.status);
  }

  if (statuses.has("rework_requested")) return "pending-rework";
  if (statuses.has("rework_in_progress")) return "rework-in-progress";
  if (statuses.has("rework_delivered")) return "new-version-ready";

  return getDashboardStatus(dbStatus);
}

function getProgressForDashboardStatus(
  dbStatus: string,
  dashboardStatus: DashboardJobStatus
): number {
  return REWORK_DASHBOARD_PROGRESS[dashboardStatus] ?? STATUS_TO_PROGRESS[dbStatus] ?? 0;
}

/** Derives cosmetic progress (0–100) from a raw DB status string. */
export function getProgressFromStatus(dbStatus: string): number {
  return STATUS_TO_PROGRESS[dbStatus] ?? 0;
}

/** Re-export so the detail page can derive the same ETA string. */
export { deriveEstimatedCompletion };

// ── Types for detail page ─────────────────────────────────────

/**
 * A sanitized order-item row safe to pass to the client layer.
 * Storage paths and private file metadata are stripped server-side.
 */
export interface SafeOrderItem {
  id: string;
  item_index: number;
  subtotal_cents: number;
  /** Safe subset of the JSONB details blob — see sanitizeDetails(). */
  details: Record<string, unknown>;
}

/**
 * Full order detail, including safe item summaries.
 * Never contains storage paths, file metadata, or private PII.
 */
export interface ClientOrderDetail extends ClientOrder {
  client_company: string | null;
  items: SafeOrderItem[];
}

// ── JSONB sanitizer ───────────────────────────────────────────

/**
 * Keys that must NEVER be forwarded to the client layer.
 * Covers storage paths, file metadata, terms/consent data, and any
 * field ending in common path/storage suffixes.
 */
const BLOCKED_DETAIL_KEYS = new Set([
  // File upload metadata embedded by the order submission flow
  "uploaded_files",
  "delivery_preferences",
  "terms_acceptance",
  "portfolio_permission",
  // Storage path fields on order_items (also excluded at SELECT level,
  // but strip defensively in case details JSONB mirrors them)
  "original_photo_path",
  "reference_image_path",
  "file_path",
  "bucket",
  "storage_path",
]);

/** Suffix patterns — any key ending with these is also blocked. */
const BLOCKED_SUFFIXES = ["_path", "_bucket", "_mime", "_size", "_url"];

function isBlockedKey(key: string): boolean {
  if (BLOCKED_DETAIL_KEYS.has(key)) return true;
  return BLOCKED_SUFFIXES.some((suffix) => key.endsWith(suffix));
}

/**
 * Strips private / internal keys from a JSONB details object before it
 * is serialised to the client.  Only scalar values and arrays of scalars
 * are forwarded — nested objects are recursively sanitized.
 */
export function sanitizeDetails(
  raw: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (isBlockedKey(key)) continue;
    if (val === null || val === undefined) continue;

    if (Array.isArray(val)) {
      // Keep arrays of primitive values only (e.g. addon_labels, option_labels)
      const filtered = val.filter(
        (v) => typeof v === "string" || typeof v === "number" || typeof v === "boolean"
      );
      if (filtered.length > 0) out[key] = filtered;
    } else if (typeof val === "object") {
      // Recurse into nested objects (e.g. flooring_by_room)
      const nested = sanitizeDetails(val as Record<string, unknown>);
      if (Object.keys(nested).length > 0) out[key] = nested;
    } else {
      // Primitive — forward as-is
      out[key] = val;
    }
  }
  return out;
}

// ── Public API ────────────────────────────────────────────────

/**
 * Map a single ClientOrder to the DashboardJob shape the UI expects.
 * Derives title, serviceType label, status, progress, and
 * estimatedCompletion from available DB columns.
 * No JSONB details or storage paths are exposed.
 */
export function mapOrderToDashboardJob(
  order: ClientOrder,
  reviews: Array<Pick<DeliverableReviewSummary, "status">> = []
): DashboardJob {
  const serviceLabel = getServiceLabel(order.service_type);
  const dashboardStatus = deriveDashboardStatusFromReviews(order.status, reviews);
  const progress = getProgressForDashboardStatus(order.status, dashboardStatus);

  return {
    id:                  order.id,
    title:               `${serviceLabel} — ${order.order_number}`,
    reference:           order.order_number,
    serviceType:         serviceLabel,
    status:              dashboardStatus,
    submittedDate:       order.created_at.split("T")[0],
    estimatedCompletion: deriveEstimatedCompletion(order.status, order.created_at),
    progress,
    costCents:           order.estimated_total_cents,
    imageCount:          order.item_count,
  };
}

/** Convenience wrapper: maps an array of ClientOrders to DashboardJobs. */
export function mapOrdersToDashboardJobs(
  orders: ClientOrder[],
  reviews: ReviewStatusLike[] = []
): DashboardJob[] {
  const reviewsByOrder = new Map<string, ReviewStatusLike[]>();
  for (const review of reviews) {
    const existing = reviewsByOrder.get(review.order_id) ?? [];
    existing.push(review);
    reviewsByOrder.set(review.order_id, existing);
  }

  return orders.map((order) =>
    mapOrderToDashboardJob(order, reviewsByOrder.get(order.id) ?? [])
  );
}

/**
 * Fetches all orders owned by the authenticated account.
 *
 * SECURITY CONTRACT:
 *  ✓ `ownership` MUST be built from `getClientUser()` (server-validated SSR session).
 *  ✗ NEVER pass identity from URL params, query string, cookies, or client input.
 *  ✓ Uses service role key — server-side only, never exposed to the client.
 *  ✓ DB pre-filter via ownedOrdersOrFilter(), then an authoritative
 *    JS re-check via isOrderOwned() (defense-in-depth) so an order
 *    owned by another user is never returned.
 *  ✓ SELECTs summary columns only (+ user_id/client_email needed for
 *    the ownership re-check) — no JSONB details, no storage paths.
 *
 * Returns [] on any error so the dashboard degrades gracefully.
 */
export async function getOrdersForClient(
  ownership: OrderOwnership
): Promise<ClientOrder[]> {
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    // Log server-side only — never surface env var names to the client
    console.warn(
      "[client-orders] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY " +
      "is not set. Returning empty orders array."
    );
    return [];
  }

  if (!ownership?.userId || !ownership?.email) {
    console.warn("[client-orders] Called without a valid ownership — returning [].");
    return [];
  }

  try {
    // Service-role client — intentional. The ownership filter + JS
    // re-check below limit results to this account's orders only.
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, service_type, status, " +
        "item_count, estimated_total_cents, currency, " +
        "created_at, updated_at, user_id, client_email"
      )
      .or(ownedOrdersOrFilter(ownership))   // ← user_id OR (NULL + email)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[client-orders] Query error:", error.message);
      return [];
    }

    const rows = (data ?? []) as unknown as Array<
      ClientOrder & { user_id: string | null; client_email: string | null }
    >;
    // Authoritative JS ownership re-check (never trust the DB filter alone),
    // then project to the safe ClientOrder summary shape.
    return rows
      .filter((row) => isOrderOwned(row, ownership))
      .map((row) => ({
        id: row.id,
        order_number: row.order_number,
        service_type: row.service_type,
        status: row.status,
        item_count: row.item_count,
        estimated_total_cents: row.estimated_total_cents,
        currency: row.currency,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
  } catch (err) {
    console.error("[client-orders] Unexpected error:", err);
    return [];
  }
}

/**
 * Returns just the IDs of orders owned by the authenticated account.
 * Used by deliverables/reviews/source-file helpers to scope their
 * own queries to the user's orders via `order_id IN (...)`.
 */
export async function getOwnedOrderIds(
  ownership: OrderOwnership
): Promise<string[]> {
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return [];
  if (!ownership?.userId || !ownership?.email) return [];

  try {
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });
    const { data, error } = await supabase
      .from("orders")
      .select("id, user_id, client_email")
      .or(ownedOrdersOrFilter(ownership));

    if (error) {
      console.error("[client-orders] Owned-id query error:", error.message);
      return [];
    }

    return ((data ?? []) as Array<{
      id: string;
      user_id: string | null;
      client_email: string | null;
    }>)
      .filter((row) => isOrderOwned(row, ownership))
      .map((row) => row.id);
  } catch (err) {
    console.error("[client-orders] Unexpected error in getOwnedOrderIds:", err);
    return [];
  }
}


/**
 * Fetches a single order by its UUID, **only** if it is owned by the
 * authenticated account (per the user_id / legacy-email rule). This is
 * the ownership check for the order detail page.
 *
 * SECURITY CONTRACT:
 *  ✓ `orderId` comes from the URL route param — treated as untrusted input.
 *  ✓ `ownership` MUST come from `getClientUser()` on the server — never from
 *              URL params, query string, cookies, or client input.
 *  ✓ The row is fetched by id, then ownership is enforced in JS via
 *    isOrderOwned(). A wrong owner receives the same null response as
 *    "not found", which is intentional to avoid leaking order existence.
 *  ✓ SELECTs summary columns + order_items (safe fields only).
 *  ✗ original_photo_path and reference_image_path are NOT selected.
 *  ✓ JSONB details are sanitized via sanitizeDetails() before return.
 *
 * Returns null when: not found, ownership fails, env vars absent, or DB error.
 */
export async function getOrderForClient(
  orderId: string,
  ownership: OrderOwnership
): Promise<ClientOrderDetail | null> {
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.warn("[client-orders] Missing env vars — cannot fetch order detail.");
    return null;
  }

  if (!orderId || !ownership?.userId || !ownership?.email) {
    console.warn("[client-orders] getOrderForClient called with empty orderId or ownership.");
    return null;
  }

  try {
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    // ── Fetch by id, then enforce ownership in JS ──────────────
    // We select user_id + client_email so isOrderOwned() can make the
    // authoritative decision. A wrong owner yields the same null
    // response as "not found".
    const { data: orderRow, error: orderErr } = await supabase
      .from("orders")
      .select(
        "id, order_number, service_type, status, " +
        "item_count, estimated_total_cents, currency, " +
        "client_company, created_at, updated_at, user_id, client_email"
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr) {
      console.error("[client-orders] Order detail query error:", orderErr.message);
      return null;
    }
    if (!orderRow) return null; // not found

    const ownedCheck = orderRow as unknown as {
      user_id: string | null;
      client_email: string | null;
    };
    if (!isOrderOwned(ownedCheck, ownership)) return null; // wrong owner

    // ── Order items — safe fields only ─────────────────────────
    // original_photo_path and reference_image_path are intentionally
    // excluded from the SELECT list — storage paths must not reach the client.
    const { data: itemRows, error: itemsErr } = await supabase
      .from("order_items")
      .select("id, item_index, subtotal_cents, details")
      .eq("order_id", orderId)
      .order("item_index", { ascending: true });

    if (itemsErr) {
      console.error("[client-orders] Order items query error:", itemsErr.message);
      // Graceful degradation — return order without items rather than null
    }

    const rawItems = (itemRows ?? []) as Array<{
      id: string;
      item_index: number;
      subtotal_cents: number;
      details: Record<string, unknown>;
    }>;

    const safeItems: SafeOrderItem[] = rawItems.map((item) => ({
      id:            item.id,
      item_index:    item.item_index,
      subtotal_cents: item.subtotal_cents,
      details:       sanitizeDetails(item.details ?? {}),
    }));

    const order = orderRow as unknown as ClientOrder & {
      client_company: string | null;
    };

    return {
      id: order.id,
      order_number: order.order_number,
      service_type: order.service_type,
      status: order.status,
      item_count: order.item_count,
      estimated_total_cents: order.estimated_total_cents,
      currency: order.currency,
      created_at: order.created_at,
      updated_at: order.updated_at,
      client_company: order.client_company ?? null,
      items: safeItems,
    };
  } catch (err) {
    console.error("[client-orders] Unexpected error in getOrderForClient:", err);
    return null;
  }
}
