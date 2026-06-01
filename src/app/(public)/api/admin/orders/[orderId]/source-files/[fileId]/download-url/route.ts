import { type NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  getAdminSourceFileSlot,
  parseAdminSourceFileId,
  type OrderItemSourceFileRow,
} from "@/lib/admin-source-files";
import { createServerClient } from "@/lib/supabase";
import { ORDER_FILES_BUCKET } from "@/lib/upload-config";

export const runtime = "nodejs";

const SOURCE_FILE_SIGNED_URL_TTL_SECONDS = 300;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string; fileId: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { orderId, fileId } = await params;
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
  }

  const parsedFileId = parseAdminSourceFileId(fileId);
  if (!parsedFileId) {
    return NextResponse.json({ error: "Invalid source file ID." }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createServerClient();
  } catch (err) {
    console.error("[admin/source-files/download-url] Supabase init:", err);
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr) {
    console.error("[admin/source-files/download-url] Order lookup:", orderErr.message);
    return NextResponse.json({ error: "Could not verify order." }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const { data: item, error: itemErr } = await supabase
    .from("order_items")
    .select(
      "id, item_index, original_photo_path, reference_image_path, details, created_at"
    )
    .eq("id", parsedFileId.orderItemId)
    .eq("order_id", orderId)
    .maybeSingle();

  if (itemErr) {
    console.error("[admin/source-files/download-url] Source item lookup:", itemErr.message);
    return NextResponse.json({ error: "Could not verify source file." }, { status: 500 });
  }
  if (!item) {
    return NextResponse.json({ error: "Source file not found." }, { status: 404 });
  }

  const row = item as unknown as OrderItemSourceFileRow;
  const slot = getAdminSourceFileSlot(row, parsedFileId.kind);
  if (!slot.storagePath) {
    return NextResponse.json({ error: "Source file not found." }, { status: 404 });
  }

  const { data: signed, error: signedErr } = await supabase.storage
    .from(ORDER_FILES_BUCKET)
    .createSignedUrl(slot.storagePath, SOURCE_FILE_SIGNED_URL_TTL_SECONDS, {
      download: slot.filename,
    });

  if (signedErr || !signed?.signedUrl) {
    console.error(
      "[admin/source-files/download-url] Signed URL error:",
      signedErr?.message ?? "No signed URL returned."
    );
    return NextResponse.json({ error: "Could not create download link." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    signedUrl: signed.signedUrl,
    filename: slot.filename,
  });
}
