import assert from "node:assert/strict";
import test from "node:test";
import { MAX_FILE_SIZE_BYTES } from "../upload-config.ts";
import {
  completeOrderDraftFileUpload,
  deleteOrderDraftFile,
  listOrderDraftFiles,
  prepareOrderDraftFileUpload,
} from "./files-client.ts";
import {
  disallowsTrustedDraftFileFields,
  draftFileResultToResponse,
  invalidDraftFileRouteIdResponse,
  orderDraftFileSuccessResponse,
  prepareDraftFileValidationResponse,
  unauthenticatedDraftFileResponse,
  validateDraftFileRouteId,
} from "./files-api.ts";
import { parseSoftDeleteOrderDraftFileRpcResult } from "./files.ts";

const DRAFT_ID = "22222222-2222-4222-8222-222222222222";
const FILE_ID = "33333333-3333-4333-8333-333333333333";
const ITEM_ID = "55555555-5555-4555-8555-555555555555";

async function responseJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

function validPrepareBody() {
  return {
    itemClientId: ITEM_ID,
    kind: "original",
    filename: "room.jpg",
    contentType: "image/jpeg",
    size: 123456,
  };
}

test("success responses use the data envelope and no-store cache header", async () => {
  const response = orderDraftFileSuccessResponse({ id: FILE_ID }, 201);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await responseJson(response), { data: { id: FILE_ID } });
});

test("unauthenticated routes map to 401", async () => {
  const response = unauthenticatedDraftFileResponse();
  assert.equal(response.status, 401);
  assert.deepEqual(await responseJson(response), {
    error: "Authentication is required.",
    code: "unauthenticated",
  });
});

test("ownership mismatch maps to 404", async () => {
  const response = draftFileResultToResponse({
    ok: false,
    code: "not_found",
    message: "Draft was not found.",
  });
  assert.equal(response.status, 404);
  assert.equal((await responseJson(response)).code, "not_found");
});

test("route UUID validation rejects invalid identifiers", async () => {
  assert.equal(validateDraftFileRouteId(DRAFT_ID), true);
  assert.equal(validateDraftFileRouteId("not-a-uuid"), false);
  assert.equal(invalidDraftFileRouteIdResponse().status, 400);
});

test("client cannot supply userId bucket path service type or item index", () => {
  const body = {
    ...validPrepareBody(),
    userId: "11111111-1111-4111-8111-111111111111",
    bucket: "order-files",
    path: "drafts/evil",
    storagePath: "drafts/evil",
    serviceType: "virtual-staging",
    itemIndex: 0,
  };

  const response = prepareDraftFileValidationResponse(body);
  assert.ok(response);
  assert.equal(response.status, 400);
  assert.equal(disallowsTrustedDraftFileFields(body), true);
});

test("oversized prepare requests map to file_too_large", async () => {
  const response = prepareDraftFileValidationResponse({
    ...validPrepareBody(),
    size: MAX_FILE_SIZE_BYTES + 1,
  });
  assert.ok(response);
  assert.equal(response.status, 413);
  assert.equal((await responseJson(response)).code, "file_too_large");
});

test("file type errors map to a safe public status", async () => {
  const response = draftFileResultToResponse({
    ok: false,
    code: "file_type_not_allowed",
    message: "File type is not allowed for this draft.",
  });
  assert.equal(response.status, 400);
  assert.equal((await responseJson(response)).code, "file_type_not_allowed");
});

test("upload mismatch maps to conflict without exposing paths", async () => {
  const response = draftFileResultToResponse({
    ok: false,
    code: "upload_mismatch",
    message: "Uploaded file size did not match the expected draft file.",
  });
  const body = await responseJson(response);
  assert.equal(response.status, 409);
  assert.equal(body.code, "upload_mismatch");
  assert.equal(JSON.stringify(body).includes("drafts/"), false);
});

test("version conflicts map to conflict without exposing internals", async () => {
  const response = draftFileResultToResponse({
    ok: false,
    code: "version_conflict",
    message: "Draft has changed since it was loaded.",
  });
  const body = await responseJson(response);
  assert.equal(response.status, 409);
  assert.equal(body.code, "version_conflict");
  assert.equal(JSON.stringify(body).includes("order_drafts"), false);
});

test("moved file delete results map to safe invalid status", async () => {
  const result = parseSoftDeleteOrderDraftFileRpcResult([
    {
      result_code: "invalid_file_status",
      deleted_file_id: FILE_ID,
      storage_path: `drafts/${DRAFT_ID}/${FILE_ID}/moved.jpg`,
    },
  ]);
  const response = draftFileResultToResponse(result);
  const body = await responseJson(response);
  assert.equal(response.status, 422);
  assert.equal(body.code, "invalid_status");
  assert.equal(JSON.stringify(body).includes("drafts/"), false);
});

test("typed client helpers encode routes and use no-store", async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    return Response.json({ data: [] });
  };

  try {
    const result = await listOrderDraftFiles("draft id with spaces");
    assert.equal(result.ok, true);
    assert.equal(
      String(calls[0]?.input),
      "/api/order-drafts/draft%20id%20with%20spaces/files",
    );
    assert.equal(calls[0]?.init?.cache, "no-store");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("typed client prepare complete and delete keep route params encoded", async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    return Response.json({ data: { id: FILE_ID } });
  };

  try {
    await prepareOrderDraftFileUpload(DRAFT_ID, validPrepareBody());
    await completeOrderDraftFileUpload(DRAFT_ID, "file id");
    await deleteOrderDraftFile(DRAFT_ID, "file id");

    assert.equal(calls[0]?.init?.method, "POST");
    assert.equal(calls[0]?.init?.cache, "no-store");
    assert.equal(
      String(calls[1]?.input),
      `/api/order-drafts/${DRAFT_ID}/files/file%20id/complete`,
    );
    assert.equal(calls[1]?.init?.body, undefined);
    assert.equal(
      String(calls[2]?.input),
      `/api/order-drafts/${DRAFT_ID}/files/file%20id`,
    );
    assert.equal(calls[2]?.init?.method, "DELETE");
    assert.equal(calls[2]?.init?.body, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AbortError remains abort behavior in the typed client", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new DOMException("The operation was aborted.", "AbortError");
  };

  try {
    await assert.rejects(
      () => listOrderDraftFiles(DRAFT_ID, new AbortController().signal),
      (error: unknown) =>
        error instanceof DOMException && error.name === "AbortError",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("non-DOMException AbortError remains abort behavior in the typed client", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    const error = new Error("The operation was aborted.");
    error.name = "AbortError";
    throw error;
  };

  try {
    await assert.rejects(
      () => listOrderDraftFiles(DRAFT_ID, new AbortController().signal),
      (error: unknown) =>
        error instanceof Error && error.name === "AbortError",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
