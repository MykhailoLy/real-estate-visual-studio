import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getOrCreatePrivateImagePreview,
  inspectPrivateImagePreview,
  type PrivateImagePreviewCandidate,
} from "../src/lib/private-image-preview.ts";

// Dry run (default, aggregate counts only):
// node --conditions=react-server --experimental-strip-types scripts/backfill-private-image-previews.ts --dry-run
// Apply additionally requires PRIVATE_IMAGE_PREVIEW_BACKFILL_CONFIRM=YES.

type BackfillMode = "dry-run" | "apply";
type CandidateKind = "source" | "deliverable";

interface BackfillCandidate extends PrivateImagePreviewCandidate {
  bucket: "order-files" | "deliverables";
  kind: CandidateKind;
}

interface BackfillCounts {
  eligibleSourceImages: number;
  eligibleDeliverables: number;
  existingPreviews: number;
  missingPreviews: number;
  skippedFiles: number;
  failedCandidates: number;
  createdPreviews: number;
}

const PAGE_SIZE = 500;
const APPLY_CONFIRMATION_ENV = "PRIVATE_IMAGE_PREVIEW_BACKFILL_CONFIRM";

export function parsePrivatePreviewBackfillMode(args: readonly string[]): BackfillMode {
  if (args.length === 0 || (args.length === 1 && args[0] === "--dry-run")) {
    return "dry-run";
  }
  if (args.length === 1 && args[0] === "--apply") return "apply";
  throw new Error("Choose exactly one mode: --dry-run or --apply.");
}

async function fetchAllRows(
  client: SupabaseClient,
  table: "order_items" | "order_item_reference_files" | "order_deliverables",
  columns: string,
  orderColumn: string,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order(orderColumn, { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not read ${table}: ${error.message}`);
    const page = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function discoverCandidates(client: SupabaseClient): Promise<BackfillCandidate[]> {
  const [items, references, deliverables] = await Promise.all([
    fetchAllRows(
      client,
      "order_items",
      "id, original_photo_path, reference_image_path, details",
      "id",
    ),
    fetchAllRows(
      client,
      "order_item_reference_files",
      "order_item_id, reference_id, storage_path, original_filename, file_size, mime_type",
      "order_item_id",
    ),
    fetchAllRows(
      client,
      "order_deliverables",
      "id, storage_path, filename, file_size, mime_type",
      "id",
    ),
  ]);

  const candidates = new Map<string, BackfillCandidate>();
  const add = (candidate: BackfillCandidate) => {
    if (typeof candidate.storagePath !== "string" || !candidate.storagePath) return;
    candidates.set(`${candidate.bucket}:${candidate.storagePath}`, candidate);
  };

  for (const row of items) {
    for (const kind of ["original", "reference"] as const) {
      const storagePath =
        row[kind === "original" ? "original_photo_path" : "reference_image_path"];
      if (typeof storagePath !== "string" || !storagePath) continue;
      const metadata = uploadedFileMetadata(row.details, kind);
      add({
        bucket: "order-files",
        kind: "source",
        storagePath,
        filename: metadata.filename ?? storageFilename(storagePath),
        fileSize: metadata.fileSize,
        mimeType: metadata.mimeType,
      });
    }
  }

  for (const row of references) {
    const storagePath = stringValue(row.storage_path);
    if (!storagePath) continue;
    add({
      bucket: "order-files",
      kind: "source",
      storagePath,
      filename: stringValue(row.original_filename) ?? storageFilename(storagePath),
      fileSize: numberValue(row.file_size),
      mimeType: stringValue(row.mime_type),
    });
  }

  for (const row of deliverables) {
    const storagePath = stringValue(row.storage_path);
    if (!storagePath) continue;
    add({
      bucket: "deliverables",
      kind: "deliverable",
      storagePath,
      filename: stringValue(row.filename) ?? storageFilename(storagePath),
      fileSize: numberValue(row.file_size),
      mimeType: stringValue(row.mime_type),
    });
  }

  return [...candidates.values()];
}

export async function runPrivatePreviewBackfill(
  client: SupabaseClient,
  mode: BackfillMode,
): Promise<BackfillCounts> {
  const counts: BackfillCounts = {
    eligibleSourceImages: 0,
    eligibleDeliverables: 0,
    existingPreviews: 0,
    missingPreviews: 0,
    skippedFiles: 0,
    failedCandidates: 0,
    createdPreviews: 0,
  };

  for (const candidate of await discoverCandidates(client)) {
    const inspection = await inspectPrivateImagePreview(
      client,
      candidate.bucket,
      candidate,
    );
    if (inspection.status === "skipped") {
      counts.skippedFiles += 1;
      continue;
    }
    if (inspection.status === "failed") {
      counts.failedCandidates += 1;
      continue;
    }

    if (candidate.kind === "source") counts.eligibleSourceImages += 1;
    else counts.eligibleDeliverables += 1;

    if (inspection.status === "existing") {
      counts.existingPreviews += 1;
      continue;
    }

    counts.missingPreviews += 1;
    if (mode === "apply") {
      const previewPath = await getOrCreatePrivateImagePreview(
        client,
        candidate.bucket,
        candidate,
      );
      if (previewPath) counts.createdPreviews += 1;
      else counts.failedCandidates += 1;
    }
  }

  return counts;
}

function uploadedFileMetadata(
  details: unknown,
  kind: "original" | "reference",
): { filename: string | null; fileSize: number | null; mimeType: string | null } {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return { filename: null, fileSize: null, mimeType: null };
  }
  const uploaded = (details as Record<string, unknown>).uploaded_files;
  if (!uploaded || typeof uploaded !== "object" || Array.isArray(uploaded)) {
    return { filename: null, fileSize: null, mimeType: null };
  }
  const slot = (uploaded as Record<string, unknown>)[kind];
  if (!slot || typeof slot !== "object" || Array.isArray(slot)) {
    return { filename: null, fileSize: null, mimeType: null };
  }
  const record = slot as Record<string, unknown>;
  return {
    filename: stringValue(record.original_filename),
    fileSize: numberValue(record.size_bytes),
    mimeType: stringValue(record.mime_type),
  };
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function storageFilename(storagePath: string): string {
  return storagePath.split("/").at(-1) ?? storagePath;
}

function printCounts(counts: BackfillCounts, mode: BackfillMode): void {
  const rows = [
    { metric: "eligible source images", count: counts.eligibleSourceImages },
    { metric: "eligible deliverables", count: counts.eligibleDeliverables },
    { metric: "existing previews", count: counts.existingPreviews },
    { metric: "missing previews", count: counts.missingPreviews },
    { metric: "skipped files", count: counts.skippedFiles },
    { metric: "failed candidates", count: counts.failedCandidates },
  ];
  if (mode === "apply") {
    rows.push({ metric: "created previews", count: counts.createdPreviews });
  }
  console.table(rows);
}

async function main(): Promise<void> {
  const mode = parsePrivatePreviewBackfillMode(process.argv.slice(2));
  if (mode === "apply" && process.env[APPLY_CONFIRMATION_ENV] !== "YES") {
    throw new Error(
      `Apply is locked. Set ${APPLY_CONFIRMATION_ENV}=YES only after explicit production approval.`,
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase server configuration.");
  }
  const client = createClient(url, serviceKey, { auth: { persistSession: false } });
  printCounts(await runPrivatePreviewBackfill(client, mode), mode);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Backfill failed.");
    process.exitCode = 1;
  });
}
