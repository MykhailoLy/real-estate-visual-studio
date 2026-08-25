import assert from "node:assert/strict";
import test from "node:test";
import {
  completeDraftReferenceFile,
  listDraftReferenceFiles,
  prepareDraftReferenceFile,
} from "./draft-reference-files-client.ts";
import type { DraftReferenceFileSummary } from "./draft-reference-files.ts";

const DRAFT_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_ID = "22222222-2222-4222-8222-222222222222";
const FIRST_ID = "33333333-3333-4333-8333-333333333333";
const SECOND_ID = "44444444-4444-4444-8444-444444444444";

function summary(
  id: string,
  overrides: Partial<DraftReferenceFileSummary> = {},
): DraftReferenceFileSummary {
  return {
    id,
    draftFileId: id,
    itemClientId: ITEM_ID,
    position: 0,
    file: null,
    filename: "reference.png",
    fileSize: 1024,
    mimeType: "image/png",
    lastModified: null,
    previewUrl: null,
    previewExpiresAt: null,
    storagePath: null,
    ...overrides,
  };
}

test("prepare, complete and restored references expose one canonical summary shape", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  const prepared = summary(FIRST_ID);
  const completed = summary(FIRST_ID, {
    previewUrl: "https://storage.example/object/sign/order-files/reference.png?token=fixture",
    previewExpiresAt: "2099-01-01T00:00:00.000Z",
  });
  let requestNumber = 0;
  globalThis.fetch = async () => {
    requestNumber += 1;
    if (requestNumber === 1) {
      return Response.json(
        {
          data: {
            reference: prepared,
            upload: {
              bucket: "order-files",
              path: "draft/reference.png",
              token: "fixture-token",
              signedUrl: "https://storage.example/upload/sign/reference.png",
            },
          },
        },
        { status: 201 },
      );
    }
    if (requestNumber === 2) return Response.json({ data: completed });
    return Response.json({ data: [completed] });
  };

  const preparedResult = await prepareDraftReferenceFile(DRAFT_ID, {
    itemClientId: ITEM_ID,
    referenceId: FIRST_ID,
    position: 0,
    filename: "reference.png",
    fileSize: 1024,
    mimeType: "image/png",
  });
  assert.equal(preparedResult.ok, true);
  if (!preparedResult.ok) return;

  const completedResult = await completeDraftReferenceFile(DRAFT_ID, FIRST_ID);
  assert.equal(completedResult.ok, true);
  if (!completedResult.ok) return;

  const restoredResult = await listDraftReferenceFiles(DRAFT_ID);
  assert.equal(restoredResult.ok, true);
  if (!restoredResult.ok) return;

  assert.equal(preparedResult.data.reference.id, completedResult.data.id);
  assert.deepEqual(restoredResult.data, [completedResult.data]);
  assert.equal(completedResult.data.file, null);
  assert.equal(completedResult.data.storagePath, null);
});

test("two restored references sharing a filename keep distinct server identities", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () =>
    Response.json({
      data: [
        summary(FIRST_ID, { filename: "same.png", position: 0 }),
        summary(SECOND_ID, { filename: "same.png", position: 1 }),
      ],
    });

  const result = await listDraftReferenceFiles(DRAFT_ID);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(result.data.map((reference) => reference.filename), [
    "same.png",
    "same.png",
  ]);
  assert.deepEqual(result.data.map((reference) => reference.id), [
    FIRST_ID,
    SECOND_ID,
  ]);
});

test("failed signature validation preserves invalid_upload for inline UI handling", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () =>
    Response.json(
      {
        error: "Uploaded file contents do not match the expected file type.",
        code: "invalid_upload",
      },
      { status: 400 },
    );

  const result = await completeDraftReferenceFile(DRAFT_ID, FIRST_ID);
  assert.equal(result.ok, false);
  if (result.ok) return;

  assert.equal(result.status, 400);
  assert.equal(result.code, "invalid_upload");
  assert.match(result.message, /do not match/);
});
