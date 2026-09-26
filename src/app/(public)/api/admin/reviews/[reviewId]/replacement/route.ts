import { after, type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { sendReviewWorkflowEmail } from "@/lib/email/review-workflow-notifications";
import { createServerClient } from "@/lib/supabase";
import {
  DELIVERABLES_BUCKET, ADMIN_DELIVERABLE_MAX_BYTES,
  ALLOWED_DELIVERABLE_MIME_TYPES, ALLOWED_DELIVERABLE_EXTENSIONS,
  buildReplacementDeliverablePath,
} from "@/lib/deliverables-config";

export const runtime = "nodejs";
export const maxDuration = 60;

const Filename = z.string().min(1).max(255);
const FileSize = z.number().int().min(1).max(ADMIN_DELIVERABLE_MAX_BYTES);
const MimeType = z.string().min(1).max(100);
const CandidateId = z.string().uuid("Invalid replacement deliverable ID.").transform(id => id.toLowerCase());
const PrepareBody = z.object({ filename: Filename, content_type: MimeType, file_size: FileSize }).strict();
const AtomicBody = z.object({ mode: z.literal("atomic_upload"), replacementDeliverableId: CandidateId,
  filename: Filename, file_size: FileSize, mime_type: MimeType }).strict();
const Body = z.union([AtomicBody, z.object({
  // A malformed strict request must never silently use legacy attachment.
  mode: z.undefined().optional(),
  replacementDeliverableId: z.string().uuid("Invalid replacement deliverable ID."),
})]);
const SafeDeliverable = z.object({
  id: z.string().uuid(), order_id: z.string().uuid(), order_number: z.string(),
  item_index: z.number().int().nullable(), filename: z.string(), file_size: FileSize,
  mime_type: z.string(), uploaded_at: z.string(),
});

function isMimeAllowed(mime: string, filename: string): boolean {
  return (ALLOWED_DELIVERABLE_MIME_TYPES as readonly string[]).includes(mime) &&
    (mime !== "application/octet-stream" ||
      (ALLOWED_DELIVERABLE_EXTENSIONS as readonly string[]).includes(filename.split(".").pop()?.toLowerCase() ?? ""));
}

const LINKABLE_STATUSES = new Set(["rework_requested", "rework_in_progress"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { reviewId } = await params;
  if (!z.string().uuid().safeParse(reviewId).success) {
    return NextResponse.json({ error: "Invalid review ID." }, { status: 400 });
  }
  const parsed = PrepareBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !isMimeAllowed(parsed.data.content_type, parsed.data.filename)) {
    return NextResponse.json({ error: "Invalid replacement file metadata." }, { status: 400 });
  }
  try {
    const supabase = createServerClient();
    const { data: review, error } = await supabase.from("deliverable_reviews")
      .select("id, status, order_id, order_number, item_index, replacement_deliverable_id")
      .eq("id", reviewId).maybeSingle();
    if (error || !review) return NextResponse.json({ error: "Review not found." }, { status: 404 });
    if (!LINKABLE_STATUSES.has(review.status) || review.replacement_deliverable_id) {
      return NextResponse.json({ error: "This review is not available for replacement." }, { status: 409 });
    }
    const replacementDeliverableId = crypto.randomUUID();
    const path = buildReplacementDeliverablePath(review.order_number, review.id, replacementDeliverableId, parsed.data.filename);
    const { data: signed, error: signingError } = await supabase.storage.from(DELIVERABLES_BUCKET)
      .createSignedUploadUrl(path, { upsert: false });
    if (signingError || !signed) return NextResponse.json({ error: "Could not prepare replacement upload." }, { status: 503 });
    return NextResponse.json({ ok: true, replacementDeliverableId, signedUrl: signed.signedUrl });
  } catch {
    return NextResponse.json({ error: "Could not prepare replacement upload." }, { status: 503 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { reviewId } = await params;
  if (!z.string().uuid().safeParse(reviewId).success) {
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
    .select("id, deliverable_id, status, order_id, order_number, item_index, replacement_deliverable_id")
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
    order_number: string;
    item_index: number | null;
    replacement_deliverable_id: string | null;
  };

  if (parsed.data.mode === "atomic_upload") {
    const candidate = parsed.data;
    if (!isMimeAllowed(candidate.mime_type, candidate.filename) || candidate.replacementDeliverableId === reviewRow.deliverable_id) {
      return NextResponse.json({ error: "Invalid replacement file metadata." }, { status: 400 });
    }
    const path = buildReplacementDeliverablePath(reviewRow.order_number, reviewRow.id, candidate.replacementDeliverableId, candidate.filename);
    try {
      const { data: object, error } = await supabase.storage.from(DELIVERABLES_BUCKET).info(path);
      if (error || !object || Number(object.size) !== candidate.file_size) {
        return NextResponse.json({ error: "Replacement upload is not ready. Complete the upload and try again." }, { status: 409 });
      }
    } catch {
      return NextResponse.json({ error: "Could not verify replacement upload. Please try again." }, { status: 503 });
    }
    // Do not apply the legacy active-state guard here: an already-delivered
    // review must reach the RPC to reconcile this exact candidate after a loss.
    try {
      const { data, error } = await supabase.rpc("commit_rework_replacement_upload", {
        p_review_id: reviewRow.id, p_replacement_deliverable_id: candidate.replacementDeliverableId,
        p_storage_path: path, p_filename: candidate.filename,
        p_file_size: candidate.file_size, p_mime_type: candidate.mime_type,
      }).maybeSingle();
      const committed = z.object({ result_code: z.string(), deliverable: z.unknown() }).safeParse(data);
      if (error || !committed.success) return NextResponse.json({ error: "Could not finalize replacement." }, { status: 500 });
      if (committed.data.result_code === "not_found") return NextResponse.json({ error: "Review not found." }, { status: 404 });
      if (["conflict", "invalid_state", "invalid_candidate", "invalid_assignment"].includes(committed.data.result_code)) {
        return NextResponse.json({ error: "This replacement could not be committed. Refresh the order." }, { status: 409 });
      }
      const result = SafeDeliverable.safeParse(committed.data.deliverable);
      if (!["committed", "already_committed"].includes(committed.data.result_code) || !result.success ||
          result.data.id !== candidate.replacementDeliverableId || result.data.order_id !== reviewRow.order_id ||
          result.data.item_index !== reviewRow.item_index) {
        return NextResponse.json({ error: "Could not confirm replacement." }, { status: 500 });
      }
      after(async () => {
        await sendReviewWorkflowEmail({ event: "admin_replacement_ready", reviewId: reviewRow.id,
          replacementDeliverableId: candidate.replacementDeliverableId });
      });
      return NextResponse.json({ ok: true, status: "rework_delivered",
        replacementDeliverableId: candidate.replacementDeliverableId, deliverable: result.data });
    } catch {
      // The DB outcome may be unknown. The client reconciles this same ID.
      return NextResponse.json({ error: "Could not confirm replacement." }, { status: 503 });
    }
  }

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
