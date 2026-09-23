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
import {
  getVirtualStagingDraftFinalizationStatus,
  submitOrderDraft,
} from "./finalization-client.ts";
import { PRICING_VERSION } from "../pricing/catalog.ts";
import { WELCOME_OFFER_VERSION } from "../welcome-offer.ts";
import { shouldPreserveDraftFinalizationKeyAfterFailure } from "./finalization.ts";

const FINALIZATION_KEY = "77777777-7777-4777-8777-777777777777";
const DRAFT_ID = "22222222-2222-4222-8222-222222222222";

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

test("body validation accepts the narrow pricing expectation and rejects pricing authority fields", () => {
  const pricingExpectation = {
    pricingVersion: PRICING_VERSION,
    welcomeOfferVersion: WELCOME_OFFER_VERSION,
    welcomeBenefitKey: "virtual-staging-first-image-50",
    totalCents: 2900,
  } as const;
  assert.equal(
    draftFinalizationBodyValidationResponse({
      expectedVersion: 4,
      finalizationKey: FINALIZATION_KEY,
      pricingExpectation,
    }),
    null,
  );
  const response = draftFinalizationBodyValidationResponse({
    expectedVersion: 4,
    finalizationKey: FINALIZATION_KEY,
    pricingExpectation: {
      ...pricingExpectation,
      discountCents: 2900,
    },
  });
  assert.ok(response);
  assert.equal(response.status, 400);
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
    ["pricing_changed", 409],
    ["client_upgrade_required", 409],
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

test("pricing conflict response and typed client preserve the authoritative snapshot", async () => {
  const currentPricingSnapshot = {
    pricingVersion: PRICING_VERSION,
    totalCents: 5800,
    welcomeOffer: { benefits: [] },
  } as never;
  const response = draftFinalizationResultToResponse({
    ok: false,
    code: "pricing_changed",
    message: "Review the current price.",
    currentPricingSnapshot,
  });
  assert.equal(response.status, 409);
  assert.deepEqual(
    (await responseJson(response)).currentPricingSnapshot,
    currentPricingSnapshot,
  );

  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    return Response.json(
      {
        error: "Review the current price.",
        code: "pricing_changed",
        currentPricingSnapshot,
      },
      { status: 409 },
    );
  };

  try {
    const pricingExpectation = {
      pricingVersion: PRICING_VERSION,
      welcomeOfferVersion: WELCOME_OFFER_VERSION,
      welcomeBenefitKey: "virtual-staging-first-image-50" as const,
      totalCents: 2900,
    };
    const result = await submitOrderDraft(
      DRAFT_ID,
      4,
      FINALIZATION_KEY,
      pricingExpectation,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.deepEqual(result.currentPricingSnapshot, currentPricingSnapshot);
    assert.equal(shouldPreserveDraftFinalizationKeyAfterFailure(result), false);
    assert.deepEqual(
      JSON.parse(String(calls[0]?.init?.body)).pricingExpectation,
      pricingExpectation,
    );
  } finally {
    globalThis.fetch = originalFetch;
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

test("confirmed released storage failure reaches the client and unlocks the old attempt", async () => {
  const failure = {
    ok: false as const,
    code: "storage_error" as const,
    message: "Draft file could not be copied. Edit the draft or try again.",
    draftReleased: true as const,
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => draftFinalizationResultToResponse(failure);
  try {
    const result = await submitOrderDraft(DRAFT_ID, 4, FINALIZATION_KEY);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 500);
    assert.equal(result.draftReleased, true);
    assert.equal(shouldPreserveDraftFinalizationKeyAfterFailure(result), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("post-claim unconfirmed release reaches the client as a retry-preserving 409 conflict", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => draftFinalizationResultToResponse({
    ok: false,
    code: "finalization_conflict",
    message: "Draft release could not be confirmed. Retry the same attempt.",
  });
  try {
    const result = await submitOrderDraft(DRAFT_ID, 4, FINALIZATION_KEY);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "finalization_conflict");
    assert.equal(result.status, 409);
    assert.equal(result.draftReleased, undefined);
    assert.equal(shouldPreserveDraftFinalizationKeyAfterFailure(result), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("old, malformed, and ambiguous responses never authorize clearing the retry lock", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const draftReleased of [undefined, false, "true", 1, null]) {
      globalThis.fetch = async () => Response.json({
        code: "storage_error", error: "Storage outcome unknown.", draftReleased,
      }, { status: 500 });
      const result = await submitOrderDraft(DRAFT_ID, 4, FINALIZATION_KEY);
      assert.equal(result.ok, false);
      if (result.ok) continue;
      assert.equal(result.draftReleased, undefined);
      assert.equal(shouldPreserveDraftFinalizationKeyAfterFailure(result), true);
    }
    for (const code of ["database_error", "finalization_incomplete", "finalization_conflict"] as const) {
      const response = draftFinalizationResultToResponse({
        ok: false, code, message: "Outcome unknown.", draftReleased: true,
      });
      assert.equal("draftReleased" in await responseJson(response), false);
      globalThis.fetch = async () => Response.json({
        code, error: "Outcome unknown.", draftReleased: true,
      }, { status: code === "finalization_incomplete" ? 503 : 500 });
      const result = await submitOrderDraft(DRAFT_ID, 4, FINALIZATION_KEY);
      assert.equal(result.ok, false);
      if (result.ok) continue;
      assert.equal(result.draftReleased, undefined);
      assert.equal(shouldPreserveDraftFinalizationKeyAfterFailure(result), true);
    }
    globalThis.fetch = async () => Response.json({
      code: "storage_error", error: "Storage outcome unknown.", draftReleased: true,
    }, { status: 503 });
    const result = await submitOrderDraft(DRAFT_ID, 4, FINALIZATION_KEY);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.draftReleased, undefined);
      assert.equal(shouldPreserveDraftFinalizationKeyAfterFailure(result), true);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
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

test("typed finalization-status client encodes route and uses no-store", async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    return Response.json({
      data: {
        status: "reconciliation_required",
        draftId: DRAFT_ID,
        expectedVersion: 8,
        orderId: "88888888-8888-4888-8888-888888888888",
        orderNumber: "VS-0010",
      },
    });
  };

  try {
    const result = await getVirtualStagingDraftFinalizationStatus(DRAFT_ID);
    assert.equal(result.ok, true);
    assert.equal(
      String(calls[0]?.input),
      `/api/order-drafts/${DRAFT_ID}/finalization-status`,
    );
    assert.equal(calls[0]?.init?.method, "GET");
    assert.equal(calls[0]?.init?.cache, "no-store");
    if (!result.ok) return;
    assert.equal(result.data.status, "reconciliation_required");
    assert.equal("finalizationKey" in result.data, false);
    assert.equal("storagePath" in result.data, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("typed finalization-status client rejects malformed reconciliation DTOs", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      data: {
        status: "reconciliation_required",
        draftId: DRAFT_ID,
      },
    });

  try {
    const result = await getVirtualStagingDraftFinalizationStatus(DRAFT_ID);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "unexpected_error");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
