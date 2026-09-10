import "server-only";
import { zipSync } from "fflate";

export const MAX_ZIP_FILES = 100;
export const MAX_ZIP_TOTAL_BYTES = 250 * 1024 * 1024;

export interface ZipSourceFile {
  path: string;
  data: Uint8Array;
}

export function safeZipFilename(filename: unknown): string {
  const cleaned = (typeof filename === "string" ? filename : "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/[\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned === "." || cleaned === "..") return "file";
  return cleaned.slice(0, 160);
}

export function imageFolder(itemIndex: number | null): string {
  return itemIndex === null
    ? "Order-level"
    : `Image-${String(itemIndex + 1).padStart(2, "0")}`;
}

export function withFilenameSuffix(filename: string, suffix: number): string {
  const safe = safeZipFilename(filename);
  const dot = safe.lastIndexOf(".");
  if (dot <= 0) return `${safe}-${suffix}`;
  return `${safe.slice(0, dot)}-${suffix}${safe.slice(dot)}`;
}

export function uniqueZipPath(path: string, usedPaths: Set<string>): string {
  const parts = path.split("/");
  const filename = parts.pop() ?? "file";
  const folder = parts.length > 0 ? `${parts.join("/")}/` : "";
  let candidate = `${folder}${safeZipFilename(filename)}`;
  let suffix = 2;

  while (usedPaths.has(candidate.toLowerCase())) {
    candidate = `${folder}${withFilenameSuffix(filename, suffix)}`;
    suffix += 1;
  }

  usedPaths.add(candidate.toLowerCase());
  return candidate;
}

export function assertZipLimits(files: Array<{ sizeBytes?: number | null }>) {
  if (files.length === 0) {
    return { ok: false as const, status: 404, error: "No files found." };
  }

  if (files.length > MAX_ZIP_FILES) {
    return {
      ok: false as const,
      status: 413,
      error: `Too many files for one ZIP. Maximum is ${MAX_ZIP_FILES}.`,
    };
  }

  const knownTotal = files.reduce((sum, file) => sum + (file.sizeBytes ?? 0), 0);
  if (knownTotal > MAX_ZIP_TOTAL_BYTES) {
    return {
      ok: false as const,
      status: 413,
      error: "Files are too large for one ZIP. Maximum total size is 250 MB.",
    };
  }

  return { ok: true as const };
}

export function createZipResponse(
  archiveFilename: string,
  files: ZipSourceFile[]
): Response {
  const zipEntries: Record<string, Uint8Array> = {};
  let totalBytes = 0;

  for (const file of files) {
    totalBytes += file.data.byteLength;
    if (totalBytes > MAX_ZIP_TOTAL_BYTES) {
      return Response.json(
        { error: "Files are too large for one ZIP. Maximum total size is 250 MB." },
        { status: 413 }
      );
    }
    zipEntries[file.path] = file.data;
  }

  const zipped = zipSync(zipEntries, { level: 0 });
  return new Response(zipped, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeZipFilename(archiveFilename)}"`,
      "Cache-Control": "no-store",
    },
  });
}
