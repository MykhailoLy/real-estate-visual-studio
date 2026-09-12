import "server-only";
import sharp from "sharp";

export const PRIVATE_IMAGE_PREVIEW_VERSION = "v1";
export const PRIVATE_IMAGE_PREVIEW_MAX_DIMENSION = 2048;
export const PRIVATE_IMAGE_PREVIEW_WEBP_QUALITY = 82;
export const PRIVATE_IMAGE_PREVIEW_MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;
export const PRIVATE_IMAGE_PREVIEW_MAX_INPUT_PIXELS = 40_000_000;
export const PRIVATE_IMAGE_PREVIEW_CACHE_CONTROL = "31536000";

const PRIVATE_IMAGE_PREVIEW_PREFIX = `_previews/${PRIVATE_IMAGE_PREVIEW_VERSION}`;
const PRIVATE_IMAGE_PREVIEW_BUCKETS = new Set(["order-files", "deliverables"]);
const PREVIEWABLE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const PREVIEWABLE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

export interface PrivateImagePreviewCandidate {
  storagePath: string | null | undefined;
  filename: string | null | undefined;
  mimeType: string | null | undefined;
  fileSize: number | null | undefined;
}

interface PrivatePreviewBucket {
  exists(path: string): Promise<{ data: boolean; error: unknown }>;
  info(path: string): Promise<{
    data: { size?: unknown; contentType?: unknown } | null;
    error: unknown;
  }>;
  download(path: string): Promise<{ data: Blob | null; error: unknown }>;
  upload(
    path: string,
    body: Uint8Array,
    options: {
      cacheControl: string;
      contentType: string;
      upsert: boolean;
    },
  ): Promise<{ data: unknown; error: unknown }>;
}

export interface PrivatePreviewStorageClient {
  storage: {
    from(bucket: string): PrivatePreviewBucket;
  };
}

export type PrivateImagePreviewInspection =
  | { status: "existing" | "missing"; previewPath: string }
  | { status: "skipped" | "failed"; previewPath: null };

/**
 * Maps an original object path to one immutable, collision-free derivative key.
 * Base64url preserves the complete UTF-8 path without introducing path segments.
 */
export function getPrivateImagePreviewPath(storagePath: string): string | null {
  if (!isSafeOriginalStoragePath(storagePath)) return null;
  const encodedPath = Buffer.from(storagePath, "utf8").toString("base64url");
  return `${PRIVATE_IMAGE_PREVIEW_PREFIX}/${encodedPath}.webp`;
}

export function isPrivateImagePreviewEligible(
  candidate: PrivateImagePreviewCandidate,
): boolean {
  return prepareCandidate(candidate)?.metadataComplete === true;
}

/** Read-only inspection used by request-time generation and the backfill dry run. */
export async function inspectPrivateImagePreview(
  client: PrivatePreviewStorageClient,
  bucket: string,
  candidate: PrivateImagePreviewCandidate,
): Promise<PrivateImagePreviewInspection> {
  if (!PRIVATE_IMAGE_PREVIEW_BUCKETS.has(bucket)) {
    return { status: "skipped", previewPath: null };
  }

  const prepared = prepareCandidate(candidate);
  if (!prepared) return { status: "skipped", previewPath: null };

  const storage = client.storage.from(bucket);
  if (prepared.metadataComplete) {
    const existing = await objectExists(storage, prepared.previewPath);
    if (existing === null) return { status: "failed", previewPath: null };
    if (existing) {
      return { status: "existing", previewPath: prepared.previewPath };
    }
  }

  const originalInfo = await getOriginalInfo(storage, prepared.storagePath);
  if (!originalInfo) return { status: "failed", previewPath: null };

  const effectiveMimeType = prepared.mimeType ?? originalInfo.mimeType;
  if (
    !PREVIEWABLE_MIME_TYPES.has(effectiveMimeType) ||
    originalInfo.size < 1 ||
    originalInfo.size > PRIVATE_IMAGE_PREVIEW_MAX_ORIGINAL_BYTES
  ) {
    return { status: "skipped", previewPath: null };
  }

  if (!prepared.metadataComplete) {
    const existing = await objectExists(storage, prepared.previewPath);
    if (existing === null) return { status: "failed", previewPath: null };
    if (existing) {
      return { status: "existing", previewPath: prepared.previewPath };
    }
  }

  return { status: "missing", previewPath: prepared.previewPath };
}

/**
 * Reuses an existing private preview or creates it once. Every recoverable
 * failure returns null so the caller can sign the original object instead.
 */
export async function getOrCreatePrivateImagePreview(
  client: PrivatePreviewStorageClient,
  bucket: string,
  candidate: PrivateImagePreviewCandidate,
): Promise<string | null> {
  try {
    const inspection = await inspectPrivateImagePreview(client, bucket, candidate);
    if (inspection.status === "existing") return inspection.previewPath;
    if (inspection.status !== "missing") return null;

    const storagePath = candidate.storagePath as string;
    const storage = client.storage.from(bucket);
    const { data: source, error: downloadError } = await storage.download(storagePath);
    if (downloadError || !source) return null;

    const input = Buffer.from(await source.arrayBuffer());
    if (
      input.byteLength < 1 ||
      input.byteLength > PRIVATE_IMAGE_PREVIEW_MAX_ORIGINAL_BYTES
    ) {
      return null;
    }

    const preview = await generatePrivateImagePreview(input);
    const { error: uploadError } = await storage.upload(
      inspection.previewPath,
      preview,
      {
        cacheControl: PRIVATE_IMAGE_PREVIEW_CACHE_CONTROL,
        contentType: "image/webp",
        upsert: false,
      },
    );

    if (!uploadError) return inspection.previewPath;

    // Another first request may have won the create race. Reuse its object.
    const existsAfterRace = await objectExists(storage, inspection.previewPath);
    return existsAfterRace ? inspection.previewPath : null;
  } catch (error) {
    console.warn(
      "[private-image-preview] Preview generation failed; using original:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return null;
  }
}

export async function generatePrivateImagePreview(input: Uint8Array): Promise<Buffer> {
  return sharp(input, {
    animated: false,
    failOn: "error",
    limitInputPixels: PRIVATE_IMAGE_PREVIEW_MAX_INPUT_PIXELS,
    sequentialRead: true,
  })
    .rotate()
    .resize({
      width: PRIVATE_IMAGE_PREVIEW_MAX_DIMENSION,
      height: PRIVATE_IMAGE_PREVIEW_MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: PRIVATE_IMAGE_PREVIEW_WEBP_QUALITY })
    .timeout({ seconds: 12 })
    .toBuffer();
}

function prepareCandidate(candidate: PrivateImagePreviewCandidate): {
  storagePath: string;
  previewPath: string;
  mimeType: string | null;
  metadataComplete: boolean;
} | null {
  const storagePath = candidate.storagePath;
  if (typeof storagePath !== "string") return null;
  const previewPath = getPrivateImagePreviewPath(storagePath);
  if (!previewPath) return null;

  const filename =
    typeof candidate.filename === "string" ? candidate.filename.trim() : "";
  const filenameExtension = fileExtension(filename);
  const storageExtension = fileExtension(storagePath);
  const extensions = [filenameExtension, storageExtension].filter(Boolean);
  if (
    extensions.length === 0 ||
    extensions.some((extension) => !PREVIEWABLE_EXTENSIONS.has(extension))
  ) {
    return null;
  }

  const rawMimeType = candidate.mimeType;
  const mimeType =
    typeof rawMimeType === "string"
      ? rawMimeType.split(";", 1)[0].trim().toLowerCase()
      : null;
  if (mimeType !== null && !PREVIEWABLE_MIME_TYPES.has(mimeType)) return null;

  const fileSize = candidate.fileSize;
  if (
    fileSize !== null &&
    fileSize !== undefined &&
    (!Number.isSafeInteger(fileSize) ||
      fileSize < 1 ||
      fileSize > PRIVATE_IMAGE_PREVIEW_MAX_ORIGINAL_BYTES)
  ) {
    return null;
  }

  return {
    storagePath,
    previewPath,
    mimeType,
    metadataComplete: mimeType !== null && fileSize !== null && fileSize !== undefined,
  };
}

function isSafeOriginalStoragePath(storagePath: string): boolean {
  if (
    storagePath.length < 1 ||
    storagePath.length > 512 ||
    storagePath !== storagePath.trim() ||
    storagePath.startsWith("/") ||
    storagePath.startsWith("_previews/") ||
    storagePath.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(storagePath)
  ) {
    return false;
  }

  const segments = storagePath.split("/");
  return segments.every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function fileExtension(value: string): string {
  const leaf = value.split("/").at(-1) ?? "";
  const dot = leaf.lastIndexOf(".");
  return dot > -1 ? leaf.slice(dot + 1).toLowerCase() : "";
}

async function objectExists(
  storage: PrivatePreviewBucket,
  path: string,
): Promise<boolean | null> {
  const { data, error } = await storage.exists(path);
  return error ? null : data;
}

async function getOriginalInfo(
  storage: PrivatePreviewBucket,
  path: string,
): Promise<{ size: number; mimeType: string } | null> {
  const { data, error } = await storage.info(path);
  if (error || !data) return null;

  const size = Number(data.size);
  const mimeType =
    typeof data.contentType === "string"
      ? data.contentType.split(";", 1)[0].trim().toLowerCase()
      : "";
  if (!Number.isSafeInteger(size) || !mimeType) return null;
  return { size, mimeType };
}
