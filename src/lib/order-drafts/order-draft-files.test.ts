import assert from "node:assert/strict";
import test from "node:test";
import { MAX_FILE_SIZE_BYTES } from "../upload-config.ts";
import {
  PrepareOrderDraftFileUploadInputSchema,
  buildDraftFileSoftDeletePayload,
  buildDraftStoragePath,
  filterUploadedDraftFiles,
  findDraftItemIndex,
  getDraftStoragePathParts,
  getRetiredUploadedStoragePathsForSlot,
  isDraftFileAllowedForDraft,
  isPendingDraftFile,
  mapOrderDraftFilePublicSummary,
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
