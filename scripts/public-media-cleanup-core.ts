import {
  assertUnambiguousObjectPath,
  isBackfillGeneratedPath,
  isPublicMediaBucket,
  type ExistingReference,
  type PublicMediaBucket,
  type StorageObjectInfo,
} from "./public-media-backfill-core.ts";

export type CleanupJournalState = "none" | "deleting" | "deleted";

export interface CleanupDeleteRecord {
  bucket: PublicMediaBucket;
  oldPath: string;
  newPath: string;
  originalBytes: number;
  optimizedBytes: number;
}

export interface CleanupDeleteRepository {
  findReferences(
    bucket: PublicMediaBucket,
    path: string,
  ): Promise<readonly ExistingReference[]>;
  getStorageObjectInfo(
    bucket: PublicMediaBucket,
    path: string,
  ): Promise<StorageObjectInfo | null>;
  deleteObject(bucket: PublicMediaBucket, path: string): Promise<void>;
}

export interface CleanupDeleteJournal {
  recordDeleting?(record: CleanupDeleteRecord): Promise<void>;
  recordDeleted?(record: CleanupDeleteRecord): Promise<void>;
}

export type CleanupInspectionStatus =
  | "safe"
  | "already-deleted"
  | "resume-deleted"
  | "retained";

export interface CleanupInspection {
  record: CleanupDeleteRecord;
  state: CleanupJournalState;
  status: CleanupInspectionStatus;
  reason:
    | "safe-to-delete"
    | "already-deleted"
    | "delete-intent-source-missing"
    | "still-referenced"
    | "source-object-missing"
    | "source-object-changed"
    | "replacement-object-missing"
    | "replacement-size-mismatch"
    | "replacement-mime-mismatch"
    | "journal-says-deleted-but-source-exists";
  references: readonly ExistingReference[];
  sourceInfo: StorageObjectInfo | null;
  replacementInfo: StorageObjectInfo | null;
}

export type CleanupDeleteResultStatus =
  | "deleted"
  | "skipped"
  | "failed"
  | "fatal";

export interface CleanupDeleteResult {
  record: CleanupDeleteRecord;
  status: CleanupDeleteResultStatus;
  stage:
    | "preflight"
    | "journal-delete-intent"
    | "final-reference-check"
    | "final-source-check"
    | "final-replacement-check"
    | "delete"
    | "verify-delete"
    | "journal-delete-complete"
    | "complete";
  message: string;
  stop: boolean;
}

export interface CleanupDeleteBatchResult {
  results: CleanupDeleteResult[];
  stopped: boolean;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function folderOf(path: string): string {
  const separator = path.lastIndexOf("/");
  return separator > 0 ? path.slice(0, separator) : "";
}

export function cleanupRecordKey(record: CleanupDeleteRecord): string {
  return JSON.stringify([record.bucket, record.oldPath, record.newPath]);
}

export function validateCleanupDeleteRecord(record: CleanupDeleteRecord): void {
  if (!isPublicMediaBucket(record.bucket)) {
    throw new Error(`Cleanup record contains out-of-scope bucket ${record.bucket}.`);
  }
  assertUnambiguousObjectPath(record.oldPath, record.bucket);
  assertUnambiguousObjectPath(record.newPath, record.bucket);
  if (record.oldPath === record.newPath) {
    throw new Error("Cleanup record old and replacement paths are identical.");
  }
  if (isBackfillGeneratedPath(record.oldPath)) {
    throw new Error(`Cleanup refuses to delete generated replacement path ${record.oldPath}.`);
  }
  if (!isBackfillGeneratedPath(record.newPath)) {
    throw new Error(`Cleanup replacement is not a generated backfill path: ${record.newPath}.`);
  }
  if (folderOf(record.oldPath) !== folderOf(record.newPath)) {
    throw new Error("Cleanup replacement path does not preserve the original folder.");
  }
  if (!Number.isSafeInteger(record.originalBytes) || record.originalBytes <= 0) {
    throw new Error("Cleanup record original byte count is invalid.");
  }
  if (!Number.isSafeInteger(record.optimizedBytes) || record.optimizedBytes <= 0) {
    throw new Error("Cleanup record optimized byte count is invalid.");
  }
}

function retained(
  record: CleanupDeleteRecord,
  state: CleanupJournalState,
  reason: CleanupInspection["reason"],
  references: readonly ExistingReference[],
  sourceInfo: StorageObjectInfo | null,
  replacementInfo: StorageObjectInfo | null,
): CleanupInspection {
  return {
    record,
    state,
    status: "retained",
    reason,
    references,
    sourceInfo,
    replacementInfo,
  };
}

export async function inspectCleanupDeleteRecord(
  repository: CleanupDeleteRepository,
  record: CleanupDeleteRecord,
  state: CleanupJournalState = "none",
): Promise<CleanupInspection> {
  validateCleanupDeleteRecord(record);

  const replacementInfo = await repository.getStorageObjectInfo(
    record.bucket,
    record.newPath,
  );
  if (!replacementInfo) {
    return retained(
      record,
      state,
      "replacement-object-missing",
      [],
      null,
      null,
    );
  }
  if (replacementInfo.size !== record.optimizedBytes) {
    return retained(
      record,
      state,
      "replacement-size-mismatch",
      [],
      null,
      replacementInfo,
    );
  }
  if (replacementInfo.mimeType.trim().toLowerCase() !== "image/webp") {
    return retained(
      record,
      state,
      "replacement-mime-mismatch",
      [],
      null,
      replacementInfo,
    );
  }

  const references = await repository.findReferences(record.bucket, record.oldPath);
  if (references.length > 0) {
    return retained(
      record,
      state,
      "still-referenced",
      references,
      null,
      replacementInfo,
    );
  }

  const sourceInfo = await repository.getStorageObjectInfo(
    record.bucket,
    record.oldPath,
  );

  if (state === "deleted") {
    if (sourceInfo) {
      return retained(
        record,
        state,
        "journal-says-deleted-but-source-exists",
        [],
        sourceInfo,
        replacementInfo,
      );
    }
    return {
      record,
      state,
      status: "already-deleted",
      reason: "already-deleted",
      references: [],
      sourceInfo: null,
      replacementInfo,
    };
  }

  if (!sourceInfo) {
    if (state === "deleting") {
      return {
        record,
        state,
        status: "resume-deleted",
        reason: "delete-intent-source-missing",
        references: [],
        sourceInfo: null,
        replacementInfo,
      };
    }
    return retained(
      record,
      state,
      "source-object-missing",
      [],
      null,
      replacementInfo,
    );
  }

  if (sourceInfo.size !== record.originalBytes) {
    return retained(
      record,
      state,
      "source-object-changed",
      [],
      sourceInfo,
      replacementInfo,
    );
  }

  return {
    record,
    state,
    status: "safe",
    reason: "safe-to-delete",
    references: [],
    sourceInfo,
    replacementInfo,
  };
}

export async function inspectCleanupDeleteRecords(
  repository: CleanupDeleteRepository,
  records: readonly CleanupDeleteRecord[],
  states: ReadonlyMap<string, CleanupJournalState> = new Map(),
): Promise<CleanupInspection[]> {
  const inspections: CleanupInspection[] = [];
  for (const record of records) {
    inspections.push(
      await inspectCleanupDeleteRecord(
        repository,
        record,
        states.get(cleanupRecordKey(record)) ?? "none",
      ),
    );
  }
  return inspections;
}

function result(
  record: CleanupDeleteRecord,
  status: CleanupDeleteResultStatus,
  stage: CleanupDeleteResult["stage"],
  message: string,
  stop: boolean,
): CleanupDeleteResult {
  return { record, status, stage, message, stop };
}

async function assertFinalDeleteGuards(
  repository: CleanupDeleteRepository,
  record: CleanupDeleteRecord,
): Promise<void> {
  const references = await repository.findReferences(record.bucket, record.oldPath);
  if (references.length > 0) {
    throw new Error(
      `Old object became referenced again immediately before delete (${references.length} reference(s)).`,
    );
  }

  const sourceInfo = await repository.getStorageObjectInfo(
    record.bucket,
    record.oldPath,
  );
  if (!sourceInfo) {
    throw new Error("Old object disappeared immediately before delete.");
  }
  if (sourceInfo.size !== record.originalBytes) {
    throw new Error(
      `Old object size changed to ${sourceInfo.size}; expected ${record.originalBytes}.`,
    );
  }

  const replacementInfo = await repository.getStorageObjectInfo(
    record.bucket,
    record.newPath,
  );
  if (!replacementInfo) {
    throw new Error("Replacement object disappeared immediately before delete.");
  }
  if (replacementInfo.size !== record.optimizedBytes) {
    throw new Error(
      `Replacement object size changed to ${replacementInfo.size}; expected ${record.optimizedBytes}.`,
    );
  }
  if (replacementInfo.mimeType.trim().toLowerCase() !== "image/webp") {
    throw new Error(
      `Replacement object MIME changed to ${replacementInfo.mimeType}.`,
    );
  }
}

export async function applyCleanupDeleteRecord(
  repository: CleanupDeleteRepository,
  record: CleanupDeleteRecord,
  state: CleanupJournalState = "none",
  journal: CleanupDeleteJournal = {},
): Promise<CleanupDeleteResult> {
  let stage: CleanupDeleteResult["stage"] = "preflight";
  try {
    const preflight = await inspectCleanupDeleteRecord(repository, record, state);

    if (preflight.status === "already-deleted") {
      return result(
        record,
        "skipped",
        "complete",
        "Cleanup journal already records this old object as deleted and Storage confirms it is absent.",
        false,
      );
    }

    if (preflight.status === "resume-deleted") {
      stage = "journal-delete-complete";
      await journal.recordDeleted?.(record);
      return result(
        record,
        "deleted",
        "complete",
        "Resumed an interrupted delete: the old object is absent, the replacement is verified, and the completed state was journaled.",
        false,
      );
    }

    if (preflight.status !== "safe") {
      return result(
        record,
        "fatal",
        stage,
        `Cleanup preflight retained the old object: ${preflight.reason}.`,
        true,
      );
    }

    stage = "journal-delete-intent";
    await journal.recordDeleting?.(record);

    stage = "final-reference-check";
    await assertFinalDeleteGuards(repository, record);

    stage = "delete";
    await repository.deleteObject(record.bucket, record.oldPath);

    stage = "verify-delete";
    const afterDelete = await repository.getStorageObjectInfo(
      record.bucket,
      record.oldPath,
    );
    if (afterDelete) {
      throw new Error("Storage delete returned but the old object still exists.");
    }

    stage = "journal-delete-complete";
    await journal.recordDeleted?.(record);

    return result(
      record,
      "deleted",
      "complete",
      "Deleted the verified unreferenced old object and verified its absence.",
      false,
    );
  } catch (error) {
    return result(
      record,
      stage === "delete" || stage === "verify-delete" || stage === "journal-delete-complete"
        ? "failed"
        : "fatal",
      stage,
      `${messageFromError(error)} Cleanup stopped; no further objects were processed.`,
      true,
    );
  }
}

export async function applyCleanupDeleteRecords(
  repository: CleanupDeleteRepository,
  records: readonly CleanupDeleteRecord[],
  states: ReadonlyMap<string, CleanupJournalState> = new Map(),
  journal: CleanupDeleteJournal = {},
  onResult?: (result: CleanupDeleteResult) => Promise<void>,
): Promise<CleanupDeleteBatchResult> {
  const results: CleanupDeleteResult[] = [];
  for (const record of records) {
    const item = await applyCleanupDeleteRecord(
      repository,
      record,
      states.get(cleanupRecordKey(record)) ?? "none",
      journal,
    );
    results.push(item);
    await onResult?.(item);
    if (item.stop) return { results, stopped: true };
  }
  return { results, stopped: false };
}
