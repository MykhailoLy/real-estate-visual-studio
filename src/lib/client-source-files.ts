import "server-only";
import { createServerClient } from "@/lib/supabase";
import { isOrderOwned, type OrderOwnership } from "@/lib/order-ownership";

export type ClientSourceFileKind = "original" | "reference";

export interface ClientSourceFile {
  id: string;
  orderItemId: string;
  kind: ClientSourceFileKind;
  itemIndex: number;
  filename: string;
  fileSize: number | null;
  mimeType: string | null;
}

export interface ClientSourceFileSlot {
  kind: ClientSourceFileKind;
  storagePath: string | null;
  filename: string;
  fileSize: number | null;
  mimeType: string | null;
}

export interface ClientOrderItemSourceFileRow {
  id: string;
  item_index: number;
  original_photo_path: string | null;
  reference_image_path: string | null;
  details: Record<string, unknown> | null;
}

export interface ClientNormalizedReferenceRow {
  order_item_id: string;
  reference_id: string;
  position: number;
  original_filename: string;
  file_size: number;
  mime_type: string;
}

const SOURCE_FILE_ID_RE =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(original|reference)(?:-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}))?$/i;

export function makeClientSourceFileId(
  orderItemId: string,
  kind: ClientSourceFileKind
): string {
  return `${orderItemId}-${kind}`;
}

export function parseClientSourceFileId(
  fileId: string
): { orderItemId: string; kind: ClientSourceFileKind; referenceId: string | null } | null {
  const match = SOURCE_FILE_ID_RE.exec(fileId);
  if (!match) return null;
  return {
    orderItemId: match[1],
    kind: match[2] as ClientSourceFileKind,
    referenceId: match[3] ?? null,
  };
}

export function buildClientSourceFiles(
  rows: ClientOrderItemSourceFileRow[]
): ClientSourceFile[] {
  return rows.flatMap((row) => {
    const files: ClientSourceFile[] = [];
    for (const kind of ["original", "reference"] as const) {
      const slot = getClientSourceFileSlot(row, kind);
      if (!slot.storagePath) continue;
      files.push({
        id: makeClientSourceFileId(row.id, kind),
        orderItemId: row.id,
        kind,
        itemIndex: row.item_index,
        filename: slot.filename,
        fileSize: slot.fileSize,
        mimeType: slot.mimeType,
      });
    }
    return files;
  });
}

export function getClientSourceFileSlot(
  row: ClientOrderItemSourceFileRow,
  kind: ClientSourceFileKind
): ClientSourceFileSlot {
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

export async function getClientSourceFilesForOrder(
  orderId: string,
  ownership: OrderOwnership
): Promise<ClientSourceFile[]> {
  if (!orderId || !ownership?.userId || !ownership?.email) return [];

  let supabase;
  try {
    supabase = createServerClient();
  } catch (err) {
    console.warn("[client-source-files] Supabase init:", err);
    return [];
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, user_id, client_email, account_deleted_at")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr) {
    console.error("[client-source-files] Order lookup:", orderErr.message);
    return [];
  }
  if (!order) return [];
  // Ownership check — user_id, or legacy NULL+email.
  if (!isOrderOwned(order as { user_id: string | null; client_email: string | null }, ownership)) {
    return [];
  }

  const { data: items, error: itemErr } = await supabase
    .from("order_items")
    .select("id, item_index, original_photo_path, reference_image_path, details")
    .eq("order_id", orderId)
    .order("item_index", { ascending: true });

  if (itemErr) {
    console.error("[client-source-files] Item lookup:", itemErr.message);
    return [];
  }
  const typedItems = (items ?? []) as unknown as ClientOrderItemSourceFileRow[];
  const itemIds = typedItems.map((item) => item.id);
  const { data: normalized, error: referenceErr } = itemIds.length > 0
    ? await supabase
        .from("order_item_reference_files")
        .select("order_item_id, reference_id, position, original_filename, file_size, mime_type")
        .in("order_item_id", itemIds)
        .order("position")
    : { data: [], error: null };
  if (referenceErr) {
    console.warn("[client-source-files] Reference lookup:", referenceErr.message);
  }
  const normalizedRows = (normalized ?? []) as ClientNormalizedReferenceRow[];
  const normalizedItemIds = new Set(normalizedRows.map((row) => row.order_item_id));
  const legacy = buildClientSourceFiles(typedItems).filter(
    (file) => file.kind === "original" || !normalizedItemIds.has(file.orderItemId),
  );
  const itemIndexById = new Map(typedItems.map((item) => [item.id, item.item_index]));
  const references: ClientSourceFile[] = normalizedRows.map((row) => ({
    id: `${row.order_item_id}-reference-${row.reference_id}`,
    orderItemId: row.order_item_id,
    kind: "reference",
    itemIndex: itemIndexById.get(row.order_item_id) ?? 0,
    filename: row.original_filename,
    fileSize: row.file_size,
    mimeType: row.mime_type,
  }));
  return [...legacy, ...references];
}

function getUploadedFileMetadata(
  details: Record<string, unknown> | null,
  kind: ClientSourceFileKind
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
  kind: ClientSourceFileKind,
  storagePath: string | null
): string {
  const extension = storagePath?.split(".").pop()?.replace(/[^A-Za-z0-9]/g, "");
  const suffix = extension ? `.${extension}` : "";
  return `image-${itemIndex + 1}-${kind}${suffix}`;
}
