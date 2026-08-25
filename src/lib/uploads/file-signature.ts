import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getFileExtension, ORDER_FILES_BUCKET } from "../upload-config.ts";

export const FILE_SIGNATURE_PREFIX_BYTES = 512;

const SIGNED_READ_TTL_SECONDS = 60;
const SIGNATURE_FETCH_TIMEOUT_MS = 8_000;
const SIGNATURE_VERIFICATION_CONCURRENCY = 6;

const INVALID_UPLOAD_MESSAGE =
  "Uploaded file contents do not match the expected file type. Please upload it again.";
const STORAGE_ERROR_MESSAGE =
  "Could not verify uploaded file contents. Please try again.";

export interface StorageObjectIdentity {
  etag: string;
  size: number;
  mimeType: string;
}

export interface FileDescriptorForSignatureVerification {
  path: string;
  originalFilename: string;
  size: number;
  mimeType: string;
}

export type FileSignatureVerificationFailure = {
  ok: false;
  code: "invalid_upload" | "storage_error";
  message: string;
  status: 400 | 500;
};

export type StoredUploadContentVerificationResult =
  | { ok: true; identity: StorageObjectIdentity }
  | FileSignatureVerificationFailure;

export type OrderFileSignatureVerificationResult =
  | { ok: true; identities: Map<string, StorageObjectIdentity> }
  | FileSignatureVerificationFailure;

export async function verifyOrderFileSignatures(input: {
  supabase: SupabaseClient;
  files: FileDescriptorForSignatureVerification[];
}): Promise<OrderFileSignatureVerificationResult> {
  const filesByPath = new Map<string, FileDescriptorForSignatureVerification>();
  for (const file of input.files) {
    if (!filesByPath.has(file.path)) filesByPath.set(file.path, file);
  }

  const files = Array.from(filesByPath.values());
  const identities = new Map<string, StorageObjectIdentity>();
  let nextIndex = 0;
  let failure: FileSignatureVerificationFailure | null = null;

  const worker = async () => {
    while (!failure) {
      const index = nextIndex++;
      if (index >= files.length) return;

      const file = files[index];
      const result = await verifyStoredUploadContent({
        supabase: input.supabase,
        file,
      });
      if (!result.ok) {
        failure = result;
        return;
      }

      identities.set(file.path, result.identity);
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(SIGNATURE_VERIFICATION_CONCURRENCY, files.length) },
      () => worker(),
    ),
  );

  return failure ?? { ok: true, identities };
}

export async function verifyStoredUploadContent(input: {
  supabase: SupabaseClient;
  file: FileDescriptorForSignatureVerification;
}): Promise<StoredUploadContentVerificationResult> {
  const before = await getStorageObjectIdentity(input.supabase, input.file.path);
  if (!before) return storageError();
  if (!storageIdentityMatchesDescriptor(before, input.file)) return invalidUpload();

  const storedExtension = getFileExtension(input.file.path);
  const originalExtension = getFileExtension(input.file.originalFilename);
  if (storedExtension !== originalExtension) return invalidUpload();

  const prefix = await readStoredObjectPrefix({
    supabase: input.supabase,
    path: input.file.path,
    identity: before,
  });
  if (!prefix.ok) return prefix;

  if (!matchesExpectedFileSignature(prefix.bytes, before.mimeType, storedExtension)) {
    return invalidUpload();
  }

  // Signed upload URLs can be reused. The conditional read, response ETag, and
  // a second authoritative object-info read all bind the inspected prefix to
  // the identity subsequently checked again immediately before order copy.
  const after = await getStorageObjectIdentity(input.supabase, input.file.path);
  if (!after) return storageError();
  if (!storageIdentitiesMatch(before, after)) return invalidUpload();

  return { ok: true, identity: after };
}

async function readStoredObjectPrefix(input: {
  supabase: SupabaseClient;
  path: string;
  identity: StorageObjectIdentity;
}): Promise<
  | { ok: true; bytes: Uint8Array }
  | FileSignatureVerificationFailure
> {
  try {
    const { data, error } = await input.supabase.storage
      .from(ORDER_FILES_BUCKET)
      .createSignedUrl(input.path, SIGNED_READ_TTL_SECONDS);
    if (error || !data?.signedUrl) return storageError();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SIGNATURE_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(data.signedUrl, {
        headers: {
          Range: `bytes=0-${FILE_SIGNATURE_PREFIX_BYTES - 1}`,
          "If-Match": input.identity.etag,
        },
        cache: "no-store",
        signal: controller.signal,
      });

      if ((response.status !== 200 && response.status !== 206) || !response.body) {
        return storageError();
      }

      const expectedLength = Math.min(FILE_SIGNATURE_PREFIX_BYTES, input.identity.size);
      if (!hasValidReadResponseHeaders(response, input.identity.size, expectedLength)) {
        return storageError();
      }

      const responseEtag = normalizeStorageEtag(response.headers.get("etag"));
      if (responseEtag && responseEtag !== input.identity.etag) return invalidUpload();

      const bytes = new Uint8Array(expectedLength);
      const reader = response.body.getReader();
      let total = 0;

      try {
        while (total < expectedLength) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value || value.length === 0) continue;

          const copiedLength = Math.min(value.length, expectedLength - total);
          bytes.set(value.subarray(0, copiedLength), total);
          total += copiedLength;
        }
      } finally {
        // Some intermediaries ignore Range. Never buffer the remainder of a
        // 20 MB object: cancel its stream after the bounded prefix is filled.
        await reader.cancel().catch(() => undefined);
      }

      return total === expectedLength ? { ok: true, bytes } : storageError();
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return storageError();
  }
}

function hasValidReadResponseHeaders(
  response: Response,
  expectedObjectSize: number,
  expectedLength: number,
): boolean {
  const contentLengthHeader = response.headers.get("content-length");
  const contentLength = contentLengthHeader === null
    ? null
    : Number(contentLengthHeader);

  if (
    contentLength !== null &&
    (!Number.isSafeInteger(contentLength) || contentLength < 1)
  ) {
    return false;
  }

  if (response.status === 200) {
    return response.headers.get("content-range") === null &&
      (contentLength === null || contentLength === expectedObjectSize);
  }

  const match = /^bytes 0-(\d+)\/(\d+)$/i.exec(
    response.headers.get("content-range") ?? "",
  );
  if (!match) return false;

  const end = Number(match[1]);
  const total = Number(match[2]);
  return Number.isSafeInteger(end) &&
    Number.isSafeInteger(total) &&
    end + 1 === expectedLength &&
    total === expectedObjectSize &&
    (contentLength === null || contentLength === expectedLength);
}

export async function getStorageObjectIdentity(
  supabase: SupabaseClient,
  path: string,
): Promise<StorageObjectIdentity | null> {
  try {
    const { data, error } = await supabase.storage
      .from(ORDER_FILES_BUCKET)
      .info(path);
    if (error || !data || typeof data !== "object") return null;

    const record = data as Record<string, unknown>;
    const size = Number(record.size);
    const mimeType = String(
      record.contentType ?? record.content_type ?? "",
    ).trim().toLowerCase();
    const etag = normalizeStorageEtag(record.etag);

    if (!Number.isSafeInteger(size) || size < 1 || !mimeType || !etag) return null;
    return { etag, size, mimeType };
  } catch {
    return null;
  }
}

export function storageIdentitiesMatch(
  source: StorageObjectIdentity,
  destination: StorageObjectIdentity,
): boolean {
  return source.etag === destination.etag &&
    source.size === destination.size &&
    source.mimeType === destination.mimeType;
}

export function matchesExpectedFileSignature(
  bytes: Uint8Array,
  mimeType: string,
  extension: string,
): boolean {
  const mime = mimeType.trim().toLowerCase();
  const ext = extension.trim().toLowerCase();

  switch (mime) {
    case "image/jpeg":
      return (ext === "jpg" || ext === "jpeg") &&
        startsWithBytes(bytes, [0xff, 0xd8, 0xff]);
    case "image/png":
      return ext === "png" &&
        startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/gif":
      return ext === "gif" &&
        (startsWithAscii(bytes, "GIF87a") || startsWithAscii(bytes, "GIF89a"));
    case "image/webp":
      return ext === "webp" &&
        startsWithAscii(bytes, "RIFF") &&
        asciiAt(bytes, 8, "WEBP") &&
        ["VP8 ", "VP8L", "VP8X"].some((chunk) => asciiAt(bytes, 12, chunk));
    case "application/pdf":
      return ext === "pdf" &&
        /^%PDF-(?:1\.[0-7]|2\.0)(?:[\r\n\x20]|$)/.test(decodeAsciiPrefix(bytes));
    case "application/octet-stream":
      if (ext === "dwg") return isDwg(bytes);
      if (ext === "dxf") return isDxf(bytes);
      if (ext === "fbx") return isFbx(bytes);
      return false;
    default:
      return false;
  }
}

function isDwg(bytes: Uint8Array): boolean {
  return /^AC10\d{2}/.test(decodeAsciiPrefix(bytes.subarray(0, 6)));
}

function isDxf(bytes: Uint8Array): boolean {
  if (startsWithAscii(bytes, "AutoCAD Binary DXF\r\n\u001a\u0000")) return true;

  const text = decodeAsciiPrefix(stripUtf8Bom(bytes));
  return /^[\t\x20]*0[\t\x20]*(?:\r?\n|\r)[\t\x20]*SECTION[\t\x20]*(?:\r?\n|\r)[\t\x20]*2[\t\x20]*(?:\r?\n|\r)[\t\x20]*(?:HEADER|CLASSES|TABLES|BLOCKS|ENTITIES|OBJECTS|THUMBNAILIMAGE)\b/i
    .test(text);
}

function isFbx(bytes: Uint8Array): boolean {
  if (startsWithAscii(bytes, "Kaydara FBX Binary  \u0000\u001a\u0000")) return true;

  const text = decodeAsciiPrefix(stripUtf8Bom(bytes)).trimStart();
  return /^;[\t\x20]*FBX(?:[\t\x20]|$)/i.test(text) &&
    /(?:^|\r?\n)[\t\x20]*FBXHeaderExtension[\t\x20]*:/i.test(text);
}

function stripUtf8Bom(bytes: Uint8Array): Uint8Array {
  return startsWithBytes(bytes, [0xef, 0xbb, 0xbf])
    ? bytes.subarray(3)
    : bytes;
}

function storageIdentityMatchesDescriptor(
  identity: StorageObjectIdentity,
  descriptor: FileDescriptorForSignatureVerification,
): boolean {
  return identity.size === descriptor.size &&
    identity.mimeType === descriptor.mimeType.trim().toLowerCase();
}

function normalizeStorageEtag(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

function startsWithBytes(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return bytes.length >= prefix.length &&
    prefix.every((value, index) => bytes[index] === value);
}

function startsWithAscii(bytes: Uint8Array, prefix: string): boolean {
  return asciiAt(bytes, 0, prefix);
}

function asciiAt(bytes: Uint8Array, offset: number, expected: string): boolean {
  if (bytes.length < offset + expected.length) return false;
  for (let index = 0; index < expected.length; index += 1) {
    if (bytes[offset + index] !== expected.charCodeAt(index)) return false;
  }
  return true;
}

function decodeAsciiPrefix(bytes: Uint8Array): string {
  let result = "";
  for (let index = 0; index < bytes.length; index += 1) {
    result += String.fromCharCode(bytes[index]);
  }
  return result;
}

function invalidUpload(): FileSignatureVerificationFailure {
  return {
    ok: false,
    code: "invalid_upload",
    message: INVALID_UPLOAD_MESSAGE,
    status: 400,
  };
}

function storageError(): FileSignatureVerificationFailure {
  return {
    ok: false,
    code: "storage_error",
    message: STORAGE_ERROR_MESSAGE,
    status: 500,
  };
}
