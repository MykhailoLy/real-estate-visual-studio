import "server-only";

import { getSupabaseAdminClient } from "../supabase-admin.ts";
import { ORDER_FILES_BUCKET } from "../upload-config.ts";
import { verifyStoredUploadContent } from "../uploads/file-signature.ts";
import {
  MAX_REFERENCE_FILES,
  MAX_REFERENCE_TOTAL_SIZE_BYTES,
} from "../reference-files.ts";
import { getOrderDraftForUser } from "./server.ts";
import { buildOrderDraftFilePath } from "./storage-paths.ts";
import {
  PrepareDraftReferenceFileSchema,
  type DraftReferenceFileSummary,
  type PrepareDraftReferenceFileInput,
  type PreparedDraftReferenceFile,
} from "./draft-reference-files.ts";
import { UuidSchema } from "./schema.ts";

type Result<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      status: number;
      message: string;
      code?: "invalid_upload" | "storage_error";
    };

const SELECT =
  "id, draft_id, item_client_id, item_index, reference_id, position, bucket, storage_path, original_filename, file_size, mime_type, upload_status, deleted_at, created_at, updated_at";
const PREVIEW_TTL_SECONDS = 600;

function invalid(message = "Invalid draft reference request."): Result<never> {
  return { ok: false, status: 400, message };
}

function mapSummary(row: Record<string, unknown>, previewUrl?: string): DraftReferenceFileSummary {
  return {
    id: String(row.reference_id),
    draftFileId: String(row.id),
    itemClientId: String(row.item_client_id),
    position: Number(row.position),
    file: null,
    filename: String(row.original_filename),
    fileSize: Number(row.file_size),
    mimeType: String(row.mime_type),
    lastModified: null,
    previewUrl: previewUrl ?? null,
    previewExpiresAt: previewUrl
      ? new Date(Date.now() + PREVIEW_TTL_SECONDS * 1000).toISOString()
      : null,
    storagePath: null,
  };
}

function draftItemIndex(state: unknown, itemClientId: string): number | null {
  if (!state || typeof state !== "object" || Array.isArray(state)) return null;
  const items = (state as Record<string, unknown>).items;
  if (!Array.isArray(items)) return null;
  const index = items.findIndex((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    return (item as Record<string, unknown>).clientItemId === itemClientId;
  });
  return index >= 0 ? index : null;
}

async function ownedDraft(userId: string, draftId: string) {
  if (!UuidSchema.safeParse(userId).success || !UuidSchema.safeParse(draftId).success) {
    return invalid();
  }
  const draft = await getOrderDraftForUser(userId, draftId);
  if (!draft.ok) return { ok: false as const, status: draft.code === "not_found" ? 404 : 409, message: draft.message };
  return { ok: true as const, data: draft.data };
}

async function signedPreview(storagePath: string): Promise<string | undefined> {
  const { data } = await getSupabaseAdminClient().storage
    .from(ORDER_FILES_BUCKET)
    .createSignedUrl(storagePath, PREVIEW_TTL_SECONDS);
  return data?.signedUrl;
}

export async function listDraftReferencesForUser(
  userId: string,
  draftId: string,
): Promise<Result<DraftReferenceFileSummary[]>> {
  const draft = await ownedDraft(userId, draftId);
  if (!draft.ok) return draft;
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("order_draft_item_reference_files")
    .select(SELECT)
    .eq("draft_id", draftId)
    .eq("upload_status", "uploaded")
    .is("deleted_at", null)
    .order("item_index")
    .order("position");
  if (error) return { ok: false, status: 500, message: "Could not load draft references." };
  const result: DraftReferenceFileSummary[] = [];
  for (const raw of data ?? []) {
    const row = raw as Record<string, unknown>;
    result.push(mapSummary(row, await signedPreview(String(row.storage_path))));
  }
  return { ok: true, data: result };
}

export async function prepareDraftReferenceForUser(
  userId: string,
  draftId: string,
  input: PrepareDraftReferenceFileInput,
): Promise<Result<PreparedDraftReferenceFile>> {
  const parsed = PrepareDraftReferenceFileSchema.safeParse(input);
  if (!parsed.success) return invalid();
  const draft = await ownedDraft(userId, draftId);
  if (!draft.ok) return draft;
  const itemIndex = draftItemIndex(draft.data.state, parsed.data.itemClientId);
  if (itemIndex === null) return invalid("Draft photo was not found.");

  const supabase = getSupabaseAdminClient();
  // Additions are sequential per item. A fresh prepare supersedes incomplete
  // candidates left behind when the previous browser operation was interrupted.
  // Return only paths actually retired by this update, never a stale pre-read.
  const { data: retired, error: retireError } = await supabase
    .from("order_draft_item_reference_files")
    .update({ upload_status: "deleted", deleted_at: new Date().toISOString() })
    .eq("draft_id", draftId)
    .eq("item_client_id", parsed.data.itemClientId)
    .in("upload_status", ["pending", "failed"])
    .is("deleted_at", null)
    .select("storage_path");
  if (retireError) return { ok: false, status: 500, message: "Could not prepare draft reference." };

  try {
    const { data: existing, error: listError } = await supabase
      .from("order_draft_item_reference_files")
      .select("reference_id, position, file_size")
      .eq("draft_id", draftId)
      .eq("item_client_id", parsed.data.itemClientId)
      .eq("upload_status", "uploaded")
      .is("deleted_at", null);
    if (listError) return { ok: false, status: 500, message: "Could not prepare draft reference." };
    const rows = existing ?? [];
    const same = rows.find((row) => row.reference_id === parsed.data.referenceId);
    if (same) return invalid("That reference is already saved.");
    if (rows.length >= MAX_REFERENCE_FILES) return invalid("You can upload up to 10 reference files.");
    if (rows.some((row) => Number(row.position) === parsed.data.position)) {
      return invalid("That reference position is already occupied.");
    }
    const total = rows.reduce((sum, row) => sum + Number(row.file_size), 0);
    if (total + parsed.data.fileSize > MAX_REFERENCE_TOTAL_SIZE_BYTES) {
      return invalid("Reference files may total up to 100 MB.");
    }

    const storagePath = buildOrderDraftFilePath({
      userId,
      draftId,
      fileId: parsed.data.referenceId,
      originalFilename: parsed.data.filename,
    });
    const { data: inserted, error: insertError } = await supabase
      .from("order_draft_item_reference_files")
      .insert({
        id: parsed.data.referenceId,
        draft_id: draftId,
        item_client_id: parsed.data.itemClientId,
        item_index: itemIndex,
        reference_id: parsed.data.referenceId,
        position: parsed.data.position,
        bucket: ORDER_FILES_BUCKET,
        storage_path: storagePath,
        original_filename: parsed.data.filename,
        file_size: parsed.data.fileSize,
        mime_type: parsed.data.mimeType,
        upload_status: "pending",
      })
      .select(SELECT)
      .single();
    if (insertError || !inserted) return { ok: false, status: 409, message: "Could not reserve this reference position." };

    const { data: signed, error: signedError } = await supabase.storage
      .from(ORDER_FILES_BUCKET)
      .createSignedUploadUrl(storagePath);
    if (signedError || !signed) {
      await supabase.from("order_draft_item_reference_files")
        .update({ upload_status: "failed" })
        .eq("id", parsed.data.referenceId)
        .eq("upload_status", "pending")
        .is("deleted_at", null);
      return { ok: false, status: 500, message: "Could not prepare draft reference upload." };
    }
    return {
      ok: true,
      data: {
        reference: mapSummary(inserted as Record<string, unknown>),
        upload: {
          bucket: ORDER_FILES_BUCKET,
          path: signed.path ?? storagePath,
          token: signed.token,
          signedUrl: signed.signedUrl,
        },
      },
    };
  } finally {
    // Metadata retirement is authoritative even if validation/signing fails.
    // Storage errors must neither reactivate old candidates nor fail a new one.
    const paths = (retired ?? []).map((row) => String(row.storage_path));
    if (paths.length > 0) {
      try {
        const { error } = await supabase.storage.from(ORDER_FILES_BUCKET).remove(paths);
        if (error) console.warn("[draft-reference-files] retired reference storage cleanup failed.");
      } catch {
        console.warn("[draft-reference-files] retired reference storage cleanup failed.");
      }
    }
  }
}

async function loadOwnedReference(userId: string, draftId: string, referenceId: string) {
  const draft = await ownedDraft(userId, draftId);
  if (!draft.ok) return draft;
  if (!UuidSchema.safeParse(referenceId).success) return invalid();
  const { data, error } = await getSupabaseAdminClient()
    .from("order_draft_item_reference_files")
    .select(SELECT)
    .eq("draft_id", draftId)
    .eq("reference_id", referenceId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return { ok: false as const, status: 500, message: "Could not load draft reference." };
  if (!data) return { ok: false as const, status: 404, message: "Draft reference was not found." };
  return { ok: true as const, data: data as Record<string, unknown> };
}

async function storageObjectMatches(row: Record<string, unknown>): Promise<
  | { ok: true; matches: boolean }
  | { ok: false }
> {
  const path = String(row.storage_path);
  const slash = path.lastIndexOf("/");
  const directory = path.slice(0, slash);
  const basename = path.slice(slash + 1);
  const { data, error } = await getSupabaseAdminClient().storage
    .from(ORDER_FILES_BUCKET)
    .list(directory, { search: basename, limit: 10 });
  if (error) return { ok: false };
  const object = (data ?? []).find((entry) => entry.name === basename);
  const metadata = object?.metadata as Record<string, unknown> | undefined;
  const size = Number(metadata?.size ?? metadata?.contentLength);
  const mime = String(metadata?.mimetype ?? metadata?.mimeType ?? "").toLowerCase();
  return {
    ok: true,
    matches: size === Number(row.file_size) &&
      mime === String(row.mime_type).toLowerCase(),
  };
}

export async function completeDraftReferenceForUser(
  userId: string,
  draftId: string,
  referenceId: string,
): Promise<Result<DraftReferenceFileSummary>> {
  const loaded = await loadOwnedReference(userId, draftId, referenceId);
  if (!loaded.ok) return loaded;
  if (loaded.data.upload_status !== "pending") return invalid("Draft reference upload is not pending.");

  const metadataVerification = await storageObjectMatches(loaded.data);
  if (!metadataVerification.ok) {
    return {
      ok: false,
      status: 500,
      message: "Could not verify uploaded reference.",
      code: "storage_error",
    };
  }
  if (!metadataVerification.matches) {
    return { ok: false, status: 409, message: "Uploaded reference could not be verified." };
  }

  const supabase = getSupabaseAdminClient();

  const contentVerification = await verifyStoredUploadContent({
    supabase,
    file: {
      path: String(loaded.data.storage_path),
      originalFilename: String(loaded.data.original_filename),
      size: Number(loaded.data.file_size),
      mimeType: String(loaded.data.mime_type),
    },
  });
  if (!contentVerification.ok) {
    if (contentVerification.code === "invalid_upload") {
      await removeInvalidPendingDraftReferenceBestEffort({
        draftId,
        referenceId,
        storagePath: String(loaded.data.storage_path),
      });
    }
    return {
      ok: false,
      status: contentVerification.status,
      message: contentVerification.message,
      code: contentVerification.code,
    };
  }

  const { data, error } = await supabase
    .from("order_draft_item_reference_files")
    .update({ upload_status: "uploaded" })
    .eq("id", referenceId)
    .eq("upload_status", "pending")
    .select(SELECT)
    .single();
  if (error || !data) return { ok: false, status: 500, message: "Could not complete draft reference." };
  await syncLegacyDraftReferenceMirror(draftId, String(loaded.data.item_client_id));
  return {
    ok: true,
    data: mapSummary(data as Record<string, unknown>, await signedPreview(String(data.storage_path))),
  };
}

async function removeInvalidPendingDraftReferenceBestEffort(input: {
  draftId: string;
  referenceId: string;
  storagePath: string;
}): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("order_draft_item_reference_files")
      .update({ upload_status: "failed" })
      .eq("id", input.referenceId)
      .eq("draft_id", input.draftId)
      .eq("storage_path", input.storagePath)
      .eq("upload_status", "pending")
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error || !data) return;

    const { error: removeError } = await supabase.storage
      .from(ORDER_FILES_BUCKET)
      .remove([input.storagePath]);
    if (removeError) {
      console.warn("[draft-reference-files] invalid object removal failed:", {
        reason: removeError.name,
      });
    }
  } catch (error) {
    console.warn("[draft-reference-files] invalid reference cleanup failed:", error);
  }
}

export async function deleteDraftReferenceForUser(
  userId: string,
  draftId: string,
  referenceId: string,
): Promise<Result<{ id: string }>> {
  const loaded = await loadOwnedReference(userId, draftId, referenceId);
  if (!loaded.ok) return loaded;
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("order_draft_item_reference_files")
    .update({ upload_status: "deleted", deleted_at: new Date().toISOString() })
    .eq("id", referenceId)
    .is("deleted_at", null);
  if (error) return { ok: false, status: 500, message: "Could not remove draft reference." };
  const { data: remaining } = await supabase
    .from("order_draft_item_reference_files")
    .select("id, position")
    .eq("draft_id", draftId)
    .eq("item_client_id", String(loaded.data.item_client_id))
    .eq("upload_status", "uploaded")
    .is("deleted_at", null)
    .order("position");
  for (const [position, row] of (remaining ?? []).entries()) {
    if (Number(row.position) === position) continue;
    await supabase
      .from("order_draft_item_reference_files")
      .update({ position })
      .eq("id", row.id);
  }
  await syncLegacyDraftReferenceMirror(draftId, String(loaded.data.item_client_id));
  await supabase.storage.from(ORDER_FILES_BUCKET).remove([String(loaded.data.storage_path)]);
  return { ok: true, data: { id: referenceId } };
}

async function syncLegacyDraftReferenceMirror(
  draftId: string,
  itemClientId: string,
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { data: next } = await supabase
    .from("order_draft_item_reference_files")
    .select(SELECT)
    .eq("draft_id", draftId)
    .eq("item_client_id", itemClientId)
    .eq("upload_status", "uploaded")
    .is("deleted_at", null)
    .order("position")
    .limit(1)
    .maybeSingle();
  const { data: legacy } = await supabase
    .from("order_draft_files")
    .select("id")
    .eq("draft_id", draftId)
    .eq("item_client_id", itemClientId)
    .eq("kind", "reference")
    .eq("upload_status", "uploaded")
    .is("deleted_at", null)
    .maybeSingle();
  if (!next) {
    if (legacy) {
      await supabase.from("order_draft_files")
        .update({ upload_status: "deleted", deleted_at: new Date().toISOString() })
        .eq("id", legacy.id);
    }
    return;
  }
  const mirror = {
    id: next.reference_id,
    draft_id: draftId,
    item_client_id: itemClientId,
    item_index: next.item_index,
    kind: "reference",
    bucket: ORDER_FILES_BUCKET,
    storage_path: next.storage_path,
    original_filename: next.original_filename,
    file_size: next.file_size,
    mime_type: next.mime_type,
    upload_status: "uploaded",
    deleted_at: null,
  };
  if (legacy) {
    const { error } = await supabase
      .from("order_draft_files")
      .update(mirror)
      .eq("id", legacy.id);
    if (error) {
      console.error("[draft-reference-files] legacy mirror update failed:", error.message);
    }
  } else {
    const { error } = await supabase.from("order_draft_files").insert(mirror);
    if (error) {
      console.error("[draft-reference-files] legacy mirror insert failed:", error.message);
    }
  }
}
