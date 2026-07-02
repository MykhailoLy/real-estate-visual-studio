import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ItemFiles,
  ServiceType,
  UploadedFile,
} from "../server-validation.ts";
import {
  MAX_FILE_SIZE_BYTES,
  ORDER_FILES_BUCKET,
  getAllowedMimeTypes,
  type UploadKind,
} from "../upload-config.ts";

const DIRECT_PENDING_PATH_REGEX =
  /^pending\/([0-9a-f]{32})\/(\d+)-(original|reference)\.([A-Za-z0-9]+)$/;
const DIRECT_PENDING_DIRECTORY_LIST_LIMIT = 100;

const INVALID_UPLOAD_MESSAGE =
  "Uploaded files could not be verified. Please refresh and upload again.";
const MISSING_UPLOAD_MESSAGE =
  "Uploaded file was not found. Please refresh and upload again.";
const STORAGE_VERIFICATION_MESSAGE =
  "Could not verify uploaded files. Please try again.";

export type DirectUploadVerificationErrorCode =
  | "invalid_upload"
  | "storage_error";

export type DirectUploadVerificationResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: DirectUploadVerificationErrorCode;
      message: string;
      status: 400 | 409 | 500;
    };

export interface VerifiedDirectOrderFileDescriptor extends UploadedFile {
  bucket: typeof ORDER_FILES_BUCKET;
  path: string;
  originalFilename: string;
  size: number;
  mimeType: string;
}

export interface VerifiedDirectOrderItemFiles {
  original: VerifiedDirectOrderFileDescriptor;
  reference?: VerifiedDirectOrderFileDescriptor | null;
}

interface DirectPendingPathParts {
  pendingToken: string;
  directory: string;
  basename: string;
  itemIndex: number;
  kind: UploadKind;
  extension: string;
}

interface DirectUploadCandidate {
  descriptor: UploadedFile;
  itemIndex: number;
  kind: UploadKind;
  path: DirectPendingPathParts;
}

interface SupabaseStorageObject {
  name?: unknown;
  metadata?: unknown;
}

interface StoredDirectObjectInfo {
  name: string;
  size: number | null;
  contentType: string | null;
}

export function validateDirectPendingDescriptorStructure(input: {
  descriptor: UploadedFile;
  itemIndex: number;
  kind: UploadKind;
  seenPaths?: Set<string>;
}): DirectUploadVerificationResult<DirectPendingPathParts> {
  if (input.descriptor.bucket !== ORDER_FILES_BUCKET) {
    return invalidDirectUpload();
  }

  const parsed = parseDirectPendingPath(input.descriptor.path);
  if (!parsed) {
    return invalidDirectUpload();
  }

  if (
    parsed.itemIndex !== input.itemIndex ||
    parsed.basename !== `${input.itemIndex}-${input.kind}.${parsed.extension}` ||
    parsed.kind !== input.kind
  ) {
    return invalidDirectUpload();
  }

  if (input.seenPaths?.has(input.descriptor.path)) {
    return invalidDirectUpload();
  }
  input.seenPaths?.add(input.descriptor.path);

  return { ok: true, data: parsed };
}

export async function verifyDirectOrderUploads(input: {
  supabase: SupabaseClient;
  serviceType: ServiceType;
  itemFiles: ItemFiles[];
}): Promise<DirectUploadVerificationResult<VerifiedDirectOrderItemFiles[]>> {
  const candidates = collectDirectUploadCandidates(input.itemFiles);
  if (!candidates.ok) return candidates;

  const verifiedByPath = new Map<string, VerifiedDirectOrderFileDescriptor>();
  const candidatesByDirectory = groupDirectUploadCandidatesByDirectory(
    candidates.data,
  );

  for (const [directory, directoryCandidates] of candidatesByDirectory) {
    const storedObjects = await listStoredDirectObjectsInDirectory(
      input.supabase,
      directory,
    );
    if (!storedObjects.ok) return storedObjects;

    const storedByBasename = mapStoredObjectsByBasename(storedObjects.data);

    for (const candidate of directoryCandidates) {
      const verified = verifyStoredDirectObject({
        serviceType: input.serviceType,
        candidate,
        object: storedByBasename.get(candidate.path.basename) ?? null,
      });
      if (!verified.ok) return verified;

      verifiedByPath.set(candidate.descriptor.path, verified.data);
    }
  }

  return {
    ok: true,
    data: input.itemFiles.map((slot) => ({
      original: verifiedByPath.get(slot.original.path) ??
        failMissingVerifiedDescriptor(),
      reference: slot.reference
        ? verifiedByPath.get(slot.reference.path) ??
          failMissingVerifiedDescriptor()
        : null,
    })),
  };
}

function collectDirectUploadCandidates(
  itemFiles: ItemFiles[],
): DirectUploadVerificationResult<DirectUploadCandidate[]> {
  const seenPaths = new Set<string>();
  const candidates: DirectUploadCandidate[] = [];

  for (let itemIndex = 0; itemIndex < itemFiles.length; itemIndex++) {
    const slot = itemFiles[itemIndex];
    const original = validateDirectPendingDescriptorStructure({
      descriptor: slot.original,
      itemIndex,
      kind: "original",
      seenPaths,
    });
    if (!original.ok) return original;
    candidates.push({
      descriptor: slot.original,
      itemIndex,
      kind: "original",
      path: original.data,
    });

    if (slot.reference) {
      const reference = validateDirectPendingDescriptorStructure({
        descriptor: slot.reference,
        itemIndex,
        kind: "reference",
        seenPaths,
      });
      if (!reference.ok) return reference;
      candidates.push({
        descriptor: slot.reference,
        itemIndex,
        kind: "reference",
        path: reference.data,
      });
    }
  }

  return { ok: true, data: candidates };
}

function groupDirectUploadCandidatesByDirectory(
  candidates: DirectUploadCandidate[],
): Map<string, DirectUploadCandidate[]> {
  const candidatesByDirectory = new Map<string, DirectUploadCandidate[]>();
  for (const candidate of candidates) {
    const directoryCandidates =
      candidatesByDirectory.get(candidate.path.directory) ?? [];
    directoryCandidates.push(candidate);
    candidatesByDirectory.set(candidate.path.directory, directoryCandidates);
  }
  return candidatesByDirectory;
}

function parseDirectPendingPath(path: string): DirectPendingPathParts | null {
  const match = DIRECT_PENDING_PATH_REGEX.exec(path);
  if (!match) return null;
  if (path.split("/").length !== 3) return null;

  const [, pendingToken, itemIndexText, kind, extension] = match;
  const itemIndex = Number(itemIndexText);
  if (
    !pendingToken ||
    !kind ||
    !extension ||
    !Number.isInteger(itemIndex) ||
    itemIndex < 0 ||
    itemIndexText !== String(itemIndex)
  ) {
    return null;
  }

  return {
    pendingToken,
    directory: `pending/${pendingToken}`,
    basename: `${itemIndexText}-${kind}.${extension}`,
    itemIndex,
    kind: kind as UploadKind,
    extension,
  };
}

async function listStoredDirectObjectsInDirectory(
  supabase: SupabaseClient,
  directory: string,
): Promise<DirectUploadVerificationResult<SupabaseStorageObject[]>> {
  try {
    const { data, error } = await supabase.storage
      .from(ORDER_FILES_BUCKET)
      .list(directory, { limit: DIRECT_PENDING_DIRECTORY_LIST_LIMIT });

    if (error) {
      console.error("[orders] direct upload storage list failed:", {
        reason: getSafeErrorLabel(error),
      });
      return storageVerificationError();
    }

    return {
      ok: true,
      data: (data ?? []) as SupabaseStorageObject[],
    };
  } catch (error) {
    console.error("[orders] direct upload storage verification threw:", {
      reason: getSafeErrorLabel(error),
    });
    return storageVerificationError();
  }
}

function mapStoredObjectsByBasename(
  objects: SupabaseStorageObject[],
): Map<string, StoredDirectObjectInfo> {
  const objectsByBasename = new Map<string, StoredDirectObjectInfo>();
  for (const object of objects) {
    const info = mapStorageObjectInfo(object);
    if (!objectsByBasename.has(info.name)) {
      objectsByBasename.set(info.name, info);
    }
  }
  return objectsByBasename;
}

function verifyStoredDirectObject(input: {
  serviceType: ServiceType;
  candidate: DirectUploadCandidate;
  object: StoredDirectObjectInfo | null;
}): DirectUploadVerificationResult<VerifiedDirectOrderFileDescriptor> {
  if (!input.object) {
    return {
      ok: false,
      code: "invalid_upload",
      message: MISSING_UPLOAD_MESSAGE,
      status: 409,
    };
  }

  if (input.object.name !== input.candidate.path.basename) {
    return invalidDirectUpload();
  }

  const actualSize = input.object.size;
  if (
    actualSize === null ||
    !Number.isInteger(actualSize) ||
    actualSize <= 0 ||
    actualSize > MAX_FILE_SIZE_BYTES
  ) {
    return invalidDirectUpload();
  }

  const actualMimeType = normalizeMimeType(input.object.contentType);
  if (!actualMimeType) {
    return invalidDirectUpload();
  }

  const allowedMimeTypes = getAllowedMimeTypes(
    input.serviceType,
    input.candidate.kind,
  );
  if (!allowedMimeTypes.includes(actualMimeType)) {
    return invalidDirectUpload();
  }

  const descriptorMimeType = normalizeMimeType(
    input.candidate.descriptor.mimeType,
  );
  if (
    input.candidate.descriptor.size !== actualSize ||
    descriptorMimeType !== actualMimeType
  ) {
    return invalidDirectUpload();
  }

  return {
    ok: true,
    data: {
      bucket: ORDER_FILES_BUCKET,
      path: input.candidate.descriptor.path,
      originalFilename: input.candidate.descriptor.originalFilename,
      size: actualSize,
      mimeType: actualMimeType,
    },
  };
}

function mapStorageObjectInfo(
  object: SupabaseStorageObject,
): StoredDirectObjectInfo {
  const metadata =
    object.metadata && typeof object.metadata === "object"
      ? object.metadata as Record<string, unknown>
      : {};

  return {
    name: typeof object.name === "string" ? object.name : "",
    size: getNumericMetadata(metadata, ["size", "contentLength"]),
    contentType: getStringMetadata(metadata, [
      "mimetype",
      "mimeType",
      "contentType",
      "content-type",
    ]),
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

function normalizeMimeType(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function invalidDirectUpload<T = never>(): DirectUploadVerificationResult<T> {
  return {
    ok: false,
    code: "invalid_upload",
    message: INVALID_UPLOAD_MESSAGE,
    status: 400,
  };
}

function storageVerificationError<T = never>(): DirectUploadVerificationResult<T> {
  return {
    ok: false,
    code: "storage_error",
    message: STORAGE_VERIFICATION_MESSAGE,
    status: 500,
  };
}

function getSafeErrorLabel(error: unknown): string {
  if (error instanceof Error && error.name) return error.name;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.name === "string" && record.name.trim()) {
      return record.name.trim();
    }
    if (typeof record.statusCode === "string" && record.statusCode.trim()) {
      return `status:${record.statusCode.trim()}`;
    }
    if (typeof record.statusCode === "number") {
      return `status:${record.statusCode}`;
    }
  }
  return "StorageError";
}

function failMissingVerifiedDescriptor(): never {
  throw new Error("Verified direct upload descriptor was not collected.");
}
