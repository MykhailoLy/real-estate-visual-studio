import { type NextRequest, NextResponse } from "next/server";
import { getClientUser } from "@/lib/client-auth";
import { getDeliverableDownloadUrl } from "@/lib/client-deliverables";

// ============================================================
// POST /api/client/deliverables/[deliverableId]/download-url
//
// Generates a short-lived (300 s) signed download URL for one
// deliverable.  The client receives signedUrl + filename — the
// storage_path never leaves the server.
//
// Response (200): { signedUrl: string; filename: string }
// Response (401): not authenticated
// Response (404): deliverable not found or not owned by caller
// Response (500): server config error
//
// SECURITY:
//   - deliverableId comes from the URL (untrusted).
//   - user.email comes from getClientUser() (server-validated SSR).
//   - Both are cross-referenced in a single ownership-guarded JOIN
//     inside getDeliverableDownloadUrl().
//   - A wrong owner receives 404 — indistinguishable from missing.
//   - Signed URL is NOT logged server-side.
//   - Service role key stays server-side only.
//   - Signed URL is generated with { download: filename } so that
//     Content-Disposition: attachment is set, forcing file download.
// ============================================================

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ deliverableId: string }> }
) {
  // Validate session server-side — email never from client
  const user = await getClientUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { deliverableId } = await params;
  const body = (await req.json().catch(() => ({}))) as { intent?: unknown };
  const intent = body.intent === "preview" ? "preview" : "download";

  // Basic UUID-shape check before touching the DB
  if (!deliverableId || !/^[0-9a-f-]{36}$/i.test(deliverableId)) {
    return NextResponse.json({ error: "Invalid deliverable ID." }, { status: 400 });
  }

  // Ownership-guarded signed URL — null = not found or wrong owner
  const result = await getDeliverableDownloadUrl(deliverableId, user.email, {
    download: intent !== "preview",
  });

  if (!result) {
    // Deliberately identical response for "not found" and "wrong owner"
    return NextResponse.json(
      { error: "Deliverable not found." },
      { status: 404 }
    );
  }

  // Return signed URL + filename — do NOT log the signed URL
  return NextResponse.json({ ok: true, signedUrl: result.signedUrl, filename: result.filename });
}
