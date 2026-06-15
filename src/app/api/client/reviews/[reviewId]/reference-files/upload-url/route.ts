import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClientUser } from "@/lib/client-auth";
import { createReworkReferenceUploadSlot } from "@/lib/rework-reference-files";
import { toOrderOwnership } from "@/lib/order-ownership";
import {
  REWORK_REFERENCE_MAX_BYTES,
  REWORK_REFERENCE_MAX_MB,
} from "@/lib/rework-references-config";

// ============================================================
// POST /api/client/reviews/[reviewId]/reference-files/upload-url
//
// Issues a short-lived Supabase Storage signed upload URL for
// the private `order-files` bucket so the client browser can PUT
// reference file bytes directly to Storage.
// No file bytes flow through this route handler.
//
// Request body (JSON):
//   filename     : string  — original filename
//   content_type : string  — MIME type (validated against allowlist)
//   file_size    : number  — bytes (validated ≤ 20 MB)
//
// Response (200):
//   { ok: true, signedUrl, file: { id, filename, file_size, mime_type, created_at } }
//
// 401 — no client session
// 400 — invalid body / MIME not allowed / file too large
// 404 — review not found or not owned by caller
// 409 — review not in rework_requested status
// 422 — per-review file limit reached
// 500 — server / storage configuration error
//
// SECURITY:
// • getClientUser() required — SSR session validation.
// • Ownership verified inside createReworkReferenceUploadSlot()
//   via deliverable_reviews JOIN orders.client_email.
// • Storage path built server-side — never accepted from client.
// • storage_path is NOT returned to the browser.
// • Bucket is private; signed URL expires quickly.
// ============================================================

export const runtime = "nodejs";

const Body = z.object({
  filename: z.string().min(1).max(255),
  content_type: z.string().min(1),
  file_size: z
    .number()
    .int()
    .min(1)
    .max(
      REWORK_REFERENCE_MAX_BYTES,
      `File is too large. Maximum is ${REWORK_REFERENCE_MAX_MB} MB.`,
    ),
});

const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function POST(
  req: NextRequest,
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

  // ── Body ────────────────────────────────────────────────────
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const { filename, content_type, file_size } = parsed.data;

  // ── Delegate to helper ──────────────────────────────────────
  const result = await createReworkReferenceUploadSlot(
    reviewId,
    toOrderOwnership(user),
    { filename, contentType: content_type, fileSize: file_size },
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // signedUrl is returned; storage_path is NOT included in result.file
  return NextResponse.json({
    ok: true,
    signedUrl: result.signedUrl,
    file: result.file,
  });
}
