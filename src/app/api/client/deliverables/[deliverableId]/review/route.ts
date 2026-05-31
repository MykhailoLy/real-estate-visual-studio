import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClientUser } from "@/lib/client-auth";
import {
  submitDeliverableReview,
  REVIEW_COMMENT_MIN,
  REVIEW_COMMENT_MAX,
} from "@/lib/client-reviews";

// ============================================================
// POST /api/client/deliverables/[deliverableId]/review
//
// Submits a client review action for one deliverable:
//   { action: "approve" }
//   { action: "rework_requested", comment: string }
//
// Response (200): { ok: true, review: { id, status, comment, created_at } }
// Response (400): invalid body or comment too short/long
// Response (401): not authenticated
// Response (404): deliverable not found or not owned by caller
// Response (409): terminal state reached or active rework already open
// Response (500): server error
//
// SECURITY:
//   - deliverableId comes from the URL (untrusted — UUID validated).
//   - user.email comes from getClientUser() (server-validated SSR session).
//   - Both are cross-referenced inside submitDeliverableReview() via
//     a JOIN: order_deliverables → orders WHERE client_email = email.
//   - client_email stored in the review row is set from the verified
//     session email — never from the request body.
//   - A wrong owner receives 404 — indistinguishable from missing.
//   - storage_path is never read or returned.
//   - Service role key stays server-side only.
// ============================================================

export const runtime = "nodejs";

// ── Zod schema ────────────────────────────────────────────────

const ReviewBody = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
  }),
  z.object({
    action: z.literal("rework_requested"),
    comment: z
      .string()
      .min(
        REVIEW_COMMENT_MIN,
        `Please describe what needs to change (min ${REVIEW_COMMENT_MIN} characters).`
      )
      .max(
        REVIEW_COMMENT_MAX,
        `Comment is too long (max ${REVIEW_COMMENT_MAX} characters).`
      ),
  }),
]);

// ── POST ──────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ deliverableId: string }> }
) {
  // Validate session — email never from client
  const user = await getClientUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { deliverableId } = await params;

  // Basic UUID-shape check before touching the DB
  if (!deliverableId || !/^[0-9a-f-]{36}$/i.test(deliverableId)) {
    return NextResponse.json({ error: "Invalid deliverable ID." }, { status: 400 });
  }

  // Parse and validate body
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = ReviewBody.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const body = parsed.data;

  // Delegate to server helper — all ownership + guard logic inside
  const result = await submitDeliverableReview(
    deliverableId,
    user.email,
    body.action,
    body.action === "rework_requested" ? body.comment : undefined
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // Return only safe review fields — no storage paths
  const { review } = result;
  return NextResponse.json({
    ok: true,
    review: {
      id:         review.id,
      status:     review.status,
      comment:    review.comment,
      created_at: review.created_at,
    },
  });
}
