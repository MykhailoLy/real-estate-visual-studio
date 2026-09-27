import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";
import { AdminPaymentGateError, assertAdminFulfillmentPaymentAllowed } from "@/lib/payments/admin-status-gate";
import type { PaymentStateOrder, PersistedOrderPayment } from "@/lib/payments/payment-state";
import { getExpectedStripeLivemode } from "@/lib/payments/stripe-server";
import {
  DELIVERABLES_BUCKET,
  ADMIN_DELIVERABLE_MAX_BYTES,
  ADMIN_DELIVERABLE_MAX_MB,
  ALLOWED_DELIVERABLE_MIME_TYPES,
  ALLOWED_DELIVERABLE_EXTENSIONS,
  buildDeliverablePath,
} from "@/lib/deliverables-config";

// ============================================================
// POST /api/admin/orders/[orderId]/deliverables/upload-url
//
// Issues a short-lived Supabase Storage signed upload URL for
// the `deliverables` bucket so the admin browser can PUT file
// bytes directly to Storage — no file bytes flow through this
// route handler.
//
// Request body (JSON):
//   filename     : string  — original filename (for path building)
//   content_type : string  — MIME type (validated against allowlist)
//   file_size    : number  — bytes (validated against 200 MB cap)
//
// Response (200):
//   { path, signedUrl, token }
//
// 401 — not an admin session
// 400 — invalid body / order not found
// 500 — Supabase config error
//
// SECURITY:
//   - isAdminAuthenticated() checked first.
//   - storage_path constructed server-side from orderNumber + safeFilename.
//   - Raw client-supplied filename is sanitized before use in path.
//   - content_type validated against explicit allowlist.
//   - file_size validated against ADMIN_DELIVERABLE_MAX_BYTES.
//   - SUPABASE_SERVICE_ROLE_KEY stays server-side only.
// ============================================================

export const runtime = "nodejs";

type AllowedMime = (typeof ALLOWED_DELIVERABLE_MIME_TYPES)[number];

const Body = z.object({
  filename:     z.string().min(1).max(255),
  content_type: z.string().min(1),
  file_size:    z.number().int().min(1).max(
    ADMIN_DELIVERABLE_MAX_BYTES,
    `File is too large. Maximum is ${ADMIN_DELIVERABLE_MAX_MB} MB.`
  ),
});

function isMimeAllowed(mime: string, filename: string): boolean {
  if ((ALLOWED_DELIVERABLE_MIME_TYPES as readonly string[]).includes(mime)) {
    // application/octet-stream is only accepted for known extensions
    if (mime === "application/octet-stream") {
      const ext = filename.split(".").pop()?.toLowerCase() ?? "";
      return (ALLOWED_DELIVERABLE_EXTENSIONS as readonly string[]).includes(ext);
    }
    return true;
  }
  return false;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  // ── Auth guard ────────────────────────────────────────────
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { orderId } = await params;
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
  }

  // ── Parse body ────────────────────────────────────────────
  let raw: unknown;
  try { raw = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { filename, content_type, file_size } = parsed.data;

  if (!isMimeAllowed(content_type, filename)) {
    return NextResponse.json(
      { error: `File type "${content_type}" is not allowed for deliverables.` },
      { status: 400 }
    );
  }

  // ── Init Supabase ─────────────────────────────────────────
  let supabase;
  try { supabase = createServerClient(); } catch (err) {
    console.error("[admin/deliverables/upload-url] Supabase init:", err);
    return NextResponse.json(
      { error: "Server is not configured for deliverables." },
      { status: 500 }
    );
  }

  // ── Verify order exists and get order_number ──────────────
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, order_number, service_type, estimated_total_cents, currency, pricing_snapshot")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 400 });
  }

  const orderRow = order as unknown as { id: string; order_number: string };

  try {
    const { data: payment, error } = await supabase.from("order_payments")
      .select("order_id, provider, payment_status, refund_status, refunded_amount_cents, subtotal_cents, tax_cents, total_cents, currency, stripe_checkout_session_id, stripe_payment_intent_id, stripe_livemode, paid_at")
      .eq("order_id", orderId).maybeSingle();
    if (error) throw error;
    assertAdminFulfillmentPaymentAllowed(
      order as unknown as PaymentStateOrder,
      payment as unknown as PersistedOrderPayment | null,
      { getExpectedStripeLivemode },
    );
  } catch (error) {
    if (error instanceof AdminPaymentGateError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not verify payment before uploading a deliverable." }, { status: 500 });
  }

  // ── Build storage path server-side ───────────────────────
  const storagePath = buildDeliverablePath(orderRow.order_number, filename);

  // ── Issue signed upload URL ───────────────────────────────
  const { data: signed, error: signedErr } = await supabase
    .storage
    .from(DELIVERABLES_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (signedErr || !signed) {
    console.error("[admin/deliverables/upload-url] Signed URL error:", signedErr?.message);
    return NextResponse.json(
      { error: "Could not create signed upload URL." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    path:        storagePath,
    signedUrl:   signed.signedUrl,
    token:       signed.token,
    contentType: content_type as AllowedMime,
    fileSize:    file_size,
    orderNumber: orderRow.order_number,
  });
}
