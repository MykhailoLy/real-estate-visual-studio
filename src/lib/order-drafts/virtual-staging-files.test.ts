import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVirtualStagingDraftFileSlotKey,
  clearVirtualStagingDraftFileOperation,
  collectVirtualStagingUploadedFileIdsForItem,
  draftFileSummaryContainsPrivateStorageFields,
  getVirtualStagingUploadedFileForSlot,
  hasActiveVirtualStagingDraftFileOperation,
  indexVirtualStagingUploadedFilesBySlot,
  isVirtualStagingOriginalSubmittable,
  isVirtualStagingReferenceRequired,
  isVirtualStagingRestoredOriginalSubmittable,
  markVirtualStagingDraftFileOperation,
  nextVirtualStagingDraftFileOperationGeneration,
  removeVirtualStagingUploadedFileSummary,
  replaceVirtualStagingUploadedFileSummary,
  resetVirtualStagingDraftFileState,
  shouldApplyVirtualStagingDraftFileOperationResult,
  shouldAutomaticallyRetryVirtualStagingFileUploadFailure,
  type VirtualStagingDraftFileOperationMap,
} from "./virtual-staging-files.ts";
import type { OrderDraftUploadedFileSummary } from "./files.ts";

const ITEM_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_ID_2 = "22222222-2222-4222-8222-222222222222";
const ORIGINAL_ID = "33333333-3333-4333-8333-333333333333";
const REFERENCE_ID = "44444444-4444-4444-8444-444444444444";
const NEW_ORIGINAL_ID = "55555555-5555-4555-8555-555555555555";

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

test("restored original file still requires a local File for current production submission", () => {
  assert.equal(isVirtualStagingRestoredOriginalSubmittable(true, null), false);
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
