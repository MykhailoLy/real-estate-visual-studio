import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MAX_FILE_SIZE_BYTES } from "../upload-config.ts";
import {
  PrepareOrderDraftFileUploadInputSchema,
  buildPrepareOrderDraftFileUploadRpcParams,
  buildDraftFileSoftDeletePayload,
  buildDraftStoragePath,
  filterUploadedDraftFiles,
  findDraftItemIndex,
  getDraftStoragePathParts,
  getRetiredUploadedStoragePathsForSlot,
  isDraftFileAllowedForDraft,
  isPendingDraftFile,
  mapOrderDraftFilePublicSummary,
  parseCompleteOrderDraftFileUploadRpcResult,
  parsePrepareOrderDraftFileUploadRpcResult,
  parseSoftDeleteOrderDraftFileRpcResult,
  sanitizeDraftStorageFilename,
  shouldSupersedeDraftFileCandidate,
  verifyStoredDraftObject,
} from "./files.ts";
import type { JsonObject, OrderDraftFileRow, OrderDraftRow } from "./types.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const DRAFT_ID = "22222222-2222-4222-8222-222222222222";
const FILE_ID = "33333333-3333-4333-8333-333333333333";
const FILE_ID_2 = "44444444-4444-4444-8444-444444444444";
const ITEM_ID = "55555555-5555-4555-8555-555555555555";
const ITEM_ID_2 = "66666666-6666-4666-8666-666666666666";
const PENDING_STORAGE_PATH = `drafts/${USER_ID}/${DRAFT_ID}/${FILE_ID}/pending.jpg`;
const FAILED_STORAGE_PATH = `drafts/${USER_ID}/${DRAFT_ID}/${FILE_ID_2}/failed.jpg`;

const MIGRATION_SQL = readFileSync(
  "supabase/add-order-draft-file-upload-foundation.sql",
  "utf8",
);
const FILES_SERVER_SOURCE = readFileSync(
  "src/lib/order-drafts/files-server.ts",
  "utf8",
);

function draftState(): JsonObject {
  return {
    schemaVersion: 1,
    jobTitle: "123 Main Street",
    currentStep: "configure",
    items: [
      { clientItemId: ITEM_ID, state: { room: "Living Room" } },
      { clientItemId: ITEM_ID_2, state: { room: "Bedroom" } },
    ],
  };
}

function draft(serviceType: OrderDraftRow["serviceType"]): Pick<OrderDraftRow, "serviceType"> {
  return { serviceType };
}

function fileRow(
  overrides: Partial<OrderDraftFileRow> = {},
): OrderDraftFileRow {
  return {
    id: FILE_ID,
    draftId: DRAFT_ID,
    itemClientId: ITEM_ID,
    itemIndex: 0,
    kind: "original",
    bucket: "order-files",
    storagePath: `drafts/${USER_ID}/${DRAFT_ID}/${FILE_ID}/room.jpg`,
    originalFilename: "room.jpg",
    fileSize: 123456,
    mimeType: "image/jpeg",
    contentHash: null,
    uploadStatus: "uploaded",
    createdAt: "2026-06-27T11:22:36.123Z",
    updatedAt: "2026-06-27T11:22:36.123Z",
    deletedAt: null,
    movedAt: null,
    ...overrides,
  };
}

test("safe filename remains usable", () => {
  assert.equal(sanitizeDraftStorageFilename("room.jpg"), "room.jpg");
});

test("path traversal filename is sanitized", () => {
  const sanitized = sanitizeDraftStorageFilename("../../secret.jpg");
  assert.equal(sanitized, "secret.jpg");
  assert.equal(sanitized.includes(".."), false);
  assert.equal(sanitized.includes("/"), false);
});

test("Windows path separators are removed", () => {
  assert.equal(
    sanitizeDraftStorageFilename("C:\\Users\\test\\photo.png"),
    "photo.png",
  );
});

test("empty or unsafe filename receives a fallback", () => {
  assert.equal(sanitizeDraftStorageFilename("..."), "file.bin");
  assert.equal(sanitizeDraftStorageFilename("\\/"), "file.bin");
});

test("generated path uses trusted user draft and file IDs", () => {
  assert.equal(
    buildDraftStoragePath({
      verifiedUserId: USER_ID,
      draftId: DRAFT_ID,
      fileId: FILE_ID,
      filename: "my room (final).JPG",
    }),
    `drafts/${USER_ID}/${DRAFT_ID}/${FILE_ID}/my_room_final.jpg`,
  );
});

test("generated path cannot escape the draft prefix", () => {
  const path = buildDraftStoragePath({
    verifiedUserId: USER_ID,
    draftId: DRAFT_ID,
    fileId: FILE_ID,
    filename: "../../secret.jpg",
  });
  assert.equal(path, `drafts/${USER_ID}/${DRAFT_ID}/${FILE_ID}/secret.jpg`);
  assert.equal(path.split("/").length, 5);
  assert.equal(path.includes(".."), false);
});

test("storage path parts derive directory and basename", () => {
  assert.deepEqual(
    getDraftStoragePathParts(`drafts/${USER_ID}/${DRAFT_ID}/${FILE_ID}/room.jpg`),
    {
      directory: `drafts/${USER_ID}/${DRAFT_ID}/${FILE_ID}`,
      basename: "room.jpg",
    },
  );
});

test("public DTO omits storagePath", () => {
  const dto = mapOrderDraftFilePublicSummary(fileRow());
  assert.equal(dto.id, FILE_ID);
  assert.equal("storagePath" in dto, false);
});

test("item index is derived from draft state", () => {
  assert.deepEqual(findDraftItemIndex(draftState(), ITEM_ID_2), {
    ok: true,
    itemIndex: 1,
  });
});

test("unknown itemClientId is rejected", () => {
  assert.deepEqual(
    findDraftItemIndex(draftState(), "77777777-7777-4777-8777-777777777777"),
    { ok: false, code: "item_not_found" },
  );
});

test("prepare schema rejects browser-controlled trusted fields", () => {
  const result = PrepareOrderDraftFileUploadInputSchema.safeParse({
    itemClientId: ITEM_ID,
    kind: "original",
    filename: "room.jpg",
    contentType: "image/jpeg",
    size: 10,
    userId: USER_ID,
    bucket: "order-files",
    storagePath: "drafts/evil",
    serviceType: "virtual-staging",
    itemIndex: 0,
  });
  assert.equal(result.success, false);
});

test("oversized files are rejected", () => {
  const result = PrepareOrderDraftFileUploadInputSchema.safeParse({
    itemClientId: ITEM_ID,
    kind: "original",
    filename: "room.jpg",
    contentType: "image/jpeg",
    size: MAX_FILE_SIZE_BYTES + 1,
  });
  assert.equal(result.success, false);
});

test("disallowed MIME types are rejected", () => {
  assert.equal(
    isDraftFileAllowedForDraft(draft("virtual-staging"), {
      kind: "original",
      contentType: "application/pdf",
    }),
    false,
  );
});

test("draft service type determines allowed MIME types", () => {
  assert.equal(
    isDraftFileAllowedForDraft(draft("3d-floor-plans"), {
      kind: "original",
      contentType: "application/pdf",
    }),
    true,
  );
  assert.equal(
    isDraftFileAllowedForDraft(draft("3d-floor-plans"), {
      kind: "reference",
      contentType: "application/pdf",
    }),
    false,
  );
});

test("list returns only uploaded non-deleted files", () => {
  const rows = [
    fileRow(),
    fileRow({ id: FILE_ID_2, uploadStatus: "pending" }),
    fileRow({
      id: "77777777-7777-4777-8777-777777777777",
      uploadStatus: "uploaded",
      deletedAt: "2026-06-27T11:25:36.123Z",
    }),
  ];
  assert.deepEqual(filterUploadedDraftFiles(rows).map((row) => row.id), [
    FILE_ID,
  ]);
});

test("prepare keeps the current uploaded row until completion", () => {
  assert.equal(
    shouldSupersedeDraftFileCandidate(fileRow(), {
      draftId: DRAFT_ID,
      itemClientId: ITEM_ID,
      kind: "original",
    }),
    false,
  );
  assert.equal(
    shouldSupersedeDraftFileCandidate(fileRow({ uploadStatus: "pending" }), {
      draftId: DRAFT_ID,
      itemClientId: ITEM_ID,
      kind: "original",
    }),
    true,
  );
});

test("prepare supersedes pending and failed candidates only", () => {
  const slot = {
    draftId: DRAFT_ID,
    itemClientId: ITEM_ID,
    kind: "original" as const,
  };
  assert.equal(
    shouldSupersedeDraftFileCandidate(fileRow({ uploadStatus: "pending" }), slot),
    true,
  );
  assert.equal(
    shouldSupersedeDraftFileCandidate(fileRow({ uploadStatus: "failed" }), slot),
    true,
  );
  assert.equal(shouldSupersedeDraftFileCandidate(fileRow(), slot), false);
  assert.equal(
    shouldSupersedeDraftFileCandidate(
      fileRow({ uploadStatus: "failed", deletedAt: "2026-06-27T11:25:36.123Z" }),
      slot,
    ),
    false,
  );
});

test("prepare RPC params include the trusted expected draft version", () => {
  const params = buildPrepareOrderDraftFileUploadRpcParams({
    userId: USER_ID,
    draftId: DRAFT_ID,
    expectedVersion: 7,
    fileId: FILE_ID,
    storagePath: PENDING_STORAGE_PATH,
    input: {
      itemClientId: ITEM_ID,
      kind: "original",
      filename: "room.jpg",
      contentType: "image/jpeg",
      size: 123456,
    },
  });

  assert.equal(params.p_expected_version, 7);
  assert.equal(params.p_item_client_id, ITEM_ID);
  assert.equal("p_item_index" in params, false);
});

test("stale prepare RPC version maps to conflict before exposing a file", () => {
  const result = parsePrepareOrderDraftFileUploadRpcResult([
    {
      result_code: "version_conflict",
      prepared_file_id: FILE_ID,
      item_index: 0,
      retired_storage_paths: [],
    },
  ]);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "version_conflict");
});

test("missing prepare item maps to item_not_found before exposing a file", () => {
  const result = parsePrepareOrderDraftFileUploadRpcResult([
    {
      result_code: "item_not_found",
      prepared_file_id: FILE_ID,
      item_index: 0,
      retired_storage_paths: [],
    },
  ]);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "item_not_found");
});

test("prepare RPC success returns derived item index and retired pending paths", () => {
  const result = parsePrepareOrderDraftFileUploadRpcResult([
    {
      result_code: "prepared",
      prepared_file_id: FILE_ID,
      item_index: 1,
      retired_storage_paths: [PENDING_STORAGE_PATH, FAILED_STORAGE_PATH],
    },
  ]);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.fileId, FILE_ID);
  assert.equal(result.data.itemIndex, 1);
  assert.deepEqual(result.data.retiredStoragePaths, [
    PENDING_STORAGE_PATH,
    FAILED_STORAGE_PATH,
  ]);
});

test("completion requires a pending row", () => {
  assert.equal(isPendingDraftFile(fileRow({ uploadStatus: "pending" })), true);
  assert.equal(isPendingDraftFile(fileRow({ uploadStatus: "uploaded" })), false);
  assert.equal(
    isPendingDraftFile(
      fileRow({
        uploadStatus: "pending",
        deletedAt: "2026-06-27T11:25:36.123Z",
      }),
    ),
    false,
  );
});

test("completion RPC parser preserves retired uploaded paths", () => {
  const result = parseCompleteOrderDraftFileUploadRpcResult([
    {
      result_code: "completed",
      completed_file_id: FILE_ID,
      retired_storage_paths: [`drafts/${USER_ID}/${DRAFT_ID}/${FILE_ID_2}/old.jpg`],
    },
  ]);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.fileId, FILE_ID);
  assert.deepEqual(result.data.retiredStoragePaths, [
    `drafts/${USER_ID}/${DRAFT_ID}/${FILE_ID_2}/old.jpg`,
  ]);
});

test("object-missing completion does not replace the current uploaded row", () => {
  const result = verifyStoredDraftObject(fileRow({ uploadStatus: "pending" }), null);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "upload_not_found");
});

test("object-size mismatch does not replace the current uploaded row", () => {
  const result = verifyStoredDraftObject(fileRow({ uploadStatus: "pending" }), {
    name: "room.jpg",
    size: 1,
    contentType: "image/jpeg",
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "upload_mismatch");
});

test("successful completion retires the previous uploaded slot", () => {
  const completed = fileRow({
    id: FILE_ID_2,
    uploadStatus: "uploaded",
    storagePath: `drafts/${USER_ID}/${DRAFT_ID}/${FILE_ID_2}/new.jpg`,
  });
  const retired = getRetiredUploadedStoragePathsForSlot(
    [
      fileRow(),
      fileRow({
        id: "77777777-7777-4777-8777-777777777777",
        kind: "reference",
        storagePath: "drafts/other/reference.jpg",
      }),
      fileRow({
        id: "88888888-8888-4888-8888-888888888888",
        uploadStatus: "pending",
        storagePath: "drafts/other/pending.jpg",
      }),
    ],
    completed,
  );
  assert.deepEqual(retired, [`drafts/${USER_ID}/${DRAFT_ID}/${FILE_ID}/room.jpg`]);
});

test("soft delete does not physically delete metadata", () => {
  const payload = buildDraftFileSoftDeletePayload(
    new Date("2026-06-27T11:22:36.123Z"),
  );
  assert.deepEqual(payload, {
    upload_status: "deleted",
    deleted_at: "2026-06-27T11:22:36.123Z",
  });
  assert.equal("storage_path" in payload, false);
});

test("soft delete RPC returns a Storage path only after successful mutation", () => {
  const result = parseSoftDeleteOrderDraftFileRpcResult([
    {
      result_code: "deleted",
      deleted_file_id: FILE_ID,
      storage_path: PENDING_STORAGE_PATH,
    },
  ]);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.storagePath, PENDING_STORAGE_PATH);
});

test("zero-row soft delete does not return a Storage path", () => {
  const result = parseSoftDeleteOrderDraftFileRpcResult([
    {
      result_code: "not_found",
      deleted_file_id: null,
      storage_path: PENDING_STORAGE_PATH,
    },
  ]);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "not_found");
  assert.equal(JSON.stringify(result).includes("drafts/"), false);
});

test("moved draft files cannot be soft-deleted through the parser", () => {
  const result = parseSoftDeleteOrderDraftFileRpcResult([
    {
      result_code: "invalid_file_status",
      deleted_file_id: FILE_ID,
      storage_path: PENDING_STORAGE_PATH,
    },
  ]);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "invalid_status");
});

test("inactive or expired draft RPC results map to a safe status", () => {
  const result = parsePrepareOrderDraftFileUploadRpcResult([
    {
      result_code: "invalid_status",
      prepared_file_id: null,
      item_index: null,
      retired_storage_paths: [],
    },
  ]);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "invalid_status");
  assert.equal(JSON.stringify(result).includes("order_drafts"), false);
});

test("migration wraps the index replacement and RPC definitions in a transaction", () => {
  assert.match(MIGRATION_SQL, /^\s*BEGIN;/m);
  assert.match(MIGRATION_SQL, /^\s*COMMIT;/m);
  assert.ok(
    MIGRATION_SQL.indexOf("BEGIN;") <
      MIGRATION_SQL.indexOf("DROP INDEX IF EXISTS public.order_draft_files_one_active_kind_per_item"),
  );
});

test("prepare RPC checks draft version and item before inserting metadata", () => {
  const versionCheck = MIGRATION_SQL.indexOf("v_draft.version <> p_expected_version");
  const itemLookup = MIGRATION_SQL.indexOf("jsonb_array_elements(v_draft.state->'items')");
  const insertMetadata = MIGRATION_SQL.indexOf("INSERT INTO public.order_draft_files");

  assert.ok(versionCheck > 0);
  assert.ok(itemLookup > versionCheck);
  assert.ok(insertMetadata > itemLookup);
});

test("prepare RPC retires pending and failed rows without retiring uploaded rows", () => {
  const prepareSection = MIGRATION_SQL.slice(
    MIGRATION_SQL.indexOf("CREATE OR REPLACE FUNCTION public.prepare_order_draft_file_upload"),
    MIGRATION_SQL.indexOf("-- Atomic completion RPC"),
  );

  assert.match(prepareSection, /upload_status IN \('pending', 'failed'\)/);
  assert.equal(prepareSection.includes("upload_status = 'uploaded'"), false);
});

test("soft delete RPC rejects moved files before returning a Storage path", () => {
  const movedCheck = MIGRATION_SQL.indexOf(
    "v_target.upload_status NOT IN ('pending', 'uploaded', 'failed')",
  );
  const updateMetadata = MIGRATION_SQL.indexOf(
    "UPDATE public.order_draft_files",
    MIGRATION_SQL.indexOf("CREATE OR REPLACE FUNCTION public.soft_delete_order_draft_file"),
  );
  const successReturn = MIGRATION_SQL.indexOf(
    "RETURN QUERY SELECT 'deleted'::text, p_file_id, v_target.storage_path",
  );

  assert.ok(movedCheck > 0);
  assert.ok(updateMetadata > movedCheck);
  assert.ok(successReturn > updateMetadata);
});

test("signed URL failure marks only the new pending file failed", () => {
  assert.match(
    FILES_SERVER_SOURCE,
    /await markDraftFileFailedBestEffort\(draftId, fileId\)/,
  );

  const markFailedSection = FILES_SERVER_SOURCE.slice(
    FILES_SERVER_SOURCE.indexOf("async function markDraftFileFailedBestEffort"),
    FILES_SERVER_SOURCE.indexOf("async function removeStorageObjectsBestEffort"),
  );
  assert.match(markFailedSection, /\.eq\("id", fileId\)/);
  assert.match(markFailedSection, /\.eq\("draft_id", draftId\)/);
  assert.match(markFailedSection, /\.is\("deleted_at", null\)/);
  assert.match(markFailedSection, /\.eq\("upload_status", "pending"\)/);
});
