import type {
  OrderDraftUploadedFileSummary,
} from "./files.ts";
import type { OrderDraftFileKind } from "./types.ts";

export type VirtualStagingDraftFileSlotKind = "original" | "reference";

export type VirtualStagingDraftFileOperationStatus =
  | "idle"
  | "saving_draft"
  | "uploading"
  | "deleting"
  | "error";

export interface VirtualStagingDraftFileOperation {
  status: VirtualStagingDraftFileOperationStatus;
  generation: number;
  error: string | null;
  pendingFileId: string | null;
}

export type VirtualStagingDraftFileOperationMap = Record<
  string,
  VirtualStagingDraftFileOperation | undefined
>;

export interface VirtualStagingDraftFileOperationSession {
  draftSession: number;
  generation: number;
}

export interface VirtualStagingDraftFileResetState {
  uploadedFiles: OrderDraftUploadedFileSummary[];
  operations: VirtualStagingDraftFileOperationMap;
  warning: string;
}

export function buildVirtualStagingDraftFileSlotKey(
  clientItemId: string,
  kind: VirtualStagingDraftFileSlotKind,
): string {
  return `${clientItemId}:${kind}`;
}

export function indexVirtualStagingUploadedFilesBySlot(
  files: OrderDraftUploadedFileSummary[],
  knownClientItemIds?: Iterable<string>,
): Map<string, OrderDraftUploadedFileSummary> {
  const known = knownClientItemIds ? new Set(knownClientItemIds) : null;
  const indexed = new Map<string, OrderDraftUploadedFileSummary>();
  for (const file of files) {
    if (!isVirtualStagingDraftFileSlotKind(file.kind)) continue;
    if (known && !known.has(file.itemClientId)) continue;
    indexed.set(
      buildVirtualStagingDraftFileSlotKey(file.itemClientId, file.kind),
      file,
    );
  }
  return indexed;
}

export function getVirtualStagingUploadedFileForSlot(
  files: OrderDraftUploadedFileSummary[],
  clientItemId: string,
  kind: VirtualStagingDraftFileSlotKind,
): OrderDraftUploadedFileSummary | null {
  return indexVirtualStagingUploadedFilesBySlot(files).get(
    buildVirtualStagingDraftFileSlotKey(clientItemId, kind),
  ) ?? null;
}

export function replaceVirtualStagingUploadedFileSummary(
  files: OrderDraftUploadedFileSummary[],
  completed: OrderDraftUploadedFileSummary,
): OrderDraftUploadedFileSummary[] {
  if (!isVirtualStagingDraftFileSlotKind(completed.kind)) return files;
  const targetKey = buildVirtualStagingDraftFileSlotKey(
    completed.itemClientId,
    completed.kind,
  );
  const withoutTarget = files.filter((file) => {
    if (!isVirtualStagingDraftFileSlotKind(file.kind)) return true;
    return buildVirtualStagingDraftFileSlotKey(file.itemClientId, file.kind) !==
      targetKey;
  });
  return [...withoutTarget, completed];
}

export function removeVirtualStagingUploadedFileSummary(
  files: OrderDraftUploadedFileSummary[],
  clientItemId: string,
  kind: VirtualStagingDraftFileSlotKind,
): OrderDraftUploadedFileSummary[] {
  const targetKey = buildVirtualStagingDraftFileSlotKey(clientItemId, kind);
  return files.filter((file) => {
    if (!isVirtualStagingDraftFileSlotKind(file.kind)) return true;
    return buildVirtualStagingDraftFileSlotKey(file.itemClientId, file.kind) !==
      targetKey;
  });
}

export function collectVirtualStagingUploadedFileIdsForItem(
  files: OrderDraftUploadedFileSummary[],
  clientItemId: string,
): string[] {
  return files
    .filter(
      (file) =>
        file.itemClientId === clientItemId &&
        isVirtualStagingDraftFileSlotKind(file.kind),
    )
    .map((file) => file.id);
}

export function hasActiveVirtualStagingDraftFileOperation(
  operations: VirtualStagingDraftFileOperationMap,
): boolean {
  return Object.values(operations).some(
    (operation) =>
      operation !== undefined &&
      (operation.status === "saving_draft" ||
        operation.status === "uploading" ||
        operation.status === "deleting"),
  );
}

export function isVirtualStagingDraftFileSlotOperationActive(
  operation: VirtualStagingDraftFileOperation | undefined,
): boolean {
  return (
    operation?.status === "saving_draft" ||
    operation?.status === "uploading" ||
    operation?.status === "deleting"
  );
}

export function shouldApplyVirtualStagingDraftFileOperationResult(
  session: VirtualStagingDraftFileOperationSession,
  currentDraftSession: number,
  currentGeneration: number | undefined,
): boolean {
  return (
    session.draftSession === currentDraftSession &&
    session.generation === currentGeneration
  );
}

export function nextVirtualStagingDraftFileOperationGeneration(
  current: VirtualStagingDraftFileOperation | undefined,
): number {
  return (current?.generation ?? 0) + 1;
}

export function markVirtualStagingDraftFileOperation(
  operations: VirtualStagingDraftFileOperationMap,
  slotKey: string,
  operation: VirtualStagingDraftFileOperation,
): VirtualStagingDraftFileOperationMap {
  return { ...operations, [slotKey]: operation };
}

export function clearVirtualStagingDraftFileOperation(
  operations: VirtualStagingDraftFileOperationMap,
  slotKey: string,
  generation: number,
): VirtualStagingDraftFileOperationMap {
  const current = operations[slotKey];
  if (!current || current.generation !== generation) return operations;
  const next = { ...operations };
  delete next[slotKey];
  return next;
}

export function resetVirtualStagingDraftFileState(): VirtualStagingDraftFileResetState {
  return {
    uploadedFiles: [],
    operations: {},
    warning: "",
  };
}

export function isVirtualStagingRestoredOriginalSubmittable(
  hasUploadedOriginal: boolean,
  localFile: File | null,
): boolean {
  void hasUploadedOriginal;
  return localFile !== null;
}

export function isVirtualStagingOriginalSubmittable(localFile: File | null): boolean {
  return localFile !== null;
}

export function isVirtualStagingReferenceRequired(): false {
  return false;
}

export function shouldAutomaticallyRetryVirtualStagingFileUploadFailure(): false {
  return false;
}

export function draftFileSummaryContainsPrivateStorageFields(
  file: OrderDraftUploadedFileSummary,
): boolean {
  const candidate = file as unknown as Record<string, unknown>;
  return (
    "storagePath" in candidate ||
    "path" in candidate ||
    "bucket" in candidate ||
    "token" in candidate ||
    "signedUrl" in candidate
  );
}

function isVirtualStagingDraftFileSlotKind(
  kind: OrderDraftFileKind,
): kind is VirtualStagingDraftFileSlotKind {
  return kind === "original" || kind === "reference";
}
