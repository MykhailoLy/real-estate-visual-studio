import { type NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";
import { ORDER_FILES_BUCKET } from "@/lib/upload-config";
import { REWORK_REFERENCE_SIGNED_URL_TTL_SECONDS } from "@/lib/rework-references-config";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ orderId: string; reviewId: string; fileId: string }>;
  },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { orderId, reviewId, fileId } = await params;
  if (!orderId || !UUID_RE.test(orderId)) {
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
  }
  if (!reviewId || !UUID_RE.test(reviewId)) {
    return NextResponse.json({ error: "Invalid review ID." }, { status: 400 });
  }
  if (!fileId || !UUID_RE.test(fileId)) {
    return NextResponse.json({ error: "Invalid file ID." }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { intent?: unknown };
  const intent = body.intent === "preview" ? "preview" : "download";

  let supabase;
  try {
    supabase = createServerClient();
  } catch (err) {
    console.error("[admin/rework-reference/download-url] Supabase init:", err);
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  }

  const { data: review, error: reviewErr } = await supabase
    .from("deliverable_reviews")
    .select("id, order_id")
    .eq("id", reviewId)
    .eq("order_id", orderId)
    .maybeSingle();

  if (reviewErr) {
    console.error("[admin/rework-reference/download-url] Review lookup:", reviewErr.message);
    return NextResponse.json({ error: "Could not verify review." }, { status: 500 });
  }
  if (!review) {
    return NextResponse.json({ error: "Reference file not found." }, { status: 404 });
  }

  const { data: file, error: fileErr } = await supabase
    .from("deliverable_review_files")
    .select("id, review_id, order_id, storage_path, filename")
    .eq("id", fileId)
    .eq("review_id", reviewId)
    .eq("order_id", orderId)
    .maybeSingle();

  if (fileErr) {
    console.error("[admin/rework-reference/download-url] File lookup:", fileErr.message);
    return NextResponse.json({ error: "Could not verify reference file." }, { status: 500 });
  }
  if (!file) {
    return NextResponse.json({ error: "Reference file not found." }, { status: 404 });
  }

  const row = file as unknown as {
    storage_path: string;
    filename: string;
  };

  const { data: signed, error: signedErr } = await supabase.storage
    .from(ORDER_FILES_BUCKET)
    .createSignedUrl(
      row.storage_path,
      REWORK_REFERENCE_SIGNED_URL_TTL_SECONDS,
      intent === "preview" ? undefined : { download: row.filename },
    );

  if (signedErr || !signed?.signedUrl) {
    console.error(
      "[admin/rework-reference/download-url] Signed URL error:",
      signedErr?.message ?? "No signed URL returned.",
    );
    return NextResponse.json({ error: "Could not create file link." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    signedUrl: signed.signedUrl,
    filename: row.filename,
  });
}
