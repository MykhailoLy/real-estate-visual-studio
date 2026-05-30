// ============================================================
// CLIENT ORDERS — server-side read helper (Phase 5A)
//
// Fetches orders from the `orders` table using the Supabase
// service role key, filtered strictly by the authenticated
// user's confirmed email address.
//
// ⚠️  SECURITY — email-only matching (Phase 5A limitation)
// ─────────────────────────────────────────────────────────
// The `orders` table pre-dates client auth and has no user_id
// FK or RLS.  Orders are matched via:
//
//   WHERE client_email = <email from verified Supabase session>
//
// The email is ALWAYS read server-side from supabase.auth.getUser()
// — it is NEVER accepted from the client, query string, cookies,
// localStorage, or request body.
//
// Supabase requires email confirmation before a session is valid
// (PR #31), so the email is confirmed before we query with it.
//
// TODO (Phase 5B): add `user_id UUID REFERENCES auth.users(id)`
// column + RLS to `orders`, backfill from client_email where
// possible, and switch this query to use user_id.
//
// Server-only.  Never import from a "use client" file.
// ============================================================

import { createClient } from "@supabase/supabase-js";
import type {
  DashboardJob,
  DashboardJobStatus,
} from "@/lib/client-dashboard/mock-data";

// ── Types ─────────────────────────────────────────────────────

/** Shape of the columns we SELECT from `orders` for the dashboard. */
export interface ClientOrder {
  id: string;
  order_number: string;
  service_type: string; // DB slug — translated to label via SERVICE_TYPE_LABELS
  status: string;       // DB status — mapped to DashboardJobStatus via DB_STATUS_TO_DASHBOARD
  item_count: number;
  estimated_total_cents: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

// ── Translation maps ──────────────────────────────────────────

/**
 * Maps every known service_type slug to a human-readable label.
 * Covers the 4 original order types plus all extended service types
 * referenced in the task brief.  Unknown slugs fall back to a
 * formatted version of the slug itself.
 */
const SERVICE_TYPE_LABELS: Record<string, string> = {
  "virtual-staging":          "Virtual Staging",
  "virtual-renovation":       "Virtual Renovation",
  "3d-floor-plans":           "Floor Plans",
  "photo-editing":            "Photo Editing",
  "image-enhancement":        "Image Enhancement",
  "day-to-dusk":              "Day to Dusk",
  "item-removal":             "Item Removal",
  "virtual-cleaning":         "Virtual Cleaning",
  "360-image-enhancement":    "360° Image Enhancement",
  "360-virtual-staging":      "360° Virtual Staging",
  "aerial-editing":           "Aerial Editing",
  "development-site-plans":   "Development Site Plans",
};

/**
 * Maps DB order status strings to DashboardJobStatus values.
 * "revision-requested" has no DB equivalent — it is mock-only.
 * Unknown statuses default to "awaiting-submission" (safest fallback).
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
 * A `progress_percent` column can be added in a future migration.
 */
const STATUS_TO_PROGRESS: Record<string, number> = {
  "pending":     0,
  "confirmed":   15,
  "in-progress": 50,
  "delivered":   100,
  "cancelled":   0,
};

// ── Helper: format unknown slug ───────────────────────────────

function slugToLabel(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ── Helper: derive soft estimated-completion display string ───

/**
 * Returns a human-readable estimated completion string.
 * - delivered  → "Delivered"
 * - cancelled  → "—"
 * - pending    → "—" (not yet confirmed)
 * - confirmed / in-progress → "+2 business days from submitted date"
 *   (soft estimate only — not a contractual commitment)
 */
function deriveEstimatedCompletion(dbStatus: string, createdAt: string): string {
  if (dbStatus === "delivered")   return "Delivered";
  if (dbStatus === "cancelled")   return "—";
  if (dbStatus === "pending")     return "—";

  // confirmed / in-progress: add ~2 business days to created_at
  try {
    const d = new Date(createdAt);
    if (isNaN(d.getTime())) return "—";
    // Skip weekends: Mon–Fri business day offset of 2
    let daysAdded = 0;
    while (daysAdded < 2) {
      d.setDate(d.getDate() + 1);
      const day = d.getDay();
      if (day !== 0 && day !== 6) daysAdded++;
    }
    return d.toISOString().split("T")[0]; // YYYY-MM-DD
  } catch {
    return "—";
  }
}

// ── Core helpers ──────────────────────────────────────────────

/**
 * Map a single ClientOrder row to the DashboardJob shape the UI expects.
 * Derives title, serviceType label, status, progress, and estimatedCompletion
 * from the available DB columns — no JSONB detail or storage paths exposed.
 */
export function mapOrderToDashboardJob(order: ClientOrder): DashboardJob {
  const serviceLabel =
    SERVICE_TYPE_LABELS[order.service_type] ?? slugToLabel(order.service_type);
  const dashboardStatus =
    DB_STATUS_TO_DASHBOARD[order.status] ?? "awaiting-submission";
  const progress = STATUS_TO_PROGRESS[order.status] ?? 0;

  return {
    id:                  order.id,
    title:               `${serviceLabel} — ${order.order_number}`,
    reference:           order.order_number,
    serviceType:         serviceLabel,
    status:              dashboardStatus,
    submittedDate:       order.created_at.split("T")[0], // YYYY-MM-DD
    estimatedCompletion: deriveEstimatedCompletion(order.status, order.created_at),
    progress,
    costCents:           order.estimated_total_cents,
    imageCount:          order.item_count,
  };
}

/** Convenience wrapper for an array of orders. */
export function mapOrdersToDashboardJobs(orders: ClientOrder[]): DashboardJob[] {
  return orders.map(mapOrderToDashboardJob);
}

/**
 * Fetches all orders for a confirmed authenticated user, matched by email.
 *
 * SECURITY CONTRACT:
 *  - `email` MUST come from `supabase.auth.getUser()` on the server.
 *  - NEVER pass an email from client input, URL params, or cookies.
 *  - Uses service role key — bypasses RLS (no RLS exists on `orders`).
 *  - Selects only summary columns — no JSONB details, no storage paths.
 *
 * Returns [] on any error so the dashboard degrades gracefully rather
 * than crashing the page.
 */
export async function getOrdersByClientEmail(
  email: string
): Promise<ClientOrder[]> {
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    // Missing at build time or in sandboxed environments — log server-side
    // only, return empty array so the dashboard renders without crashing.
    console.warn(
      "[client-orders] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY " +
      "is not set. Returning empty orders array."
    );
    return [];
  }

  if (!email) {
    console.warn("[client-orders] getOrdersByClientEmail called with empty email.");
    return [];
  }

  try {
    // Create a one-off service-role client — NOT the SSR anon client.
    // This is intentional: the orders table has no RLS, so we need the
    // service role to read it.  The email guard below limits the result
    // strictly to the authenticated user's orders.
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, service_type, status, item_count, " +
        "estimated_total_cents, currency, created_at, updated_at"
      )
      .eq("client_email", email)          // ← strict email guard (server-side only)
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
