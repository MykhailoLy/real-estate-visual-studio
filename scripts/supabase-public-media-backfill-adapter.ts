import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PORTFOLIO_IMAGE_COLUMNS,
  SITE_MEDIA_REFERENCE_COLUMNS,
  isPublicMediaBucket,
  type ApplyRepository,
  type BackfillCandidate,
  type BackfillTable,
  type CleanupReportRepository,
  type DiscoveryRepository,
  type ExistingReference,
  type PublicImageReference,
  type PublicMediaBucket,
  type ReferenceReadResult,
  type StorageObjectInfo,
} from "./public-media-backfill-core.ts";

const PAGE_SIZE = 500;

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  return record.status === 404 || record.statusCode === "404";
}

function rowRecord(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${context} returned an invalid row.`);
  }
  return value as Record<string, unknown>;
}

function assertAllowedBucket(bucket: string): asserts bucket is PublicMediaBucket {
  if (!isPublicMediaBucket(bucket)) {
    throw new Error(`Backfill adapter rejected out-of-scope bucket ${bucket}.`);
  }
}

async function fetchAllRows(
  client: SupabaseClient,
  table: BackfillTable,
  columns: string,
): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`Could not read ${table}: ${errorMessage(error)}`);
    }
    const page = (data ?? []) as unknown[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export async function readExactReference(
  client: SupabaseClient,
  reference: PublicImageReference,
): Promise<ReferenceReadResult> {
  const { data, error } = await client
    .from(reference.table)
    .select(`id,${reference.column}`)
    .eq("id", reference.rowId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `Could not re-read ${reference.table}.${reference.column}: ${errorMessage(error)}`,
    );
  }
  if (!data) return { rowExists: false, value: null };

  const row = rowRecord(data, "Reference re-read");
  const value = row[reference.column];
  if (value !== null && typeof value !== "string") {
    throw new Error(
      `${reference.table}.${reference.column} returned an invalid path value.`,
    );
  }
  return { rowExists: true, value };
}

/**
 * Replace exactly one row and one column, guarded by both the row id and the
 * old path. A null result means the optimistic guard found a concurrent edit.
 */
export async function guardedReplaceExactReference(
  client: SupabaseClient,
  reference: PublicImageReference,
  newPath: string,
): Promise<"updated" | "conflict"> {
  const { data, error } = await client
    .from(reference.table)
    .update({ [reference.column]: newPath })
    .eq("id", reference.rowId)
    .eq(reference.column, reference.path)
    .select(`id,${reference.column}`)
    .maybeSingle();
  if (error) {
    throw new Error(
      `Guarded update failed for ${reference.table}.${reference.column}: ${errorMessage(error)}`,
    );
  }
  return data ? "updated" : "conflict";
}

async function getStorageObjectInfo(
  client: SupabaseClient,
  bucket: PublicMediaBucket,
  path: string,
): Promise<StorageObjectInfo | null> {
  assertAllowedBucket(bucket);
  const { data, error } = await client.storage.from(bucket).info(path);
  if (error) {
    if (isNotFoundError(error)) return null;
    throw new Error(
      `Could not inspect ${bucket}/${path}: ${errorMessage(error)}`,
    );
  }
  if (!data) return null;

  const size = data.size;
  const mimeType = data.contentType;
  if (!Number.isSafeInteger(size) || typeof size !== "number" || size < 0) {
    throw new Error(`Storage returned an invalid size for ${bucket}/${path}.`);
  }
  if (typeof mimeType !== "string" || mimeType.trim() === "") {
    throw new Error(`Storage returned no MIME type for ${bucket}/${path}.`);
  }
  return { size, mimeType };
}

async function findReferences(
  client: SupabaseClient,
  bucket: PublicMediaBucket,
  path: string,
): Promise<ExistingReference[]> {
  assertAllowedBucket(bucket);
  const table: BackfillTable =
    bucket === "site-media" ? "site_media_items" : "portfolio_items";
  const columns =
    bucket === "site-media"
      ? SITE_MEDIA_REFERENCE_COLUMNS
      : PORTFOLIO_IMAGE_COLUMNS;
  const references: ExistingReference[] = [];

  for (const column of columns) {
    const { data, error } = await client
      .from(table)
      .select("id")
      .eq(column, path);
    if (error) {
      throw new Error(
        `Could not verify references in ${table}.${column}: ${errorMessage(error)}`,
      );
    }
    for (const value of data ?? []) {
      const row = rowRecord(value, "Cleanup reference query");
      if (typeof row.id !== "string" || row.id.trim() === "") {
        throw new Error(`Cleanup reference query returned an invalid ${table} id.`);
      }
      references.push({ table, rowId: row.id, column });
    }
  }

  return references;
}

export type SupabasePublicMediaBackfillRepository = DiscoveryRepository &
  ApplyRepository &
  CleanupReportRepository;

export function createSupabasePublicMediaBackfillRepository(
  client: SupabaseClient,
): SupabasePublicMediaBackfillRepository {
  return {
    listSiteMediaRows: () =>
      fetchAllRows(
        client,
        "site_media_items",
        "id,section,media_type,title,service_slug,before_image_path,after_image_path,image_path,poster_image_path",
      ),
    listPortfolioRows: () =>
      fetchAllRows(
        client,
        "portfolio_items",
        "id,service_slug,title,before_image_path,after_image_path",
      ),
    getStorageObjectInfo: (bucket, path) =>
      getStorageObjectInfo(client, bucket, path),
    readReference: (reference) => readExactReference(client, reference),
    downloadObject: async (bucket, path) => {
      assertAllowedBucket(bucket);
      const { data, error } = await client.storage.from(bucket).download(path);
      if (error || !data) {
        throw new Error(
          `Could not download ${bucket}/${path}: ${errorMessage(error)}`,
        );
      }
      return new Uint8Array(await data.arrayBuffer());
    },
    uploadObject: async (bucket, path, bytes, options) => {
      assertAllowedBucket(bucket);
      const { error } = await client.storage.from(bucket).upload(path, bytes, {
        contentType: options.contentType,
        cacheControl: options.cacheControl,
        upsert: options.upsert,
      });
      if (error) {
        throw new Error(
          `Could not upload ${bucket}/${path}: ${errorMessage(error)}`,
        );
      }
    },
    guardedReplaceReference: (reference, newPath) =>
      guardedReplaceExactReference(client, reference, newPath),
    findReferences: (bucket, path) => findReferences(client, bucket, path),
  };
}

export function candidateAuditKey(candidate: BackfillCandidate): string {
  return [candidate.table, candidate.rowId, candidate.column, candidate.path].join(
    ":",
  );
}
