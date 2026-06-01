import "server-only";

export type AdminSourceFileKind = "original" | "reference";

export interface AdminSourceFile {
  id: string;
  orderItemId: string;
  kind: AdminSourceFileKind;
  itemIndex: number;
  filename: string;
  fileSize: number | null;
  mimeType: string | null;
  uploadedAt: string | null;
}

export interface AdminSourceFileSlot {
  kind: AdminSourceFileKind;
  storagePath: string | null;
  filename: string;
  fileSize: number | null;
  mimeType: string | null;
}

export interface OrderItemSourceFileRow {
  id: string;
  item_index: number;
  original_photo_path: string | null;
  reference_image_path: string | null;
  details: Record<string, unknown> | null;
  created_at: string | null;
}

const SOURCE_FILE_ID_RE =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(original|reference)$/i;

export function makeAdminSourceFileId(
  orderItemId: string,
  kind: AdminSourceFileKind
): string {
  return `${orderItemId}-${kind}`;
}

export function parseAdminSourceFileId(
  fileId: string
): { orderItemId: string; kind: AdminSourceFileKind } | null {
  const match = SOURCE_FILE_ID_RE.exec(fileId);
  if (!match) return null;
  return {
    orderItemId: match[1],
    kind: match[2] as AdminSourceFileKind,
  };
}

export function buildAdminSourceFiles(
  rows: OrderItemSourceFileRow[]
): AdminSourceFile[] {
  return rows.flatMap((row) => {
    const files: AdminSourceFile[] = [];
    for (const kind of ["original", "reference"] as const) {
      const slot = getAdminSourceFileSlot(row, kind);
      if (!slot.storagePath) continue;
      files.push({
        id: makeAdminSourceFileId(row.id, kind),
        orderItemId: row.id,
        kind,
        itemIndex: row.item_index,
        filename: slot.filename,
        fileSize: slot.fileSize,
        mimeType: slot.mimeType,
        uploadedAt: row.created_at,
      });
    }
    return files;
  });
}

export function getAdminSourceFileSlot(
  row: OrderItemSourceFileRow,
  kind: AdminSourceFileKind
): AdminSourceFileSlot {
  const storagePath =
    kind === "original" ? row.original_photo_path : row.reference_image_path;
  const metadata = getUploadedFileMetadata(row.details, kind);

  return {
    kind,
    storagePath,
    filename:
      metadata?.original_filename ||
      fallbackFilename(row.item_index, kind, storagePath),
    fileSize: metadata?.size_bytes ?? null,
    mimeType: metadata?.mime_type ?? null,
  };
}

function getUploadedFileMetadata(
  details: Record<string, unknown> | null,
  kind: AdminSourceFileKind
): { original_filename?: string; size_bytes?: number; mime_type?: string } | null {
  const uploaded = details?.uploaded_files;
  if (!uploaded || typeof uploaded !== "object") return null;

  const slot = (uploaded as Record<string, unknown>)[kind];
  if (!slot || typeof slot !== "object") return null;

  const data = slot as Record<string, unknown>;
  return {
    original_filename:
      typeof data.original_filename === "string"
        ? data.original_filename
        : undefined,
    size_bytes:
      typeof data.size_bytes === "number" && Number.isFinite(data.size_bytes)
        ? data.size_bytes
        : undefined,
    mime_type:
      typeof data.mime_type === "string" ? data.mime_type : undefined,
  };
}

function fallbackFilename(
  itemIndex: number,
  kind: AdminSourceFileKind,
  storagePath: string | null
): string {
  const extension = storagePath?.split(".").pop()?.replace(/[^A-Za-z0-9]/g, "");
  const suffix = extension ? `.${extension}` : "";
  return `image-${itemIndex + 1}-${kind}${suffix}`;
}
