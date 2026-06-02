import { type NextRequest, NextResponse } from "next/server";
import { getClientUser } from "@/lib/client-auth";
import { getReworkReferenceFilesForReview } from "@/lib/rework-reference-files";

// ============================================================
// GET /api/client/reviews/[reviewId]/reference-files
//
// Returns safe metadata for all reference files attached to the
// given rework review.
//
// Response (200):
//   { ok: true, files: [{ id, filename, file_size, mime_type, created_at }] }
//
// 401 — no client session
// 400 — invalid reviewId format
// 404 — review not found or not owned by caller
// 500 — server configuration error
//
// SECURITY:
// • getClientUser() required — SSR session validation.
// • Ownership verified inside getReworkReferenceFilesForReview()
//   via deliverable_reviews JOIN orders.client_email.
// • storage_path is NOT returned to the browser.
// ============================================================

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  // ── Auth ────────────────────────────────────────────────────
  const user = await getClientUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // ── Params ──────────────────────────────────────────────────
  const { reviewId } = await params;
  if (!reviewId || !UUID_RE.test(reviewId)) {
    return NextResponse.json({ error: "Invalid review ID." }, { status: 400 });
  }

  // ── Delegate to helper ──────────────────────────────────────
  const result = await getReworkReferenceFilesForReview(reviewId, user.email);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // storage_path is NOT included in any item of result.files
  return NextResponse.json({ ok: true, files: result.files });
}
