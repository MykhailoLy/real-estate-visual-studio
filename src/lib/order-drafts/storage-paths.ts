import { ORDER_FILES_BUCKET } from "../upload-config.ts";
import { UuidSchema } from "./schema.ts";

export { ORDER_FILES_BUCKET };

const MAX_FILENAME_LENGTH = 100;

export interface BuildOrderDraftFilePathInput {
  userId: string;
  draftId: string;
  fileId: string;
  originalFilename: string;
}

function splitNameAndExtension(filename: string): {
  base: string;
  extension: string;
} {
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
    extension: extension.toLowerCase(),
  };
}

function sanitizePart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/_+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "");
}

export function sanitizeOrderDraftFilename(originalFilename: string): string {
  const leafName = originalFilename
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/^.*[\\/]/, "")
    .trim();

  const { base, extension } = splitNameAndExtension(leafName);
  const safeBase = sanitizePart(base) || "file";
  const suffix = extension ? `.${extension}` : "";
  const maxBaseLength = Math.max(1, MAX_FILENAME_LENGTH - suffix.length);
  const cappedBase = safeBase.slice(0, maxBaseLength).replace(/[._-]+$/g, "") || "file";

  return `${cappedBase}${suffix}`;
}

export function buildOrderDraftFilePath({
  userId,
  draftId,
  fileId,
  originalFilename,
}: BuildOrderDraftFilePathInput): string {
  const parsedUserId = UuidSchema.parse(userId);
  const parsedDraftId = UuidSchema.parse(draftId);
  const parsedFileId = UuidSchema.parse(fileId);
  const sanitizedFilename = sanitizeOrderDraftFilename(originalFilename);

  return `drafts/${parsedUserId}/${parsedDraftId}/${parsedFileId}/${sanitizedFilename}`;
}
