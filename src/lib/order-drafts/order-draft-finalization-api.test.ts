import assert from "node:assert/strict";
import test from "node:test";
import {
  draftFinalizationBodyValidationResponse,
  draftFinalizationErrorResponse,
  draftFinalizationResultToResponse,
  draftFinalizationSuccessResponse,
  parseDraftFinalizationJsonRequest,
  profileIncompleteDraftFinalizationResponse,
  unauthenticatedDraftFinalizationResponse,
} from "./finalization-api.ts";

const FINALIZATION_KEY = "77777777-7777-4777-8777-777777777777";

async function responseJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("success responses use data envelope and no-store header", async () => {
  const response = draftFinalizationSuccessResponse({ orderNumber: "VS-0001" });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await responseJson(response), {
    data: { orderNumber: "VS-0001" },
  });
});

test("invalid JSON returns invalid_json", async () => {
  const result = await parseDraftFinalizationJsonRequest(
    new Request("https://example.test/api/order-drafts/id/submit", {
      method: "POST",
      body: "{",
    }),
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.response.status, 400);
  assert.deepEqual(await responseJson(result.response), {
    error: "Invalid JSON body.",
    code: "invalid_json",
  });
});

test("body validation rejects missing expectedVersion", async () => {
  const response = draftFinalizationBodyValidationResponse({
    finalizationKey: FINALIZATION_KEY,
  });
  assert.ok(response);
  assert.equal(response.status, 400);
  assert.equal((await responseJson(response)).code, "invalid_input");
});

test("body validation rejects invalid UUID", async () => {
  const response = draftFinalizationBodyValidationResponse({
    expectedVersion: 4,
    finalizationKey: "bad",
  });
  assert.ok(response);
  assert.equal(response.status, 400);
  assert.equal((await responseJson(response)).code, "invalid_input");
});

test("body validation accepts expected shape", () => {
  assert.equal(
    draftFinalizationBodyValidationResponse({
      expectedVersion: 4,
      finalizationKey: FINALIZATION_KEY,
    }),
    null,
  );
});

test("unauthenticated response uses safe code", async () => {
  const response = unauthenticatedDraftFinalizationResponse();
  assert.equal(response.status, 401);
  assert.equal((await responseJson(response)).code, "unauthenticated");
});

test("profile incomplete response uses safe code", async () => {
  const response = profileIncompleteDraftFinalizationResponse();
  assert.equal(response.status, 422);
  assert.equal((await responseJson(response)).code, "profile_incomplete");
});

test("result errors map to HTTP statuses", async () => {
  const cases = [
    ["not_found", 404],
    ["version_conflict", 409],
    ["finalization_conflict", 409],
    ["missing_original", 422],
    ["file_mismatch", 409],
    ["database_error", 500],
    ["finalization_incomplete", 503],
  ] as const;

  for (const [code, status] of cases) {
    const response = draftFinalizationResultToResponse({
      ok: false,
      code,
      message: code,
    });
    assert.equal(response.status, status);
    assert.equal((await responseJson(response)).code, code);
  }
});

test("result success passes through data", async () => {
  const response = draftFinalizationResultToResponse({
    ok: true,
    data: { orderNumber: "VS-0001" },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await responseJson(response), {
    data: { orderNumber: "VS-0001" },
  });
});

test("manual error response includes details only when provided", async () => {
  const response = draftFinalizationErrorResponse(
    "bad",
    "invalid_input",
    400,
    { form: "details" },
  );
  assert.deepEqual(await responseJson(response), {
    error: "bad",
    code: "invalid_input",
    details: { form: "details" },
  });
});
