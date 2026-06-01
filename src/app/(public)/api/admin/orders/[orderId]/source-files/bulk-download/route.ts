import { type NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  getAdminSourceFileSlot,
  type OrderItemSourceFileRow,
} from "@/lib/admin-source-files";
import {
  assertZipLimits,
  createZipResponse,
  imageFolder,
  safeZipFilename,
  uniqueZipPath,
  type ZipSourceFile,
} from "@/lib/server-zip-download";
import { createServerClient } from "@/lib/supabase";
import { ORDER_FILES_BUCKET } from "@/lib/upload-config";

export const runtime = "nodejs";

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

  const limit = assertZipLimits(
    sourceFiles.map((file) => ({ sizeBytes: file.slot.fileSize }))
  );
  if (!limit.ok) {
    return NextResponse.json({ error: limit.error }, { status: limit.status });
  }

  const usedPaths = new Set<string>();
  const zipFiles: ZipSourceFile[] = [];

  for (const { itemIndex, slot } of sourceFiles) {
    const { data, error } = await supabase.storage
        .from(ORDER_FILES_BUCKET)
        .download(slot.storagePath!);

    if (error || !data) {
      console.error("[admin/source-files/bulk-download] Storage download failed:", error?.message);
      return NextResponse.json(
        { error: `Could not download Image ${itemIndex + 1} ${slot.kind} source file.` },
        { status: 500 }
      );
    }

    const bytes = new Uint8Array(await data.arrayBuffer());
    const zipPath = uniqueZipPath(
      `${imageFolder(itemIndex)}/${slot.kind}-${safeZipFilename(slot.filename)}`,
      usedPaths
    );

    zipFiles.push({ path: zipPath, data: bytes });
  }

  return createZipResponse(
    `${(order as { order_number: string }).order_number}-source-files.zip`,
    zipFiles
  );
}
