import "server-only";
import { createHash } from "node:crypto";

export const PRIVATE_IMAGE_PREVIEW_VERSION = "v1";

const PRIVATE_IMAGE_PREVIEW_PREFIX = `_previews/${PRIVATE_IMAGE_PREVIEW_VERSION}`;

/** Returns a fixed-length opaque key without exposing original path fragments. */
export function getPrivateImagePreviewPath(storagePath: string): string | null {
  if (!isSafeOriginalStoragePath(storagePath)) return null;
  const digest = createHash("sha256")
    .update(storagePath, "utf8")
    .digest("base64url");
  return `${PRIVATE_IMAGE_PREVIEW_PREFIX}/${digest}.webp`;
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
