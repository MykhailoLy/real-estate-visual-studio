import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DraftFinalizationBodySchema,
  buildTrustedFinalPathForDraftFile,
  buildTrustedMovedDraftFiles,
  draftFinalizationMovedPayloadContainsOnlyTrustedFields,
  isExactDraftStoragePathForFile,
  isOwnershipSafeFinalizationNotFound,
  mapClaimCodeToPublicError,
  mapVirtualStagingDraftStateToProductionItems,
  parseClaimFinalizationRpcResult,
  resetVirtualStagingFinalizationIdentity,
  selectVirtualStagingDraftSubmissionMode,
  shouldApplyVirtualStagingFinalizationResult,
  shouldAutomaticallyRetryVirtualStagingFinalization,
  validateAndMatchVirtualStagingDraftFiles,
  validateVirtualStagingDraftForFinalization,
} from "./finalization.ts";
import {
  isVirtualStagingFinalSubmissionReady,
  type VirtualStagingDraftState,
} from "./virtual-staging.ts";
import type { OrderDraftFileRow, OrderDraftRow } from "./types.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const DRAFT_ID = "22222222-2222-4222-8222-222222222222";
const ITEM_ID = "33333333-3333-4333-8333-333333333333";
const ITEM_ID_2 = "44444444-4444-4444-8444-444444444444";
const ORIGINAL_ID = "55555555-5555-4555-8555-555555555555";
const REFERENCE_ID = "66666666-6666-4666-8666-666666666666";
const FINALIZATION_KEY = "77777777-7777-4777-8777-777777777777";
const ORDER_ID = "88888888-8888-4888-8888-888888888888";

const SQL = readFileSync("supabase/add-order-draft-finalization.sql", "utf8");
const ORDER_ROUTE = readFileSync("src/app/(public)/api/order/route.ts", "utf8");
const FINALIZATION_SERVER = readFileSync(
  "src/lib/order-drafts/finalization-server.ts",
  "utf8",
);
const ORDER_SERVICE = readFileSync(
  "src/lib/orders/create-order-server.ts",
  "utf8",
);

function draftState(overrides: Partial<VirtualStagingDraftState> = {}): VirtualStagingDraftState {
  return {
    schemaVersion: 1,
    jobTitle: "123 Main Street",
    currentStep: "virtual-staging-form",
    termsUi: {
      accepted: true,
      allowPortfolio: true,
    },
    metadata: {
      service: "virtual-staging",
    },
    items: [
      {
        clientItemId: ITEM_ID,
        state: {
          roomName: "Living Room",
          furnitureStyle: "Modern",
          fileSizeLimit: "",
          disclaimerText: "",
          referenceLink: "",
          additionalInfo: "Use warm accents",
          selectedAddons: ["day-to-dusk"],
          originalFilename: "living.jpg",
          referenceFilename: "style.png",
        },
      },
    ],
    ...overrides,
  };
}

function draftRow(overrides: Partial<OrderDraftRow> = {}): OrderDraftRow {
  return {
    id: DRAFT_ID,
    userId: USER_ID,
    serviceType: "virtual-staging",
    subService: null,
    route: "/dashboard/orders/new/virtual-staging",
    title: "123 Main Street",
    currentStep: "virtual-staging-form",
    state: draftState(),
    stateSchemaVersion: 1,
    pricingPreview: {
      nonAuthoritative: true,
      preview: { totalCents: 1 },
    },
    pricingVersionSeen: null,
    currency: "CAD",
    region: "CA",
    status: "converting",
    version: 4,
    finalizationKey: FINALIZATION_KEY,
    convertedOrderId: null,
    createdAt: "2026-06-28T10:00:00.000Z",
    updatedAt: "2026-06-28T10:00:00.000Z",
    lastAutosavedAt: "2026-06-28T10:00:00.000Z",
    expiresAt: "2026-07-28T10:00:00.000Z",
    convertedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

function draftFile(overrides: Partial<OrderDraftFileRow> = {}): OrderDraftFileRow {
  const id = overrides.id ?? ORIGINAL_ID;
  const originalFilename = overrides.originalFilename ?? "living.jpg";
  return {
    id,
    draftId: DRAFT_ID,
    itemClientId: ITEM_ID,
    itemIndex: 99,
    kind: "original",
    bucket: "order-files",
    storagePath: `drafts/${USER_ID}/${DRAFT_ID}/${id}/${originalFilename}`,
    originalFilename,
    fileSize: 1234,
    mimeType: "image/jpeg",
    contentHash: null,
    uploadStatus: "uploaded",
    createdAt: "2026-06-28T10:00:00.000Z",
    updatedAt: "2026-06-28T10:00:00.000Z",
    deletedAt: null,
    movedAt: null,
    ...overrides,
  };
}

test("finalization body validation accepts expected version and UUID key", () => {
  assert.equal(
    DraftFinalizationBodySchema.safeParse({
      expectedVersion: 4,
      finalizationKey: FINALIZATION_KEY,
    }).success,
    true,
  );
});

test("invalid UUID finalization key is rejected", () => {
  assert.equal(
    DraftFinalizationBodySchema.safeParse({
      expectedVersion: 4,
      finalizationKey: "not-a-uuid",
    }).success,
    false,
  );
});

test("stable claim result-code mapping parses known codes", () => {
  const result = parseClaimFinalizationRpcResult([
    {
      result_code: "claimed",
      draft_id: DRAFT_ID,
      converted_order_id: null,
    },
  ]);
  assert.equal(result.code, "claimed");
  assert.equal(result.draftId, DRAFT_ID);
  assert.equal(mapClaimCodeToPublicError("claimed"), null);
  assert.equal(mapClaimCodeToPublicError("version_conflict"), "version_conflict");
});

test("ownership-safe not-found mapping does not reveal ownership mismatch", () => {
  assert.equal(mapClaimCodeToPublicError("not_found"), "not_found");
  assert.equal(isOwnershipSafeFinalizationNotFound("not_found"), true);
});

test("claim RPC transitions active drafts to converting without version increment", () => {
  assert.match(SQL, /status = 'converting'/);
  assert.match(SQL, /finalization_key = p_finalization_key/);
  assert.doesNotMatch(SQL, /version = v_draft\.version \+ 1/);
});

test("same-key claim is idempotent", () => {
  assert.match(SQL, /v_draft\.finalization_key = p_finalization_key/);
  assert.match(SQL, /'already_claimed'::text/);
});

test("conflicting-key claim returns a safe conflict", () => {
  assert.match(SQL, /'finalization_conflict'::text/);
});

test("already-converted claim returns the converted order id", () => {
  const result = parseClaimFinalizationRpcResult({
    result_code: "already_converted",
    draft_id: DRAFT_ID,
    converted_order_id: ORDER_ID,
  });
  assert.equal(result.code, "already_converted");
  assert.equal(result.convertedOrderId, ORDER_ID);
});

test("source draft ID maps to one production order", () => {
  assert.match(SQL, /ADD COLUMN IF NOT EXISTS source_draft_id uuid NULL/);
  assert.match(SQL, /orders_source_draft_id_unique/);
  assert.match(ORDER_SERVICE, /orderInsert\.source_draft_id = input\.sourceDraftId/);
});

test("draft state maps to the production Staging item shape", () => {
  const result = mapVirtualStagingDraftStateToProductionItems(draftState());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data[0], {
    roomName: "Living Room",
    furnitureStyle: "Modern",
    fileSizeLimit: "",
    disclaimerText: "",
    referenceLink: "",
    additionalInfo: "Use warm accents",
    selectedAddons: ["day-to-dusk"],
  });
});

test("current schema version is required", () => {
  const result = validateVirtualStagingDraftForFinalization(
    draftRow({ stateSchemaVersion: 0 }),
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "invalid_status");
});

test("service and route must be Virtual Staging", () => {
  assert.equal(
    validateVirtualStagingDraftForFinalization(
      draftRow({ serviceType: "photo-editing" }),
    ).ok,
    false,
  );
  assert.equal(
    validateVirtualStagingDraftForFinalization(
      draftRow({ route: "/dashboard/orders/new/photo-editing" }),
    ).ok,
    false,
  );
});

test("canonical currency comes from the draft row", () => {
  assert.match(FINALIZATION_SERVER, /currency: draft\.currency/);
});

test("terms must be accepted", () => {
  const result = validateVirtualStagingDraftForFinalization(
    draftRow({
      state: draftState({
        termsUi: { accepted: false, allowPortfolio: false },
      }),
    }),
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "invalid_status");
});

test("pricing preview is ignored for final pricing", () => {
  assert.match(FINALIZATION_SERVER, /createProductionOrder/);
  assert.doesNotMatch(FINALIZATION_SERVER, /pricingPreview/);
});

test("files match by clientItemId, not itemIndex", () => {
  const state = draftState({
    items: [
      draftState().items[0],
      {
        ...draftState().items[0],
        clientItemId: ITEM_ID_2,
      },
    ],
  });
  const result = validateAndMatchVirtualStagingDraftFiles({
    verifiedUserId: USER_ID,
    draftId: DRAFT_ID,
    state,
    files: [
      draftFile({ itemIndex: 42 }),
      draftFile({
        id: "99999999-9999-4999-8999-999999999999",
        itemClientId: ITEM_ID_2,
        itemIndex: 0,
        originalFilename: "second.jpg",
        storagePath:
          `drafts/${USER_ID}/${DRAFT_ID}/99999999-9999-4999-8999-999999999999/second.jpg`,
      }),
    ],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data.map((slot) => slot.clientItemId), [
    ITEM_ID,
    ITEM_ID_2,
  ]);
});

test("one original is required per item", () => {
  const result = validateAndMatchVirtualStagingDraftFiles({
    verifiedUserId: USER_ID,
    draftId: DRAFT_ID,
    state: draftState(),
    files: [],
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "missing_original");
});

test("reference remains optional", () => {
  const result = validateAndMatchVirtualStagingDraftFiles({
    verifiedUserId: USER_ID,
    draftId: DRAFT_ID,
    state: draftState(),
    files: [draftFile()],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data[0].reference, null);
});

test("duplicate slot files are rejected", () => {
  const result = validateAndMatchVirtualStagingDraftFiles({
    verifiedUserId: USER_ID,
    draftId: DRAFT_ID,
    state: draftState(),
    files: [
      draftFile(),
      draftFile({
        id: "99999999-9999-4999-8999-999999999999",
        storagePath:
          `drafts/${USER_ID}/${DRAFT_ID}/99999999-9999-4999-8999-999999999999/living-2.jpg`,
      }),
    ],
  });
  assert.equal(result.ok, false);
});

test("unknown or orphaned active files are rejected", () => {
  const result = validateAndMatchVirtualStagingDraftFiles({
    verifiedUserId: USER_ID,
    draftId: DRAFT_ID,
    state: draftState(),
    files: [draftFile({ itemClientId: ITEM_ID_2 })],
  });
  assert.equal(result.ok, false);
});

test("path must match the exact verified user, draft, and file namespace", () => {
  assert.equal(
    isExactDraftStoragePathForFile({
      path: `drafts/${USER_ID}/${DRAFT_ID}/${ORIGINAL_ID}/living.jpg`,
      verifiedUserId: USER_ID,
      draftId: DRAFT_ID,
      fileId: ORIGINAL_ID,
    }),
    true,
  );
  assert.equal(
    validateAndMatchVirtualStagingDraftFiles({
      verifiedUserId: USER_ID,
      draftId: DRAFT_ID,
      state: draftState(),
      files: [draftFile({ storagePath: `drafts/${USER_ID}/${DRAFT_ID}/bad/living.jpg` })],
    }).ok,
    false,
  );
});

test("bucket must remain order-files", () => {
  const result = validateAndMatchVirtualStagingDraftFiles({
    verifiedUserId: USER_ID,
    draftId: DRAFT_ID,
    state: draftState(),
    files: [draftFile({ bucket: "public-files" as "order-files" })],
  });
  assert.equal(result.ok, false);
});

test("moved-file payload contains only trusted file IDs and final paths", () => {
  const payload = buildTrustedMovedDraftFiles([
    { draftFileId: ORIGINAL_ID, finalPath: "VS-0001/0-original.jpg" },
  ]);
  assert.deepEqual(payload, [
    { fileId: ORIGINAL_ID, finalPath: "VS-0001/0-original.jpg" },
  ]);
  assert.equal(draftFinalizationMovedPayloadContainsOnlyTrustedFields(payload), true);
});

test("final paths are generated server-side", () => {
  assert.equal(
    buildTrustedFinalPathForDraftFile({
      orderNumber: "VS-0001",
      itemIndex: 0,
      kind: "original",
      sourcePath: `drafts/${USER_ID}/${DRAFT_ID}/${ORIGINAL_ID}/living.JPG`,
      originalFilename: "living.JPG",
    }),
    "VS-0001/0-original/jpg".replace("/jpg", ".jpg"),
  );
  assert.match(ORDER_SERVICE, /buildFinalPath/);
});

test("draft finalization uses copy mode", () => {
  assert.match(FINALIZATION_SERVER, /storageMode: "copy"/);
});

test("ordinary /api/order continues using move mode", () => {
  assert.match(ORDER_ROUTE, /storageMode: "move"/);
});

test("final copy cleanup occurs on pre-order failure", () => {
  assert.match(ORDER_SERVICE, /cleanupFinalPaths\(supabase, copiedFinalPaths\)/);
});

test("source draft objects are retained until DB success", () => {
  const completeIndex = FINALIZATION_SERVER.indexOf("completeDraftFinalization");
  const cleanupIndex = FINALIZATION_SERVER.lastIndexOf("removeDraftSourcesBestEffort");
  assert.ok(completeIndex >= 0);
  assert.ok(cleanupIndex > completeIndex);
});

test("repeated finalization returns the same order boundary", () => {
  assert.match(SQL, /orders_source_draft_id_unique/);
  assert.equal(parseClaimFinalizationRpcResult({
    result_code: "already_converted",
    converted_order_id: ORDER_ID,
  }).convertedOrderId, ORDER_ID);
});

test("existing order with uncompleted draft is reconciled", () => {
  assert.match(FINALIZATION_SERVER, /reconcileExistingDraftOrder/);
  assert.match(SQL, /v_existing_order_id IS NOT NULL/);
});

test("local original with matching summary selects draft finalization", () => {
  assert.equal(selectVirtualStagingDraftSubmissionMode([
    {
      localOriginal: { name: "living.jpg", size: 1234, type: "image/jpeg" },
      uploadedOriginal: {
        id: ORIGINAL_ID,
        itemClientId: ITEM_ID,
        kind: "original",
        originalFilename: "living.jpg",
        fileSize: 1234,
        mimeType: "image/jpeg",
      },
    },
  ]).mode, "draft_finalization");
});

test("restored original with persisted summary selects draft finalization", () => {
  assert.equal(selectVirtualStagingDraftSubmissionMode([
    {
      localOriginal: null,
      uploadedOriginal: {
        id: ORIGINAL_ID,
        itemClientId: ITEM_ID,
        kind: "original",
        originalFilename: "living.jpg",
        fileSize: 1234,
        mimeType: "image/jpeg",
      },
    },
  ]).mode, "draft_finalization");
});

test("failed local replacement selects local fallback", () => {
  assert.equal(selectVirtualStagingDraftSubmissionMode([
    {
      localOriginal: { name: "new.jpg", size: 99, type: "image/jpeg" },
      uploadedOriginal: {
        id: ORIGINAL_ID,
        itemClientId: ITEM_ID,
        kind: "original",
        originalFilename: "old.jpg",
        fileSize: 1234,
        mimeType: "image/jpeg",
      },
    },
  ]).mode, "local_upload_fallback");
});

test("MIME and size mismatch prevents treating a summary as current local file", () => {
  assert.equal(selectVirtualStagingDraftSubmissionMode([
    {
      localOriginal: { name: "living.jpg", size: 99, type: "image/png" },
      uploadedOriginal: {
        id: ORIGINAL_ID,
        itemClientId: ITEM_ID,
        kind: "original",
        originalFilename: "living.jpg",
        fileSize: 1234,
        mimeType: "image/jpeg",
      },
    },
  ]).mode, "local_upload_fallback");
});

test("missing original returns not-ready", () => {
  assert.equal(selectVirtualStagingDraftSubmissionMode([
    {
      localOriginal: null,
      uploadedOriginal: null,
    },
  ]).mode, "not_ready");
});

test("reference mismatch selects local fallback", () => {
  assert.equal(selectVirtualStagingDraftSubmissionMode([
    {
      localOriginal: null,
      localReference: { name: "new-ref.png", size: 55, type: "image/png" },
      uploadedOriginal: {
        id: ORIGINAL_ID,
        itemClientId: ITEM_ID,
        kind: "original",
        originalFilename: "living.jpg",
        fileSize: 1234,
        mimeType: "image/jpeg",
      },
      uploadedReference: {
        id: REFERENCE_ID,
        itemClientId: ITEM_ID,
        kind: "reference",
        originalFilename: "old-ref.png",
        fileSize: 44,
        mimeType: "image/png",
      },
    },
  ]).mode, "local_upload_fallback");
});

test("no automatic finalization retry", () => {
  assert.equal(shouldAutomaticallyRetryVirtualStagingFinalization(), false);
});

test("stale finalization result is ignored", () => {
  assert.equal(shouldApplyVirtualStagingFinalizationResult({
    startedSession: 1,
    currentSession: 2,
    startedKey: FINALIZATION_KEY,
    currentKey: FINALIZATION_KEY,
  }), false);
});

test("Start new resets finalization identity", () => {
  assert.deepEqual(resetVirtualStagingFinalizationIdentity(), {
    finalizationKey: null,
  });
});

test("successful persisted original counts as submit-ready", () => {
  assert.equal(isVirtualStagingFinalSubmissionReady([
    {
      file: null,
      uploadedOriginal: {
        id: ORIGINAL_ID,
      },
    },
  ]), true);
});
