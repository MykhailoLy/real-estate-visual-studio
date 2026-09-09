import { after, type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";
import { dispatchOrderEmailOutbox } from "@/lib/email/send-order-emails";
import {
  AdminPaymentGateError,
  assertAdminOrderStatusTransitionAllowed,
  PRODUCTION_ADVANCING_ORDER_STATUSES,
} from "@/lib/payments/admin-status-gate";
import type {
  PaymentStateOrder,
  PersistedOrderPayment,
} from "@/lib/payments/payment-state";
import { getExpectedStripeLivemode } from "@/lib/payments/stripe-server";

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
//   409 { error }                       — fixed-price payment not verified
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
//   - Production-advancing statuses require a matching webhook-written
//     Paid record for orders with a valid fixed-price Checkout snapshot.
//   - Service role key is used server-side only (createServerClient).
//     It never reaches the client.
//   - No other fields (client_email, item_count, pricing, items,
//     etc.) are touched.
// ============================================================

export const runtime = "nodejs";
export const maxDuration = 60;

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

  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .select("id, service_type, estimated_total_cents, currency, pricing_snapshot")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    console.error("[admin/orders/status] Order lookup error:", orderError.message);
    return NextResponse.json(
      { error: "Could not verify the order before updating its status." },
      { status: 500 },
    );
  }
  if (!orderData) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (PRODUCTION_ADVANCING_ORDER_STATUSES.some((status) => status === newStatus)) {
    const { data: paymentData, error: paymentError } = await supabase
      .from("order_payments")
      .select(
        "order_id, provider, payment_status, refund_status, refunded_amount_cents, subtotal_cents, tax_cents, total_cents, " +
          "currency, stripe_checkout_session_id, stripe_payment_intent_id, stripe_livemode, paid_at",
      )
      .eq("order_id", orderId)
      .maybeSingle();

    if (paymentError) {
      console.error("[admin/orders/status] Payment lookup error:", paymentError.message);
      return NextResponse.json(
        { error: "Could not verify payment before updating the order status." },
        { status: 500 },
      );
    }

    try {
      assertAdminOrderStatusTransitionAllowed(
        orderData as unknown as PaymentStateOrder,
        (paymentData as unknown as PersistedOrderPayment | null) ?? null,
        newStatus,
        { getExpectedStripeLivemode },
      );
    } catch (error) {
      if (error instanceof AdminPaymentGateError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      console.error(
        "[admin/orders/status] Payment gate failed:",
        error instanceof Error ? error.name : "UnknownError",
      );
      return NextResponse.json(
        { error: "Could not verify payment before updating the order status." },
        { status: 500 },
      );
    }
  }

  // Delivery and its first email event commit together. Other statuses keep
  // the existing update path; the payment/auth gates above apply to both.
  const { data, error } = newStatus === "delivered"
    ? await supabase.rpc("mark_order_delivered_with_email", { p_order_id: orderId })
      .maybeSingle<{ id: string; status: OrderStatus; updated_at: string }>()
    : await supabase
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

  if (!data) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  if (newStatus === "delivered") {
    // The DB function enqueues atomically with the status update. Repeated
    // delivered requests only drain an existing retryable event, never enqueue.
    // Resend availability must not delay or undo the committed status response.
    after(async () => {
      await dispatchOrderEmailOutbox({ supabase, orderId });
    });
  }

  return NextResponse.json({
    ok: true,
    orderId: data.id,
    status: data.status,
    updated_at: data.updated_at,
  });
}
