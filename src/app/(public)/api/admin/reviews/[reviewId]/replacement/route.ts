import { after, type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { sendReviewWorkflowEmail } from "@/lib/email/review-workflow-notifications";
import { createServerClient } from "@/lib/supabase";
import { DELIVERABLES_BUCKET } from "@/lib/deliverables-config";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  replacementDeliverableId: z.string().uuid("Invalid replacement deliverable ID."),
});

const LINKABLE_STATUSES = new Set(["rework_requested", "rework_in_progress"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { reviewId } = await params;
  if (!reviewId || !/^[0-9a-f-]{36}$/i.test(reviewId)) {
    return NextResponse.json({ error: "Invalid review ID." }, { status: 400 });
  }

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  let supabase;
  try { supabase = createServerClient(); } catch (err) {
    console.error("[admin/reviews/replacement] Supabase init:", err);
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  }

  const { data: review, error: reviewErr } = await supabase
    .from("deliverable_reviews")
    .select("id, deliverable_id, status, order_id, item_index, replacement_deliverable_id")
    .eq("id", reviewId)
    .maybeSingle();

  if (reviewErr || !review) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }

  const reviewRow = review as unknown as {
    id: string;
    deliverable_id: string;
    status: string;
    order_id: string;
    item_index: number | null;
    replacement_deliverable_id: string | null;
  };

  if (!LINKABLE_STATUSES.has(reviewRow.status)) {
    return NextResponse.json(
      { error: `Cannot link replacement while review is "${reviewRow.status}".` },
      { status: 409 }
    );
  }

  if (reviewRow.replacement_deliverable_id) {
    return NextResponse.json(
      { error: "This review already has a replacement deliverable." },
      { status: 409 }
    );
  }

  const { replacementDeliverableId } = parsed.data;
  const { data: deliverable, error: deliverableErr } = await supabase
    .from("order_deliverables")
    .select("id, order_id, item_index, storage_path, file_size, expires_at")
    .eq("id", replacementDeliverableId)
    .maybeSingle();

  if (deliverableErr || !deliverable) {
    return NextResponse.json({ error: "Replacement deliverable not found." }, { status: 404 });
  }

  const deliverableRow = deliverable as unknown as {
    id: string;
    order_id: string;
    item_index: number | null;
    storage_path: string;
    file_size: number;
    expires_at: string | null;
  };

  if (deliverableRow.order_id !== reviewRow.order_id) {
    return NextResponse.json(
      { error: "Replacement deliverable belongs to a different order." },
      { status: 400 }
    );
  }

  if (deliverableRow.item_index !== reviewRow.item_index) {
    return NextResponse.json(
      { error: "Replacement deliverable must use the same image assignment as the rework request." },
      { status: 400 }
    );
  }

  if (deliverableRow.id === reviewRow.deliverable_id ||
      (deliverableRow.expires_at && new Date(deliverableRow.expires_at).getTime() <= Date.now())) {
    return NextResponse.json({ error: "A new, accessible replacement file is required." }, { status: 409 });
  }

  // A metadata row alone is not proof of a completed upload. Verify the
  // persisted private object before attaching it or firing the existing event.
  try {
    const { data: object, error: storageError } = await supabase.storage
      .from(DELIVERABLES_BUCKET).info(deliverableRow.storage_path);
    if (storageError || !object || deliverableRow.file_size < 1 || Number(object.size) !== deliverableRow.file_size) {
      return NextResponse.json({ error: "Replacement upload is not ready. Complete the upload and try again." }, { status: 409 });
    }
  } catch {
    return NextResponse.json({ error: "Could not verify replacement upload. Please try again." }, { status: 503 });
  }

  // Conditional attachment and the existing replacement-ready event commit
  // together. A crash or provider outage cannot lose the notification.
  const { data: linkedReview, error: updateErr } = await supabase
    .rpc("attach_replacement_with_email", {
      p_review_id: reviewId,
      p_replacement_deliverable_id: replacementDeliverableId,
    })
    .maybeSingle();

  if (updateErr) {
    console.error("[admin/reviews/replacement] Update error:", updateErr.message);
    return NextResponse.json({ error: "Could not link replacement deliverable." }, { status: 500 });
  }

  if (!linkedReview) {
    return NextResponse.json({ error: "This review was already updated. Refresh the order." }, { status: 409 });
  }

  after(async () => {
    await sendReviewWorkflowEmail({
      event: "admin_replacement_ready",
      reviewId,
      replacementDeliverableId,
    });
  });

  return NextResponse.json({
    ok: true,
    status: "rework_delivered",
    replacementDeliverableId,
  });
}
