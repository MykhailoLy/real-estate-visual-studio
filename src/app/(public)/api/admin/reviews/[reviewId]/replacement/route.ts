import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

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
    .select("id, status, order_id, item_index, replacement_deliverable_id")
    .eq("id", reviewId)
    .maybeSingle();

  if (reviewErr || !review) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }

  const reviewRow = review as unknown as {
    id: string;
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
    .select("id, order_id, item_index")
    .eq("id", replacementDeliverableId)
    .maybeSingle();

  if (deliverableErr || !deliverable) {
    return NextResponse.json({ error: "Replacement deliverable not found." }, { status: 404 });
  }

  const deliverableRow = deliverable as unknown as {
    id: string;
    order_id: string;
    item_index: number | null;
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

  const { error: updateErr } = await supabase
    .from("deliverable_reviews")
    .update({
      replacement_deliverable_id: replacementDeliverableId,
      status: "rework_delivered",
      updated_at: new Date().toISOString(),
    })
    .eq("id", reviewId);

  if (updateErr) {
    console.error("[admin/reviews/replacement] Update error:", updateErr.message);
    return NextResponse.json({ error: "Could not link replacement deliverable." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    status: "rework_delivered",
    replacementDeliverableId,
  });
}
