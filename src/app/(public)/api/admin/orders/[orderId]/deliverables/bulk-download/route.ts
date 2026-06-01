import { type NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { DELIVERABLES_BUCKET } from "@/lib/deliverables-config";
import {
  assertZipLimits,
  createZipResponse,
  imageFolder,
  safeZipFilename,
  uniqueZipPath,
  type ZipSourceFile,
} from "@/lib/server-zip-download";
import { createServerClient } from "@/lib/supabase";

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
    console.error("[admin/deliverables/bulk-download] Supabase init:", err);
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, order_number")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr) {
    console.error("[admin/deliverables/bulk-download] Order lookup:", orderErr.message);
    return NextResponse.json({ error: "Could not verify order." }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const { data: deliverables, error: deliverablesErr } = await supabase
    .from("order_deliverables")
    .select("id, item_index, storage_path, filename, file_size")
    .eq("order_id", orderId)
    .order("uploaded_at", { ascending: false });

  if (deliverablesErr) {
    console.error("[admin/deliverables/bulk-download] Deliverable lookup:", deliverablesErr.message);
    return NextResponse.json({ error: "Could not load deliverables." }, { status: 500 });
  }

  const rows = (deliverables ?? []) as unknown as Array<{
    item_index: number | null;
    storage_path: string;
    filename: string;
    file_size: number | null;
  }>;

  const limit = assertZipLimits(rows.map((row) => ({ sizeBytes: row.file_size })));
  if (!limit.ok) {
    return NextResponse.json({ error: limit.error }, { status: limit.status });
  }

  const usedPaths = new Set<string>();
  const zipFiles: ZipSourceFile[] = [];

  for (const row of rows) {
    const { data, error } = await supabase.storage
        .from(DELIVERABLES_BUCKET)
        .download(row.storage_path);

    if (error || !data) {
      console.error("[admin/deliverables/bulk-download] Storage download failed:", error?.message);
      return NextResponse.json(
        { error: `Could not download deliverable "${row.filename}".` },
        { status: 500 }
      );
    }

    const bytes = new Uint8Array(await data.arrayBuffer());
    const zipPath = uniqueZipPath(
      `${imageFolder(row.item_index)}/${safeZipFilename(row.filename)}`,
      usedPaths
    );

    zipFiles.push({ path: zipPath, data: bytes });
  }

  return createZipResponse(
    `${(order as { order_number: string }).order_number}-deliverables.zip`,
    zipFiles
  );
}
