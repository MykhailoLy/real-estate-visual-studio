import assert from "node:assert/strict";
import test from "node:test";
import {
  containsDisallowedDraftPayloadValue,
  createOrderDraftValidationResponse,
  DeleteOrderDraftBodySchema,
  deleteOrderDraftValidationResponse,
  draftUpdateResultToResponse,
  orderDraftSuccessResponse,
  parseDraftListLimit,
  parseOrderDraftJsonRequest,
  repositoryResultToResponse,
  unauthenticatedOrderDraftResponse,
  updateOrderDraftValidationResponse,
} from "./api.ts";
import type {
  DraftUpdateResult,
  OrderDraftRepositoryResult,
} from "./types.ts";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

function validEnvelope() {
  return {
    schemaVersion: 1,
    jobTitle: "123 Main Street",
    currentStep: "details",
    items: [
      {
        clientItemId: UUID_A,
        state: { room: "Living Room" },
      },
    ],
  };
}

function validCreateBody() {
  return {
    serviceType: "virtual-staging",
    route: "/dashboard/orders/new/virtual-staging",
    state: validEnvelope(),
    currency: "USD",
  };
}

function validUpdateBody() {
  return {
    expectedVersion: 1,
    title: "Updated draft",
  };
}

async function responseJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("success responses use the data envelope and no-store cache header", async () => {
  const response = orderDraftSuccessResponse({ id: UUID_B }, 201);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await responseJson(response), { data: { id: UUID_B } });
});

test("unauthenticated response uses the standard error envelope", async () => {
  const response = unauthenticatedOrderDraftResponse();
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await responseJson(response), {
    error: "Authentication is required.",
    code: "unauthenticated",
  });
});

test("invalid JSON returns a 400 error response", async () => {
  const result = await parseOrderDraftJsonRequest(
    new Request("https://example.test/api/order-drafts", {
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

test("request size guard rejects oversized JSON bodies", async () => {
  const result = await parseOrderDraftJsonRequest(
    new Request("https://example.test/api/order-drafts", {
      method: "POST",
      headers: { "content-length": String(300 * 1024) },
      body: "{}",
    }),
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.response.status, 400);
  assert.equal((await responseJson(result.response)).code, "invalid_input");
});

test("embedded file data is rejected before schema validation", async () => {
  const result = await parseOrderDraftJsonRequest(
    new Request("https://example.test/api/order-drafts", {
      method: "POST",
      body: JSON.stringify({
        state: {
          items: [{ photo: "data:image/png;base64,abcd" }],
        },
      }),
    }),
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.response.status, 400);
  assert.equal((await responseJson(result.response)).code, "invalid_input");
});

test("base64-like embedded blobs are rejected", () => {
  assert.equal(containsDisallowedDraftPayloadValue("YWJjZA=="), false);
  assert.equal(
    containsDisallowedDraftPayloadValue("a".repeat(4096)),
    false,
  );
  assert.equal(
    containsDisallowedDraftPayloadValue("a".repeat(4096) + "aaaa"),
    true,
  );
});

test("repository results map to HTTP statuses", async () => {
  const cases: Array<[OrderDraftRepositoryResult<unknown>, number, string]> = [
    [{ ok: false, code: "invalid_input", message: "bad" }, 400, "invalid_input"],
    [{ ok: false, code: "not_found", message: "missing" }, 404, "not_found"],
    [{ ok: false, code: "database_error", message: "db" }, 500, "database_error"],
  ];

  for (const [result, status, code] of cases) {
    const response = repositoryResultToResponse(result);
    assert.equal(response.status, status);
    assert.equal((await responseJson(response)).code, code);
  }
});

test("update results preserve optimistic-concurrency status mapping", async () => {
  const cases: Array<[DraftUpdateResult<unknown>, number, string]> = [
    [{ ok: false, code: "invalid_input", message: "bad" }, 400, "invalid_input"],
    [{ ok: false, code: "not_found", message: "missing" }, 404, "not_found"],
    [
      { ok: false, code: "version_conflict", message: "changed" },
      409,
      "version_conflict",
    ],
    [
      { ok: false, code: "invalid_status", message: "closed" },
      422,
      "invalid_status",
    ],
    [{ ok: false, code: "database_error", message: "db" }, 500, "database_error"],
  ];

  for (const [result, status, code] of cases) {
    const response = draftUpdateResultToResponse(result);
    assert.equal(response.status, status);
    assert.equal((await responseJson(response)).code, code);
  }
});

test("update success response includes draft and version", async () => {
  const response = draftUpdateResultToResponse({
    ok: true,
    draft: { id: UUID_B },
    version: 2,
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await responseJson(response), {
    data: { draft: { id: UUID_B }, version: 2 },
  });
});

test("list limit query parsing uses default and bounds", () => {
  assert.equal(parseDraftListLimit(new URLSearchParams()), 20);
  assert.equal(parseDraftListLimit(new URLSearchParams("limit=")), 20);
  assert.equal(parseDraftListLimit(new URLSearchParams("limit=10.8")), 10);
  assert.equal(parseDraftListLimit(new URLSearchParams("limit=0")), 1);
  assert.equal(parseDraftListLimit(new URLSearchParams("limit=250")), 100);
  assert.equal(parseDraftListLimit(new URLSearchParams("limit=abc")), 20);
});

test("DELETE body validation is strict and requires expectedVersion", async () => {
  assert.equal(
    DeleteOrderDraftBodySchema.safeParse({ expectedVersion: 3 }).success,
    true,
  );
  for (const body of [
    {},
    { expectedVersion: 0 },
    { expectedVersion: 1, status: "deleted" },
  ]) {
    const response = deleteOrderDraftValidationResponse(body);
    assert.ok(response);
    assert.equal(response.status, 400);
    assert.equal((await responseJson(response)).code, "invalid_input");
  }
});

test("create payload rejects trusted browser-controlled fields", async () => {
  for (const field of ["userId", "status", "updatedAt", "expiresAt"] as const) {
    const response = createOrderDraftValidationResponse({
      ...validCreateBody(),
      [field]: field === "userId" ? UUID_A : "active",
    });
    assert.ok(response, `${field} should be rejected`);
    assert.equal(response.status, 400);
    assert.equal((await responseJson(response)).code, "invalid_input");
  }
});

test("update payload rejects trusted browser-controlled fields", async () => {
  for (const field of [
    "userId",
    "status",
    "updatedAt",
    "lastAutosavedAt",
    "expiresAt",
    "convertedOrderId",
  ] as const) {
    const response = updateOrderDraftValidationResponse({
      ...validUpdateBody(),
      [field]: field === "userId" ? UUID_A : "active",
    });
    assert.ok(response, `${field} should be rejected`);
    assert.equal(response.status, 400);
    assert.equal((await responseJson(response)).code, "invalid_input");
  }
});
