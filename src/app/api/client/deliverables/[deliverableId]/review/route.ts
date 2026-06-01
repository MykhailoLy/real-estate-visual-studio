import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClientUser } from "@/lib/client-auth";
import { submitDeliverableReview, REVIEW_COMMENT_MIN, REVIEW_COMMENT_MAX } from "@/lib/client-reviews";

// ============================================================
// POST /api/client/deliverables/[deliverableId]/review
//
// { action: "approve" }
// { action: "rework_requested", comment: string }
//
// Security: getClientUser() SSR session; ownership JOIN inside
// submitDeliverableReview(); service role key server-side only.
// ============================================================

export const runtime = "nodejs";

const ReviewBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({
    action: z.literal("rework_requested"),
    comment: z.string()
      .min(REVIEW_COMMENT_MIN, `Min ${REVIEW_COMMENT_MIN} characters.`)
      .max(REVIEW_COMMENT_MAX, `Max ${REVIEW_COMMENT_MAX} characters.`),
  }),
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ deliverableId: string }> }
) {
  const user = await getClientUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { deliverableId } = await params;
  if (!deliverableId || !/^[0-9a-f-]{36}$/i.test(deliverableId))
    return NextResponse.json({ error: "Invalid deliverable ID." }, { status: 400 });

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = ReviewBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const body = parsed.data;
  const result = await submitDeliverableReview(
    deliverableId,
    user.email,
    body.action,
    body.action === "rework_requested" ? body.comment : undefined
  );

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const { review } = result;
  return NextResponse.json({
    ok: true,
    review: { id: review.id, status: review.status, comment: review.comment, created_at: review.created_at },
  });
}
