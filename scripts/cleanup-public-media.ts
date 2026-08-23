import { createHash, randomUUID } from "node:crypto";
import { access, open, readFile, rename } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  PORTFOLIO_IMAGE_COLUMNS,
  SITE_MEDIA_IMAGE_COLUMNS,
  assertUnambiguousObjectPath,
  isBackfillGeneratedPath,
  isPublicMediaBucket,
  type PublicMediaBucket,
} from "./public-media-backfill-core.ts";
import {
  applyCleanupDeleteRecords,
  cleanupRecordKey,
  inspectCleanupDeleteRecords,
  validateCleanupDeleteRecord,
  type CleanupDeleteRecord,
  type CleanupDeleteRepository,
  type CleanupInspection,
  type CleanupJournalState,
} from "./public-media-cleanup-core.ts";
import { createSupabasePublicMediaBackfillRepository } from "./supabase-public-media-backfill-adapter.ts";

type CleanupCliMode = "dry-run" | "apply" | "help";

interface CleanupCliOptions {
  mode: CleanupCliMode;
  manifestPath: string | null;
  journalPath: string | null;
}

interface BackfillManifestEntry {
  attemptId: string;
  candidateKey?: string;
  table: string;
  rowId: string;
  column: string;
  bucket: string;
  oldPath: string;
  newPath: string;
  originalBytes: number;
  optimizedBytes: number | null;
  status: string;
  message: string;
  updatedAt: string;
}

interface BackfillManifest {
  version: 1;
  projectUrl: string;
  createdAt: string;
  updatedAt: string;
  entries: BackfillManifestEntry[];
}

type CleanupJournalEntryStatus = "deleting" | "deleted";

interface CleanupJournalEntry extends CleanupDeleteRecord {
  key: string;
  status: CleanupJournalEntryStatus;
  updatedAt: string;
}

interface CleanupJournal {
  version: 1;
  projectUrl: string;
  sourceManifestFingerprint: string;
  createdAt: string;
  updatedAt: string;
  entries: CleanupJournalEntry[];
}

function usage(): string {
  return [
    "Legacy public image cleanup",
    "",
    "Read-only dry run (default):",
    "  npm run media:cleanup:dry-run -- --manifest <backfill-manifest.json>",
    "",
    "Delete old objects (requires PUBLIC_MEDIA_CLEANUP_CONFIRM=YES):",
    "  npm run media:cleanup:apply -- --manifest <backfill-manifest.json> --journal <cleanup-journal.json>",
    "",
    "Only old objects in site-media and portfolio from successful migrated entries are eligible.",
  ].join("\n");
}

function valueAfter(
  args: readonly string[],
  index: number,
  flag: string,
): { value: string; consumed: number } {
  if (args[index].startsWith(`${flag}=`)) {
    const value = args[index].slice(flag.length + 1);
    if (!value) throw new Error(`${flag} requires a non-empty path.`);
    return { value, consumed: 0 };
  }
  const next = args[index + 1];
  if (!next || next.startsWith("--")) {
    throw new Error(`${flag} requires a path argument.`);
  }
  return { value: next, consumed: 1 };
}

export function parseCleanupCliOptions(args: readonly string[]): CleanupCliOptions {
  let mode: CleanupCliMode = "dry-run";
  let explicitMode = false;
  let manifestPath: string | null = null;
  let journalPath: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      mode = "help";
      explicitMode = true;
      continue;
    }
    if (arg === "--dry-run" || arg === "--apply") {
      const requested: CleanupCliMode = arg === "--apply" ? "apply" : "dry-run";
      if (explicitMode && mode !== requested) {
        throw new Error("Choose exactly one cleanup mode.");
      }
      mode = requested;
      explicitMode = true;
      continue;
    }
    if (arg === "--manifest" || arg.startsWith("--manifest=")) {
      const parsed = valueAfter(args, index, "--manifest");
      manifestPath = parsed.value;
      index += parsed.consumed;
      continue;
    }
    if (arg === "--journal" || arg.startsWith("--journal=")) {
      const parsed = valueAfter(args, index, "--journal");
      journalPath = parsed.value;
      index += parsed.consumed;
      continue;
    }
    throw new Error(`Unknown cleanup argument: ${arg}`);
  }

  if (mode !== "help" && !manifestPath) {
    throw new Error("Cleanup requires --manifest <backfill-manifest.json>.");
  }
  if (mode === "apply" && !journalPath) {
    throw new Error("Cleanup apply requires --journal <cleanup-journal.json>.");
  }
  return { mode, manifestPath, journalPath };
}

function projectUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  return new URL(raw).origin;
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function isBackfillManifestEntry(value: unknown): value is BackfillManifestEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.attemptId === "string" &&
    (entry.candidateKey === undefined || typeof entry.candidateKey === "string") &&
    typeof entry.table === "string" &&
    typeof entry.rowId === "string" &&
    typeof entry.column === "string" &&
    typeof entry.bucket === "string" &&
    typeof entry.oldPath === "string" &&
    typeof entry.newPath === "string" &&
    typeof entry.originalBytes === "number" &&
    Number.isSafeInteger(entry.originalBytes) &&
    entry.originalBytes >= 0 &&
    (entry.optimizedBytes === null ||
      (typeof entry.optimizedBytes === "number" &&
        Number.isSafeInteger(entry.optimizedBytes) &&
        entry.optimizedBytes > 0)) &&
    typeof entry.status === "string" &&
    typeof entry.message === "string" &&
    typeof entry.updatedAt === "string"
  );
}

function isBackfillManifest(value: unknown): value is BackfillManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    record.version === 1 &&
    typeof record.projectUrl === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string" &&
    Array.isArray(record.entries) &&
    record.entries.every(isBackfillManifestEntry)
  );
}

async function loadBackfillManifest(
  requestedPath: string,
  expectedProjectUrl: string,
): Promise<{ path: string; manifest: BackfillManifest }> {
  const path = resolve(requestedPath);
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
  if (!isBackfillManifest(parsed)) {
    throw new Error("Backfill manifest has an invalid shape or version.");
  }
  if (parsed.projectUrl !== expectedProjectUrl) {
    throw new Error(
      `Backfill manifest belongs to ${parsed.projectUrl}, not ${expectedProjectUrl}.`,
    );
  }
  return { path, manifest: parsed };
}

function allowedEntryColumn(entry: BackfillManifestEntry): boolean {
  if (entry.bucket === "site-media") {
    return (
      entry.table === "site_media_items" &&
      (SITE_MEDIA_IMAGE_COLUMNS as readonly string[]).includes(entry.column)
    );
  }
  if (entry.bucket === "portfolio") {
    return (
      entry.table === "portfolio_items" &&
      (PORTFOLIO_IMAGE_COLUMNS as readonly string[]).includes(entry.column)
    );
  }
  return false;
}

export function extractCleanupDeleteRecords(
  manifest: BackfillManifest,
): CleanupDeleteRecord[] {
  const unique = new Map<string, CleanupDeleteRecord>();

  for (const entry of manifest.entries) {
    if (entry.status !== "migrated") continue;
    if (!isPublicMediaBucket(entry.bucket)) {
      throw new Error(`Migrated manifest entry contains private bucket ${entry.bucket}.`);
    }
    if (!allowedEntryColumn(entry)) {
      throw new Error(
        `Migrated manifest entry has an invalid table/column for ${entry.bucket}.`,
      );
    }
    const expectedCandidateKey = JSON.stringify([
      entry.table,
      entry.rowId,
      entry.column,
      entry.oldPath,
    ]);
    if (entry.candidateKey && entry.candidateKey !== expectedCandidateKey) {
      throw new Error("Migrated manifest candidate key does not match its audit fields.");
    }
    if (entry.optimizedBytes === null) {
      throw new Error("Migrated manifest entry has no optimized byte count.");
    }

    assertUnambiguousObjectPath(entry.oldPath, entry.bucket);
    assertUnambiguousObjectPath(entry.newPath, entry.bucket);
    if (isBackfillGeneratedPath(entry.oldPath)) {
      throw new Error("Cleanup manifest old path unexpectedly points to a generated WebP.");
    }
    if (!isBackfillGeneratedPath(entry.newPath)) {
      throw new Error("Cleanup manifest replacement path is not a generated WebP.");
    }

    const record: CleanupDeleteRecord = {
      bucket: entry.bucket,
      oldPath: entry.oldPath,
      newPath: entry.newPath,
      originalBytes: entry.originalBytes,
      optimizedBytes: entry.optimizedBytes,
    };
    validateCleanupDeleteRecord(record);

    const key = `${record.bucket}:${record.oldPath}`;
    const existing = unique.get(key);
    if (existing && cleanupRecordKey(existing) !== cleanupRecordKey(record)) {
      throw new Error(`Cleanup manifest has conflicting migrations for ${key}.`);
    }
    if (existing &&
      (existing.originalBytes !== record.originalBytes ||
        existing.optimizedBytes !== record.optimizedBytes)) {
      throw new Error(`Cleanup manifest has conflicting byte counts for ${key}.`);
    }
    unique.set(key, record);
  }

  return [...unique.values()];
}

export function cleanupSourceFingerprint(
  records: readonly CleanupDeleteRecord[],
): string {
  const normalized = [...records]
    .sort((a, b) => cleanupRecordKey(a).localeCompare(cleanupRecordKey(b)))
    .map((record) => ({
      bucket: record.bucket,
      oldPath: record.oldPath,
      newPath: record.newPath,
      originalBytes: record.originalBytes,
      optimizedBytes: record.optimizedBytes,
    }));
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function isCleanupJournalEntry(value: unknown): value is CleanupJournalEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.key === "string" &&
    isPublicMediaBucket(String(entry.bucket)) &&
    typeof entry.oldPath === "string" &&
    typeof entry.newPath === "string" &&
    typeof entry.originalBytes === "number" &&
    Number.isSafeInteger(entry.originalBytes) &&
    entry.originalBytes > 0 &&
    typeof entry.optimizedBytes === "number" &&
    Number.isSafeInteger(entry.optimizedBytes) &&
    entry.optimizedBytes > 0 &&
    (entry.status === "deleting" || entry.status === "deleted") &&
    typeof entry.updatedAt === "string"
  );
}

function isCleanupJournal(value: unknown): value is CleanupJournal {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    record.version === 1 &&
    typeof record.projectUrl === "string" &&
    typeof record.sourceManifestFingerprint === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string" &&
    Array.isArray(record.entries) &&
    record.entries.every(isCleanupJournalEntry)
  );
}

async function writeTextFileAtomically(
  targetPath: string,
  contents: string,
): Promise<void> {
  const targetDirectory = dirname(targetPath);
  await access(targetDirectory);
  const temporaryPath = join(
    targetDirectory,
    `.${basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  const handle = await open(temporaryPath, "wx");
  try {
    await handle.writeFile(contents, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporaryPath, targetPath);
}

async function writeCleanupJournal(
  path: string,
  journal: CleanupJournal,
): Promise<void> {
  journal.updatedAt = new Date().toISOString();
  await writeTextFileAtomically(path, `${JSON.stringify(journal, null, 2)}\n`);
}

async function loadOrCreateCleanupJournal(
  requestedPath: string,
  expectedProjectUrl: string,
  sourceManifestFingerprint: string,
): Promise<{ path: string; journal: CleanupJournal }> {
  const path = resolve(requestedPath);
  let journal: CleanupJournal;
  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    if (!isCleanupJournal(parsed)) {
      throw new Error("Cleanup journal has an invalid shape or version.");
    }
    journal = parsed;
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      (error as { code?: string }).code !== "ENOENT"
    ) {
      throw error;
    }
    const now = new Date().toISOString();
    journal = {
      version: 1,
      projectUrl: expectedProjectUrl,
      sourceManifestFingerprint,
      createdAt: now,
      updatedAt: now,
      entries: [],
    };
    await writeCleanupJournal(path, journal);
  }

  if (journal.projectUrl !== expectedProjectUrl) {
    throw new Error(
      `Cleanup journal belongs to ${journal.projectUrl}, not ${expectedProjectUrl}.`,
    );
  }
  if (journal.sourceManifestFingerprint !== sourceManifestFingerprint) {
    throw new Error("Cleanup journal belongs to a different backfill manifest snapshot.");
  }
  return { path, journal };
}

async function loadExistingCleanupJournal(
  requestedPath: string,
  expectedProjectUrl: string,
  sourceManifestFingerprint: string,
): Promise<{ path: string; journal: CleanupJournal }> {
  const path = resolve(requestedPath);
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
  if (!isCleanupJournal(parsed)) {
    throw new Error("Cleanup journal has an invalid shape or version.");
  }
  if (parsed.projectUrl !== expectedProjectUrl) {
    throw new Error(
      `Cleanup journal belongs to ${parsed.projectUrl}, not ${expectedProjectUrl}.`,
    );
  }
  if (parsed.sourceManifestFingerprint !== sourceManifestFingerprint) {
    throw new Error("Cleanup journal belongs to a different backfill manifest snapshot.");
  }
  return { path, journal: parsed };
}

function statesFromCleanupJournal(
  journal: CleanupJournal,
  records: readonly CleanupDeleteRecord[],
): Map<string, CleanupJournalState> {
  const recordsByKey = new Map(records.map((record) => [cleanupRecordKey(record), record]));
  const states = new Map<string, CleanupJournalState>();

  for (const entry of journal.entries) {
    const record = recordsByKey.get(entry.key);
    if (!record) {
      throw new Error(`Cleanup journal contains an unknown record ${entry.key}.`);
    }
    if (
      entry.bucket !== record.bucket ||
      entry.oldPath !== record.oldPath ||
      entry.newPath !== record.newPath ||
      entry.originalBytes !== record.originalBytes ||
      entry.optimizedBytes !== record.optimizedBytes ||
      entry.key !== cleanupRecordKey(record)
    ) {
      throw new Error(`Cleanup journal record does not match source manifest: ${entry.key}.`);
    }
    if (states.has(entry.key)) {
      throw new Error(`Cleanup journal contains duplicate record ${entry.key}.`);
    }
    states.set(entry.key, entry.status);
  }
  return states;
}

function upsertCleanupJournalEntry(
  journal: CleanupJournal,
  record: CleanupDeleteRecord,
  status: CleanupJournalEntryStatus,
): void {
  const key = cleanupRecordKey(record);
  const entry: CleanupJournalEntry = {
    key,
    ...record,
    status,
    updatedAt: new Date().toISOString(),
  };
  const index = journal.entries.findIndex((item) => item.key === key);
  if (index === -1) journal.entries.push(entry);
  else journal.entries[index] = entry;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function printInspections(inspections: readonly CleanupInspection[]): void {
  console.table(
    inspections.map((inspection) => ({
      bucket: inspection.record.bucket,
      old_path: inspection.record.oldPath,
      replacement_path: inspection.record.newPath,
      journal_state: inspection.state,
      status: inspection.status,
      current_bytes: inspection.sourceInfo?.size ?? "",
      reason: inspection.reason,
    })),
  );
  const safe = inspections.filter((item) => item.status === "safe");
  const alreadyDeleted = inspections.filter((item) => item.status === "already-deleted");
  const resumeDeleted = inspections.filter((item) => item.status === "resume-deleted");
  const retained = inspections.filter((item) => item.status === "retained");
  const pendingBytes = safe.reduce(
    (total, item) => total + (item.sourceInfo?.size ?? 0),
    0,
  );
  console.log({
    safeCandidateCount: safe.length,
    safeCandidateBytes: pendingBytes,
    safeCandidateSize: formatBytes(pendingBytes),
    alreadyDeletedCount: alreadyDeleted.length,
    interruptedDeleteCount: resumeDeleted.length,
    retainedCount: retained.length,
  });
}

async function createCleanupRepository(): Promise<CleanupDeleteRepository> {
  const { getSupabaseAdminClient } = await import("../src/lib/supabase-admin.ts");
  const client = getSupabaseAdminClient();
  const base = createSupabasePublicMediaBackfillRepository(client);

  return {
    findReferences: (bucket, path) => base.findReferences(bucket, path),
    getStorageObjectInfo: (bucket, path) => base.getStorageObjectInfo(bucket, path),
    deleteObject: async (bucket: PublicMediaBucket, path: string) => {
      if (!isPublicMediaBucket(bucket)) {
        throw new Error(`Cleanup rejected out-of-scope bucket ${bucket}.`);
      }
      assertUnambiguousObjectPath(path, bucket);
      if (isBackfillGeneratedPath(path)) {
        throw new Error(`Cleanup refuses to delete generated replacement ${path}.`);
      }
      const { error } = await client.storage.from(bucket).remove([path]);
      if (error) {
        throw new Error(`Could not delete ${bucket}/${path}: ${errorMessage(error)}`);
      }
    },
  };
}

async function runDryRun(
  records: readonly CleanupDeleteRecord[],
  repository: CleanupDeleteRepository,
  expectedProjectUrl: string,
  fingerprint: string,
  journalPath: string | null,
): Promise<void> {
  let states = new Map<string, CleanupJournalState>();
  if (journalPath) {
    const loaded = await loadExistingCleanupJournal(
      journalPath,
      expectedProjectUrl,
      fingerprint,
    );
    states = statesFromCleanupJournal(loaded.journal, records);
    console.log(`Read-only cleanup journal: ${loaded.path}`);
  }
  const inspections = await inspectCleanupDeleteRecords(repository, records, states);
  printInspections(inspections);
  console.log("CLEANUP DRY RUN COMPLETE: no Storage, database, or local files were written.");
  if (inspections.some((item) => item.status === "retained")) {
    process.exitCode = 2;
  }
}

async function runApply(
  records: readonly CleanupDeleteRecord[],
  repository: CleanupDeleteRepository,
  expectedProjectUrl: string,
  fingerprint: string,
  journalPath: string,
): Promise<void> {
  if (process.env.PUBLIC_MEDIA_CLEANUP_CONFIRM !== "YES") {
    throw new Error(
      "Cleanup apply is locked. Set PUBLIC_MEDIA_CLEANUP_CONFIRM=YES only after reviewing cleanup dry-run output.",
    );
  }

  const loaded = await loadOrCreateCleanupJournal(
    journalPath,
    expectedProjectUrl,
    fingerprint,
  );
  const states = statesFromCleanupJournal(loaded.journal, records);
  const preflight = await inspectCleanupDeleteRecords(repository, records, states);
  console.log("Cleanup apply preflight");
  printInspections(preflight);
  if (preflight.some((item) => item.status === "retained")) {
    throw new Error("Cleanup apply refused to start because at least one old object is retained.");
  }

  console.log(`Cleanup audit journal: ${loaded.path}`);
  const applied = await applyCleanupDeleteRecords(
    repository,
    records,
    states,
    {
      recordDeleting: async (record) => {
        upsertCleanupJournalEntry(loaded.journal, record, "deleting");
        await writeCleanupJournal(loaded.path, loaded.journal);
      },
      recordDeleted: async (record) => {
        upsertCleanupJournalEntry(loaded.journal, record, "deleted");
        await writeCleanupJournal(loaded.path, loaded.journal);
      },
    },
    async (item) => {
      console.log(
        `${item.status.toUpperCase()} ${item.record.bucket}/${item.record.oldPath}: ${item.message}`,
      );
    },
  );

  console.table(
    applied.results.map((item) => ({
      status: item.status,
      stage: item.stage,
      bucket: item.record.bucket,
      old_path: item.record.oldPath,
      replacement_path: item.record.newPath,
    })),
  );

  if (applied.stopped || applied.results.some((item) => item.status === "failed" || item.status === "fatal")) {
    throw new Error("Cleanup stopped before all eligible old objects were deleted. Keep the same cleanup journal for resume.");
  }

  console.log("CLEANUP APPLY COMPLETE: all eligible old objects were processed; database rows were not mutated.");
}

export async function main(args: readonly string[] = process.argv.slice(2)): Promise<void> {
  const options = parseCleanupCliOptions(args);
  if (options.mode === "help") {
    console.log(usage());
    return;
  }

  const expectedProjectUrl = projectUrl();
  const source = await loadBackfillManifest(
    options.manifestPath as string,
    expectedProjectUrl,
  );
  const records = extractCleanupDeleteRecords(source.manifest);
  if (records.length === 0) {
    throw new Error("Backfill manifest contains no successful migrated entries to clean up.");
  }
  const fingerprint = cleanupSourceFingerprint(records);
  const repository = await createCleanupRepository();

  console.log(`Backfill manifest: ${source.path}`);
  console.log(`Cleanup source fingerprint: ${fingerprint}`);

  if (options.mode === "apply") {
    await runApply(
      records,
      repository,
      expectedProjectUrl,
      fingerprint,
      options.journalPath as string,
    );
    return;
  }

  await runDryRun(
    records,
    repository,
    expectedProjectUrl,
    fingerprint,
    options.journalPath,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(errorMessage(error));
    process.exitCode = 1;
  });
}
