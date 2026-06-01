// ============================================================
// CLIENT ORDERS — server-side read helper (Phase 5A)
//
// Fetches orders from the `orders` table using the Supabase
// service role key, filtered strictly by the authenticated
// user's confirmed email address.
//
// ⚠️  SECURITY — email-only matching (Phase 5A limitation)
// ─────────────────────────────────────────────────────────
// The `orders` table pre-dates client auth and has NO user_id
// column and NO RLS. Orders are matched via:
//
//   WHERE client_email = <email from verified Supabase session>
//
// The email is ALWAYS read server-side from supabase.auth.getUser()
// (via getClientUser()) — it is NEVER accepted from the client,
// query string, cookies, localStorage, or request body.
//
// Supabase requires email confirmation before a session is valid
// (PR #31), so only the confirmed email owner sees their orders.
//
// TODO (Phase 5B): add `user_id UUID REFERENCES auth.users(id)`
// column + RLS to `orders`, backfill from client_email, and
// switch this query to filter by user_id instead.
//
// Server-only. Never import from a "use client" file.
// ============================================================

import { createClient } from "@supabase/supabase-js";
import type { DashboardJob, DashboardJobStatus } from "@/lib/client-dashboard/mock-data";
import type { ReviewStatus } from "@/lib/client-reviews";

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

// ── Translation maps ──────────────────────────────────────────

/**
 * Maps every known service_type slug to a human-readable label.
 * Covers the 4 original order types plus all extended service slugs.
 * Unknown slugs fall back to slugToLabel().
 */
const SERVICE_TYPE_LABELS: Record<string, string> = {
  "virtual-staging":        "Virtual Staging",
  "virtual-renovation":     "Virtual Renovation",
  "3d-floor-plans":         "Floor Plans",
  "photo-editing":          "Photo Editing",
  "image-enhancement":      "Image Enhancement",
  "day-to-dusk":            "Day to Dusk",
  "item-removal":           "Item Removal",
  "virtual-cleaning":       "Virtual Cleaning",
  "360-image-enhancement":  "360° Image Enhancement",
  "360-virtual-staging":    "360° Virtual Staging",
  "aerial-editing":         "Aerial Editing",
  "development-site-plans": "Development Site Plans",
};

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

/** Format an unknown slug into a readable label, e.g. "my-slug" → "My Slug". */
function slugToLabel(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

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
  return SERVICE_TYPE_LABELS[slug] ?? slugToLabel(slug);
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
  const serviceLabel =
    SERVICE_TYPE_LABELS[order.service_type] ?? slugToLabel(order.service_type);
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
 * Fetches all orders for the authenticated user, matched by confirmed email.
 *
 * SECURITY CONTRACT:
 *  ✓ `email` MUST come from `getClientUser()` (server-validated SSR session).
 *  ✗ NEVER pass an email from URL params, query string, cookies, or client input.
 *  ✓ Uses service role key — server-side only, never exposed to the client.
 *  ✓ Strict `.eq("client_email", email)` — no wildcard, no OR conditions.
 *  ✓ SELECTs summary columns only — no JSONB details, no storage paths.
 *
 * Returns [] on any error so the dashboard degrades gracefully.
 */
export async function getOrdersByClientEmail(
  email: string
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

  if (!email) {
    console.warn("[client-orders] Called with empty email — returning [].");
    return [];
  }

  try {
    // Service-role client — intentional, orders table has no RLS.
    // The email guard below limits results to this user's orders only.
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, service_type, status, " +
        "item_count, estimated_total_cents, currency, " +
        "created_at, updated_at"
      )
      .eq("client_email", email)           // ← strict server-side email guard
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[client-orders] Query error:", error.message);
      return [];
    }

    return (data ?? []) as unknown as ClientOrder[];
  } catch (err) {
    console.error("[client-orders] Unexpected error:", err);
    return [];
  }
}


/**
 * Fetches a single order by its UUID, **only** if client_email matches the
 * authenticated user's confirmed email.  This is the ownership check.
 *
 * SECURITY CONTRACT:
 *  ✓ `orderId` comes from the URL route param — treated as untrusted input.
 *  ✓ `email`   MUST come from `getClientUser()` on the server — never from
 *              URL params, query string, cookies, or client input.
 *  ✓ The query filters on BOTH id AND client_email simultaneously.
 *    If the orderId belongs to a different user, no row is returned —
 *    the caller cannot distinguish "wrong owner" from "not found", which
 *    is intentional to avoid leaking order existence to other users.
 *  ✓ SELECTs summary columns + order_items (safe fields only).
 *  ✗ original_photo_path and reference_image_path are NOT selected.
 *  ✓ JSONB details are sanitized via sanitizeDetails() before return.
 *
 * Returns null when:
 *  - Order not found
 *  - Email does not match (ownership check fails)
 *  - Env vars absent
 *  - Any DB error
 */
export async function getOrderByIdForClient(
  orderId: string,
  email: string
): Promise<ClientOrderDetail | null> {
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.warn("[client-orders] Missing env vars — cannot fetch order detail.");
    return null;
  }

  if (!orderId || !email) {
    console.warn("[client-orders] getOrderByIdForClient called with empty orderId or email.");
    return null;
  }

  try {
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    // ── Ownership-guarded order query ──────────────────────────
    // Filtering on BOTH id AND client_email means a wrong owner
    // receives exactly the same null response as "not found".
    const { data: orderRow, error: orderErr } = await supabase
      .from("orders")
      .select(
        "id, order_number, service_type, status, " +
        "item_count, estimated_total_cents, currency, " +
        "client_company, created_at, updated_at"
      )
      .eq("id", orderId)
      .eq("client_email", email)   // ← ownership check
      .maybeSingle();

    if (orderErr) {
      console.error("[client-orders] Order detail query error:", orderErr.message);
      return null;
    }
    if (!orderRow) return null; // not found or wrong owner

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

    const order = orderRow as unknown as ClientOrder & { client_company: string | null };

    return {
      ...order,
      client_company: order.client_company ?? null,
      items: safeItems,
    };
  } catch (err) {
    console.error("[client-orders] Unexpected error in getOrderByIdForClient:", err);
    return null;
  }
}
