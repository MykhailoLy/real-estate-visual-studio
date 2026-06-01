import { type NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { DELIVERABLES_BUCKET, SIGNED_URL_TTL_SECONDS } from "@/lib/deliverables-config";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

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
    .select("id, storage_path, filename")
    .eq("order_id", orderId)
    .order("uploaded_at", { ascending: false });

  if (deliverablesErr) {
    console.error("[admin/deliverables/bulk-download] Deliverable lookup:", deliverablesErr.message);
    return NextResponse.json({ error: "Could not load deliverables." }, { status: 500 });
  }

  const rows = (deliverables ?? []) as unknown as Array<{
    storage_path: string;
    filename: string;
  }>;

  if (rows.length === 0) {
    return NextResponse.json({ error: "No deliverables found." }, { status: 404 });
  }
  if (rows.length > MAX_BULK_FILES) {
    return NextResponse.json(
      { error: `Too many files for one bulk download. Maximum is ${MAX_BULK_FILES}.` },
      { status: 413 }
    );
  }

  const files = await Promise.all(
    rows.map(async (row) => {
      const { data: signed, error } = await supabase.storage
        .from(DELIVERABLES_BUCKET)
        .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS, {
          download: row.filename,
        });

      if (error || !signed?.signedUrl) {
        throw new Error(`Could not create download link for ${row.filename}.`);
      }

      return {
        signedUrl: signed.signedUrl,
        filename: row.filename,
      };
    })
  ).catch((err) => {
    console.error("[admin/deliverables/bulk-download] Signing failed:", err);
    return null;
  });

  if (!files) {
    return NextResponse.json({ error: "Could not prepare deliverable downloads." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    mode: "signed-url-batch",
    archiveFilename: `${(order as { order_number: string }).order_number}-deliverables.zip`,
    files,
  });
}
