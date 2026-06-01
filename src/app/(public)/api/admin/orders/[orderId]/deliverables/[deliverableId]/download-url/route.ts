import { type NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { DELIVERABLES_BUCKET, SIGNED_URL_TTL_SECONDS } from "@/lib/deliverables-config";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string; deliverableId: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { orderId, deliverableId } = await params;
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
  }
  if (!deliverableId || !/^[0-9a-f-]{36}$/i.test(deliverableId)) {
    return NextResponse.json({ error: "Invalid deliverable ID." }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { intent?: unknown };
  const intent = body.intent === "preview" ? "preview" : "download";

  let supabase;
  try {
    supabase = createServerClient();
  } catch (err) {
    console.error("[admin/deliverables/download-url] Supabase init:", err);
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  }

  const { data: deliverable, error: deliverableErr } = await supabase
    .from("order_deliverables")
    .select("id, order_id, storage_path, filename")
    .eq("id", deliverableId)
    .eq("order_id", orderId)
    .maybeSingle();

  if (deliverableErr) {
    console.error("[admin/deliverables/download-url] Lookup:", deliverableErr.message);
    return NextResponse.json({ error: "Could not verify deliverable." }, { status: 500 });
  }
  if (!deliverable) {
    return NextResponse.json({ error: "Deliverable not found." }, { status: 404 });
  }

  const row = deliverable as unknown as {
    storage_path: string;
    filename: string;
  };

  const { data: signed, error: signedErr } = await supabase.storage
    .from(DELIVERABLES_BUCKET)
    .createSignedUrl(
      row.storage_path,
      SIGNED_URL_TTL_SECONDS,
      intent === "preview" ? undefined : { download: row.filename }
    );

  if (signedErr || !signed?.signedUrl) {
    console.error(
      "[admin/deliverables/download-url] Signed URL error:",
      signedErr?.message ?? "No signed URL returned."
    );
    return NextResponse.json({ error: "Could not create file link." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    signedUrl: signed.signedUrl,
    filename: row.filename,
  });
}
