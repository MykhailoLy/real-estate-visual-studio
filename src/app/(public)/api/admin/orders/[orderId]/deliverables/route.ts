import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";
import {
  DELIVERABLES_BUCKET,
  ADMIN_DELIVERABLE_MAX_BYTES,
  ADMIN_DELIVERABLE_MAX_MB,
} from "@/lib/client-deliverables";

// ============================================================
// POST /api/admin/orders/[orderId]/deliverables
//   — Register an uploaded file in order_deliverables.
//     Called AFTER the browser has PUT the file to Storage via
//     the signed URL from the upload-url route.
//
// DELETE /api/admin/orders/[orderId]/deliverables
//   — Remove a deliverable row and optionally delete the file
//     from Storage.
//
// POST body (JSON):
//   path        : string  — storage path (must start with orderNumber/)
//   filename    : string  — display filename (≤ 255 chars)
//   file_size   : number  — bytes
//   mime_type   : string
//   item_index  : number | null  — which item, or null for order-level
//
// DELETE body (JSON):
//   deliverable_id : string  — UUID of the row to delete
//   delete_file    : boolean — if true, also remove from Storage
//
// SECURITY:
//   - isAdminAuthenticated() checked first on both verbs.
//   - POST: path must begin with <orderNumber>/ to prevent
//     cross-order path injection.
//   - DELETE: verifies row belongs to this orderId before deleting.
//   - Service role key stays server-side.
// ============================================================

export const runtime = "nodejs";

// ── Schemas ───────────────────────────────────────────────────

const PostBody = z.object({
  path:       z.string().min(1).max(512),
  filename:   z.string().min(1).max(255),
  file_size:  z.number().int().min(1).max(
    ADMIN_DELIVERABLE_MAX_BYTES,
    `File too large (max ${ADMIN_DELIVERABLE_MAX_MB} MB).`
  ),
  mime_type:  z.string().min(1).max(100),
  item_index: z.number().int().nullable().optional(),
});

const DeleteBody = z.object({
  deliverable_id: z.string().uuid("Invalid deliverable ID."),
  delete_file:    z.boolean().optional().default(false),
});

// ── POST — register ───────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { orderId } = await params;
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
  }

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = PostBody.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { path, filename, file_size, mime_type, item_index } = parsed.data;

  let supabase;
  try { supabase = createServerClient(); } catch (err) {
    console.error("[admin/deliverables] Supabase init:", err);
    return NextResponse.json(
      { error: "Server not configured for deliverables." },
      { status: 500 }
    );
  }

  // Fetch order to validate orderId + get order_number
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, order_number")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 400 });
  }

  const orderRow = order as unknown as { id: string; order_number: string };

  // Guard: path must start with the correct orderNumber prefix
  // to prevent cross-order path injection.
  if (!path.startsWith(`${orderRow.order_number}/`)) {
    return NextResponse.json(
      { error: "Storage path does not match the order number." },
      { status: 400 }
    );
  }

  const { data: row, error: insertErr } = await supabase
    .from("order_deliverables")
    .insert({
      order_id:     orderId,
      order_number: orderRow.order_number,
      item_index:   item_index ?? null,
      storage_path: path,
      filename,
      file_size,
      mime_type,
    })
    .select("id, order_id, order_number, item_index, filename, file_size, mime_type, uploaded_at")
    .single();

  if (insertErr || !row) {
    console.error("[admin/deliverables] Insert error:", insertErr?.message);
    return NextResponse.json(
      { error: "Could not register deliverable." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, deliverable: row });
}

// ── DELETE — remove ───────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { orderId } = await params;
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
  }

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = DeleteBody.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { deliverable_id, delete_file } = parsed.data;

  let supabase;
  try { supabase = createServerClient(); } catch (err) {
    console.error("[admin/deliverables] Supabase init:", err);
    return NextResponse.json(
      { error: "Server not configured for deliverables." },
      { status: 500 }
    );
  }

  // Fetch row and verify it belongs to this orderId
  const { data: existing, error: fetchErr } = await supabase
    .from("order_deliverables")
    .select("id, order_id, storage_path")
    .eq("id", deliverable_id)
    .eq("order_id", orderId)       // ← ownership guard
    .maybeSingle();

  if (fetchErr || !existing) {
    return NextResponse.json(
      { error: "Deliverable not found for this order." },
      { status: 404 }
    );
  }

  const existingRow = existing as unknown as {
    id: string; order_id: string; storage_path: string;
  };

  // Optionally delete the file from Storage first
  if (delete_file && existingRow.storage_path) {
    const { error: storageErr } = await supabase
      .storage
      .from(DELIVERABLES_BUCKET)
      .remove([existingRow.storage_path]);

    if (storageErr) {
      console.warn(
        "[admin/deliverables] Storage delete failed (continuing):",
        storageErr.message
      );
      // Non-fatal: delete the DB row even if storage removal fails
    }
  }

  const { error: deleteErr } = await supabase
    .from("order_deliverables")
    .delete()
    .eq("id", deliverable_id)
    .eq("order_id", orderId);

  if (deleteErr) {
    console.error("[admin/deliverables] Delete error:", deleteErr.message);
    return NextResponse.json(
      { error: "Could not remove deliverable." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
