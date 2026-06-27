import { z } from "zod";
import {
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
  ORDER_FILES_BUCKET,
  getAllowedMimeTypes,
} from "../upload-config.ts";
import {
  BaseDraftStateEnvelopeSchema,
  OrderDraftFileKindSchema,
  UuidSchema,
} from "./schema.ts";
import type {
  JsonObject,
  OrderDraftFileKind,
  OrderDraftFileRow,
  OrderDraftRow,
} from "./types.ts";

const MAX_ORIGINAL_FILENAME_LENGTH = 255;
const MAX_STORAGE_FILENAME_LENGTH = 100;

export type OrderDraftFilePublicErrorCode =
  | "invalid_input"
  | "not_found"
  | "invalid_status"
  | "version_conflict"
  | "item_not_found"
  | "file_too_large"
  | "file_type_not_allowed"
  | "storage_error"
  | "upload_not_found"
  | "upload_mismatch"
  | "database_error"
  | "unexpected_error";

export type OrderDraftFileOperationResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: OrderDraftFilePublicErrorCode;
      message: string;
    };

export interface PrepareOrderDraftFileUploadInput {
  itemClientId: string;
  kind: OrderDraftFileKind;
  filename: string;
  contentType: string;
  size: number;
}

export interface OrderDraftFileUploadInfo {
  bucket: typeof ORDER_FILES_BUCKET;
  path: string;
  token: string;
  signedUrl: string;
}

export interface OrderDraftUploadedFileSummary {
  id: string;
  itemClientId: string;
  itemIndex: number | null;
  kind: OrderDraftFileKind;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  uploadStatus: "uploaded";
  createdAt: string;
  updatedAt: string;
}

export interface OrderDraftPendingFileSummary
  extends Omit<OrderDraftUploadedFileSummary, "uploadStatus"> {
  uploadStatus: "pending";
}

export type OrderDraftFilePublicSummary =
  | OrderDraftUploadedFileSummary
  | OrderDraftPendingFileSummary;

export interface PreparedOrderDraftFileUpload {
  file: OrderDraftPendingFileSummary;
  upload: OrderDraftFileUploadInfo;
}

export interface DeletedOrderDraftFileSummary {
  id: string;
}

export interface PrepareOrderDraftFileUploadRpcParams {
  p_user_id: string;
  p_draft_id: string;
  p_expected_version: number;
  p_file_id: string;
  p_item_client_id: string;
  p_kind: OrderDraftFileKind;
  p_storage_path: string;
  p_original_filename: string;
  p_file_size: number;
  p_mime_type: string;
}

export interface PrepareOrderDraftFileUploadRpcInput {
  userId: string;
  draftId: string;
  expectedVersion: number;
  fileId: string;
  input: PrepareOrderDraftFileUploadInput;
  storagePath: string;
}

export interface PreparedDraftFileUploadMutation {
  fileId: string;
  itemIndex: number;
  retiredStoragePaths: string[];
}

export interface CompletedDraftFileUploadMutation {
  fileId: string;
  retiredStoragePaths: string[];
}

export interface SoftDeletedDraftFileMutation {
  fileId: string;
  storagePath: string;
}

export type DraftFileMutationResultCode =
  | "prepared"
  | "completed"
  | "deleted"
  | "not_found"
  | "invalid_status"
  | "version_conflict"
  | "item_not_found"
  | "invalid_file_status";

export interface DraftStoragePathParts {
  directory: string;
  basename: string;
}

export interface StoredDraftObjectInfo {
  name: string;
  size: number | null;
  contentType?: string | null;
}

export const PrepareOrderDraftFileUploadInputSchema = z
  .object({
    itemClientId: UuidSchema,
    kind: OrderDraftFileKindSchema,
    filename: z
      .string({ message: "Filename is required." })
      .trim()
      .min(1, "Filename is required.")
      .max(MAX_ORIGINAL_FILENAME_LENGTH),
    contentType: z
      .string({ message: "Content type is required." })
      .trim()
      .toLowerCase()
      .min(1)
      .max(255),
    size: z
      .number()
      .int()
      .min(1, "File appears to be empty.")
      .max(
        MAX_FILE_SIZE_BYTES,
        `File exceeds ${MAX_FILE_SIZE_MB} MB limit.`,
      ),
  })
  .strict();

export function draftFileError<T = never>(
  code: OrderDraftFilePublicErrorCode,
  message: string,
): OrderDraftFileOperationResult<T> {
  return { ok: false, code, message };
}

export function buildPrepareOrderDraftFileUploadRpcParams(
  input: PrepareOrderDraftFileUploadRpcInput,
): PrepareOrderDraftFileUploadRpcParams {
  return {
    p_user_id: input.userId,
    p_draft_id: input.draftId,
    p_expected_version: input.expectedVersion,
    p_file_id: input.fileId,
    p_item_client_id: input.input.itemClientId,
    p_kind: input.input.kind,
    p_storage_path: input.storagePath,
    p_original_filename: input.input.filename,
    p_file_size: input.input.size,
    p_mime_type: input.input.contentType,
  };
}

export function parsePrepareOrderDraftFileUploadRpcResult(
  data: unknown,
): OrderDraftFileOperationResult<PreparedDraftFileUploadMutation> {
  const row = getSingleRpcRow(data);
  const code = getRpcResultCode(row);
  if (code !== "prepared") {
    return mapDraftFileMutationCodeToResult(code, "prepare");
  }

  const fileId = getStringField(row, "prepared_file_id");
  const itemIndex = getNumberField(row, "item_index");
  if (!UuidSchema.safeParse(fileId).success || !isNonNegativeInteger(itemIndex)) {
    return draftFileError(
      "database_error",
      "Order draft file operation failed.",
    );
  }

  return {
    ok: true,
    data: {
      fileId,
      itemIndex,
      retiredStoragePaths: getStringArrayField(row, "retired_storage_paths"),
    },
  };
}

export function parseCompleteOrderDraftFileUploadRpcResult(
  data: unknown,
): OrderDraftFileOperationResult<CompletedDraftFileUploadMutation> {
  const row = getSingleRpcRow(data);
  const code = getRpcResultCode(row);
  if (code !== "completed") {
    return mapDraftFileMutationCodeToResult(code, "complete");
  }

  const fileId = getStringField(row, "completed_file_id");
  if (!UuidSchema.safeParse(fileId).success) {
    return draftFileError(
      "database_error",
      "Order draft file operation failed.",
    );
  }

  return {
    ok: true,
    data: {
      fileId,
      retiredStoragePaths: getStringArrayField(row, "retired_storage_paths"),
    },
  };
}

export function parseSoftDeleteOrderDraftFileRpcResult(
  data: unknown,
): OrderDraftFileOperationResult<SoftDeletedDraftFileMutation> {
  const row = getSingleRpcRow(data);
  const code = getRpcResultCode(row);
  if (code !== "deleted") {
    return mapDraftFileMutationCodeToResult(code, "delete");
  }

  const fileId = getStringField(row, "deleted_file_id");
  const storagePath = getStringField(row, "storage_path");
  if (!UuidSchema.safeParse(fileId).success || storagePath.trim() === "") {
    return draftFileError(
      "database_error",
      "Order draft file operation failed.",
    );
  }

  return {
    ok: true,
    data: { fileId, storagePath },
  };
}

export function sanitizeDraftStorageFilename(filename: string): string {
  const leaf = filename
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part.length > 0)
    .pop()
    ?.trim() ?? "";

  const { base, extension } = splitFilename(leaf);
  const safeBase = sanitizeFilenamePart(base);
  const safeExtension = extension.toLowerCase();
  const fallbackBase = safeBase || "file";
  const fallbackExtension =
    safeExtension || (safeBase ? "" : "bin");
  const suffix = fallbackExtension ? `.${fallbackExtension}` : "";
  const maxBaseLength = Math.max(1, MAX_STORAGE_FILENAME_LENGTH - suffix.length);
  const cappedBase =
    fallbackBase.slice(0, maxBaseLength).replace(/[._-]+$/g, "") || "file";
  const sanitized = `${cappedBase}${suffix}`;

  return sanitized.includes("/") || sanitized.includes("\\")
    ? "file.bin"
    : sanitized;
}

export function buildDraftStoragePath(input: {
  verifiedUserId: string;
  draftId: string;
  fileId: string;
  filename: string;
}): string {
  const verifiedUserId = UuidSchema.parse(input.verifiedUserId);
  const draftId = UuidSchema.parse(input.draftId);
  const fileId = UuidSchema.parse(input.fileId);
  const sanitizedFilename = sanitizeDraftStorageFilename(input.filename);

  return `drafts/${verifiedUserId}/${draftId}/${fileId}/${sanitizedFilename}`;
}

export function getDraftStoragePathParts(
  storagePath: string,
): DraftStoragePathParts {
  const slashIndex = storagePath.lastIndexOf("/");
  if (slashIndex <= 0 || slashIndex === storagePath.length - 1) {
    throw new Error("Invalid draft storage path.");
  }

  return {
    directory: storagePath.slice(0, slashIndex),
    basename: storagePath.slice(slashIndex + 1),
  };
}

export function findDraftItemIndex(
  draftState: JsonObject,
  itemClientId: string,
):
  | { ok: true; itemIndex: number }
  | { ok: false; code: "invalid_state" | "item_not_found" } {
  const itemIdResult = UuidSchema.safeParse(itemClientId);
  if (!itemIdResult.success) return { ok: false, code: "item_not_found" };

  const stateResult = BaseDraftStateEnvelopeSchema.safeParse(draftState);
  if (!stateResult.success) return { ok: false, code: "invalid_state" };

  const itemIndex = stateResult.data.items.findIndex(
    (item) => item.clientItemId === itemIdResult.data,
  );

  return itemIndex >= 0
    ? { ok: true, itemIndex }
    : { ok: false, code: "item_not_found" };
}

export function isDraftFileAllowedForDraft(
  draft: Pick<OrderDraftRow, "serviceType">,
  input: Pick<PrepareOrderDraftFileUploadInput, "kind" | "contentType">,
): boolean {
  return getAllowedMimeTypes(draft.serviceType, input.kind).includes(
    input.contentType,
  );
}

export function mapOrderDraftFilePublicSummary(
  row: OrderDraftFileRow,
): OrderDraftFilePublicSummary {
  if (row.uploadStatus !== "pending" && row.uploadStatus !== "uploaded") {
    throw new Error("Draft file is not public.");
  }

  return {
    id: row.id,
    itemClientId: row.itemClientId,
    itemIndex: row.itemIndex,
    kind: row.kind,
    originalFilename: row.originalFilename,
    fileSize: row.fileSize,
    mimeType: row.mimeType,
    uploadStatus: row.uploadStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapUploadedOrderDraftFileSummary(
  row: OrderDraftFileRow,
): OrderDraftUploadedFileSummary {
  if (row.uploadStatus !== "uploaded" || row.deletedAt !== null) {
    throw new Error("Draft file is not uploaded.");
  }

  return mapOrderDraftFilePublicSummary(row) as OrderDraftUploadedFileSummary;
}

export function filterUploadedDraftFiles(
  rows: OrderDraftFileRow[],
): OrderDraftUploadedFileSummary[] {
  return rows
    .filter((row) => row.uploadStatus === "uploaded" && row.deletedAt === null)
    .map(mapUploadedOrderDraftFileSummary);
}

export function shouldSupersedeDraftFileCandidate(
  row: OrderDraftFileRow,
  slot: {
    draftId: string;
    itemClientId: string;
    kind: OrderDraftFileKind;
  },
): boolean {
  return (
    row.draftId === slot.draftId &&
    row.itemClientId === slot.itemClientId &&
    row.kind === slot.kind &&
    row.deletedAt === null &&
    (row.uploadStatus === "pending" || row.uploadStatus === "failed")
  );
}

export function isPendingDraftFile(row: OrderDraftFileRow): boolean {
  return row.uploadStatus === "pending" && row.deletedAt === null;
}

export function verifyStoredDraftObject(
  row: OrderDraftFileRow,
  object: StoredDraftObjectInfo | null,
): OrderDraftFileOperationResult<true> {
  if (!object) {
    return draftFileError(
      "upload_not_found",
      "Uploaded file was not found. Please upload it again.",
    );
  }

  const { basename } = getDraftStoragePathParts(row.storagePath);
  if (object.name !== basename) {
    return draftFileError(
      "upload_mismatch",
      "Uploaded file did not match the expected draft file.",
    );
  }

  if (object.size === null || object.size !== row.fileSize) {
    return draftFileError(
      "upload_mismatch",
      "Uploaded file size did not match the expected draft file.",
    );
  }

  if (
    object.contentType &&
    object.contentType.toLowerCase() !== row.mimeType.toLowerCase()
  ) {
    return draftFileError(
      "upload_mismatch",
      "Uploaded file type did not match the expected draft file.",
    );
  }

  return { ok: true, data: true };
}

export function getRetiredUploadedStoragePathsForSlot(
  rows: OrderDraftFileRow[],
  completed: OrderDraftFileRow,
): string[] {
  return rows
    .filter(
      (row) =>
        row.id !== completed.id &&
        row.draftId === completed.draftId &&
        row.itemClientId === completed.itemClientId &&
        row.kind === completed.kind &&
        row.uploadStatus === "uploaded" &&
        row.deletedAt === null,
    )
    .map((row) => row.storagePath);
}

export function buildDraftFileSoftDeletePayload(now = new Date()): {
  upload_status: "deleted";
  deleted_at: string;
} {
  return {
    upload_status: "deleted",
    deleted_at: now.toISOString(),
  };
}

function mapDraftFileMutationCodeToResult<T>(
  code: DraftFileMutationResultCode | null,
  operation: "prepare" | "complete" | "delete",
): OrderDraftFileOperationResult<T> {
  switch (code) {
    case "not_found":
      return draftFileError("not_found", "Draft file was not found.");
    case "invalid_status":
      return draftFileError("invalid_status", "Draft is not editable.");
    case "version_conflict":
      return draftFileError(
        "version_conflict",
        "Draft has changed since it was loaded.",
      );
    case "item_not_found":
      return draftFileError("item_not_found", "Draft item was not found.");
    case "invalid_file_status":
      return draftFileError(
        "invalid_status",
        operation === "delete"
          ? "Draft file cannot be deleted."
          : "Draft file is not in the expected upload state.",
      );
    default:
      return draftFileError(
        "database_error",
        "Order draft file operation failed.",
      );
  }
}

function getSingleRpcRow(data: unknown): Record<string, unknown> | null {
  const row = Array.isArray(data) ? data[0] : data;
  return row !== null && typeof row === "object" && !Array.isArray(row)
    ? row as Record<string, unknown>
    : null;
}

function getRpcResultCode(
  row: Record<string, unknown> | null,
): DraftFileMutationResultCode | null {
  const code = row?.result_code;
  if (typeof code !== "string") return null;
  return [
    "prepared",
    "completed",
    "deleted",
    "not_found",
    "invalid_status",
    "version_conflict",
    "item_not_found",
    "invalid_file_status",
  ].includes(code)
    ? code as DraftFileMutationResultCode
    : null;
}

function getStringField(
  row: Record<string, unknown> | null,
  field: string,
): string {
  const value = row?.[field];
  return typeof value === "string" ? value : "";
}

function getNumberField(
  row: Record<string, unknown> | null,
  field: string,
): number {
  const value = row?.[field];
  return typeof value === "number" ? value : Number.NaN;
}

function getStringArrayField(
  row: Record<string, unknown> | null,
  field: string,
): string[] {
  const value = row?.[field];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function splitFilename(filename: string): { base: string; extension: string } {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === filename.length - 1) {
    return { base: filename, extension: "" };
  }

  const extension = filename.slice(dotIndex + 1);
  if (!/^[A-Za-z0-9]{1,16}$/.test(extension)) {
    return { base: filename, extension: "" };
  }

  return {
    base: filename.slice(0, dotIndex),
    extension,
  };
}

function sanitizeFilenamePart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/_+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "");
}
