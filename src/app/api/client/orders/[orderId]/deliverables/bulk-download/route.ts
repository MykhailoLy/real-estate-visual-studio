import { type NextRequest, NextResponse } from "next/server";
import { getClientUser } from "@/lib/client-auth";
import { getCurrentDeliverableRows } from "@/lib/client-deliverable-display";
import type { ClientDeliverable } from "@/lib/client-deliverables";
import type { DeliverableReview } from "@/lib/client-reviews";
import { DELIVERABLES_BUCKET, SIGNED_URL_TTL_SECONDS } from "@/lib/deliverables-config";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

const MAX_BULK_FILES = 100;

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
    .select("id, order_number")
    .eq("id", orderId)
    .eq("client_email", user.email)
    .maybeSingle();

  if (orderErr) {
    console.error("[client/deliverables/bulk-download] Order lookup:", orderErr.message);
    return NextResponse.json({ error: "Could not verify order." }, { status: 500 });
  }
  if (!order) {
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

  if (currentRows.length === 0) {
    return NextResponse.json({ error: "No delivered files found." }, { status: 404 });
  }
  if (currentRows.length > MAX_BULK_FILES) {
    return NextResponse.json(
      { error: `Too many files for one bulk download. Maximum is ${MAX_BULK_FILES}.` },
      { status: 413 }
    );
  }

  const pathByDeliverableId = new Map(rows.map((row) => [row.id, row.storage_path]));
  const files = await Promise.all(
    currentRows.map(async ({ deliverable }) => {
      const storagePath = pathByDeliverableId.get(deliverable.id);
      if (!storagePath) {
        throw new Error(`Could not find storage path for ${deliverable.filename}.`);
      }

      const { data: signed, error } = await supabase.storage
        .from(DELIVERABLES_BUCKET)
        .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS, {
          download: deliverable.filename,
        });

      if (error || !signed?.signedUrl) {
        throw new Error(`Could not create download link for ${deliverable.filename}.`);
      }

      return {
        signedUrl: signed.signedUrl,
        filename: deliverable.filename,
      };
    })
  ).catch((err) => {
    console.error("[client/deliverables/bulk-download] Signing failed:", err);
    return null;
  });

  if (!files) {
    return NextResponse.json({ error: "Could not prepare delivered file downloads." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    mode: "signed-url-batch",
    archiveFilename: `${(order as { order_number: string }).order_number}-delivered-files.zip`,
    files,
  });
}
