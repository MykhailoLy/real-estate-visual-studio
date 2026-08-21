import { randomUUID } from "node:crypto";
import { IMAGE_PROFILE_SETTINGS } from "../src/lib/image-profile-settings.ts";

export const PUBLIC_MEDIA_BUCKETS = ["site-media", "portfolio"] as const;
export type PublicMediaBucket = (typeof PUBLIC_MEDIA_BUCKETS)[number];

export const SITE_MEDIA_IMAGE_COLUMNS = [
  "before_image_path",
  "after_image_path",
  "image_path",
  "poster_image_path",
] as const;
export const SITE_MEDIA_REFERENCE_COLUMNS = [
  ...SITE_MEDIA_IMAGE_COLUMNS,
  "panorama_image_path",
] as const;
export const PORTFOLIO_IMAGE_COLUMNS = [
  "before_image_path",
  "after_image_path",
] as const;

export type SiteMediaImageColumn = (typeof SITE_MEDIA_IMAGE_COLUMNS)[number];
export type SiteMediaReferenceColumn =
  (typeof SITE_MEDIA_REFERENCE_COLUMNS)[number];
export type PortfolioImageColumn = (typeof PORTFOLIO_IMAGE_COLUMNS)[number];
export type BackfillTable = "site_media_items" | "portfolio_items";
export type BackfillColumn = SiteMediaImageColumn | PortfolioImageColumn;

export interface StorageObjectInfo {
  size: number;
  mimeType: string;
}

export interface PublicImageReference {
  table: BackfillTable;
  rowId: string;
  column: BackfillColumn;
  bucket: PublicMediaBucket;
  path: string;
  section: string | null;
  serviceSlug: string | null;
  title: string | null;
}

export interface BackfillCandidate extends PublicImageReference {
  currentBytes: number;
  mimeType: string;
  intendedNewPath: string;
  reason: string;
  manifestState?: {
    status: "uploaded-uncommitted" | "migrated";
    optimizedBytes: number;
  };
}

export interface BackfillManifestAttempt {
  candidateKey?: string;
  table: string;
  rowId: string;
  column: string;
  bucket: string;
  oldPath: string;
  newPath: string;
  optimizedBytes: number | null;
  status: string;
}

export interface DiscoverySkip extends PublicImageReference {
  reason: CandidateSkipReason;
}

export interface DiscoveryResult {
  candidates: BackfillCandidate[];
  skipped: DiscoverySkip[];
  originalTotalBytes: number;
  theoreticalTargetCeiling: number;
  targetBasedSavings: number;
}

export type CandidateSkipReason =
  | "private-bucket"
  | "missing-storage-object"
  | "unsupported-mime-type"
  | "at-or-below-gallery-target"
  | "already-backfilled";

export interface DiscoveryRepository {
  listSiteMediaRows(): Promise<readonly unknown[]>;
  listPortfolioRows(): Promise<readonly unknown[]>;
  getStorageObjectInfo(
    bucket: PublicMediaBucket,
    path: string,
  ): Promise<StorageObjectInfo | null>;
}

export interface ReferenceReadResult {
  rowExists: boolean;
  value: string | null;
}

export interface StorageUploadOptions {
  contentType: "image/webp";
  cacheControl: "31536000";
  upsert: false;
}

export type GuardedReplaceResult = "updated" | "conflict";

export interface ApplyRepository {
  readReference(reference: PublicImageReference): Promise<ReferenceReadResult>;
  getStorageObjectInfo(
    bucket: PublicMediaBucket,
    path: string,
  ): Promise<StorageObjectInfo | null>;
  downloadObject(bucket: PublicMediaBucket, path: string): Promise<Uint8Array>;
  uploadObject(
    bucket: PublicMediaBucket,
    path: string,
    bytes: Uint8Array,
    options: StorageUploadOptions,
  ): Promise<void>;
  guardedReplaceReference(
    reference: PublicImageReference,
    newPath: string,
  ): Promise<GuardedReplaceResult>;
}

export interface OptimizedGalleryImage {
  bytes: Uint8Array;
  width: number;
  height: number;
  quality: number;
  targetMet: boolean;
}

export interface ApplyJournal {
  recordVerifiedUpload?(
    candidate: BackfillCandidate,
    optimizedBytes: number,
  ): Promise<void>;
  recordCommittedMigration?(
    candidate: BackfillCandidate,
    optimizedBytes: number,
  ): Promise<void>;
}

export type ApplyResultStatus =
  | "migrated"
  | "skipped"
  | "conflict"
  | "failed"
  | "fatal";

export interface ApplyResult {
  candidate: BackfillCandidate;
  status: ApplyResultStatus;
  stage:
    | "re-read-row"
    | "source-object-check"
    | "download"
    | "optimize"
    | "upload"
    | "verify-upload"
    | "journal-upload"
    | "guarded-db-update"
    | "verify-db-update"
    | "journal-commit"
    | "complete";
  message: string;
  optimizedBytes: number | null;
  cleanupCandidatePath: string | null;
  stop: boolean;
}

export interface ApplyBackfillResult {
  results: ApplyResult[];
  stopped: boolean;
}

export interface ExistingReference {
  table: BackfillTable | "property_showcases";
  rowId: string;
  column: SiteMediaReferenceColumn | PortfolioImageColumn | "content";
}

export interface CleanupReportRepository {
  findReferences(
    bucket: PublicMediaBucket,
    path: string,
  ): Promise<readonly ExistingReference[]>;
  getStorageObjectInfo(
    bucket: PublicMediaBucket,
    path: string,
  ): Promise<StorageObjectInfo | null>;
}

export interface MigratedObjectRecord {
  bucket: PublicMediaBucket;
  oldPath: string;
  newPath: string;
}

export interface CleanupCandidate extends MigratedObjectRecord {
  currentBytes: number;
  mimeType: string;
}

export interface RetainedCleanupRecord extends MigratedObjectRecord {
  reason: "still-referenced" | "source-object-missing";
  references: readonly ExistingReference[];
}

export interface CleanupReport {
  safeCandidates: CleanupCandidate[];
  retained: RetainedCleanupRecord[];
}

const GALLERY_SETTINGS = IMAGE_PROFILE_SETTINGS.gallery;
const SUPPORTED_SHARP_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heif",
  "image/tiff",
  "image/gif",
]);
const KNOWN_BUCKET_PREFIXES = new Set([
  "site-media",
  "portfolio",
  "order-files",
  "deliverables",
]);
const SITE_MEDIA_TYPES = new Set([
  "before-after",
  "image",
  "panorama-360",
  "embed",
  "video",
]);

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is not a database row.`);
  }
  return value as Record<string, unknown>;
}

function requiredString(
  row: Record<string, unknown>,
  key: string,
  label: string,
): string {
  const value = row[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label}.${key} is missing or invalid.`);
  }
  return value;
}

function nullableString(
  row: Record<string, unknown>,
  key: string,
  label: string,
): string | null {
  const value = row[key];
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error(`${label}.${key} is missing or invalid.`);
  }
  return value;
}

export function isPublicMediaBucket(
  value: string,
): value is PublicMediaBucket {
  return (PUBLIC_MEDIA_BUCKETS as readonly string[]).includes(value);
}

export function assertUnambiguousObjectPath(
  path: string,
  expectedBucket: PublicMediaBucket,
): void {
  if (path.trim() !== path || path.length === 0 || path.length > 512) {
    throw new Error(`Ambiguous ${expectedBucket} object path: ${JSON.stringify(path)}.`);
  }
  if (
    path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("?") ||
    path.includes("#") ||
    /^[a-z][a-z0-9+.-]*:/i.test(path) ||
    /%[0-9a-f]{2}/i.test(path)
  ) {
    throw new Error(`Ambiguous ${expectedBucket} object path: ${JSON.stringify(path)}.`);
  }

  const segments = path.split("/");
  if (
    segments.length < 2 ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..") ||
    KNOWN_BUCKET_PREFIXES.has(segments[0])
  ) {
    throw new Error(`Ambiguous ${expectedBucket} object path: ${JSON.stringify(path)}.`);
  }
}

function pathValue(
  row: Record<string, unknown>,
  column: string,
  label: string,
  bucket: PublicMediaBucket,
): string | null {
  const value = row[column];
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error(`${label}.${column} is missing or invalid.`);
  }
  assertUnambiguousObjectPath(value, bucket);
  return value;
}

export function extractSiteMediaReferences(
  rows: readonly unknown[],
): PublicImageReference[] {
  const references: PublicImageReference[] = [];

  rows.forEach((value, index) => {
    const label = `site_media_items[${index}]`;
    const row = asRecord(value, label);
    const rowId = requiredString(row, "id", label);
    const mediaType = requiredString(row, "media_type", label);
    if (!SITE_MEDIA_TYPES.has(mediaType)) {
      throw new Error(`${label}.media_type is not recognized.`);
    }
    if (mediaType === "panorama-360") return;

    const section = nullableString(row, "section", label);
    const serviceSlug = nullableString(row, "service_slug", label);
    const title = nullableString(row, "title", label);

    for (const column of SITE_MEDIA_IMAGE_COLUMNS) {
      const path = pathValue(row, column, label, "site-media");
      if (!path) continue;
      references.push({
        table: "site_media_items",
        rowId,
        column,
        bucket: "site-media",
        path,
        section,
        serviceSlug,
        title,
      });
    }
  });

  return references;
}

export function extractPortfolioReferences(
  rows: readonly unknown[],
): PublicImageReference[] {
  const references: PublicImageReference[] = [];

  rows.forEach((value, index) => {
    const label = `portfolio_items[${index}]`;
    const row = asRecord(value, label);
    const rowId = requiredString(row, "id", label);
    const serviceSlug = nullableString(row, "service_slug", label);
    const title = nullableString(row, "title", label);

    for (const column of PORTFOLIO_IMAGE_COLUMNS) {
      const path = pathValue(row, column, label, "portfolio");
      if (!path) continue;
      references.push({
        table: "portfolio_items",
        rowId,
        column,
        bucket: "portfolio",
        path,
        section: null,
        serviceSlug,
        title,
      });
    }
  });

  return references;
}

export function isBackfillGeneratedPath(path: string): boolean {
  return /-legacy-gallery\.webp$/i.test(path);
}

export function stableCandidateAuditKey(
  reference: Pick<PublicImageReference, "table" | "rowId" | "column" | "path">,
): string {
  return JSON.stringify([
    reference.table,
    reference.rowId,
    reference.column,
    reference.path,
  ]);
}

function manifestAttemptCandidateKey(attempt: BackfillManifestAttempt): string {
  return JSON.stringify([
    attempt.table,
    attempt.rowId,
    attempt.column,
    attempt.oldPath,
  ]);
}

function assertManifestAttemptForCandidate(
  candidate: BackfillCandidate,
  attempt: BackfillManifestAttempt,
): void {
  const stableKey = stableCandidateAuditKey(candidate);
  if (attempt.candidateKey && attempt.candidateKey !== stableKey) {
    throw new Error(
      `Manifest candidate key does not match its audit fields for ${stableKey}.`,
    );
  }
  if (attempt.bucket !== candidate.bucket) {
    throw new Error(`Manifest bucket does not match candidate ${stableKey}.`);
  }
  assertUnambiguousObjectPath(attempt.newPath, candidate.bucket);
  if (!isBackfillGeneratedPath(attempt.newPath)) {
    throw new Error(`Manifest replacement path is not a backfill path for ${stableKey}.`);
  }
  const oldFolder = candidate.path.slice(0, candidate.path.lastIndexOf("/"));
  const newFolder = attempt.newPath.slice(0, attempt.newPath.lastIndexOf("/"));
  if (!oldFolder || newFolder !== oldFolder) {
    throw new Error(`Manifest replacement path changed folders for ${stableKey}.`);
  }
  if (
    !Number.isSafeInteger(attempt.optimizedBytes) ||
    (attempt.optimizedBytes ?? 0) <= 0
  ) {
    throw new Error(`Manifest optimized byte count is invalid for ${stableKey}.`);
  }
}

export function resolveBackfillCandidatesWithManifest(
  candidates: readonly BackfillCandidate[],
  attempts: readonly BackfillManifestAttempt[],
): BackfillCandidate[] {
  const relevantAttempts = new Map<string, BackfillManifestAttempt[]>();
  for (const attempt of attempts) {
    if (attempt.status !== "uploaded-uncommitted" && attempt.status !== "migrated") {
      continue;
    }
    const key = manifestAttemptCandidateKey(attempt);
    if (attempt.candidateKey && attempt.candidateKey !== key) {
      throw new Error("Manifest candidate key does not match its audit fields.");
    }
    const existing = relevantAttempts.get(key) ?? [];
    existing.push(attempt);
    relevantAttempts.set(key, existing);
  }

  return candidates.map((candidate) => {
    const stableKey = stableCandidateAuditKey(candidate);
    const matching = relevantAttempts.get(stableKey) ?? [];
    if (matching.length === 0) return candidate;

    for (const attempt of matching) {
      assertManifestAttemptForCandidate(candidate, attempt);
    }
    const paths = new Set(matching.map((attempt) => attempt.newPath));
    if (paths.size !== 1) {
      throw new Error(
        `Manifest has multiple replacement paths for stable candidate ${stableKey}.`,
      );
    }
    const optimizedSizes = new Set(
      matching.map((entry) => entry.optimizedBytes),
    );
    if (optimizedSizes.size !== 1) {
      throw new Error(
        `Manifest has multiple optimized byte counts for stable candidate ${stableKey}.`,
      );
    }
    const attempt =
      matching.find((entry) => entry.status === "migrated") ?? matching[0];
    return {
      ...candidate,
      intendedNewPath: attempt.newPath,
      manifestState: {
        status: attempt.status as "uploaded-uncommitted" | "migrated",
        optimizedBytes: attempt.optimizedBytes as number,
      },
    };
  });
}

export function isSharpDecodableImageMime(mimeType: string): boolean {
  return SUPPORTED_SHARP_IMAGE_MIMES.has(mimeType.trim().toLowerCase());
}

export function candidateSkipReason(
  reference: { bucket: string; path: string },
  info: StorageObjectInfo | null,
): CandidateSkipReason | null {
  if (!isPublicMediaBucket(reference.bucket)) return "private-bucket";
  if (isBackfillGeneratedPath(reference.path)) return "already-backfilled";
  if (!info) return "missing-storage-object";
  if (!isSharpDecodableImageMime(info.mimeType)) {
    return "unsupported-mime-type";
  }
  if (info.size <= GALLERY_SETTINGS.targetBytes) {
    return "at-or-below-gallery-target";
  }
  return null;
}

export interface ObjectPathGenerationOptions {
  timestamp?: number;
  nonce?: string;
}

export function buildLegacyGalleryObjectPath(
  oldPath: string,
  options: ObjectPathGenerationOptions = {},
): string {
  const separator = oldPath.lastIndexOf("/");
  if (separator <= 0 || separator === oldPath.length - 1) {
    throw new Error(`Cannot preserve the folder for ${JSON.stringify(oldPath)}.`);
  }
  const folder = oldPath.slice(0, separator);
  const timestamp = options.timestamp ?? Date.now();
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
    throw new Error("Backfill path timestamp must be a non-negative safe integer.");
  }
  const rawNonce = options.nonce ?? randomUUID().replace(/-/g, "").slice(0, 12);
  const nonce = rawNonce.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);
  if (!nonce) throw new Error("Backfill path nonce is invalid.");

  const newPath = `${folder}/${timestamp}-${nonce}-legacy-gallery.webp`;
  if (newPath.length > 512) {
    throw new Error(`Generated object path exceeds 512 characters for ${oldPath}.`);
  }
  return newPath;
}

export async function discoverBackfillCandidates(
  repository: DiscoveryRepository,
  pathOptions: () => ObjectPathGenerationOptions = () => ({}),
): Promise<DiscoveryResult> {
  const [siteMediaRows, portfolioRows] = await Promise.all([
    repository.listSiteMediaRows(),
    repository.listPortfolioRows(),
  ]);
  const references = [
    ...extractSiteMediaReferences(siteMediaRows),
    ...extractPortfolioReferences(portfolioRows),
  ];

  const seen = new Set<string>();
  const candidates: BackfillCandidate[] = [];
  const skipped: DiscoverySkip[] = [];

  for (const reference of references) {
    const referenceKey = [reference.table, reference.rowId, reference.column].join(":");
    if (seen.has(referenceKey)) {
      throw new Error(`Duplicate database reference discovered: ${referenceKey}.`);
    }
    seen.add(referenceKey);

    const info = await repository.getStorageObjectInfo(
      reference.bucket,
      reference.path,
    );
    const skipReason = candidateSkipReason(reference, info);
    if (skipReason) {
      skipped.push({ ...reference, reason: skipReason });
      continue;
    }
    if (!info) {
      throw new Error("Candidate selection reached an impossible missing-object state.");
    }

    candidates.push({
      ...reference,
      currentBytes: info.size,
      mimeType: info.mimeType.toLowerCase(),
      intendedNewPath: buildLegacyGalleryObjectPath(
        reference.path,
        pathOptions(),
      ),
      reason: "referenced public image exceeds the gallery target",
    });
  }

  const originalTotalBytes = candidates.reduce(
    (total, candidate) => total + candidate.currentBytes,
    0,
  );
  const theoreticalTargetCeiling =
    candidates.length * GALLERY_SETTINGS.targetBytes;

  return {
    candidates,
    skipped,
    originalTotalBytes,
    theoreticalTargetCeiling,
    targetBasedSavings: Math.max(
      0,
      originalTotalBytes - theoreticalTargetCeiling,
    ),
  };
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function result(
  candidate: BackfillCandidate,
  status: ApplyResultStatus,
  stage: ApplyResult["stage"],
  message: string,
  optimizedBytes: number | null,
  cleanupCandidatePath: string | null,
  stop = false,
): ApplyResult {
  return {
    candidate,
    status,
    stage,
    message,
    optimizedBytes,
    cleanupCandidatePath,
    stop,
  };
}

export async function applyBackfillCandidate(
  candidate: BackfillCandidate,
  repository: ApplyRepository,
  optimize: (
    bytes: Uint8Array,
    mimeType: string,
  ) => Promise<OptimizedGalleryImage>,
  journal: ApplyJournal = {},
): Promise<ApplyResult> {
  let stage: ApplyResult["stage"] = "re-read-row";
  let optimized: OptimizedGalleryImage | null = null;
  let optimizedBytes: number | null = null;
  let uploaded = false;
  let databaseUpdated = false;

  try {
    const currentReference = await repository.readReference(candidate);
    if (!currentReference.rowExists) {
      return result(
        candidate,
        "conflict",
        stage,
        "The source row no longer exists.",
        null,
        null,
      );
    }
    if (currentReference.value !== candidate.path) {
      const alreadyMigrated =
        currentReference.value === candidate.intendedNewPath ||
        (currentReference.value !== null &&
          isBackfillGeneratedPath(currentReference.value));
      return result(
        candidate,
        alreadyMigrated ? "skipped" : "conflict",
        stage,
        alreadyMigrated
          ? "The row is already migrated."
          : "The database reference changed after discovery.",
        null,
        null,
      );
    }
    if (candidate.manifestState?.status === "migrated") {
      return result(
        candidate,
        "skipped",
        stage,
        "The manifest already records this stable candidate as migrated; no write was attempted.",
        candidate.manifestState.optimizedBytes,
        null,
      );
    }

    stage = "source-object-check";
    const sourceInfo = await repository.getStorageObjectInfo(
      candidate.bucket,
      candidate.path,
    );
    const skipReason = candidateSkipReason(candidate, sourceInfo);
    if (skipReason) {
      return result(
        candidate,
        "skipped",
        stage,
        `Source is no longer eligible: ${skipReason}.`,
        null,
        null,
      );
    }
    if (!sourceInfo) {
      throw new Error("Source object disappeared before migration.");
    }

    if (candidate.manifestState?.status === "uploaded-uncommitted") {
      optimizedBytes = candidate.manifestState.optimizedBytes;
      uploaded = true;
    } else {
      stage = "download";
      const sourceBytes = await repository.downloadObject(
        candidate.bucket,
        candidate.path,
      );
      if (sourceBytes.byteLength !== sourceInfo.size) {
        throw new Error(
          `Downloaded ${sourceBytes.byteLength} bytes but Storage reports ${sourceInfo.size}.`,
        );
      }

      stage = "optimize";
      optimized = await optimize(sourceBytes, sourceInfo.mimeType);
      if (optimized.bytes.byteLength <= 0) {
        throw new Error("Optimizer produced an empty WebP buffer.");
      }
      optimizedBytes = optimized.bytes.byteLength;

      stage = "upload";
      await repository.uploadObject(
        candidate.bucket,
        candidate.intendedNewPath,
        optimized.bytes,
        {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: false,
        },
      );
      uploaded = true;
    }
    if (optimizedBytes === null) {
      throw new Error("Verified upload byte count is unavailable.");
    }

    stage = "verify-upload";
    const uploadedInfo = await repository.getStorageObjectInfo(
      candidate.bucket,
      candidate.intendedNewPath,
    );
    if (!uploadedInfo) {
      throw new Error("The uploaded object could not be found during verification.");
    }
    if (uploadedInfo.size !== optimizedBytes) {
      throw new Error(
        `Uploaded object has ${uploadedInfo.size} bytes; expected ${optimizedBytes}.`,
      );
    }
    if (uploadedInfo.mimeType.toLowerCase() !== "image/webp") {
      throw new Error(
        `Uploaded object has unexpected MIME type ${uploadedInfo.mimeType}.`,
      );
    }

    if (!candidate.manifestState) {
      stage = "journal-upload";
      await journal.recordVerifiedUpload?.(candidate, optimizedBytes);
    }

    stage = "guarded-db-update";
    const replacement = await repository.guardedReplaceReference(
      candidate,
      candidate.intendedNewPath,
    );
    if (replacement === "conflict") {
      return result(
        candidate,
        "conflict",
        stage,
        "The optimistic database guard found a concurrent change.",
        optimizedBytes,
        candidate.intendedNewPath,
      );
    }
    databaseUpdated = true;

    stage = "verify-db-update";
    const verifiedReference = await repository.readReference(candidate);
    if (
      !verifiedReference.rowExists ||
      verifiedReference.value !== candidate.intendedNewPath
    ) {
      return result(
        candidate,
        "fatal",
        stage,
        "Database update returned success but the new reference could not be verified. Stop immediately; the original object was retained.",
        optimizedBytes,
        null,
        true,
      );
    }

    stage = "journal-commit";
    await journal.recordCommittedMigration?.(candidate, optimizedBytes);

    return result(
      candidate,
      "migrated",
      "complete",
      candidate.manifestState?.status === "uploaded-uncommitted"
        ? "Reused and re-verified the manifest's uploaded WebP, then replaced the guarded DB reference without a second upload."
        : optimized?.targetMet
          ? "Uploaded and verified a target-sized WebP, then replaced the guarded DB reference."
          : "Uploaded and verified the smallest profile-compliant WebP, then replaced the guarded DB reference; the target could not be reached without going below the minimum dimensions.",
      optimizedBytes,
      null,
    );
  } catch (error) {
    const cleanupCandidatePath =
      uploaded && !databaseUpdated ? candidate.intendedNewPath : null;
    return result(
      candidate,
      databaseUpdated ? "fatal" : "failed",
      stage,
      `${messageFromError(error)} The original object was retained.`,
      optimizedBytes,
      cleanupCandidatePath,
      databaseUpdated,
    );
  }
}

export async function applyBackfillCandidates(
  candidates: readonly BackfillCandidate[],
  repository: ApplyRepository,
  optimize: (
    bytes: Uint8Array,
    mimeType: string,
  ) => Promise<OptimizedGalleryImage>,
  options: {
    journal?: ApplyJournal;
    onResult?: (result: ApplyResult) => Promise<void>;
  } = {},
): Promise<ApplyBackfillResult> {
  const results: ApplyResult[] = [];
  for (const candidate of candidates) {
    const candidateResult = await applyBackfillCandidate(
      candidate,
      repository,
      optimize,
      options.journal,
    );
    results.push(candidateResult);
    await options.onResult?.(candidateResult);
    if (candidateResult.stop) {
      return { results, stopped: true };
    }
  }
  return { results, stopped: false };
}

export async function buildCleanupReport(
  repository: CleanupReportRepository,
  records: readonly MigratedObjectRecord[],
): Promise<CleanupReport> {
  const unique = new Map<string, MigratedObjectRecord>();
  for (const record of records) {
    if (!isPublicMediaBucket(record.bucket)) {
      throw new Error(`Cleanup manifest contains private bucket ${record.bucket}.`);
    }
    assertUnambiguousObjectPath(record.oldPath, record.bucket);
    assertUnambiguousObjectPath(record.newPath, record.bucket);
    unique.set(`${record.bucket}:${record.oldPath}`, record);
  }

  const safeCandidates: CleanupCandidate[] = [];
  const retained: RetainedCleanupRecord[] = [];

  for (const record of unique.values()) {
    const references = await repository.findReferences(
      record.bucket,
      record.oldPath,
    );
    if (references.length > 0) {
      retained.push({ ...record, reason: "still-referenced", references });
      continue;
    }

    const info = await repository.getStorageObjectInfo(
      record.bucket,
      record.oldPath,
    );
    if (!info) {
      retained.push({
        ...record,
        reason: "source-object-missing",
        references: [],
      });
      continue;
    }
    safeCandidates.push({
      ...record,
      currentBytes: info.size,
      mimeType: info.mimeType,
    });
  }

  return { safeCandidates, retained };
}
