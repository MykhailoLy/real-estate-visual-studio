// ============================================================
// REWORK REFERENCE FILES — server-side helpers (Phase 5H.4)
//
// All DB access and storage access use the service role key.
// Clients have no direct INSERT/UPDATE/DELETE access to
// deliverable_review_files (see RLS policy in migration SQL).
//
// SECURITY CONTRACT:
// • email MUST come from getClientUser() on the server.
// • Ownership verified via JOIN:
//     deliverable_reviews → orders WHERE client_email = email
// • storage_path is NEVER returned in any public-facing object.
// • Storage paths are built server-side from server-controlled
//   inputs (reviewId + sanitized filename) — never from raw
//   client input.
// • Signed upload URLs are short-lived (order-files bucket).
// • The complete() step verifies the object actually exists in
//   storage before the row is considered confirmed.
//
// Server-only. Never import from "use client" files.
// ============================================================

import "server-only";
import { createServerClient } from "@/lib/supabase";
import { isOrderOwned, type OrderOwnership } from "@/lib/order-ownership";
import {
  ORDER_FILES_BUCKET,
  buildReworkReferencePath,
} from "@/lib/upload-config";
import { verifyStoredUploadContent } from "@/lib/uploads/file-signature";
import {
  REWORK_REFERENCES_MAX_FILES,
  REWORK_REFERENCE_MAX_BYTES,
  REWORK_REFERENCE_MAX_MB,
  isAllowedReworkReferenceMimeType,
} from "@/lib/rework-references-config";

// ── Public types (no storage_path) ───────────────────────────

/**
 * Safe public representation of a rework reference file row.
 * storage_path is intentionally excluded — it is a server-side
 * implementation detail and must never be sent to the browser.
 */
export interface ReworkReferenceFile {
  id: string;
  review_id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

// ── Result types ──────────────────────────────────────────────

type SlotOk = { ok: true; signedUrl: string; file: ReworkReferenceFile };
type SlotFail = { ok: false; error: string; status: number };

type CompleteOk = { ok: true; file: ReworkReferenceFile };
type CompleteFail = {
  ok: false;
  error: string;
  status: number;
  code?: "invalid_upload" | "storage_error";
};

type ListOk = { ok: true; files: ReworkReferenceFile[] };
type ListFail = { ok: false; error: string; status: number };

// ── Private helpers ───────────────────────────────────────────

/** Full DB row shape — storage_path included for internal use only. */
interface ReviewFileRow {
  id: string;
  review_id: string;
  order_id: string;
  deliverable_id: string;
  item_index: number | null;
  storage_path: string; // NEVER returned to browser
  filename: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  upload_status: "pending" | "uploaded";
  created_at: string;
}

/** Shape of the review row we need for ownership + status checks. */
interface ReviewOwnershipRow {
  id: string;
  status: string;
  deliverable_id: string;
  order_id: string;
  item_index: number | null;
}

/** Strip storage_path before returning a file to a route handler. */
function toPublicFile(row: ReviewFileRow): ReworkReferenceFile {
  return {
    id: row.id,
    review_id: row.review_id,
    filename: row.filename,
    file_size: row.file_size,
    mime_type: row.mime_type,
    created_at: row.created_at,
  };
}

/**
 * Load a review row, verifying it belongs to the authenticated account.
 * Returns null if not found or ownership fails (user_id, or legacy
 * NULL+email via isOrderOwned()).
 */
async function getOwnedReview(
  reviewId: string,
  ownership: OrderOwnership,
): Promise<ReviewOwnershipRow | null> {
  let supabase;
  try {
    supabase = createServerClient();
  } catch {
    return null;
  }

  const { data, error } = await supabase
    .from("deliverable_reviews")
    .select(
      "id, status, deliverable_id, order_id, item_index, " +
        "orders!inner(user_id, client_email)",
    )
    .eq("id", reviewId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as ReviewOwnershipRow & {
    orders?: { user_id: string | null; client_email: string | null };
  };
  if (!row.orders || !isOrderOwned(row.orders, ownership)) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { orders: _o, ...clean } = row;
  return clean as ReviewOwnershipRow;
}

/**
 * Check whether a storage object actually exists in the order-files
 * bucket by listing the containing folder and matching the filename.
 */
async function storageObjectExists(storagePath: string): Promise<
  | { ok: true; exists: boolean }
  | { ok: false }
> {
  let supabase;
  try {
    supabase = createServerClient();
  } catch {
    return { ok: false };
  }

  // Path format: rework/<reviewId>/<ts>-<filename>
  const lastSlash = storagePath.lastIndexOf("/");
  const folder = storagePath.substring(0, lastSlash);
  const filename = storagePath.substring(lastSlash + 1);

  const { data, error } = await supabase.storage
    .from(ORDER_FILES_BUCKET)
    .list(folder, { search: filename });

  if (error || !data) return { ok: false };
  return { ok: true, exists: data.some((f) => f.name === filename) };
}

// ── Public API ────────────────────────────────────────────────

/**
 * Create a signed upload URL for one rework reference file and
 * insert a pending row in deliverable_review_files.
 *
 * Ownership checks:
 * • review must belong to `email`
 * • review.status must be "rework_requested"
 * • existing file count for this review must be < REWORK_REFERENCES_MAX_FILES
 *
 * Returns the signed URL and safe file metadata (no storage_path).
 */
export async function createReworkReferenceUploadSlot(
  reviewId: string,
  ownership: OrderOwnership,
  meta: { filename: string; contentType: string; fileSize: number },
): Promise<SlotOk | SlotFail> {
  const { filename, contentType, fileSize } = meta;

  // ── Input validation ──────────────────────────────────────

  if (!isAllowedReworkReferenceMimeType(contentType)) {
    return {
      ok: false,
      error: `File type "${contentType}" is not allowed for rework references.`,
      status: 400,
    };
  }

  if (fileSize > REWORK_REFERENCE_MAX_BYTES) {
    return {
      ok: false,
      error: `File is too large. Maximum is ${REWORK_REFERENCE_MAX_MB} MB.`,
      status: 400,
    };
  }

  // ── Supabase ──────────────────────────────────────────────

  let supabase;
  try {
    supabase = createServerClient();
  } catch (e) {
    console.error("[rework-reference-files] Supabase init:", e);
    return { ok: false, error: "Server configuration error.", status: 500 };
  }

  try {
    // ── Ownership + status check ──────────────────────────

    const review = await getOwnedReview(reviewId, ownership);
    if (!review) {
      return { ok: false, error: "Review not found.", status: 404 };
    }

    if (review.status !== "rework_requested") {
      return {
        ok: false,
        error: "Reference files can only be added to an active rework request.",
        status: 409,
      };
    }

    // ── File count guard ──────────────────────────────────

    const { count, error: countErr } = await supabase
      .from("deliverable_review_files")
      .select("id", { count: "exact", head: true })
      .eq("review_id", reviewId);

    if (countErr) {
      console.error("[rework-reference-files] Count error:", countErr.message);
      return {
        ok: false,
        error: "Could not check existing files.",
        status: 500,
      };
    }

    if ((count ?? 0) >= REWORK_REFERENCES_MAX_FILES) {
      return {
        ok: false,
        error: `Maximum of ${REWORK_REFERENCES_MAX_FILES} reference files per rework request.`,
        status: 422,
      };
    }

    // ── Build storage path (server-side, never from client input) ─

    const storagePath = buildReworkReferencePath(reviewId, filename);

    // ── Issue signed upload URL ───────────────────────────

    const { data: signed, error: signedErr } = await supabase.storage
      .from(ORDER_FILES_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (signedErr || !signed) {
      console.error(
        "[rework-reference-files] Signed URL error:",
        signedErr?.message,
      );
      return {
        ok: false,
        error: "Could not create signed upload URL.",
        status: 500,
      };
    }

    // ── Insert DB row ─────────────────────────────────────

    const { data: inserted, error: insertErr } = await supabase
      .from("deliverable_review_files")
      .insert({
        review_id: reviewId,
        order_id: review.order_id,
        deliverable_id: review.deliverable_id,
        item_index: review.item_index,
        storage_path: storagePath, // stored server-side; never returned to browser
        filename,
        file_size: fileSize,
        mime_type: contentType,
        uploaded_by: "client",
        upload_status: "pending",
      })
      .select(
        "id, review_id, order_id, deliverable_id, item_index, " +
          "storage_path, filename, file_size, mime_type, uploaded_by, upload_status, created_at",
      )
      .single();

    if (insertErr || !inserted) {
      console.error(
        "[rework-reference-files] Insert error:",
        insertErr?.message,
      );
      return {
        ok: false,
        error: "Could not register reference file.",
        status: 500,
      };
    }

    const row = inserted as unknown as ReviewFileRow;

    return {
      ok: true,
      signedUrl: signed.signedUrl,
      file: toPublicFile(row),
    };
  } catch (err) {
    console.error("[rework-reference-files] Unexpected:", err);
    return { ok: false, error: "Unexpected server error.", status: 500 };
  }
}

/**
 * Confirm a rework reference file upload by verifying the object
 * actually exists in storage.
 *
 * Called after the browser PUTs bytes to the signed URL.
 * Returns safe file metadata (no storage_path).
 */
export async function markReworkReferenceUploaded(
  reviewId: string,
  fileId: string,
  ownership: OrderOwnership,
): Promise<CompleteOk | CompleteFail> {
  let supabase;
  try {
    supabase = createServerClient();
  } catch (e) {
    console.error("[rework-reference-files] Supabase init:", e);
    return { ok: false, error: "Server configuration error.", status: 500 };
  }

  try {
    // ── Verify review ownership ───────────────────────────

    const review = await getOwnedReview(reviewId, ownership);
    if (!review) {
      return { ok: false, error: "Review not found.", status: 404 };
    }

    // ── Load file row, verify it belongs to this review ───

    const { data: fileData, error: fileErr } = await supabase
      .from("deliverable_review_files")
      .select(
        "id, review_id, order_id, deliverable_id, item_index, " +
          "storage_path, filename, file_size, mime_type, uploaded_by, upload_status, created_at",
      )
      .eq("id", fileId)
      .eq("review_id", reviewId)
      .maybeSingle();

    if (fileErr) {
      console.error("[rework-reference-files] File lookup:", fileErr.message);
      return { ok: false, error: "Could not look up file.", status: 500 };
    }
    if (!fileData) {
      return { ok: false, error: "Reference file not found.", status: 404 };
    }

    const row = fileData as unknown as ReviewFileRow;

    if (row.upload_status === "uploaded") {
      return { ok: true, file: toPublicFile(row) };
    }

    // ── Verify object exists in storage ──────────────────

    const storageObject = await storageObjectExists(row.storage_path);
    if (!storageObject.ok) {
      return {
        ok: false,
        error: "Could not verify uploaded reference.",
        status: 500,
        code: "storage_error",
      };
    }
    if (!storageObject.exists) {
      return {
        ok: false,
        error: "Upload not found in storage. Please try uploading again.",
        status: 409,
      };
    }

    const contentVerification = await verifyStoredUploadContent({
      supabase,
      file: {
        path: row.storage_path,
        originalFilename: row.filename,
        size: row.file_size,
        mimeType: row.mime_type,
      },
    });
    if (!contentVerification.ok) {
      return {
        ok: false,
        error: contentVerification.message,
        status: contentVerification.status,
        code: contentVerification.code,
      };
    }

    const { error: updateErr } = await supabase
      .from("deliverable_review_files")
      .update({ upload_status: "uploaded" })
      .eq("id", fileId)
      .eq("review_id", reviewId)
      .eq("upload_status", "pending");

    if (updateErr) {
      console.error(
        "[rework-reference-files] Completion update:",
        updateErr.message,
      );
      return {
        ok: false,
        error: "Could not confirm uploaded reference.",
        status: 500,
      };
    }

    return { ok: true, file: toPublicFile(row) };
  } catch (err) {
    console.error("[rework-reference-files] Unexpected:", err);
    return { ok: false, error: "Unexpected server error.", status: 500 };
  }
}

/**
 * List all reference files attached to a review.
 * Ownership-checked: review must belong to `email`.
 * Returns safe metadata only (no storage_path).
 */
export async function getReworkReferenceFilesForReview(
  reviewId: string,
  ownership: OrderOwnership,
): Promise<ListOk | ListFail> {
  let supabase;
  try {
    supabase = createServerClient();
  } catch (e) {
    console.error("[rework-reference-files] Supabase init:", e);
    return { ok: false, error: "Server configuration error.", status: 500 };
  }

  try {
    // ── Verify review ownership ───────────────────────────

    const review = await getOwnedReview(reviewId, ownership);
    if (!review) {
      return { ok: false, error: "Review not found.", status: 404 };
    }

    // ── Fetch files ───────────────────────────────────────

    const { data, error } = await supabase
      .from("deliverable_review_files")
      .select(
        "id, review_id, order_id, deliverable_id, item_index, " +
          "storage_path, filename, file_size, mime_type, uploaded_by, upload_status, created_at",
      )
      .eq("review_id", reviewId)
      .eq("upload_status", "uploaded")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[rework-reference-files] List error:", error.message);
      return {
        ok: false,
        error: "Could not load reference files.",
        status: 500,
      };
    }

    const rows = (data ?? []) as unknown as ReviewFileRow[];
    return { ok: true, files: rows.map(toPublicFile) };
  } catch (err) {
    console.error("[rework-reference-files] Unexpected:", err);
    return { ok: false, error: "Unexpected server error.", status: 500 };
  }
}
