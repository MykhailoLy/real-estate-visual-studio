import { type NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  getAdminSourceFileSlot,
  type OrderItemSourceFileRow,
} from "@/lib/admin-source-files";
import { createServerClient } from "@/lib/supabase";
import { ORDER_FILES_BUCKET } from "@/lib/upload-config";

export const runtime = "nodejs";

const BULK_SIGNED_URL_TTL_SECONDS = 300;
const MAX_BULK_FILES = 100;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { orderId } = await params;
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createServerClient();
  } catch (err) {
    console.error("[admin/source-files/bulk-download] Supabase init:", err);
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, order_number")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr) {
    console.error("[admin/source-files/bulk-download] Order lookup:", orderErr.message);
    return NextResponse.json({ error: "Could not verify order." }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const { data: items, error: itemsErr } = await supabase
    .from("order_items")
    .select("id, item_index, original_photo_path, reference_image_path, details, created_at")
    .eq("order_id", orderId)
    .order("item_index", { ascending: true });

  if (itemsErr) {
    console.error("[admin/source-files/bulk-download] Item lookup:", itemsErr.message);
    return NextResponse.json({ error: "Could not load source files." }, { status: 500 });
  }

  const rows = (items ?? []) as unknown as OrderItemSourceFileRow[];
  const sourceFiles = rows.flatMap((row) =>
    (["original", "reference"] as const)
      .map((kind) => ({
        itemIndex: row.item_index,
        slot: getAdminSourceFileSlot(row, kind),
      }))
      .filter((file) => Boolean(file.slot.storagePath))
  );

  if (sourceFiles.length === 0) {
    return NextResponse.json({ error: "No source files found." }, { status: 404 });
  }
  if (sourceFiles.length > MAX_BULK_FILES) {
    return NextResponse.json(
      { error: `Too many files for one bulk download. Maximum is ${MAX_BULK_FILES}.` },
      { status: 413 }
    );
  }

  const files = await Promise.all(
    sourceFiles.map(async ({ itemIndex, slot }) => {
      const { data: signed, error } = await supabase.storage
        .from(ORDER_FILES_BUCKET)
        .createSignedUrl(slot.storagePath!, BULK_SIGNED_URL_TTL_SECONDS, {
          download: slot.filename,
        });

      if (error || !signed?.signedUrl) {
        throw new Error(
          `Could not create download link for Image ${itemIndex + 1} ${slot.kind}.`
        );
      }

      return {
        signedUrl: signed.signedUrl,
        filename: slot.filename,
      };
    })
  ).catch((err) => {
    console.error("[admin/source-files/bulk-download] Signing failed:", err);
    return null;
  });

  if (!files) {
    return NextResponse.json({ error: "Could not prepare source file downloads." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    mode: "signed-url-batch",
    archiveFilename: `${(order as { order_number: string }).order_number}-source-files.zip`,
    files,
  });
}
