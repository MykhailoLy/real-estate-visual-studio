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
  "cancelled":   0,
};

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

// ── Public API ────────────────────────────────────────────────

/**
 * Map a single ClientOrder to the DashboardJob shape the UI expects.
 * Derives title, serviceType label, status, progress, and
 * estimatedCompletion from available DB columns.
 * No JSONB details or storage paths are exposed.
 */
export function mapOrderToDashboardJob(order: ClientOrder): DashboardJob {
  const serviceLabel =
    SERVICE_TYPE_LABELS[order.service_type] ?? slugToLabel(order.service_type);
  const dashboardStatus: DashboardJobStatus =
    DB_STATUS_TO_DASHBOARD[order.status] ?? "awaiting-submission";
  const progress = STATUS_TO_PROGRESS[order.status] ?? 0;

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
export function mapOrdersToDashboardJobs(orders: ClientOrder[]): DashboardJob[] {
  return orders.map(mapOrderToDashboardJob);
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
