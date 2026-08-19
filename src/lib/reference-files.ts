export const MAX_REFERENCE_FILES = 10;
export const MAX_REFERENCE_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_REFERENCE_TOTAL_SIZE_BYTES = 100 * 1024 * 1024;

export const REFERENCE_FILE_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf";

export const REFERENCE_FILE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const REFERENCE_FILE_ERRORS = {
  count: "You can upload up to 10 reference files.",
  size: "Each reference file must be 20 MB or smaller.",
  total: "Reference files may total up to 100 MB.",
  type: "Supported reference formats are JPG, JPEG, PNG, WebP and PDF.",
  duplicate: "That reference file has already been added.",
} as const;

export interface ReferenceFileValue {
  id: string;
  file: File | null;
  filename: string;
  fileSize: number;
  mimeType: string;
  lastModified: number | null;
  previewUrl?: string | null;
  previewExpiresAt?: string | null;
  storagePath?: string | null;
  draftFileId?: string | null;
}

export interface ReferenceFileCandidate {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

export interface ReferenceSelectionResult {
  accepted: ReferenceFileValue[];
  errors: string[];
}

function createReferenceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

export function referenceFileIdentity(
  value: Pick<
    ReferenceFileValue,
    "filename" | "fileSize" | "mimeType" | "lastModified"
  >,
): string {
  return [
    value.filename.toLowerCase(),
    value.fileSize,
    value.mimeType.toLowerCase(),
    value.lastModified ?? "persisted",
  ].join("|");
}

export function referenceCandidateIdentity(
  file: ReferenceFileCandidate,
): string {
  return [
    file.name.toLowerCase(),
    file.size,
    file.type.toLowerCase(),
    file.lastModified,
  ].join("|");
}

export function isSupportedReferenceFile(
  file: Pick<ReferenceFileCandidate, "name" | "type">,
): boolean {
  const type = file.type.toLowerCase();
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const validExtension = ["jpg", "jpeg", "png", "webp", "pdf"].includes(
    extension,
  );
  return (
    validExtension &&
    (REFERENCE_FILE_MIME_TYPES as readonly string[]).includes(type)
  );
}

export function appendReferenceFiles(
  existing: ReferenceFileValue[],
  candidates: File[],
): ReferenceSelectionResult {
  const accepted = [...existing];
  const errors = new Set<string>();
  const identities = new Set(existing.map(referenceFileIdentity));
  let total = existing.reduce((sum, item) => sum + item.fileSize, 0);

  for (const file of candidates) {
    if (!isSupportedReferenceFile(file)) {
      errors.add(REFERENCE_FILE_ERRORS.type);
      continue;
    }
    if (file.size > MAX_REFERENCE_FILE_SIZE_BYTES) {
      errors.add(REFERENCE_FILE_ERRORS.size);
      continue;
    }
    const identity = referenceCandidateIdentity(file);
    if (identities.has(identity)) {
      errors.add(REFERENCE_FILE_ERRORS.duplicate);
      continue;
    }
    if (accepted.length >= MAX_REFERENCE_FILES) {
      errors.add(REFERENCE_FILE_ERRORS.count);
      continue;
    }
    if (total + file.size > MAX_REFERENCE_TOTAL_SIZE_BYTES) {
      errors.add(REFERENCE_FILE_ERRORS.total);
      continue;
    }

    accepted.push({
      id: createReferenceId(),
      file,
      filename: file.name,
      fileSize: file.size,
      mimeType: file.type,
      lastModified: file.lastModified,
    });
    identities.add(identity);
    total += file.size;
  }

  return { accepted, errors: [...errors] };
}

export function referenceFilesTotalSize(files: ReferenceFileValue[]): number {
  return files.reduce((sum, file) => sum + file.fileSize, 0);
}

export function validateReferenceFiles(
  files: Array<Pick<ReferenceFileValue, "filename" | "fileSize" | "mimeType">>,
): string[] {
  const errors = new Set<string>();
  if (files.length > MAX_REFERENCE_FILES) errors.add(REFERENCE_FILE_ERRORS.count);
  let total = 0;
  for (const file of files) {
    total += file.fileSize;
    if (file.fileSize > MAX_REFERENCE_FILE_SIZE_BYTES) {
      errors.add(REFERENCE_FILE_ERRORS.size);
    }
    if (!isSupportedReferenceFile({ name: file.filename, type: file.mimeType })) {
      errors.add(REFERENCE_FILE_ERRORS.type);
    }
  }
  if (total > MAX_REFERENCE_TOTAL_SIZE_BYTES) {
    errors.add(REFERENCE_FILE_ERRORS.total);
  }
  return [...errors];
}

export function mergeReferenceFiles(
  primary: ReferenceFileValue[],
  legacy: ReferenceFileValue[],
): ReferenceFileValue[] {
  const result: ReferenceFileValue[] = [];
  const ids = new Set<string>();
  const paths = new Set<string>();

  for (const file of [...primary, ...legacy]) {
    const path = file.storagePath?.trim() ?? "";
    if (ids.has(file.id) || (path && paths.has(path))) continue;
    result.push(file);
    ids.add(file.id);
    if (path) paths.add(path);
  }
  return result.slice(0, MAX_REFERENCE_FILES);
}

export function normalizeReferenceLink(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function formatReferenceFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function isImageReference(file: Pick<ReferenceFileValue, "mimeType">) {
  return file.mimeType.startsWith("image/");
}
