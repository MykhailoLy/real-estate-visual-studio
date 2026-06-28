import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVirtualStagingDraftFileSlotKey,
  clearVirtualStagingCleanupPendingTarget,
  clearVirtualStagingDraftFileOperation,
  collectVirtualStagingItemCleanupTargets,
  collectVirtualStagingUploadedFileIdsForItem,
  draftFileSummaryContainsPrivateStorageFields,
  getVirtualStagingUploadedFileForSlot,
  hasActiveVirtualStagingDraftFileOperation,
  indexVirtualStagingUploadedFilesBySlot,
  isTrustedVirtualStagingCleanupAlreadyAbsent,
  isVirtualStagingOriginalSubmittable,
  isVirtualStagingReferenceRequired,
  isVirtualStagingRestoredOriginalSubmittable,
  mapVirtualStagingPrepareConflictAction,
  markVirtualStagingDraftFileOperation,
  nextVirtualStagingDraftFileOperationGeneration,
  removeVirtualStagingUploadedFileSummary,
  removeVirtualStagingCleanupTargetFromRetrySet,
  replaceVirtualStagingUploadedFileSummary,
  resolveVirtualStagingCommittedItems,
  resolveVirtualStagingDraftFileVisualState,
  resetVirtualStagingDraftFileState,
  shouldApplyVirtualStagingItemRemovalResult,
  shouldApplyVirtualStagingDraftFileOperationResult,
  shouldAutomaticallyRetryVirtualStagingFileUploadFailure,
  shouldFinishVirtualStagingItemRemoval,
  type VirtualStagingDraftFileOperationMap,
} from "./virtual-staging-files.ts";
import type { OrderDraftUploadedFileSummary } from "./files.ts";

const ITEM_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_ID_2 = "22222222-2222-4222-8222-222222222222";
const ORIGINAL_ID = "33333333-3333-4333-8333-333333333333";
const REFERENCE_ID = "44444444-4444-4444-8444-444444444444";
const NEW_ORIGINAL_ID = "55555555-5555-4555-8555-555555555555";
const PENDING_ORIGINAL_ID = "66666666-6666-4666-8666-666666666666";
const PENDING_REFERENCE_ID = "77777777-7777-4777-8777-777777777777";

function uploadedFile(
  overrides: Partial<OrderDraftUploadedFileSummary> = {},
): OrderDraftUploadedFileSummary {
  return {
    id: ORIGINAL_ID,
    itemClientId: ITEM_ID,
    itemIndex: 0,
    kind: "original",
    originalFilename: "living.jpg",
    fileSize: 123456,
    mimeType: "image/jpeg",
    uploadStatus: "uploaded",
    createdAt: "2026-06-28T10:00:00.000Z",
    updatedAt: "2026-06-28T10:00:00.000Z",
    ...overrides,
  };
}

test("slot key uses clientItemId and kind", () => {
  assert.equal(
    buildVirtualStagingDraftFileSlotKey(ITEM_ID, "original"),
    `${ITEM_ID}:original`,
  );
});

test("original and reference slots do not collide", () => {
  assert.notEqual(
    buildVirtualStagingDraftFileSlotKey(ITEM_ID, "original"),
    buildVirtualStagingDraftFileSlotKey(ITEM_ID, "reference"),
  );
});

test("item index changes do not change slot identity", () => {
  assert.equal(
    buildVirtualStagingDraftFileSlotKey(ITEM_ID, "original"),
    buildVirtualStagingDraftFileSlotKey(ITEM_ID, "original"),
  );
});

test("summaries are indexed by stable slot", () => {
  const indexed = indexVirtualStagingUploadedFilesBySlot([
    uploadedFile({ itemIndex: 4 }),
  ]);
  assert.equal(indexed.get(`${ITEM_ID}:original`)?.id, ORIGINAL_ID);
});

test("uploaded summary replaces only its matching slot", () => {
  const reference = uploadedFile({
    id: REFERENCE_ID,
    kind: "reference",
    originalFilename: "style.png",
  });
  const next = replaceVirtualStagingUploadedFileSummary(
    [uploadedFile(), reference],
    uploadedFile({
      id: NEW_ORIGINAL_ID,
      originalFilename: "new.jpg",
      itemIndex: 9,
    }),
  );

  assert.deepEqual(next.map((file) => file.id).sort(), [
    NEW_ORIGINAL_ID,
    REFERENCE_ID,
  ].sort());
});

test("deleting one slot does not remove another slot", () => {
  const reference = uploadedFile({ id: REFERENCE_ID, kind: "reference" });
  const next = removeVirtualStagingUploadedFileSummary(
    [uploadedFile(), reference],
    ITEM_ID,
    "original",
  );
  assert.deepEqual(next.map((file) => file.id), [REFERENCE_ID]);
});

test("removing an item collects both file IDs", () => {
  assert.deepEqual(
    collectVirtualStagingUploadedFileIdsForItem(
      [
        uploadedFile(),
        uploadedFile({ id: REFERENCE_ID, kind: "reference" }),
        uploadedFile({ id: NEW_ORIGINAL_ID, itemClientId: ITEM_ID_2 }),
      ],
      ITEM_ID,
    ).sort(),
    [ORIGINAL_ID, REFERENCE_ID].sort(),
  );
});

test("summaries for unknown item IDs are ignored safely", () => {
  const indexed = indexVirtualStagingUploadedFilesBySlot(
    [uploadedFile({ itemClientId: ITEM_ID_2 })],
    [ITEM_ID],
  );
  assert.equal(indexed.size, 0);
});

test("stale operation generation is rejected", () => {
  assert.equal(
    shouldApplyVirtualStagingDraftFileOperationResult(
      { draftSession: 1, generation: 1 },
      1,
      2,
    ),
    false,
  );
});

test("stale draft session result is rejected", () => {
  assert.equal(
    shouldApplyVirtualStagingDraftFileOperationResult(
      { draftSession: 1, generation: 1 },
      2,
      1,
    ),
    false,
  );
});

test("same operation result applies once", () => {
  const slotKey = buildVirtualStagingDraftFileSlotKey(ITEM_ID, "original");
  let operations: VirtualStagingDraftFileOperationMap = {};
  operations = markVirtualStagingDraftFileOperation(operations, slotKey, {
    status: "uploading",
    generation: 1,
    error: null,
    pendingFileId: ORIGINAL_ID,
  });
  assert.equal(
    shouldApplyVirtualStagingDraftFileOperationResult(
      { draftSession: 1, generation: 1 },
      1,
      operations[slotKey]?.generation,
    ),
    true,
  );
  operations = clearVirtualStagingDraftFileOperation(operations, slotKey, 1);
  assert.equal(
    shouldApplyVirtualStagingDraftFileOperationResult(
      { draftSession: 1, generation: 1 },
      1,
      operations[slotKey]?.generation,
    ),
    false,
  );
});

test("failed upload keeps the existing uploaded summary", () => {
  const existing = uploadedFile();
  const unchanged = replaceVirtualStagingUploadedFileSummary([existing], existing);
  assert.equal(unchanged[0]?.id, ORIGINAL_ID);
});

test("successful completion replaces the existing summary", () => {
  const next = replaceVirtualStagingUploadedFileSummary(
    [uploadedFile()],
    uploadedFile({ id: NEW_ORIGINAL_ID, originalFilename: "complete.jpg" }),
  );
  assert.equal(next.length, 1);
  assert.equal(next[0]?.id, NEW_ORIGINAL_ID);
});

test("list restoration matches by clientItemId not itemIndex", () => {
  const file = uploadedFile({ itemIndex: 99 });
  assert.equal(
    getVirtualStagingUploadedFileForSlot([file], ITEM_ID, "original")?.id,
    ORIGINAL_ID,
  );
});

test("no Storage path or token appears in the UI model", () => {
  assert.equal(draftFileSummaryContainsPrivateStorageFields(uploadedFile()), false);
});

test("active-operation detection works", () => {
  assert.equal(hasActiveVirtualStagingDraftFileOperation({}), false);
  assert.equal(
    hasActiveVirtualStagingDraftFileOperation({
      one: {
        status: "saving_draft",
        generation: 1,
        error: null,
        pendingFileId: null,
      },
    }),
    true,
  );
});

test("explicit retry creates a new operation generation", () => {
  assert.equal(
    nextVirtualStagingDraftFileOperationGeneration({
      status: "error",
      generation: 3,
      error: "failed",
      pendingFileId: ORIGINAL_ID,
    }),
    4,
  );
});

test("restored original file is submittable when the uploaded summary exists", () => {
  assert.equal(isVirtualStagingRestoredOriginalSubmittable(true, null), true);
});

test("local original File remains production-submittable", () => {
  assert.equal(
    isVirtualStagingOriginalSubmittable(new File(["x"], "living.jpg")),
    true,
  );
});

test("reference file remains optional", () => {
  assert.equal(isVirtualStagingReferenceRequired(), false);
});

test("resetting a draft clears operation and summary state", () => {
  assert.deepEqual(resetVirtualStagingDraftFileState(), {
    uploadedFiles: [],
    operations: {},
    warning: "",
  });
});

test("no automatic retry decision is returned for upload failure", () => {
  assert.equal(shouldAutomaticallyRetryVirtualStagingFileUploadFailure(), false);
});

test("operation status and error belong to one visual state only", () => {
  assert.equal(resolveVirtualStagingDraftFileVisualState(true, true), "local_file");
  assert.equal(
    resolveVirtualStagingDraftFileVisualState(false, true),
    "persisted_file",
  );
  assert.equal(resolveVirtualStagingDraftFileVisualState(false, false), "empty");
});

test("item cleanup targets include uploaded original and reference IDs", () => {
  const targets = collectVirtualStagingItemCleanupTargets(
    [
      uploadedFile(),
      uploadedFile({ id: REFERENCE_ID, kind: "reference" }),
    ],
    {},
    ITEM_ID,
  );

  assert.deepEqual(targets.map((target) => target.id).sort(), [
    ORIGINAL_ID,
    REFERENCE_ID,
  ].sort());
});

test("item cleanup targets include transient pending IDs", () => {
  const operations: VirtualStagingDraftFileOperationMap = {
    [buildVirtualStagingDraftFileSlotKey(ITEM_ID, "original")]: {
      status: "error",
      generation: 2,
      error: "failed",
      pendingFileId: PENDING_ORIGINAL_ID,
    },
    [buildVirtualStagingDraftFileSlotKey(ITEM_ID, "reference")]: {
      status: "error",
      generation: 3,
      error: "failed",
      pendingFileId: PENDING_REFERENCE_ID,
    },
  };

  const targets = collectVirtualStagingItemCleanupTargets([], operations, ITEM_ID);
  assert.deepEqual(targets.map((target) => target.id).sort(), [
    PENDING_ORIGINAL_ID,
    PENDING_REFERENCE_ID,
  ].sort());
});

test("duplicate uploaded and pending cleanup IDs are deduplicated", () => {
  const operations: VirtualStagingDraftFileOperationMap = {
    [buildVirtualStagingDraftFileSlotKey(ITEM_ID, "original")]: {
      status: "error",
      generation: 1,
      error: "failed",
      pendingFileId: ORIGINAL_ID,
    },
  };

  const targets = collectVirtualStagingItemCleanupTargets(
    [uploadedFile()],
    operations,
    ITEM_ID,
  );
  assert.deepEqual(targets.map((target) => target.id), [ORIGINAL_ID]);
});

test("pending-only item is not removable before pending cleanup succeeds", () => {
  const targets = collectVirtualStagingItemCleanupTargets(
    [],
    {
      [buildVirtualStagingDraftFileSlotKey(ITEM_ID, "original")]: {
        status: "error",
        generation: 1,
        error: "failed",
        pendingFileId: PENDING_ORIGINAL_ID,
      },
    },
    ITEM_ID,
  );

  assert.equal(shouldFinishVirtualStagingItemRemoval(targets), false);
});

test("partial deletion removes successful targets from the next retry set", () => {
  const targets = collectVirtualStagingItemCleanupTargets(
    [
      uploadedFile(),
      uploadedFile({ id: REFERENCE_ID, kind: "reference" }),
    ],
    {},
    ITEM_ID,
  );
  const remaining = removeVirtualStagingCleanupTargetFromRetrySet(
    targets,
    ORIGINAL_ID,
  );

  assert.deepEqual(remaining.map((target) => target.id), [REFERENCE_ID]);
});

test("failed cleanup target remains retryable", () => {
  const targets = collectVirtualStagingItemCleanupTargets(
    [
      uploadedFile(),
      uploadedFile({ id: REFERENCE_ID, kind: "reference" }),
    ],
    {},
    ITEM_ID,
  );

  assert.equal(
    targets.some((target) => target.id === REFERENCE_ID),
    true,
  );
});

test("trusted missing cleanup target can be reconciled as absent", () => {
  assert.equal(isTrustedVirtualStagingCleanupAlreadyAbsent("not_found"), true);
  assert.equal(
    isTrustedVirtualStagingCleanupAlreadyAbsent("ownership_mismatch"),
    false,
  );
});

test("all successful cleanup targets permit final item removal", () => {
  let targets = collectVirtualStagingItemCleanupTargets(
    [
      uploadedFile(),
      uploadedFile({ id: REFERENCE_ID, kind: "reference" }),
    ],
    {},
    ITEM_ID,
  );
  targets = removeVirtualStagingCleanupTargetFromRetrySet(targets, ORIGINAL_ID);
  targets = removeVirtualStagingCleanupTargetFromRetrySet(targets, REFERENCE_ID);
  assert.equal(shouldFinishVirtualStagingItemRemoval(targets), true);
});

test("stale draft session cannot apply item-removal results", () => {
  assert.equal(
    shouldApplyVirtualStagingItemRemovalResult(
      { draftSession: 4, generation: 2 },
      5,
      2,
    ),
    false,
  );
});

test("stale item-removal generation cannot apply results", () => {
  assert.equal(
    shouldApplyVirtualStagingItemRemovalResult(
      { draftSession: 4, generation: 2 },
      4,
      3,
    ),
    false,
  );
});

test("reset cleanup cannot mutate the next draft session", () => {
  assert.equal(
    shouldApplyVirtualStagingItemRemovalResult(
      { draftSession: 1, generation: 1 },
      2,
      undefined,
    ),
    false,
  );
  assert.deepEqual(resetVirtualStagingDraftFileState(), {
    uploadedFiles: [],
    operations: {},
    warning: "",
  });
});

test("item cleanup identity is based on clientItemId instead of index", () => {
  const targets = collectVirtualStagingItemCleanupTargets(
    [uploadedFile({ itemIndex: 12 })],
    {},
    ITEM_ID,
  );
  assert.equal(targets[0]?.clientItemId, ITEM_ID);
  assert.equal(targets[0]?.id, ORIGINAL_ID);
});

test("synchronized item updates produce the exact save snapshot", () => {
  const current = [
    {
      clientItemId: ITEM_ID,
      originalFilename: null as string | null,
    },
  ];
  const next = resolveVirtualStagingCommittedItems(current, (items) =>
    items.map((item) => ({
      ...item,
      originalFilename: "selected.jpg",
    })),
  );

  assert.deepEqual(next, [
    {
      clientItemId: ITEM_ID,
      originalFilename: "selected.jpg",
    },
  ]);
});

test("pending cleanup success clears only its pending operation ID", () => {
  const slotKey = buildVirtualStagingDraftFileSlotKey(ITEM_ID, "original");
  const operations: VirtualStagingDraftFileOperationMap = {
    [slotKey]: {
      status: "deleting",
      generation: 3,
      error: null,
      pendingFileId: PENDING_ORIGINAL_ID,
    },
  };
  const [target] = collectVirtualStagingItemCleanupTargets(
    [],
    operations,
    ITEM_ID,
  );
  assert.ok(target);

  const next = clearVirtualStagingCleanupPendingTarget(
    operations,
    target,
    3,
  );
  assert.equal(next[slotKey]?.pendingFileId, null);
});

test("prepare version conflict maps to the existing draft conflict action", () => {
  assert.equal(
    mapVirtualStagingPrepareConflictAction("version_conflict"),
    "draft_conflict",
  );
  assert.equal(
    mapVirtualStagingPrepareConflictAction("file_too_large"),
    "slot_error",
  );
});
