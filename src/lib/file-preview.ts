export type FilePreviewKind = "image" | "pdf" | "unsupported";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

export function getFileExtensionFromName(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

export function getFilePreviewKind(
  filename: string,
  mimeType?: string | null
): FilePreviewKind {
  const mime = mimeType?.toLowerCase() ?? "";
  const ext = getFileExtensionFromName(filename);

  if (
    ["image/jpeg", "image/png", "image/webp"].includes(mime) ||
    IMAGE_EXTENSIONS.has(ext)
  ) {
    return "image";
  }

  if (mime === "application/pdf" || ext === "pdf") {
    return "pdf";
  }

  return "unsupported";
}

export function getFileTypeLabel(filename: string, mimeType?: string | null): string {
  const previewKind = getFilePreviewKind(filename, mimeType);
  if (previewKind === "image") return "Image";
  if (previewKind === "pdf") return "PDF";

  const ext = getFileExtensionFromName(filename);
  if (ext === "zip") return "ZIP";
  if (ext) return ext.toUpperCase();
  return "File";
}
