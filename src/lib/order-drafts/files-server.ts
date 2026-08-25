import "server-only";

import {
  getSupabaseAdminClient,
  SupabaseAdminConfigurationError,
} from "../supabase-admin.ts";
import { ORDER_FILES_BUCKET } from "../upload-config.ts";
import { verifyStoredUploadContent } from "../uploads/file-signature.ts";
import {
  ORDER_DRAFT_FILE_SELECT,
  mapOrderDraftFileDatabaseRow,
} from "./database.ts";
import {
  PrepareOrderDraftFileUploadInputSchema,
  buildPrepareOrderDraftFileUploadRpcParams,
  buildDraftStoragePath,
  draftFileError,
  getDraftStoragePathParts,
  isDraftFileAllowedForDraft,
  isPendingDraftFile,
  mapOrderDraftFilePublicSummary,
  mapUploadedOrderDraftFileSummary,
  parseCompleteOrderDraftFileUploadRpcResult,
  parsePrepareOrderDraftFileUploadRpcResult,
  parseSoftDeleteOrderDraftFileRpcResult,
  verifyStoredDraftObject,
  type DeletedOrderDraftFileSummary,
  type OrderDraftFilePreview,
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

interface SupabaseStorageObject {
  name?: unknown;
  metadata?: unknown;
}

const DRAFT_FILE_PREVIEW_URL_TTL_SECONDS = 600;

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

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "prepare_order_draft_file_upload",
      buildPrepareOrderDraftFileUploadRpcParams({
        userId,
        draftId,
        expectedVersion: draftResult.data.version,
        fileId,
        input: parsed,
        storagePath,
      }),
    );

    if (rpcError) {
      console.error(
        "[order-draft-files] prepare RPC failed:",
        rpcError.message,
      );
      return draftFileError("database_error", "Could not prepare draft upload.");
    }

    const prepareResult = parsePrepareOrderDraftFileUploadRpcResult(rpcData);
    if (!prepareResult.ok) return prepareResult;

    const { data: signed, error: signedError } = await supabase.storage
      .from(ORDER_FILES_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (signedError || !signed) {
      console.error(
        "[order-draft-files] signed upload URL failed:",
        signedError?.message,
      );
      await markDraftFileFailedBestEffort(draftId, fileId);
      return draftFileError("storage_error", "Could not prepare draft upload.");
    }

    const pendingResult = await getDraftFileRowById(supabase, draftId, fileId);
    if (!pendingResult.ok) return pendingResult;

    await removeStorageObjectsBestEffort(
      prepareResult.data.retiredStoragePaths,
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
        file: mapOrderDraftFilePublicSummary(pendingResult.data) as PreparedOrderDraftFileUpload["file"],
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

    const contentVerification = await verifyStoredUploadContent({
      supabase,
      file: {
        path: pendingResult.data.storagePath,
        originalFilename: pendingResult.data.originalFilename,
        size: pendingResult.data.fileSize,
        mimeType: pendingResult.data.mimeType,
      },
    });
    if (!contentVerification.ok) {
      if (contentVerification.code === "invalid_upload") {
        const markedFailed = await markDraftFileFailedBestEffort(draftId, fileId);
        if (markedFailed) {
          await removeStorageObjectsBestEffort(
            [pendingResult.data.storagePath],
            "remove invalid pending draft file",
          );
        }
      }
      return draftFileError(contentVerification.code, contentVerification.message);
    }

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

    const completeResult = parseCompleteOrderDraftFileUploadRpcResult(rpcData);
    if (!completeResult.ok) return completeResult;

    const completedResult = await getDraftFileRowById(supabase, draftId, fileId);
    if (!completedResult.ok) return completedResult;

    await removeStorageObjectsBestEffort(
      completeResult.data.retiredStoragePaths,
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

    const rows = (data ?? []).map(mapOrderDraftFileDatabaseRow);
    return {
      ok: true,
      data: await attachPreviewUrlsToUploadedFiles(rows),
    };
  } catch (error) {
    return handleDraftFileException("list uploaded", error);
  }
}

export async function createOrderDraftFilePreviewForUser(
  userId: string,
  draftId: string,
  fileId: string,
): Promise<OrderDraftFileOperationResult<OrderDraftFilePreview>> {
  if (!validateUuidTriplet(userId, draftId, fileId)) return invalidIdentifier();

  try {
    const supabase = getSupabaseAdminClient();
    const { data: draft, error: draftError } = await supabase
      .from("order_drafts")
      .select("id, user_id, status, deleted_at, expires_at")
      .eq("id", draftId)
      .eq("user_id", userId)
      .maybeSingle();

    if (draftError) {
      console.error(
        "[order-draft-files] preview draft lookup failed:",
        draftError.message,
      );
      return draftFileError("database_error", "Could not load draft preview.");
    }
    if (!isPreviewableDraftRow(draft)) {
      return draftFileError("not_found", "Draft file was not found.");
    }

    const fileResult = await getDraftFileRowById(supabase, draftId, fileId);
    if (!fileResult.ok) {
      return fileResult.code === "upload_not_found"
        ? draftFileError("not_found", "Draft file was not found.")
        : fileResult;
    }

    if (!isPreviewableDraftFile(fileResult.data)) {
      return draftFileError("not_found", "Draft file was not found.");
    }

    const preview = await createSignedDraftFilePreview(
      fileResult.data.storagePath,
    );
    if (!preview.ok) return preview;
    return preview;
  } catch (error) {
    return handleDraftFileException("preview", error);
  }
}

export async function softDeleteOrderDraftFileForUser(
  userId: string,
  draftId: string,
  fileId: string,
): Promise<OrderDraftFileOperationResult<DeletedOrderDraftFileSummary>> {
  if (!validateUuidTriplet(userId, draftId, fileId)) return invalidIdentifier();

  try {
    const supabase = getSupabaseAdminClient();
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "soft_delete_order_draft_file",
      {
        p_user_id: userId,
        p_draft_id: draftId,
        p_file_id: fileId,
      },
    );

    if (rpcError) {
      console.error("[order-draft-files] soft delete RPC failed:", rpcError.message);
      return draftFileError("database_error", "Could not delete draft file.");
    }

    const deleteResult = parseSoftDeleteOrderDraftFileRpcResult(rpcData);
    if (!deleteResult.ok) return deleteResult;

    await removeStorageObjectsBestEffort(
      [deleteResult.data.storagePath],
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

async function attachPreviewUrlsToUploadedFiles(
  rows: OrderDraftFileRow[],
): Promise<OrderDraftUploadedFileSummary[]> {
  const summaries: OrderDraftUploadedFileSummary[] = [];
  for (const row of rows) {
    const summary = mapUploadedOrderDraftFileSummary(row);
    const preview = await createSignedDraftFilePreview(row.storagePath);
    summaries.push(
      preview.ok
        ? {
            ...summary,
            previewUrl: preview.data.previewUrl,
            previewExpiresAt: preview.data.previewExpiresAt,
          }
        : summary,
    );
  }
  return summaries;
}

function isPreviewableDraftRow(row: unknown): boolean {
  if (row === null || typeof row !== "object" || Array.isArray(row)) {
    return false;
  }
  const record = row as Record<string, unknown>;
  const status = record.status;
  return (
    record.deleted_at === null &&
    typeof record.expires_at === "string" &&
    record.expires_at > new Date().toISOString() &&
    (status === "active" || status === "converting")
  );
}

function isPreviewableDraftFile(row: OrderDraftFileRow): boolean {
  return (
    row.deletedAt === null &&
    (row.uploadStatus === "uploaded" || row.uploadStatus === "moved")
  );
}

async function createSignedDraftFilePreview(
  storagePath: string,
): Promise<OrderDraftFileOperationResult<OrderDraftFilePreview>> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(ORDER_FILES_BUCKET)
    .createSignedUrl(storagePath, DRAFT_FILE_PREVIEW_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.warn(
      "[order-draft-files] preview signed URL failed:",
      error?.message ?? "No signed URL returned",
    );
    return draftFileError("storage_error", "Could not load draft preview.");
  }

  return {
    ok: true,
    data: {
      previewUrl: data.signedUrl,
      previewExpiresAt: new Date(
        Date.now() + DRAFT_FILE_PREVIEW_URL_TTL_SECONDS * 1000,
      ).toISOString(),
    },
  };
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

async function markDraftFileFailedBestEffort(
  draftId: string,
  fileId: string,
): Promise<boolean> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("order_draft_files")
      .update({ upload_status: "failed" })
      .eq("id", fileId)
      .eq("draft_id", draftId)
      .is("deleted_at", null)
      .eq("upload_status", "pending")
      .select("id")
      .maybeSingle();
    if (error) {
      console.warn("[order-draft-files] mark failed returned error:", error.message);
      return false;
    }
    return Boolean(data);
  } catch (error) {
    console.warn("[order-draft-files] mark failed threw:", error);
    return false;
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
