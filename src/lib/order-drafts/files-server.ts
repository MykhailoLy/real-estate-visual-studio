import "server-only";

import {
  getSupabaseAdminClient,
  SupabaseAdminConfigurationError,
} from "../supabase-admin.ts";
import { ORDER_FILES_BUCKET } from "../upload-config.ts";
import {
  ORDER_DRAFT_FILE_SELECT,
  mapOrderDraftFileDatabaseRow,
} from "./database.ts";
import {
  PrepareOrderDraftFileUploadInputSchema,
  buildDraftFileSoftDeletePayload,
  buildDraftStoragePath,
  draftFileError,
  findDraftItemIndex,
  getDraftStoragePathParts,
  isDraftFileAllowedForDraft,
  isPendingDraftFile,
  mapOrderDraftFilePublicSummary,
  mapUploadedOrderDraftFileSummary,
  shouldSupersedeDraftFileCandidate,
  verifyStoredDraftObject,
  type DeletedOrderDraftFileSummary,
  type OrderDraftFileOperationResult,
  type OrderDraftFileUploadInfo,
  type OrderDraftUploadedFileSummary,
  type PrepareOrderDraftFileUploadInput,
  type PreparedOrderDraftFileUpload,
  type StoredDraftObjectInfo,
} from "./files.ts";
import { UuidSchema } from "./schema.ts";
import { getOrderDraftForUser } from "./server.ts";
import type {
  OrderDraftFileRow,
  OrderDraftRepositoryErrorCode,
} from "./types.ts";

interface CompletedUploadRpcRow {
  completed_file_id?: string;
  retired_storage_paths?: string[] | null;
}

interface SupabaseStorageObject {
  name?: unknown;
  metadata?: unknown;
}

function invalidIdentifier<T = never>(): OrderDraftFileOperationResult<T> {
  return draftFileError("invalid_input", "Invalid order draft file identifier.");
}

function repositoryResultToDraftFileResult<T>(
  result: {
    ok: false;
    code: OrderDraftRepositoryErrorCode;
    message: string;
  },
): OrderDraftFileOperationResult<T> {
  return draftFileError(result.code, result.message);
}

function handleDraftFileException(
  scope: string,
  error: unknown,
): OrderDraftFileOperationResult<never> {
  if (error instanceof SupabaseAdminConfigurationError) throw error;
  console.error(`[order-draft-files] ${scope} failed:`, error);
  return draftFileError("database_error", "Order draft file operation failed.");
}

function validateUuidPair(userId: string, draftId: string): boolean {
  return UuidSchema.safeParse(userId).success &&
    UuidSchema.safeParse(draftId).success;
}

function validateUuidTriplet(
  userId: string,
  draftId: string,
  fileId: string,
): boolean {
  return validateUuidPair(userId, draftId) &&
    UuidSchema.safeParse(fileId).success;
}

export async function prepareOrderDraftFileUploadForUser(
  userId: string,
  draftId: string,
  input: PrepareOrderDraftFileUploadInput,
): Promise<OrderDraftFileOperationResult<PreparedOrderDraftFileUpload>> {
  if (!validateUuidPair(userId, draftId)) return invalidIdentifier();

  const inputResult = PrepareOrderDraftFileUploadInputSchema.safeParse(input);
  if (!inputResult.success) {
    return draftFileError("invalid_input", "Invalid draft file upload input.");
  }

  const draftResult = await getOrderDraftForUser(userId, draftId);
  if (!draftResult.ok) return repositoryResultToDraftFileResult(draftResult);

  const parsed = inputResult.data;
  const itemLocation = findDraftItemIndex(
    draftResult.data.state,
    parsed.itemClientId,
  );
  if (!itemLocation.ok) {
    return draftFileError(
      itemLocation.code === "item_not_found" ? "item_not_found" : "invalid_status",
      itemLocation.code === "item_not_found"
        ? "Draft item was not found."
        : "Draft state is not valid for file uploads.",
    );
  }

  if (!isDraftFileAllowedForDraft(draftResult.data, parsed)) {
    return draftFileError(
      "file_type_not_allowed",
      "File type is not allowed for this draft.",
    );
  }

  try {
    const supabase = getSupabaseAdminClient();
    const fileId = crypto.randomUUID();
    const storagePath = buildDraftStoragePath({
      verifiedUserId: userId,
      draftId,
      fileId,
      filename: parsed.filename,
    });

    const { data: existingRows, error: existingError } = await supabase
      .from("order_draft_files")
      .select(ORDER_DRAFT_FILE_SELECT)
      .eq("draft_id", draftId)
      .eq("item_client_id", parsed.itemClientId)
      .eq("kind", parsed.kind)
      .is("deleted_at", null)
      .in("upload_status", ["pending", "failed"]);

    if (existingError) {
      console.error(
        "[order-draft-files] prepare candidate lookup failed:",
        existingError.message,
      );
      return draftFileError("database_error", "Could not prepare draft upload.");
    }

    const supersededRows = (existingRows ?? [])
      .map(mapOrderDraftFileDatabaseRow)
      .filter((row) =>
        shouldSupersedeDraftFileCandidate(row, {
          draftId,
          itemClientId: parsed.itemClientId,
          kind: parsed.kind,
        }),
      );

    if (supersededRows.length > 0) {
      const { error: retireError } = await supabase
        .from("order_draft_files")
        .update(buildDraftFileSoftDeletePayload())
        .in("id", supersededRows.map((row) => row.id));

      if (retireError) {
        console.error(
          "[order-draft-files] retire stale candidates failed:",
          retireError.message,
        );
        return draftFileError("database_error", "Could not prepare draft upload.");
      }
    }

    const { data: inserted, error: insertError } = await supabase
      .from("order_draft_files")
      .insert({
        id: fileId,
        draft_id: draftId,
        item_client_id: parsed.itemClientId,
        item_index: itemLocation.itemIndex,
        kind: parsed.kind,
        bucket: ORDER_FILES_BUCKET,
        storage_path: storagePath,
        original_filename: parsed.filename,
        file_size: parsed.size,
        mime_type: parsed.contentType,
        content_hash: null,
        upload_status: "pending",
        deleted_at: null,
        moved_at: null,
      })
      .select(ORDER_DRAFT_FILE_SELECT)
      .single();

    if (insertError || !inserted) {
      console.error(
        "[order-draft-files] insert pending failed:",
        insertError?.message,
      );
      return draftFileError("database_error", "Could not prepare draft upload.");
    }

    const pendingRow = mapOrderDraftFileDatabaseRow(inserted);
    const { data: signed, error: signedError } = await supabase.storage
      .from(ORDER_FILES_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (signedError || !signed) {
      console.error(
        "[order-draft-files] signed upload URL failed:",
        signedError?.message,
      );
      await markDraftFileFailedBestEffort(fileId);
      return draftFileError("storage_error", "Could not prepare draft upload.");
    }

    await removeStorageObjectsBestEffort(
      supersededRows.map((row) => row.storagePath),
      "remove stale pending candidates",
    );

    const upload: OrderDraftFileUploadInfo = {
      bucket: ORDER_FILES_BUCKET,
      path: signed.path ?? storagePath,
      token: signed.token,
      signedUrl: signed.signedUrl,
    };

    return {
      ok: true,
      data: {
        file: mapOrderDraftFilePublicSummary(pendingRow) as PreparedOrderDraftFileUpload["file"],
        upload,
      },
    };
  } catch (error) {
    return handleDraftFileException("prepare", error);
  }
}

export async function completeOrderDraftFileUploadForUser(
  userId: string,
  draftId: string,
  fileId: string,
): Promise<OrderDraftFileOperationResult<OrderDraftUploadedFileSummary>> {
  if (!validateUuidTriplet(userId, draftId, fileId)) return invalidIdentifier();

  const draftResult = await getOrderDraftForUser(userId, draftId);
  if (!draftResult.ok) return repositoryResultToDraftFileResult(draftResult);

  try {
    const supabase = getSupabaseAdminClient();
    const pendingResult = await getDraftFileRowById(supabase, draftId, fileId);
    if (!pendingResult.ok) return pendingResult;

    if (!isPendingDraftFile(pendingResult.data)) {
      return draftFileError(
        "invalid_status",
        "Draft file upload is not pending.",
      );
    }

    const storedObject = await getStoredDraftObjectInfo(
      pendingResult.data.storagePath,
    );
    if (!storedObject.ok) return storedObject;

    const verification = verifyStoredDraftObject(
      pendingResult.data,
      storedObject.data,
    );
    if (!verification.ok) return verification;

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "complete_order_draft_file_upload",
      {
        p_user_id: userId,
        p_draft_id: draftId,
        p_file_id: fileId,
      },
    );

    if (rpcError) {
      console.error(
        "[order-draft-files] completion RPC failed:",
        rpcError.message,
      );
      return draftFileError("database_error", "Could not complete draft upload.");
    }

    const retiredPaths = parseRetiredStoragePaths(rpcData);
    const completedResult = await getDraftFileRowById(supabase, draftId, fileId);
    if (!completedResult.ok) return completedResult;

    await removeStorageObjectsBestEffort(
      retiredPaths,
      "remove retired uploaded file",
    );

    return {
      ok: true,
      data: mapUploadedOrderDraftFileSummary(completedResult.data),
    };
  } catch (error) {
    return handleDraftFileException("complete", error);
  }
}

export async function listUploadedOrderDraftFilesForUser(
  userId: string,
  draftId: string,
): Promise<OrderDraftFileOperationResult<OrderDraftUploadedFileSummary[]>> {
  if (!validateUuidPair(userId, draftId)) return invalidIdentifier();

  const draftResult = await getOrderDraftForUser(userId, draftId);
  if (!draftResult.ok) return repositoryResultToDraftFileResult(draftResult);

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("order_draft_files")
      .select(ORDER_DRAFT_FILE_SELECT)
      .eq("draft_id", draftId)
      .eq("upload_status", "uploaded")
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[order-draft-files] list uploaded failed:", error.message);
      return draftFileError("database_error", "Could not load draft files.");
    }

    return {
      ok: true,
      data: (data ?? [])
        .map(mapOrderDraftFileDatabaseRow)
        .map(mapUploadedOrderDraftFileSummary),
    };
  } catch (error) {
    return handleDraftFileException("list uploaded", error);
  }
}

export async function softDeleteOrderDraftFileForUser(
  userId: string,
  draftId: string,
  fileId: string,
): Promise<OrderDraftFileOperationResult<DeletedOrderDraftFileSummary>> {
  if (!validateUuidTriplet(userId, draftId, fileId)) return invalidIdentifier();

  const draftResult = await getOrderDraftForUser(userId, draftId);
  if (!draftResult.ok) return repositoryResultToDraftFileResult(draftResult);

  try {
    const supabase = getSupabaseAdminClient();
    const existingResult = await getDraftFileRowById(supabase, draftId, fileId);
    if (!existingResult.ok) return existingResult;

    const payload = buildDraftFileSoftDeletePayload();
    const { error } = await supabase
      .from("order_draft_files")
      .update(payload)
      .eq("id", fileId)
      .eq("draft_id", draftId)
      .is("deleted_at", null);

    if (error) {
      console.error("[order-draft-files] soft delete failed:", error.message);
      return draftFileError("database_error", "Could not delete draft file.");
    }

    await removeStorageObjectsBestEffort(
      [existingResult.data.storagePath],
      "remove soft-deleted file",
    );

    return { ok: true, data: { id: fileId } };
  } catch (error) {
    return handleDraftFileException("soft delete", error);
  }
}

async function getDraftFileRowById(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  draftId: string,
  fileId: string,
): Promise<OrderDraftFileOperationResult<OrderDraftFileRow>> {
  const { data, error } = await supabase
    .from("order_draft_files")
    .select(ORDER_DRAFT_FILE_SELECT)
    .eq("id", fileId)
    .eq("draft_id", draftId)
    .maybeSingle();

  if (error) {
    console.error("[order-draft-files] lookup failed:", error.message);
    return draftFileError("database_error", "Could not load draft file.");
  }
  if (!data) {
    return draftFileError("upload_not_found", "Draft file was not found.");
  }

  return { ok: true, data: mapOrderDraftFileDatabaseRow(data) };
}

async function getStoredDraftObjectInfo(
  storagePath: string,
): Promise<OrderDraftFileOperationResult<StoredDraftObjectInfo | null>> {
  try {
    const supabase = getSupabaseAdminClient();
    const { directory, basename } = getDraftStoragePathParts(storagePath);
    const { data, error } = await supabase.storage
      .from(ORDER_FILES_BUCKET)
      .list(directory, { search: basename, limit: 100 });

    if (error) {
      console.error("[order-draft-files] storage list failed:", error.message);
      return draftFileError("storage_error", "Could not verify uploaded file.");
    }

    const object = (data ?? []).find((entry) => entry.name === basename) as
      | SupabaseStorageObject
      | undefined;

    return {
      ok: true,
      data: object ? mapStorageObjectInfo(object) : null,
    };
  } catch (error) {
    return handleDraftFileException("storage verification", error);
  }
}

function mapStorageObjectInfo(
  object: SupabaseStorageObject,
): StoredDraftObjectInfo {
  const metadata =
    object.metadata && typeof object.metadata === "object"
      ? object.metadata as Record<string, unknown>
      : {};
  const size = getNumericMetadata(metadata, ["size", "contentLength"]);
  const contentType = getStringMetadata(metadata, [
    "mimetype",
    "mimeType",
    "contentType",
    "content-type",
  ]);

  return {
    name: typeof object.name === "string" ? object.name : "",
    size,
    contentType,
  };
}

function getNumericMetadata(
  metadata: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function getStringMetadata(
  metadata: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return null;
}

async function markDraftFileFailedBestEffort(fileId: string): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("order_draft_files")
      .update({ upload_status: "failed" })
      .eq("id", fileId)
      .eq("upload_status", "pending");
    if (error) {
      console.warn("[order-draft-files] mark failed returned error:", error.message);
    }
  } catch (error) {
    console.warn("[order-draft-files] mark failed threw:", error);
  }
}

async function removeStorageObjectsBestEffort(
  paths: string[],
  scope: string,
): Promise<void> {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  if (uniquePaths.length === 0) return;

  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.storage
      .from(ORDER_FILES_BUCKET)
      .remove(uniquePaths);
    if (error) {
      console.warn(`[order-draft-files] ${scope} returned error:`, error.message);
    }
  } catch (error) {
    console.warn(`[order-draft-files] ${scope} threw:`, error);
  }
}

function parseRetiredStoragePaths(rpcData: unknown): string[] {
  const row = Array.isArray(rpcData)
    ? rpcData[0] as CompletedUploadRpcRow | undefined
    : rpcData as CompletedUploadRpcRow | null | undefined;

  return Array.isArray(row?.retired_storage_paths)
    ? row.retired_storage_paths.filter((path): path is string => typeof path === "string")
    : [];
}
