import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClientUser } from "@/lib/client-auth";
import { finalizeReworkReviewSubmission } from "@/lib/client-reviews";
import { toOrderOwnership } from "@/lib/order-ownership";
import { REWORK_REFERENCES_MAX_FILES } from "@/lib/rework-references-config";
import { sendReviewWorkflowEmail } from "@/lib/email/review-workflow-notifications";

export const runtime = "nodejs";
const Body = z.object({ expected_file_count: z.number().int().min(1).max(REWORK_REFERENCES_MAX_FILES) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ reviewId: string }> }) {
  const user = await getClientUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { reviewId } = await params;
  if (!z.uuid().safeParse(reviewId).success) return NextResponse.json({ error: "Invalid review ID." }, { status: 400 });
  let raw: unknown;
  try { raw = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid reference file count." }, { status: 400 });
  const result = await finalizeReworkReviewSubmission(reviewId, toOrderOwnership(user), parsed.data.expected_file_count);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  // Preserve the existing best-effort email behavior, after the atomic commit.
  await sendReviewWorkflowEmail({ event: "client_rework_requested", reviewId: result.review.id });
  return NextResponse.json({ ok: true, review: result.review });
}
