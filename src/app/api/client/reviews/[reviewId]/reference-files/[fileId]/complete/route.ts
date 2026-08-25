import { type NextRequest, NextResponse } from "next/server";
import { getClientUser } from "@/lib/client-auth";
import { markReworkReferenceUploaded } from "@/lib/rework-reference-files";
import { toOrderOwnership } from "@/lib/order-ownership";

// ============================================================
// POST /api/client/reviews/[reviewId]/reference-files/[fileId]/complete
//
// Called by the client after successfully PUTting file bytes to
// the signed upload URL. Verifies the object actually exists in
// the order-files bucket and returns confirmed file metadata.
//
// No request body required.
//
// Response (200):
//   { ok: true, file: { id, filename, file_size, mime_type, created_at } }
//
// 401 — no client session
// 400 — invalid reviewId or fileId format
// 404 — review or file not found / not owned by caller
// 409 — storage object not present (upload likely incomplete)
// 500 — server configuration error
//
// SECURITY:
// • getClientUser() required — SSR session validation.
// • Ownership verified inside markReworkReferenceUploaded()
//   via deliverable_reviews JOIN orders.client_email.
// • storage_path is NOT returned to the browser.
// ============================================================

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ reviewId: string; fileId: string }> },
) {
  // ── Auth ────────────────────────────────────────────────────
  const user = await getClientUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // ── Params ──────────────────────────────────────────────────
  const { reviewId, fileId } = await params;

  if (!reviewId || !UUID_RE.test(reviewId)) {
    return NextResponse.json({ error: "Invalid review ID." }, { status: 400 });
  }
  if (!fileId || !UUID_RE.test(fileId)) {
    return NextResponse.json({ error: "Invalid file ID." }, { status: 400 });
  }

  // ── Delegate to helper ──────────────────────────────────────
  const result = await markReworkReferenceUploaded(reviewId, fileId, toOrderOwnership(user));

  if (!result.ok) {
    return NextResponse.json(
      result.code
        ? { error: result.error, code: result.code }
        : { error: result.error },
      { status: result.status },
    );
  }

  // storage_path is NOT included in result.file
  return NextResponse.json({ ok: true, file: result.file });
}
