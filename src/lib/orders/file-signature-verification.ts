import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getFileExtension, ORDER_FILES_BUCKET } from "../upload-config.ts";

const SIGNATURE_PREFIX_BYTES = 4096;
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

export type OrderFileSignatureVerificationResult =
  | {
      ok: true;
      identities: Map<string, StorageObjectIdentity>;
    }
  | {
      ok: false;
      code: "invalid_upload" | "storage_error";
      message: string;
      status: 400 | 500;
    };

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
  let failure: Exclude<OrderFileSignatureVerificationResult, { ok: true }> | null = null;

  const worker = async () => {
    while (!failure) {
      const index = nextIndex++;
      if (index >= files.length) return;
      const file = files[index];
      const result = await verifyOneStoredFile(input.supabase, file);
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

async function verifyOneStoredFile(
  supabase: SupabaseClient,
  file: FileDescriptorForSignatureVerification,
): Promise<
  | { ok: true; identity: StorageObjectIdentity }
  | Exclude<OrderFileSignatureVerificationResult, { ok: true }>
> {
  const before = await getStorageObjectIdentity(supabase, file.path);
  if (!before || !storageIdentityMatchesDescriptor(before, file)) {
    return invalidUpload();
  }

  const prefix = await readStoredObjectPrefix(supabase, file.path);
  if (!prefix.ok) return prefix;

  const extension =
    getFileExtension(file.path) || getFileExtension(file.originalFilename);
  if (!matchesExpectedFileSignature(prefix.bytes, before.mimeType, extension)) {
    return invalidUpload();
  }

  // A signed upload URL can still be reusable while the order is being
  // submitted. Re-read the authoritative Storage identity after inspecting
  // bytes, then bind finalization to this exact ETag so an overwrite between
  // signature verification and copy is rejected.
  const after = await getStorageObjectIdentity(supabase, file.path);
  if (!after || !storageIdentitiesMatch(before, after)) {
    return invalidUpload();
  }

  return { ok: true, identity: after };
}

async function readStoredObjectPrefix(
  supabase: SupabaseClient,
  path: string,
): Promise<
  | { ok: true; bytes: Uint8Array }
  | Exclude<OrderFileSignatureVerificationResult, { ok: true }>
> {
  try {
    const { data, error } = await supabase.storage
      .from(ORDER_FILES_BUCKET)
      .createSignedUrl(path, SIGNED_READ_TTL_SECONDS);
    if (error || !data?.signedUrl) return storageError();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SIGNATURE_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(data.signedUrl, {
        headers: { Range: `bytes=0-${SIGNATURE_PREFIX_BYTES - 1}` },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok || !response.body) return storageError();

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      try {
        while (total < SIGNATURE_PREFIX_BYTES) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value || value.length === 0) continue;
          const remaining = SIGNATURE_PREFIX_BYTES - total;
          const chunk = value.length > remaining ? value.subarray(0, remaining) : value;
          chunks.push(chunk);
          total += chunk.length;
        }
      } finally {
        // Range is an optimisation, not a trust boundary. If a Storage/CDN
        // response ignores Range and starts streaming the full object, stop as
        // soon as the bounded prefix has been collected.
        await reader.cancel().catch(() => undefined);
      }

      if (total === 0) return storageError();
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      return { ok: true, bytes };
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return storageError();
  }
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
    if (!Number.isFinite(size) || size < 1 || !mimeType || !etag) return null;
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
        startsWithAscii(bytes, "RIFF") && asciiAt(bytes, 8, "WEBP");
    case "application/pdf":
      return ext === "pdf" && startsWithAscii(bytes, "%PDF-");
    case "application/dxf":
      return ext === "dxf" && isDxf(bytes);
    case "application/dwg":
      return ext === "dwg" && isDwg(bytes);
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
  return startsWithAscii(bytes, "AC10");
}

function isDxf(bytes: Uint8Array): boolean {
  if (startsWithAscii(bytes, "AutoCAD Binary DXF\r\n\u001a\u0000")) return true;
  const text = decodeAsciiPrefix(bytes).replace(/^\uFEFF/, "");
  return /^\s*0\s*(?:\r?\n|\r)\s*SECTION(?:\s|$)/i.test(text);
}

function isFbx(bytes: Uint8Array): boolean {
  if (startsWithAscii(bytes, "Kaydara FBX Binary  \u0000\u001a\u0000")) return true;
  const text = decodeAsciiPrefix(bytes).replace(/^\uFEFF/, "").trimStart();
  return text.startsWith("; FBX");
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
  if (bytes.length < prefix.length) return false;
  return prefix.every((value, index) => bytes[index] === value);
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
  const limit = Math.min(bytes.length, SIGNATURE_PREFIX_BYTES);
  for (let index = 0; index < limit; index += 1) {
    result += String.fromCharCode(bytes[index]);
  }
  return result;
}

function invalidUpload(): Exclude<OrderFileSignatureVerificationResult, { ok: true }> {
  return {
    ok: false,
    code: "invalid_upload",
    message: INVALID_UPLOAD_MESSAGE,
    status: 400,
  };
}

function storageError(): Exclude<OrderFileSignatureVerificationResult, { ok: true }> {
  return {
    ok: false,
    code: "storage_error",
    message: STORAGE_ERROR_MESSAGE,
    status: 500,
  };
}
