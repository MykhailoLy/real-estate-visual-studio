import { randomUUID } from "node:crypto";
import { access, open, readFile, rename } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  applyBackfillCandidates,
  buildCleanupReport,
  discoverBackfillCandidates,
  isPublicMediaBucket,
  resolveBackfillCandidatesWithManifest,
  stableCandidateAuditKey,
  type ApplyResult,
  type BackfillCandidate,
  type MigratedObjectRecord,
} from "./public-media-backfill-core.ts";
import { optimizeLegacyGalleryImage } from "./optimize-legacy-gallery-image.ts";
import { createSupabasePublicMediaBackfillRepository } from "./supabase-public-media-backfill-adapter.ts";

type CliMode = "dry-run" | "apply" | "cleanup-report" | "help";

interface CliOptions {
  mode: CliMode;
  manifestPath: string | null;
}

type ManifestEntryStatus =
  | "uploaded-uncommitted"
  | "migrated"
  | "skipped"
  | "conflict"
  | "failed"
  | "fatal";

interface ManifestEntry {
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
  status: ManifestEntryStatus;
  message: string;
  updatedAt: string;
}

interface BackfillManifest {
  version: 1;
  projectUrl: string;
  createdAt: string;
  updatedAt: string;
  entries: ManifestEntry[];
}

function usage(): string {
  return [
    "Legacy public image backfill",
    "",
    "Dry run (default; remote and local write-free):",
    "  npm run media:backfill:dry-run",
    "",
    "Apply (requires PUBLIC_MEDIA_BACKFILL_CONFIRM=YES and a manifest path):",
    "  npm run media:backfill:apply -- --manifest <path-to-manifest.json>",
    "",
    "Read-only cleanup candidate report:",
    "  npm run media:backfill:cleanup-report -- <path-to-manifest.json>",
  ].join("\n");
}

function valueAfter(
  args: readonly string[],
  index: number,
  flag: string,
): { value: string; consumed: number } {
  const inline = args[index].slice(flag.length + 1);
  if (args[index].startsWith(`${flag}=`)) {
    if (!inline) throw new Error(`${flag} requires a non-empty path.`);
    return { value: inline, consumed: 0 };
  }
  const next = args[index + 1];
  if (!next || next.startsWith("--")) {
    throw new Error(`${flag} requires a path argument.`);
  }
  return { value: next, consumed: 1 };
}

export function parseCliOptions(args: readonly string[]): CliOptions {
  let mode: CliMode = "dry-run";
  let manifestPath: string | null = null;
  let explicitMode = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      mode = "help";
      explicitMode = true;
      continue;
    }
    if (arg === "--dry-run") {
      if (explicitMode && mode !== "dry-run") {
        throw new Error("Choose exactly one backfill mode.");
      }
      mode = "dry-run";
      explicitMode = true;
      continue;
    }
    if (arg === "--apply") {
      if (explicitMode && mode !== "apply") {
        throw new Error("Choose exactly one backfill mode.");
      }
      mode = "apply";
      explicitMode = true;
      continue;
    }
    if (arg === "--manifest" || arg.startsWith("--manifest=")) {
      const parsed = valueAfter(args, index, "--manifest");
      manifestPath = parsed.value;
      index += parsed.consumed;
      continue;
    }
    if (arg === "--cleanup-report" || arg.startsWith("--cleanup-report=")) {
      if (explicitMode && mode !== "cleanup-report") {
        throw new Error("Choose exactly one backfill mode.");
      }
      const parsed = valueAfter(args, index, "--cleanup-report");
      mode = "cleanup-report";
      explicitMode = true;
      manifestPath = parsed.value;
      index += parsed.consumed;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (mode === "apply" && !manifestPath) {
    throw new Error("Apply mode requires --manifest <path> for an audit journal.");
  }
  if (mode === "cleanup-report" && !manifestPath) {
    throw new Error("Cleanup report mode requires a manifest path.");
  }
  if (mode === "dry-run" && manifestPath) {
    throw new Error("Dry-run mode does not accept --manifest because it writes nothing.");
  }
  return { mode, manifestPath };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function printDiscovery(
  discovery: Awaited<ReturnType<typeof discoverBackfillCandidates>>,
): void {
  console.table(
    discovery.candidates.map((candidate) => ({
      table: candidate.table,
      row_id: candidate.rowId,
      column: candidate.column,
      bucket: candidate.bucket,
      current_path: candidate.path,
      current_bytes: candidate.currentBytes,
      mime_type: candidate.mimeType,
      intended_webp_path: candidate.intendedNewPath,
      section_or_service: candidate.section ?? candidate.serviceSlug ?? "",
      title: candidate.title ?? "",
      reason: candidate.reason,
    })),
  );

  const skippedByReason = Object.groupBy(
    discovery.skipped,
    (skipped) => skipped.reason,
  );
  console.log("Dry-run totals");
  console.table([
    { metric: "candidate count", value: String(discovery.candidates.length) },
    {
      metric: "original total bytes",
      value: `${discovery.originalTotalBytes} (${formatBytes(discovery.originalTotalBytes)})`,
    },
    {
      metric: "theoretical target ceiling",
      value: `${discovery.theoreticalTargetCeiling} (${formatBytes(discovery.theoreticalTargetCeiling)})`,
    },
    {
      metric: "savings at gallery target ceiling",
      value: `${discovery.targetBasedSavings} (${formatBytes(discovery.targetBasedSavings)})`,
    },
  ]);
  console.log(
    "Skipped references:",
    Object.fromEntries(
      Object.entries(skippedByReason).map(([reason, rows]) => [
        reason,
        rows?.length ?? 0,
      ]),
    ),
  );
}

function projectUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  return new URL(raw).origin;
}

const MANIFEST_ENTRY_STATUSES = new Set<ManifestEntryStatus>([
  "uploaded-uncommitted",
  "migrated",
  "skipped",
  "conflict",
  "failed",
  "fatal",
]);

function isManifestEntry(value: unknown): value is ManifestEntry {
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
    MANIFEST_ENTRY_STATUSES.has(entry.status as ManifestEntryStatus) &&
    typeof entry.message === "string" &&
    typeof entry.updatedAt === "string"
  );
}

function isManifest(value: unknown): value is BackfillManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    record.version === 1 &&
    typeof record.projectUrl === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string" &&
    Array.isArray(record.entries) &&
    record.entries.every(isManifestEntry)
  );
}

export async function writeTextFileAtomically(
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

async function writeManifest(
  manifestPath: string,
  manifest: BackfillManifest,
): Promise<void> {
  manifest.updatedAt = new Date().toISOString();
  await writeTextFileAtomically(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

async function loadOrCreateManifest(
  requestedPath: string,
  expectedProjectUrl: string,
): Promise<{ path: string; manifest: BackfillManifest }> {
  const manifestPath = resolve(requestedPath);
  let manifest: BackfillManifest;
  try {
    const parsed: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
    if (!isManifest(parsed)) {
      throw new Error("Existing manifest has an invalid shape or version.");
    }
    manifest = parsed;
    if (manifest.projectUrl !== expectedProjectUrl) {
      throw new Error(
        `Manifest belongs to ${manifest.projectUrl}, not ${expectedProjectUrl}.`,
      );
    }
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
    manifest = {
      version: 1,
      projectUrl: expectedProjectUrl,
      createdAt: now,
      updatedAt: now,
      entries: [],
    };
    await writeManifest(manifestPath, manifest);
  }
  return { path: manifestPath, manifest };
}

async function loadExistingManifest(
  requestedPath: string,
  expectedProjectUrl: string,
): Promise<{ path: string; manifest: BackfillManifest }> {
  const manifestPath = resolve(requestedPath);
  const parsed: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
  if (!isManifest(parsed)) {
    throw new Error("Cleanup manifest has an invalid shape or version.");
  }
  if (parsed.projectUrl !== expectedProjectUrl) {
    throw new Error(
      `Manifest belongs to ${parsed.projectUrl}, not ${expectedProjectUrl}.`,
    );
  }
  return { path: manifestPath, manifest: parsed };
}

function upsertManifestEntry(
  manifest: BackfillManifest,
  candidate: BackfillCandidate,
  update: {
    status: ManifestEntryStatus;
    message: string;
    optimizedBytes: number | null;
  },
): void {
  const candidateKey = stableCandidateAuditKey(candidate);
  const attemptId = JSON.stringify([candidateKey, candidate.intendedNewPath]);
  const entry: ManifestEntry = {
    attemptId,
    candidateKey,
    table: candidate.table,
    rowId: candidate.rowId,
    column: candidate.column,
    bucket: candidate.bucket,
    oldPath: candidate.path,
    newPath: candidate.intendedNewPath,
    originalBytes: candidate.currentBytes,
    optimizedBytes: update.optimizedBytes,
    status: update.status,
    message: update.message,
    updatedAt: new Date().toISOString(),
  };
  const existing = manifest.entries.findIndex(
    (manifestEntry) =>
      manifestEntry.attemptId === attemptId ||
      (manifestEntry.table === candidate.table &&
        manifestEntry.rowId === candidate.rowId &&
        manifestEntry.column === candidate.column &&
        manifestEntry.oldPath === candidate.path &&
        manifestEntry.newPath === candidate.intendedNewPath),
  );
  if (existing === -1) manifest.entries.push(entry);
  else manifest.entries[existing] = entry;
}

export function manifestStatus(result: ApplyResult): ManifestEntryStatus {
  if (
    result.status === "migrated" ||
    result.candidate.manifestState?.status === "migrated"
  ) {
    return "migrated";
  }
  if (
    result.cleanupCandidatePath ||
    result.candidate.manifestState?.status === "uploaded-uncommitted"
  ) {
    return "uploaded-uncommitted";
  }
  return result.status;
}

function migratedRecords(manifest: BackfillManifest): MigratedObjectRecord[] {
  return manifest.entries
    .filter((entry) => entry.status === "migrated")
    .map((entry) => {
      if (!isPublicMediaBucket(entry.bucket)) {
        throw new Error(`Manifest entry contains out-of-scope bucket ${entry.bucket}.`);
      }
      if (!entry.oldPath || !entry.newPath) {
        throw new Error("Manifest migrated entry is missing an object path.");
      }
      return {
        bucket: entry.bucket,
        oldPath: entry.oldPath,
        newPath: entry.newPath,
      };
    });
}

async function createRepository() {
  // The existing service-role client remains the only credential-bearing
  // client factory. The react-server condition activates server-only's safe
  // entrypoint for this explicitly server-side Node process.
  const { getSupabaseAdminClient } = await import(
    "../src/lib/supabase-admin.ts"
  );
  return createSupabasePublicMediaBackfillRepository(
    getSupabaseAdminClient(),
  );
}

async function runApply(
  manifestPath: string,
  repository: Awaited<ReturnType<typeof createRepository>>,
): Promise<void> {
  if (process.env.PUBLIC_MEDIA_BACKFILL_CONFIRM !== "YES") {
    throw new Error(
      "Apply is locked. Set PUBLIC_MEDIA_BACKFILL_CONFIRM=YES only after reviewing dry-run output.",
    );
  }

  const journal = await loadOrCreateManifest(manifestPath, projectUrl());
  const discovered = await discoverBackfillCandidates(repository);
  const discovery = {
    ...discovered,
    candidates: resolveBackfillCandidatesWithManifest(
      discovered.candidates,
      journal.manifest.entries,
    ),
  };
  printDiscovery(discovery);
  console.log(`Audit manifest: ${journal.path}`);

  const applyResult = await applyBackfillCandidates(
    discovery.candidates,
    repository,
    optimizeLegacyGalleryImage,
    {
      journal: {
        recordVerifiedUpload: async (
          candidate: BackfillCandidate,
          optimizedBytes: number,
        ) => {
          upsertManifestEntry(journal.manifest, candidate, {
            status: "uploaded-uncommitted",
            message:
              "New object verified; DB reference has not yet been changed. This path is an uncommitted cleanup candidate if the process stops here.",
            optimizedBytes,
          });
          await writeManifest(journal.path, journal.manifest);
        },
        recordCommittedMigration: async (candidate, optimizedBytes) => {
          upsertManifestEntry(journal.manifest, candidate, {
            status: "migrated",
            message: "Guarded DB replacement and post-update verification succeeded.",
            optimizedBytes,
          });
          await writeManifest(journal.path, journal.manifest);
        },
      },
      onResult: async (candidateResult) => {
        upsertManifestEntry(journal.manifest, candidateResult.candidate, {
          status: manifestStatus(candidateResult),
          message: candidateResult.message,
          optimizedBytes:
            candidateResult.optimizedBytes ??
            candidateResult.candidate.manifestState?.optimizedBytes ??
            null,
        });
        await writeManifest(journal.path, journal.manifest);
        console.log(
          `${candidateResult.status.toUpperCase()} ${candidateResult.candidate.table}.${candidateResult.candidate.column} ${candidateResult.candidate.rowId}: ${candidateResult.message}`,
        );
        if (candidateResult.cleanupCandidatePath) {
          console.warn(
            `UNCOMMITTED CLEANUP CANDIDATE (not deleted): ${candidateResult.candidate.bucket}/${candidateResult.cleanupCandidatePath}`,
          );
        }
      },
    },
  );

  console.table(
    applyResult.results.map((candidateResult) => ({
      status: candidateResult.status,
      stage: candidateResult.stage,
      table: candidateResult.candidate.table,
      row_id: candidateResult.candidate.rowId,
      column: candidateResult.candidate.column,
      old_path: candidateResult.candidate.path,
      new_path: candidateResult.candidate.intendedNewPath,
      optimized_bytes: candidateResult.optimizedBytes ?? "",
      cleanup_candidate: candidateResult.cleanupCandidatePath ?? "",
    })),
  );

  if (
    applyResult.stopped ||
    applyResult.results.some((item) =>
      ["failed", "fatal", "conflict"].includes(item.status),
    )
  ) {
    process.exitCode = 1;
  }
}

async function runCleanupReport(
  manifestPath: string,
  repository: Awaited<ReturnType<typeof createRepository>>,
): Promise<void> {
  const journal = await loadExistingManifest(manifestPath, projectUrl());
  const report = await buildCleanupReport(
    repository,
    migratedRecords(journal.manifest),
  );

  console.log("Read-only cleanup candidate report (no objects were deleted)");
  console.table(
    report.safeCandidates.map((candidate) => ({
      bucket: candidate.bucket,
      old_path: candidate.oldPath,
      replacement_path: candidate.newPath,
      current_bytes: candidate.currentBytes,
      mime_type: candidate.mimeType,
      reason: "no longer referenced in any relevant image-path column",
    })),
  );
  if (report.retained.length > 0) {
    console.log("Retained / not safe for deletion");
    console.table(
      report.retained.map((candidate) => ({
        bucket: candidate.bucket,
        old_path: candidate.oldPath,
        reason: candidate.reason,
        references: candidate.references.length,
      })),
    );
  }
  console.log({
    safeCandidateCount: report.safeCandidates.length,
    retainedCount: report.retained.length,
  });
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  if (options.mode === "help") {
    console.log(usage());
    return;
  }
  if (
    options.mode === "apply" &&
    process.env.PUBLIC_MEDIA_BACKFILL_CONFIRM !== "YES"
  ) {
    throw new Error(
      "Apply is locked. Set PUBLIC_MEDIA_BACKFILL_CONFIRM=YES only after reviewing dry-run output.",
    );
  }

  const repository = await createRepository();
  if (options.mode === "dry-run") {
    const discovery = await discoverBackfillCandidates(repository);
    printDiscovery(discovery);
    console.log("DRY RUN COMPLETE: no Storage, database, or local files were written.");
    return;
  }
  if (options.mode === "apply") {
    await runApply(options.manifestPath!, repository);
    return;
  }
  await runCleanupReport(options.manifestPath!, repository);
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;
if (invokedPath === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
