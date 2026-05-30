import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";

// ============================================================
// POST /api/admin/orders/[orderId]/status
//
// Updates ONLY the `status` field of a single order.
// updated_at is refreshed automatically by the DB trigger.
//
// Body (JSON): { status: string }
//
// Responses:
//   200 { ok: true, orderId, status }   — updated
//   400 { error }                       — invalid status / body
//   401 { error }                       — not an admin session
//   404 { error }                       — order not found
//   500 { error }                       — DB / config error
//
// Security:
//   - isAdminAuthenticated() verifies the HMAC-signed admin
//     session cookie before anything else.
//   - Only 5 valid status values are accepted; all others are
//     rejected with 400 — the DB CHECK constraint is the last
//     line of defence, but we validate before reaching it.
//   - orderId from the URL is treated as untrusted input and
//     checked against the DB; a non-existent UUID returns 404.
//   - Service role key is used server-side only (createServerClient).
//     It never reaches the client.
//   - No other fields (client_email, item_count, pricing, items,
//     etc.) are touched.
// ============================================================

export const runtime = "nodejs";

// The 5 values enforced by the DB CHECK constraint on orders.status
const VALID_STATUSES = [
  "pending",
  "confirmed",
  "in-progress",
  "delivered",
  "cancelled",
] as const;

type OrderStatus = (typeof VALID_STATUSES)[number];

const Body = z.object({
  status: z.enum(VALID_STATUSES, {
    error: `Status must be one of: ${VALID_STATUSES.join(", ")}.`,
  }),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  // ── 1. Admin auth guard ───────────────────────────────────
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { orderId } = await params;

  // Basic UUID-shape sanity check before touching the DB
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
  }

  // ── 2. Parse + validate body ──────────────────────────────
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const newStatus: OrderStatus = parsed.data.status;

  // ── 3. Update orders.status (service role, server-side only) ──
  let supabase;
  try {
    supabase = createServerClient();
  } catch (err) {
    console.error("[admin/orders/status] Supabase init failed:", err);
    return NextResponse.json(
      { error: "Server is not configured for order management." },
      { status: 500 }
    );
  }

  // Only update `status`. `updated_at` is refreshed automatically
  // by the orders_updated_at trigger in the DB schema.
  const { data, error } = await supabase
    .from("orders")
    .update({ status: newStatus })
    .eq("id", orderId)
    .select("id, status, updated_at")
    .maybeSingle();

  if (error) {
    console.error("[admin/orders/status] Update error:", error.message);
    return NextResponse.json(
      { error: "Could not update order status." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    orderId: data.id,
    status: data.status,
    updated_at: data.updated_at,
  });
}
