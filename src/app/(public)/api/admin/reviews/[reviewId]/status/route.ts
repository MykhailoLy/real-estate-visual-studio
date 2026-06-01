import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";

// ============================================================
// PATCH /api/admin/reviews/[reviewId]/status
//
// Admin transitions a deliverable_review status:
//   rework_requested   → rework_in_progress
//   rework_requested   → resolved
//   rework_in_progress → resolved
//
// Auth: isAdminAuthenticated() cookie-based session.
// Service role key stays server-side.
// ============================================================

export const runtime = "nodejs";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  rework_requested:   ["rework_in_progress", "resolved"],
  rework_in_progress: ["resolved"],
};

const PatchBody = z.object({
  status: z.enum(["rework_in_progress", "resolved"]),
});

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

  const parsed = PatchBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const { status: newStatus } = parsed.data;

  let supabase;
  try { supabase = createServerClient(); } catch (err) {
    console.error("[admin/reviews] Supabase init:", err);
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  }

  // Fetch current review
  const { data: review, error: fetchErr } = await supabase
    .from("deliverable_reviews")
    .select("id, status")
    .eq("id", reviewId)
    .maybeSingle();

  if (fetchErr || !review) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }

  const currentStatus = (review as unknown as { status: string }).status;

  // Validate transition
  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `Cannot transition from "${currentStatus}" to "${newStatus}".` },
      { status: 409 }
    );
  }

  // Update
  const { error: updateErr } = await supabase
    .from("deliverable_reviews")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", reviewId);

  if (updateErr) {
    console.error("[admin/reviews] Update error:", updateErr.message);
    return NextResponse.json({ error: "Could not update review." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
