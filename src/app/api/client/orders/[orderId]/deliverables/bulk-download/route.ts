import { type NextRequest, NextResponse } from "next/server";
import { getClientUser } from "@/lib/client-auth";
import { getCurrentDeliverableRows } from "@/lib/client-deliverable-display";
import type { ClientDeliverable } from "@/lib/client-deliverables";
import type { DeliverableReview } from "@/lib/client-reviews";
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
import { isOrderOwned, toOrderOwnership } from "@/lib/order-ownership";

export const runtime = "nodejs";

type DeliverableWithPath = ClientDeliverable & { storage_path: string };

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const user = await getClientUser();
  if (!user) {
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
    console.error("[client/deliverables/bulk-download] Supabase init:", err);
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, order_number, user_id, client_email")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr) {
    console.error("[client/deliverables/bulk-download] Order lookup:", orderErr.message);
    return NextResponse.json({ error: "Could not verify order." }, { status: 500 });
  }
  if (
    !order ||
    !isOrderOwned(
      order as { user_id: string | null; client_email: string | null },
      toOrderOwnership(user)
    )
  ) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const [{ data: deliverables, error: deliverablesErr }, { data: reviews, error: reviewsErr }] =
    await Promise.all([
      supabase
        .from("order_deliverables")
        .select(
          "id, order_id, order_number, item_index, filename, file_size, mime_type, uploaded_at, storage_path"
        )
        .eq("order_id", orderId)
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("deliverable_reviews")
        .select(
          "id, deliverable_id, order_id, order_number, item_index, client_email, status, comment, created_at, updated_at, replacement_deliverable_id"
        )
        .eq("order_id", orderId)
        .order("created_at", { ascending: false }),
    ]);

  if (deliverablesErr) {
    console.error("[client/deliverables/bulk-download] Deliverable lookup:", deliverablesErr.message);
    return NextResponse.json({ error: "Could not load delivered files." }, { status: 500 });
  }
  if (reviewsErr) {
    console.error("[client/deliverables/bulk-download] Review lookup:", reviewsErr.message);
    return NextResponse.json({ error: "Could not load review state." }, { status: 500 });
  }

  const rows = (deliverables ?? []) as unknown as DeliverableWithPath[];
  const currentRows = getCurrentDeliverableRows(
    rows,
    (reviews ?? []) as unknown as DeliverableReview[]
  );

  const limit = assertZipLimits(
    currentRows.map(({ deliverable }) => ({ sizeBytes: deliverable.file_size }))
  );
  if (!limit.ok) {
    return NextResponse.json(
      {
        error:
          limit.status === 404 ? "No delivered files found." : limit.error,
      },
      { status: limit.status }
    );
  }

  const pathByDeliverableId = new Map(rows.map((row) => [row.id, row.storage_path]));
  const usedPaths = new Set<string>();
  const zipFiles: ZipSourceFile[] = [];

  for (const { deliverable } of currentRows) {
    const storagePath = pathByDeliverableId.get(deliverable.id);
    if (!storagePath) {
      console.error("[client/deliverables/bulk-download] Missing storage path:", deliverable.id);
      return NextResponse.json(
        { error: `Could not prepare delivered file "${deliverable.filename}".` },
        { status: 500 }
      );
    }

    const { data, error } = await supabase.storage
      .from(DELIVERABLES_BUCKET)
      .download(storagePath);

    if (error || !data) {
      console.error("[client/deliverables/bulk-download] Storage download failed:", error?.message);
      return NextResponse.json(
        { error: `Could not download delivered file "${deliverable.filename}".` },
        { status: 500 }
      );
    }

    const bytes = new Uint8Array(await data.arrayBuffer());
    const zipPath = uniqueZipPath(
      `${imageFolder(deliverable.item_index)}/${safeZipFilename(deliverable.filename)}`,
      usedPaths
    );

    zipFiles.push({ path: zipPath, data: bytes });
  }

  return createZipResponse(
    `${(order as { order_number: string }).order_number}-delivered-files.zip`,
    zipFiles
  );
}
