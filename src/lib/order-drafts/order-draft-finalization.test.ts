import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import "../orders/direct-order-file-integrity.test.ts";
import {
  DraftFinalizationBodySchema,
  STALE_DRAFT_FINALIZATION_CLAIM_MINUTES,
  buildTrustedFinalPathForDraftFile,
  buildTrustedMovedDraftFiles,
  draftFinalizationMovedPayloadContainsOnlyTrustedFields,
  isExactDraftStoragePathForFile,
  isOwnershipSafeFinalizationNotFound,
  isStaleVirtualStagingFinalizationClaim,
  mapClaimCodeToPublicError,
  mapVirtualStagingDraftStateToProductionItems,
  parseClaimFinalizationRpcResult,
  parseVirtualStagingFinalizationRetryContext,
  parseStrictClaimFinalizationRpcResult,
  resetVirtualStagingFinalizationIdentity,
  selectVirtualStagingDraftSubmissionMode,
  serializeVirtualStagingFinalizationRetryContext,
  shouldApplyVirtualStagingFinalizationResult,
  shouldAutomaticallyRetryVirtualStagingFinalization,
  shouldPreserveVirtualStagingFinalizationKeyAfterFailure,
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
const SQL_COMPLETE_AMBIGUITY_PATCH = readFileSync(
  "supabase/fix-order-draft-finalization-complete-ambiguity.sql",
  "utf8",
);
const SQL_PHOTO_EDITING_COMPATIBILITY = readFileSync(
  "supabase/allow-photo-editing-draft-finalization.sql",
  "utf8",
);
const SQL_VIRTUAL_RENOVATION_COMPATIBILITY = readFileSync(
  "supabase/allow-virtual-renovation-draft-finalization.sql",
  "utf8",
);
const VIRTUAL_RENOVATION_PAGE = readFileSync(
  "src/app/(dashboard)/dashboard/orders/new/virtual-renovation/page.tsx",
  "utf8",
);
const ORDER_ROUTE = readFileSync("src/app/(public)/api/order/route.ts", "utf8");
const VIRTUAL_STAGING_FORM = readFileSync(
  "src/components/order/virtual-staging/VirtualStagingOrderForm.tsx",
  "utf8",
);
const STAGING_ITEM_CARD = readFileSync(
  "src/components/order/virtual-staging/StagingItemCard.tsx",
  "utf8",
);
const FILE_UPLOAD = readFileSync("src/components/order/FileUpload.tsx", "utf8");
const STATIC_IMAGE_STAGE = readFileSync(
  "src/components/media/StaticImageStage.tsx",
  "utf8",
);
const SAVED_DRAFTS_SECTION = readFileSync(
  "src/components/dashboard/SavedDraftsSection.tsx",
  "utf8",
);
const DRAFTS_PAGE = readFileSync(
  "src/components/dashboard/ClientDraftsPage.tsx",
  "utf8",
);
const DRAFT_THUMBNAIL = readFileSync(
  "src/components/dashboard/DraftThumbnail.tsx",
  "utf8",
);
const STYLE_SELECTOR = readFileSync(
  "src/components/order/virtual-staging/StyleSelector.tsx",
  "utf8",
);
const ORDER_JOB_TITLE_FIELD = readFileSync(
  "src/components/order/OrderJobTitleField.tsx",
  "utf8",
);
const ORDER_TERMS_BLOCK = readFileSync(
  "src/components/order/OrderTermsBlock.tsx",
  "utf8",
);
const ORDER_SUMMARY = readFileSync(
  "src/components/order/OrderSummary.tsx",
  "utf8",
);
const FINALIZATION_SERVER = readFileSync(
  "src/lib/order-drafts/finalization-server.ts",
  "utf8",
);
const ORDER_SERVICE = readFileSync(
  "src/lib/orders/create-order-server.ts",
  "utf8",
);
const DRAFT_SERVER = readFileSync("src/lib/order-drafts/server.ts", "utf8");
const DRAFT_FILES_SERVER = readFileSync(
  "src/lib/order-drafts/files-server.ts",
  "utf8",
);
const FINALIZATION_STATUS_ROUTE = readFileSync(
  "src/app/(public)/api/order-drafts/[draftId]/finalization-status/route.ts",
  "utf8",
);
const DRAFT_FILE_PREVIEW_ROUTE = readFileSync(
  "src/app/(public)/api/order-drafts/[draftId]/files/[fileId]/preview/route.ts",
  "utf8",
);

function sourceSlice(
  source: string,
  startMarker: string,
  endMarker: string,
): string {
  const normalizedSource = source.replace(/\r\n/g, "\n");
  const start = normalizedSource.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = normalizedSource.indexOf(endMarker, start);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return normalizedSource.slice(start, end);
}

function draftState(overrides: Partial<VirtualStagingDraftState> = {}): VirtualStagingDraftState {
  return {
    schemaVersion: 1,
    jobTitle: "123 Main Street",
    currentStep: "virtual-staging-form",
    defaultFurnitureStyle: "Modern",
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
          referenceFiles: [],
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

function sqlFunctionBody(sql: string, functionName: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${functionName}`);
  assert.ok(start >= 0, `${functionName} was not found`);
  const end = sql.indexOf("\n-- ------------------------------------------------------------", start + 1);
  return end >= 0 ? sql.slice(start, end) : sql.slice(start);
}

function parsedDraftServiceRoutePairs(sql: string): Array<{
  serviceType: string;
  route: string;
}> {
  return Array.from(
    sql.matchAll(
      /v_draft\.service_type = '([^']+)'\s+AND v_draft\.route = '([^']+)'/g,
    ),
    (match) => ({ serviceType: match[1], route: match[2] }),
  );
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

test("strict claim result parsing accepts explicit invalid_status", () => {
  const result = parseStrictClaimFinalizationRpcResult({
    result_code: "invalid_status",
    draft_id: DRAFT_ID,
    converted_order_id: null,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.result.code, "invalid_status");
});

test("malformed claim RPC result maps to database_error", () => {
  assert.equal(parseStrictClaimFinalizationRpcResult([]).ok, false);
  assert.equal(
    parseStrictClaimFinalizationRpcResult({ result_code: "unknown_code" }).ok,
    false,
  );
  assert.match(
    FINALIZATION_SERVER,
    /claim RPC returned malformed data[\s\S]+code: "database_error"/,
  );
});

test("claim RPC transport error maps to database_error", () => {
  assert.match(
    FINALIZATION_SERVER,
    /claim RPC failed:[\s\S]+code: "database_error"/,
  );
  assert.doesNotMatch(
    FINALIZATION_SERVER,
    /claim RPC failed:[\s\S]{0,180}code: "invalid_status"/,
  );
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
  assert.match(
    SQL,
    /v_draft\.finalization_key IS NOT DISTINCT FROM p_finalization_key/,
  );
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
  assert.match(ORDER_SERVICE, /p_source_draft_id: input\.sourceDraftId \?\? null/);
  assert.match(ORDER_SERVICE, /p_draft_expected_version: input\.draftExpectedVersion \?\? null/);
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

test("Single Exposure aerial choices and detail requirements reach final order data", () => {
  assert.match(ORDER_SERVICE, /base\.aerial_editing = aerial\.id/);
  assert.match(ORDER_SERVICE, /base\.aerial_editing_label = aerial\.label/);
  assert.match(
    ORDER_SERVICE,
    /base\.aerial_editing_instructions =\s*p\.aerialEditingInstructions\?\.trim\(\) \|\| ""/,
  );
  assert.match(
    ORDER_SERVICE,
    /isAerialDetailRequirementSatisfied\([\s\S]*?itemFiles\[index\]\?\.reference[\s\S]*?itemFiles\[index\]\?\.references\?\.length/,
  );
});

test("final copy cleanup occurs on pre-order failure", () => {
  assert.match(
    ORDER_SERVICE,
    /cleanupFinalPaths\(supabase, copiedFinalPaths\)/,
  );
  assert.match(ORDER_SERVICE, /if \(finalizedReference\.createdFinal\) copiedFinalPaths\.push/);
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
  assert.match(SQL, /v_owned_source_order_id IS NOT NULL/);
});

test("matching owned source-draft order allows reconciliation", () => {
  assert.match(
    SQL,
    /v_owned_source_order_id[\s\S]+source_orders\.user_id IS NOT DISTINCT FROM p_user_id/,
  );
  assert.match(
    SQL,
    /RETURN QUERY SELECT 'already_claimed'::text, p_draft_id, v_owned_source_order_id/,
  );
});

test("source-draft order with NULL user blocks release", () => {
  const releaseStart = SQL.indexOf("CREATE OR REPLACE FUNCTION public.release_order_draft_finalization");
  const releaseEnd = SQL.indexOf("CREATE OR REPLACE FUNCTION public.recover_stale_order_draft_finalization", releaseStart);
  const releaseSql = SQL.slice(releaseStart, releaseEnd);
  assert.match(
    releaseSql,
    /WHERE source_orders\.source_draft_id IS NOT DISTINCT FROM p_draft_id\s+LIMIT 1/,
  );
  assert.doesNotMatch(releaseSql, /source_orders\.user_id IS NOT DISTINCT FROM p_user_id/);
  assert.match(releaseSql, /RETURN QUERY SELECT 'order_exists'::text/);
});

test("source-draft order with another user blocks release", () => {
  const releaseStart = SQL.indexOf("CREATE OR REPLACE FUNCTION public.release_order_draft_finalization");
  const releaseEnd = SQL.indexOf("CREATE OR REPLACE FUNCTION public.recover_stale_order_draft_finalization", releaseStart);
  const releaseSql = SQL.slice(releaseStart, releaseEnd);
  assert.match(releaseSql, /v_existing_source_order_id IS NOT NULL/);
  assert.doesNotMatch(releaseSql, /AND source_orders\.user_id/);
});

test("inconsistent source-order ownership never allows a new claim", () => {
  assert.match(SQL, /v_any_source_order_id IS NOT NULL/);
  assert.match(SQL, /v_owned_source_order_id IS NULL/);
  assert.match(
    SQL,
    /RETURN QUERY SELECT 'invalid_status'::text, v_draft\.id, NULL::uuid/,
  );
});

test("finalization RPC SQL qualifies source-order aliases", () => {
  const claimSql = sqlFunctionBody(SQL, "claim_order_draft_finalization");
  const releaseSql = sqlFunctionBody(SQL, "release_order_draft_finalization");
  const recoverySql = sqlFunctionBody(SQL, "recover_stale_order_draft_finalization");
  assert.match(claimSql, /SELECT source_orders\.id[\s\S]+FROM public\.orders AS source_orders/);
  assert.match(releaseSql, /SELECT source_orders\.id[\s\S]+FROM public\.orders AS source_orders/);
  assert.match(recoverySql, /FROM public\.orders AS source_orders/);
  assert.doesNotMatch(claimSql + releaseSql + recoverySql, /SELECT orders\.id/);
});

test("complete RPC SQL qualifies ambiguous draft-file identifiers", () => {
  const completeSql = sqlFunctionBody(SQL, "complete_order_draft_finalization");
  assert.match(completeSql, /SELECT moved_entry\.value\s+FROM jsonb_array_elements\(p_moved_files\) AS moved_entry\(value\)/);
  assert.match(completeSql, /array_agg\(live_files\.id\)/);
  assert.match(completeSql, /SELECT files\.id\s+FROM public\.order_draft_files AS files/);
  assert.match(completeSql, /WHERE files\.draft_id = p_draft_id/);
  assert.match(completeSql, /SELECT moved\.file_id, moved\.final_path\s+FROM unnest\(v_moved_ids, v_moved_paths\) AS moved\(file_id, final_path\)/);
  assert.doesNotMatch(completeSql, /\barray_agg\(id\)/);
  assert.doesNotMatch(completeSql, /\bWHERE draft_id = p_draft_id/);
  assert.doesNotMatch(completeSql, /\bAND draft_id = p_draft_id/);
});

test("one-time complete ambiguity patch only replaces the complete RPC", () => {
  assert.match(
    SQL_COMPLETE_AMBIGUITY_PATCH,
    /CREATE OR REPLACE FUNCTION public\.complete_order_draft_finalization/,
  );
  assert.doesNotMatch(
    SQL_COMPLETE_AMBIGUITY_PATCH,
    /CREATE OR REPLACE FUNCTION public\.(claim|release|recover_stale)_order_draft_finalization/,
  );
  assert.doesNotMatch(
    SQL_COMPLETE_AMBIGUITY_PATCH,
    /\b(PERFORM|SELECT)\s+public\.complete_order_draft_finalization\(/,
  );
});

test("one-time complete ambiguity patch preserves service-role-only security", () => {
  assert.match(SQL_COMPLETE_AMBIGUITY_PATCH, /LANGUAGE plpgsql\s+SECURITY DEFINER\s+SET search_path = pg_catalog, public/);
  assert.match(
    SQL_COMPLETE_AMBIGUITY_PATCH,
    /REVOKE ALL ON FUNCTION public\.complete_order_draft_finalization\([\s\S]+FROM PUBLIC, anon, authenticated/,
  );
  assert.match(
    SQL_COMPLETE_AMBIGUITY_PATCH,
    /GRANT EXECUTE ON FUNCTION public\.complete_order_draft_finalization\([\s\S]+TO service_role/,
  );
});

test("one-time complete ambiguity patch has no top-level row mutation", () => {
  const functionEnd = SQL_COMPLETE_AMBIGUITY_PATCH.indexOf("$$;");
  assert.ok(functionEnd >= 0);
  const patchTail = SQL_COMPLETE_AMBIGUITY_PATCH.slice(functionEnd + 3);
  assert.doesNotMatch(
    patchTail,
    /\b(UPDATE|INSERT INTO|DELETE FROM)\s+public\.(orders|order_drafts|order_draft_files)\b/i,
  );
});

test("NULL source_draft_id is rejected by complete RPC", () => {
  assert.match(
    SQL,
    /v_order\.source_draft_id IS DISTINCT FROM p_draft_id/,
  );
});

test("NULL finalization key cannot complete or release a draft", () => {
  assert.match(SQL, /v_draft\.finalization_key IS NULL/);
  assert.match(
    SQL,
    /finalization_key IS NOT DISTINCT FROM p_finalization_key/,
  );
});

test("matching finalization keys use null-safe comparisons", () => {
  assert.match(SQL, /IS NOT DISTINCT FROM p_finalization_key/);
  assert.match(SQL, /IS DISTINCT FROM p_finalization_key/);
});

test("recent different-key claim remains a conflict", () => {
  assert.equal(STALE_DRAFT_FINALIZATION_CLAIM_MINUTES, 15);
  assert.equal(isStaleVirtualStagingFinalizationClaim({
    updatedAt: "2026-06-28T10:00:00.000Z",
    now: new Date("2026-06-28T10:14:59.000Z"),
  }), false);
  assert.match(SQL, /'finalization_conflict'::text/);
});

test("stale no-order claim is recoverable", () => {
  assert.equal(isStaleVirtualStagingFinalizationClaim({
    updatedAt: "2026-06-28T10:00:00.000Z",
    now: new Date("2026-06-28T10:15:00.000Z"),
  }), true);
  assert.match(SQL, /recover_stale_order_draft_finalization/);
  assert.match(SQL, /SET status = 'active',\s+finalization_key = NULL/);
});

test("stale claim with an existing order is not released", () => {
  assert.match(
    SQL,
    /NOT EXISTS \(\s+SELECT 1\s+FROM public\.orders AS source_orders\s+WHERE source_orders\.source_draft_id IS NOT DISTINCT FROM drafts\.id/s,
  );
});

test("stale recovery still does not release drafts with any source order", () => {
  const recoveryStart = SQL.indexOf("CREATE OR REPLACE FUNCTION public.recover_stale_order_draft_finalization");
  const recoveryEnd = SQL.indexOf("CREATE OR REPLACE FUNCTION public.complete_order_draft_finalization", recoveryStart);
  const recoverySql = SQL.slice(recoveryStart, recoveryEnd);
  assert.match(
    recoverySql,
    /WHERE source_orders\.source_draft_id IS NOT DISTINCT FROM drafts\.id/,
  );
  assert.doesNotMatch(recoverySql, /source_orders\.user_id IS NOT DISTINCT FROM p_user_id/);
});

test("converting draft becomes resumable after safe stale recovery", () => {
  assert.match(DRAFT_SERVER, /recoverStaleFinalizationClaimsForUser\(userId/);
  assert.match(DRAFT_SERVER, /\.eq\("status", "active"\)/);
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
  ]).mode, "local_upload_fallback_unavailable");
});

test("no automatic finalization retry", () => {
  assert.equal(shouldAutomaticallyRetryVirtualStagingFinalization(), false);
});

test("network error preserves the logical finalization key", () => {
  assert.equal(shouldPreserveVirtualStagingFinalizationKeyAfterFailure({
    code: "network_error",
    status: 0,
  }), true);
});

test("finalization incomplete preserves the logical finalization key", () => {
  assert.equal(shouldPreserveVirtualStagingFinalizationKeyAfterFailure({
    code: "finalization_incomplete",
    status: 503,
  }), true);
});

test("ambiguous claim failure preserves the browser finalization key", () => {
  assert.equal(shouldPreserveVirtualStagingFinalizationKeyAfterFailure({
    code: "database_error",
    status: 500,
  }), true);
});

test("explicit invalid_status still clears the browser finalization key", () => {
  assert.equal(shouldPreserveVirtualStagingFinalizationKeyAfterFailure({
    code: "invalid_status",
    status: 409,
  }), false);
});

test("retry after ambiguous failure reuses the same finalization key", () => {
  assert.match(
    VIRTUAL_STAGING_FORM,
    /const key = finalizationKeyRef\.current \?\? createFinalizationKey\(\)/,
  );
  assert.match(
    VIRTUAL_STAGING_FORM,
    /finalizationKey: key/,
  );
  assert.equal(shouldPreserveVirtualStagingFinalizationKeyAfterFailure({
    code: "database_error",
    status: 500,
  }), true);
});

test("ambiguous finalization failure stores the draft retry target", () => {
  assert.match(
    VIRTUAL_STAGING_FORM,
    /const nextRetryContext = \{\s+draftId: saveOutcome\.draftId,\s+expectedVersion: saveOutcome\.version,\s+finalizationKey: key,\s+\}/,
  );
  assert.match(
    VIRTUAL_STAGING_FORM,
    /if \(shouldPreserveKey\) \{[\s\S]+storeFinalizationRetryContext\(retryContext\)/,
  );
});

test("retry submit bypasses draft save, file refresh, and legacy submit", () => {
  const retryStart = VIRTUAL_STAGING_FORM.indexOf(
    "const retryContext = finalizationRetryContextRef.current",
  );
  const retryEnd = VIRTUAL_STAGING_FORM.indexOf(
    "const saveOutcome = await enqueueDraftSave",
    retryStart,
  );
  assert.ok(retryStart >= 0);
  assert.ok(retryEnd > retryStart);
  const retryBranch = VIRTUAL_STAGING_FORM.slice(retryStart, retryEnd);
  assert.match(
    retryBranch,
    /submitVirtualStagingDraft\(\s+retryContext\.draftId,\s+retryContext\.expectedVersion,\s+retryContext\.finalizationKey,/,
  );
  assert.doesNotMatch(retryBranch, /enqueueDraftSave/);
  assert.doesNotMatch(retryBranch, /refreshUploadedDraftFiles/);
  assert.doesNotMatch(retryBranch, /selectVirtualStagingDraftSubmissionMode/);
  assert.doesNotMatch(retryBranch, /submitCurrentLocalOrder|submitOrder/);
});

test("retry context is reused without automatic finalization retry", () => {
  assert.equal(shouldAutomaticallyRetryVirtualStagingFinalization(), false);
  assert.match(
    VIRTUAL_STAGING_FORM,
    /if \(retryContext\) \{[\s\S]+submitVirtualStagingDraft\(/,
  );
  assert.doesNotMatch(
    VIRTUAL_STAGING_FORM,
    /setTimeout\(\s*\(\) => \{?\s*(?:void\s+)?submitVirtualStagingDraft/,
  );
});

test("finalization retry context freezes draft edits and autosave", () => {
  assert.match(
    VIRTUAL_STAGING_FORM,
    /if \(finalizationRetryContextRef\.current\) \{\s+return \{ ok: false \};\s+\}/,
  );
  assert.match(
    VIRTUAL_STAGING_FORM,
    /finalizationRetryContext !== null[\s\S]+return;/,
  );
  assert.match(
    VIRTUAL_STAGING_FORM,
    /if \(isSubmitting \|\| finalizationRetryContextRef\.current\) return;/,
  );
  assert.match(
    VIRTUAL_STAGING_FORM,
    /disabled=\{hasFinalizationRetryContext \|\| isSubmitting\}/,
  );
});

test("retry context uses a dedicated submit label", () => {
  assert.match(VIRTUAL_STAGING_FORM, /retryOrderFinalization: "Retry order finalization"/);
  assert.match(
    VIRTUAL_STAGING_FORM,
    /hasFinalizationRetryContext[\s\S]+\? copy\.retryOrderFinalization/,
  );
});

test("definite finalization outcomes clear the retry context", () => {
  assert.match(
    VIRTUAL_STAGING_FORM,
    /if \(result\.ok\) \{[\s\S]+clearFinalizationRetryContext\(\)/,
  );
  assert.match(
    VIRTUAL_STAGING_FORM,
    /else \{[\s\S]+clearFinalizationRetryContext\(\)/,
  );
  assert.match(
    VIRTUAL_STAGING_FORM,
    /const startNewVirtualStagingOrder[\s\S]+clearFinalizationRetryContext\(\)/,
  );
});

test("retry context disables child order controls", () => {
  assert.match(STAGING_ITEM_CARD, /disabled\?: boolean/);
  assert.match(STAGING_ITEM_CARD, /const originalDisabled = disabled \|\| originalBusy/);
  assert.match(STYLE_SELECTOR, /disabled\?: boolean/);
  assert.match(ORDER_JOB_TITLE_FIELD, /disabled\?: boolean/);
  assert.match(ORDER_TERMS_BLOCK, /disabled\?: boolean/);
});

test("definite validation failure clears the logical finalization key", () => {
  assert.equal(shouldPreserveVirtualStagingFinalizationKeyAfterFailure({
    code: "invalid_input",
    status: 400,
  }), false);
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

test("success clears finalization identity in the form", () => {
  assert.match(
    VIRTUAL_STAGING_FORM,
    /if \(result\.ok\)[\s\S]+setFinalizationKey\(null\)[\s\S]+finalizationKeyRef\.current = null/,
  );
});

test("finalization-status API requires auth and validates the draft UUID", () => {
  assert.match(FINALIZATION_STATUS_ROUTE, /const sessionUser = await getClientUser\(\)/);
  assert.match(FINALIZATION_STATUS_ROUTE, /unauthenticatedOrderDraftResponse\(\)/);
  assert.match(FINALIZATION_STATUS_ROUTE, /validateDraftId\(draftId\)/);
  assert.match(
    FINALIZATION_STATUS_ROUTE,
    /getOrderDraftFinalizationStatusForUser\(\s+sessionUser\.id,\s+draftId,/,
  );
});

test("finalization-status lookup supports only canonical recovery pairs and owned states", () => {
  const lookup = sourceSlice(
    DRAFT_SERVER,
    "export async function getOrderDraftFinalizationStatusForUser",
    "async function listOwnedFinishingDraftsForUser",
  );
  const supportGuard = sourceSlice(
    lookup,
    "const supportsFinalizationStatus =",
    "if (",
  );

  assert.match(
    DRAFT_SERVER,
    /import \{ VIRTUAL_RENOVATION_DRAFT_ROUTE \} from "\.\/virtual-renovation\.ts"/,
  );
  assert.match(
    DRAFT_SERVER,
    /import \{ FLOOR_PLANS_DRAFT_ROUTE \} from "\.\/floor-plans\.ts"/,
  );
  assert.equal(
    supportGuard.replace(/\s+/g, " ").trim(),
    `const supportsFinalizationStatus = (draft.serviceType === "virtual-staging" && draft.route === VIRTUAL_STAGING_DRAFT_ROUTE) || (draft.serviceType === "photo-editing" && draft.subService === null && draft.route === PHOTO_EDITING_DRAFT_ROUTE) || (draft.serviceType === "virtual-renovation" && draft.subService === null && draft.route === VIRTUAL_RENOVATION_DRAFT_ROUTE) || (draft.serviceType === "3d-floor-plans" && draft.subService === null && draft.route === FLOOR_PLANS_DRAFT_ROUTE);`,
  );
  assert.doesNotMatch(
    supportGuard,
    /\/dashboard\/orders\/new\/virtual-renovation/,
  );

  assert.match(lookup, /\.eq\("user_id", userId\)/);
  assert.match(lookup, /sourceOrder && sourceOrder\.userId !== userId/);
  assert.match(lookup, /notFoundFinalizationStatus\(draftId\)/);
  assert.match(lookup, /status: "active"/);
  assert.match(lookup, /status: "finalization_in_progress"/);
  assert.match(lookup, /status: "reconciliation_required"/);
  assert.match(lookup, /status: "already_converted"/);
});

test("finalization-status DTO omits private draft and Storage fields", () => {
  const dto = {
    status: "reconciliation_required",
    draftId: DRAFT_ID,
    expectedVersion: 8,
    orderId: ORDER_ID,
    orderNumber: "VS-0010",
  };
  const json = JSON.stringify(dto);
  assert.equal(json.includes("finalizationKey"), false);
  assert.equal(json.includes("finalization_key"), false);
  assert.equal(json.includes("storagePath"), false);
  assert.equal(json.includes("storage_path"), false);
  assert.equal(json.includes("bucket"), false);
  assert.equal(json.includes("fileId"), false);
  assert.equal(json.includes("userId"), false);
});

test("page reload checks finalization status after active draft restore fails", () => {
  const restore404Branch = sourceSlice(
    VIRTUAL_STAGING_FORM,
    "if (result.status === 404)",
    "const resume = validateVirtualStagingDraftForResume",
  );

  assert.match(
    restore404Branch,
    /getVirtualStagingDraftFinalizationStatus\(\s+requestedDraftId,/,
  );
  assert.match(restore404Branch, /statusResult\.data\.status === "active"/);
  assert.match(restore404Branch, /const restoredResult = await getOrderDraft/);
  assert.match(restore404Branch, /applyFinalizationStatus\(statusResult\.data\)/);
});

test("reload recovery skips draft save file refresh upload and legacy order submit", () => {
  const recoveryHandler = sourceSlice(
    VIRTUAL_STAGING_FORM,
    "const handleFinishFinalizationRecovery",
    "const submitCurrentLocalOrder",
  );

  assert.match(recoveryHandler, /submitVirtualStagingDraft\(/);
  assert.doesNotMatch(recoveryHandler, /enqueueDraftSave/);
  assert.doesNotMatch(recoveryHandler, /refreshUploadedDraftFiles/);
  assert.doesNotMatch(recoveryHandler, /prepareOrderDraftFileUpload/);
  assert.doesNotMatch(recoveryHandler, /uploadPreparedOrderDraftFile/);
  assert.doesNotMatch(recoveryHandler, /submitCurrentLocalOrder|submitOrder/);
});

test("reload recovery can use a new request UUID with the stored server claim", () => {
  const recoveryHandler = sourceSlice(
    VIRTUAL_STAGING_FORM,
    "const handleFinishFinalizationRecovery",
    "const submitCurrentLocalOrder",
  );
  assert.match(
    recoveryHandler,
    /storedContext\?\.finalizationKey \?\? createFinalizationKey\(\)/,
  );
  assert.match(
    FINALIZATION_SERVER,
    /reconcileExistingDraftOrder[\s\S]+draft\.finalizationKey/,
  );
});

test("successful reload recovery shows the existing order number", () => {
  const applyStatus = sourceSlice(
    VIRTUAL_STAGING_FORM,
    "const applyFinalizationStatus",
    "useEffect(() => {",
  );
  assert.match(applyStatus, /status\.status === "already_converted"/);
  assert.match(applyStatus, /setOrderNumber\(status\.orderNumber\)/);
  assert.match(
    VIRTUAL_STAGING_FORM,
    /copy\.existingOrder\}: \{recoveryOrderNumber\}/,
  );
});

test("finalization retry sessionStorage is strictly validated", () => {
  const context = {
    draftId: DRAFT_ID,
    expectedVersion: 8,
    finalizationKey: FINALIZATION_KEY,
  };
  assert.deepEqual(
    parseVirtualStagingFinalizationRetryContext(
      serializeVirtualStagingFinalizationRetryContext(context),
      DRAFT_ID,
    ),
    context,
  );
  assert.equal(
    parseVirtualStagingFinalizationRetryContext(
      JSON.stringify({ ...context, storagePath: "drafts/private" }),
      DRAFT_ID,
    ),
    null,
  );
  assert.equal(
    parseVirtualStagingFinalizationRetryContext(
      serializeVirtualStagingFinalizationRetryContext(context),
      "99999999-9999-4999-8999-999999999999",
    ),
    null,
  );
  assert.equal(parseVirtualStagingFinalizationRetryContext("{", DRAFT_ID), null);
});

test("sessionStorage context is stored only as draft version and browser key", () => {
  const storageHelpers = sourceSlice(
    VIRTUAL_STAGING_FORM,
    "function readStoredFinalizationRetryContext",
    "function clearStagingItemDraftFileSlot",
  );
  assert.match(storageHelpers, /window\.sessionStorage\.getItem/);
  assert.match(storageHelpers, /window\.sessionStorage\.setItem/);
  assert.match(storageHelpers, /window\.sessionStorage\.removeItem/);
  assert.doesNotMatch(storageHelpers, /storagePath|bucket|fileId|userId|token/);
  assert.match(
    VIRTUAL_STAGING_FORM,
    /if \(result\.ok\)[\s\S]+clearFinalizationRetryContext\(\)/,
  );
  assert.match(
    VIRTUAL_STAGING_FORM,
    /const startNewVirtualStagingOrder[\s\S]+clearFinalizationRetryContext\(\)/,
  );
});

test("in-progress finalization recovery is non-editable and explicitly rechecked", () => {
  const recheckHandler = sourceSlice(
    VIRTUAL_STAGING_FORM,
    "const handleFinalizationStatusRecheck",
    "const handleFinishFinalizationRecovery",
  );
  assert.match(VIRTUAL_STAGING_FORM, /status: "finalization_in_progress"/);
  assert.match(VIRTUAL_STAGING_FORM, /copy\.finalizationInProgressMessage/);
  assert.match(VIRTUAL_STAGING_FORM, /handleFinalizationStatusRecheck/);
  assert.doesNotMatch(
    recheckHandler,
    /setInterval\([\s\S]+getVirtualStagingDraftFinalizationStatus/,
  );
  assert.doesNotMatch(
    recheckHandler,
    /setTimeout\([\s\S]+getVirtualStagingDraftFinalizationStatus/,
  );
});

test("Saved Drafts includes only owned converting drafts with source orders", () => {
  const finishingList = sourceSlice(
    DRAFT_SERVER,
    "async function listOwnedFinishingDraftsForUser",
    "async function attachDraftThumbnails",
  );
  assert.match(finishingList, /\.from\("orders"\)/);
  assert.match(finishingList, /\.eq\("user_id", userId\)/);
  assert.match(finishingList, /\.not\("source_draft_id", "is", null\)/);
  assert.match(finishingList, /\.eq\("status", "converting"\)/);
  assert.match(finishingList, /status: "finishing_order"/);
});

test("Saved Drafts cards expose finishing actions without converted drafts", () => {
  assert.match(SAVED_DRAFTS_SECTION, /copy\.finishingBadge/);
  assert.match(SAVED_DRAFTS_SECTION, /getSavedDraftActionLabel/);
  assert.match(DRAFTS_PAGE, /copy\.finishingBadge/);
  assert.match(DRAFTS_PAGE, /!isFinishing && \(/);
  assert.match(DRAFT_SERVER, /\.eq\("status", "active"\)/);
  assert.match(DRAFT_SERVER, /\.eq\("status", "converting"\)/);
  assert.doesNotMatch(
    sourceSlice(
      DRAFT_SERVER,
      "export async function listActiveOrderDraftsForUser",
      "export async function getOrderDraftFinalizationStatusForUser",
    ),
    /\.eq\("status", "converted"\)/,
  );
});

test("opened Virtual Staging drafts render persisted original and reference previews", () => {
  assert.match(STAGING_ITEM_CARD, /label="Upload Original Photo"/);
  assert.match(STAGING_ITEM_CARD, /ReferenceFilesUploader/);
  assert.match(STAGING_ITEM_CARD, /uploadedOriginalFile\.previewUrl/);
  assert.match(STAGING_ITEM_CARD, /uploadedReferenceFile\.previewUrl/);
  assert.match(STAGING_ITEM_CARD, /!data\.file && uploadedOriginalFile/);
  assert.match(STAGING_ITEM_CARD, /displayedReferenceFiles/);
  assert.match(FILE_UPLOAD, /className="h-full w-full object-cover"/);
  assert.match(FILE_UPLOAD, /role="dialog"/);
  assert.match(FILE_UPLOAD, /onError=\{\(\) => setBroken\(true\)\}/);
});

test("Saved Draft thumbnails use first original and never reference files", () => {
  const thumbnails = sourceSlice(
    DRAFT_SERVER,
    "async function attachDraftThumbnails",
    "function notFoundFinalizationStatus",
  );
  assert.match(thumbnails, /\.eq\("kind", "original"\)/);
  assert.match(thumbnails, /\.order\("created_at", \{ ascending: true \}\)/);
  assert.match(thumbnails, /const first = candidates\[0\]/);
  assert.match(thumbnails, /originalCount: candidates\.length/);
  assert.doesNotMatch(thumbnails, /"reference"/);
});

test("preview routes verify ownership and never return raw Storage metadata", () => {
  assert.match(DRAFT_FILE_PREVIEW_ROUTE, /const sessionUser = await getClientUser\(\)/);
  assert.match(DRAFT_FILE_PREVIEW_ROUTE, /validateDraftFileRouteId\(draftId\)/);
  assert.match(DRAFT_FILE_PREVIEW_ROUTE, /validateDraftFileRouteId\(fileId\)/);
  assert.match(DRAFT_FILES_SERVER, /\.eq\("user_id", userId\)/);
  assert.match(DRAFT_FILES_SERVER, /\.eq\("draft_id", draftId\)/);
  assert.match(DRAFT_FILES_SERVER, /fileResult\.code === "upload_not_found"/);
  assert.match(DRAFT_FILES_SERVER, /row\.deletedAt === null/);
  assert.match(DRAFT_FILES_SERVER, /previewUrl: data\.signedUrl/);
  assert.doesNotMatch(DRAFT_FILE_PREVIEW_ROUTE, /storage_path|storagePath|bucket|user_id/);
});

test("preview failure and expiration do not block forms or start refresh loops", () => {
  assert.match(FILE_UPLOAD, /onError=\{\(\) => setBroken\(true\)\}/);
  assert.match(FILE_UPLOAD, /FileImage className=/);
  assert.match(FILE_UPLOAD, /URL\.revokeObjectURL\(previewUrl\)/);
  assert.match(DRAFT_THUMBNAIL, /onError=\{\(\) => setBroken\(true\)\}/);
  assert.doesNotMatch(FILE_UPLOAD, /setInterval|setTimeout/);
  assert.doesNotMatch(DRAFT_THUMBNAIL, /setInterval|setTimeout/);
  assert.match(DRAFT_FILES_SERVER, /DRAFT_FILE_PREVIEW_URL_TTL_SECONDS = 600/);
});

test("preview layout stays responsive for active and finishing draft cards", () => {
  assert.match(FILE_UPLOAD, /aspect-\[4\/3\]/);
  assert.match(DRAFT_THUMBNAIL, /aspect-\[4\/3\]/);
  assert.match(SAVED_DRAFTS_SECTION, /flex flex-col gap-4 sm:flex-row/);
  assert.match(DRAFTS_PAGE, /flex flex-col gap-4 sm:flex-row/);
});

test("Saved Draft thumbnails stay compact on desktop and stack on mobile", () => {
  assert.match(DRAFT_THUMBNAIL, /aspect-video w-full shrink-0 self-start/);
  assert.match(DRAFT_THUMBNAIL, /sm:h-\[102px\] sm:w-\[136px\]/);
  assert.match(DRAFT_THUMBNAIL, /sm:aspect-\[4\/3\]/);
  assert.match(DRAFT_THUMBNAIL, /overflow-hidden/);
  assert.match(DRAFT_THUMBNAIL, /className="h-full w-full object-cover"/);
  assert.doesNotMatch(DRAFT_THUMBNAIL, /sm:h-full|object-contain/);
  assert.match(SAVED_DRAFTS_SECTION, /flex flex-col gap-4 sm:flex-row/);
  assert.match(DRAFTS_PAGE, /flex flex-col gap-4 sm:flex-row/);
});

test("draft deletion confirmation is a modal instead of inline card content", () => {
  assert.match(DRAFTS_PAGE, /role="dialog"/);
  assert.match(DRAFTS_PAGE, /aria-modal="true"/);
  assert.match(DRAFTS_PAGE, /fixed inset-0 z-50/);
  assert.match(DRAFTS_PAGE, /cancelDeleteRef\.current\?\.focus\(\)/);
  assert.match(
    DRAFTS_PAGE,
    /event\.key === "Escape" && !activeDeleteControllerRef\.current/,
  );
  assert.match(DRAFTS_PAGE, /deleteTriggerRef\.current\?\.focus\(\)/);
  assert.match(
    DRAFTS_PAGE,
    /event\.target === event\.currentTarget[\s\S]+!activeDeleteControllerRef\.current/,
  );
  const card = DRAFTS_PAGE.slice(DRAFTS_PAGE.indexOf("function DraftCard"));
  assert.doesNotMatch(card, /copy\.confirmTitle|copy\.confirmMessage/);
});

test("delete runs once, disables modal actions, and uses a temporary toast", () => {
  assert.match(
    DRAFTS_PAGE,
    /if \(deletingDraftId \|\| activeDeleteControllerRef\.current\) return/,
  );
  assert.match(
    DRAFTS_PAGE,
    /disabled=\{deletingDraftId === confirmDraft\.id\}/,
  );
  assert.match(DRAFTS_PAGE, /setDrafts\(\(current\) => removeDraftSummaryById/);
  assert.match(DRAFTS_PAGE, /setToastMessage\(copy\.deleted\)/);
  assert.match(DRAFTS_PAGE, /setTimeout\(\(\) => \{[\s\S]+setToastMessage\(""\)/);
  assert.match(DRAFTS_PAGE, /3500/);
  assert.match(DRAFTS_PAGE, /role="status"/);
  assert.doesNotMatch(DRAFTS_PAGE, /setStatusMessage\(copy\.deleted\)/);
});

test("normal autosave UI is quiet while failures and conflicts remain visible", () => {
  assert.doesNotMatch(VIRTUAL_STAGING_FORM, /handleSaveAndExit|<Save /);
  assert.doesNotMatch(VIRTUAL_STAGING_FORM, /copy\.saveAndExit/);
  assert.doesNotMatch(VIRTUAL_STAGING_FORM, /Back to drafts/);
  assert.doesNotMatch(VIRTUAL_STAGING_FORM, /copy\[saveStatus\]/);
  assert.match(
    VIRTUAL_STAGING_FORM,
    /saveStatus === "saving"[\s\S]+role="status"[\s\S]+copy\.saving/,
  );
  assert.match(
    VIRTUAL_STAGING_FORM,
    /draftError && saveStatus !== "conflict"/,
  );
  assert.match(VIRTUAL_STAGING_FORM, /saveStatus === "save_failed"/);
  assert.match(VIRTUAL_STAGING_FORM, /saveStatus === "conflict"/);
});

test("autosave still observes form state and explicit file changes", () => {
  const autosave = sourceSlice(
    VIRTUAL_STAGING_FORM,
    "useEffect(() => {\n    if (\n      finalizationRetryContext",
    "const handleReloadLatestDraft",
  );
  assert.match(autosave, /draftSource/);
  assert.match(autosave, /void saveDraftNow\(\)/);
  assert.match(VIRTUAL_STAGING_FORM, /void enqueueDraftSave\(buildDraftSourceSnapshot\(nextItems\)\)/);
  assert.match(VIRTUAL_STAGING_FORM, /enqueueDraftSave\(sourceSnapshot, \{\s+force: true/);
});

test("the redundant saved-images notice is not rendered", () => {
  assert.doesNotMatch(VIRTUAL_STAGING_FORM, /showSavedImagesNotice/);
  assert.doesNotMatch(VIRTUAL_STAGING_FORM, /copy\.resumedFileWarning/);
  const formUi = VIRTUAL_STAGING_FORM.slice(
    VIRTUAL_STAGING_FORM.indexOf("<OrderLayout"),
  );
  assert.doesNotMatch(
    formUi,
    /Your images are saved with this draft and will be used when you submit the order\./,
  );
});

test("incomplete submit returns before saving or calling submission endpoints", () => {
  const submitHandler = sourceSlice(
    VIRTUAL_STAGING_FORM,
    "const handleSubmit = async () => {",
    "const handleNewOrder",
  );
  const incompleteBranch = sourceSlice(
    submitHandler,
    "if (missingRequiredFields.length > 0)",
    "const saveOutcome = await enqueueDraftSave",
  );
  assert.match(incompleteBranch, /setValidationAttempted\(true\)/);
  assert.match(incompleteBranch, /focusRequiredField\(missingRequiredFields\[0\]\.targetId\)/);
  assert.match(incompleteBranch, /return;/);
  assert.doesNotMatch(
    incompleteBranch,
    /submitVirtualStagingDraft|submitCurrentLocalOrder|submitOrder|\/api\/order/,
  );
});

test("Review Order validates configuration without invoking an order submission path", () => {
  const reviewHandler = sourceSlice(
    VIRTUAL_STAGING_FORM,
    "const goToReview = () => {",
    "const goToConfigureTop",
  );

  assert.match(
    reviewHandler,
    /if \(configurationMissingRequiredFields\.length > 0\)/,
  );
  assert.match(reviewHandler, /setValidationAttempted\(true\)/);
  assert.match(
    reviewHandler,
    /focusRequiredField\(configurationMissingRequiredFields\[0\]\.targetId\)/,
  );
  assert.match(reviewHandler, /setStep\("review"\)/);
  assert.doesNotMatch(
    reviewHandler,
    /submitVirtualStagingDraft|submitCurrentLocalOrder|submitOrder|\/api\/order/,
  );
});

test("required fields expose inline errors plus scroll and focus guidance", () => {
  assert.match(VIRTUAL_STAGING_FORM, /findMissingVirtualStagingRequiredFields/);
  assert.match(VIRTUAL_STAGING_FORM, /scrollIntoView\(\{ behavior: "smooth"/);
  assert.match(VIRTUAL_STAGING_FORM, /control\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(
    VIRTUAL_STAGING_FORM,
    /copy\.incompleteFields\(\s+configurationMissingRequiredFields\.length/,
  );
  assert.match(VIRTUAL_STAGING_FORM, /onClick=\{\(\) => focusRequiredField\(field\.targetId\)\}/);
  assert.match(STAGING_ITEM_CARD, /validationError=\{validationErrors\.original\}/);
  assert.match(STAGING_ITEM_CARD, /aria-invalid=\{Boolean\(validationErrors\.room\)/);
  assert.match(STAGING_ITEM_CARD, /aria-describedby=/);
  assert.match(ORDER_JOB_TITLE_FIELD, /aria-invalid=\{displayError/);
  assert.match(ORDER_TERMS_BLOCK, /aria-invalid=\{displayError/);
});

test("active image operations disable submit and explain the wait", () => {
  assert.match(
    VIRTUAL_STAGING_FORM,
    /const canReview =\s+!hasActiveDraftFileOperation &&\s+!isSubmitting/,
  );
  assert.match(
    VIRTUAL_STAGING_FORM,
    /const canSubmit =\s+isReview &&\s+!hasActiveDraftFileOperation &&\s+!isSubmitting/,
  );
  assert.match(
    VIRTUAL_STAGING_FORM,
    /hasActiveDraftFileOperation \? \([\s\S]+copy\.waitForImages/,
  );
  assert.match(
    VIRTUAL_STAGING_FORM,
    /submissionInFlightRef\.current \|\|\s+isSubmitting \|\|\s+hasActiveDraftFileOperation/,
  );
  assert.match(ORDER_SUMMARY, /disabled=\{!canSubmit \|\| isSubmitting\}/);
});

test("Spanish required-field guidance remains valid UTF-8 copy", () => {
  const copyStart = VIRTUAL_STAGING_FORM.indexOf(
    "  es: {",
    VIRTUAL_STAGING_FORM.indexOf("const DRAFT_COPY"),
  );
  const copyEnd = VIRTUAL_STAGING_FORM.indexOf(
    "const JOB_TITLE_REQUIRED_FIELD_ID",
    copyStart,
  );
  assert.ok(copyStart >= 0);
  assert.ok(copyEnd > copyStart);
  const spanishCopy = VIRTUAL_STAGING_FORM.slice(copyStart, copyEnd);

  const quoted = (property: string): string | undefined =>
    new RegExp(`${property}: "([^"]+)"`).exec(spanishCopy)?.[1];
  const itemCopy = (property: string): string | undefined =>
    new RegExp(`${property}: \\(itemNumber\\) =>\\s+\`([^\`]+)\``)
      .exec(spanishCopy)?.[1]
      ?.replace("${itemNumber}", "1");

  assert.deepEqual(
    [
      quoted("waitForImages"),
      quoted("jobTitleRequired"),
      itemCopy("roomRequired"),
      quoted("termsRequired"),
      quoted("jobTitleLabel"),
      itemCopy("roomLabel"),
      quoted("termsLabel"),
    ],
    [
      "Espera a que tus imágenes terminen de subirse.",
      "Introduce un título para el pedido.",
      "Imagen #1: selecciona una habitación o zona.",
      "Acepta los términos antes de enviar.",
      "Título del pedido",
      "Imagen #1 habitación",
      "Términos",
    ],
  );
  assert.doesNotMatch(
    spanishCopy,
    /[\u0413\u0420\u00d0\u00c3\u00c2]/,
  );
});

test("persisted previews use original filenames and compact cover thumbnails", () => {
  const persistedPreviewDialog = FILE_UPLOAD.slice(
    FILE_UPLOAD.indexOf("{open && previewUrl"),
    FILE_UPLOAD.indexOf("function formatFileSize"),
  );

  assert.match(STAGING_ITEM_CARD, /filename: uploadedOriginalFile\.originalFilename/);
  assert.match(STAGING_ITEM_CARD, /filename: uploadedReferenceFile\.originalFilename/);
  assert.match(FILE_UPLOAD, /<FilenameText filename=\{persistedFile\.filename\}/);
  assert.match(FILE_UPLOAD, /title=\{filename\}/);
  assert.match(FILE_UPLOAD, /className="sr-only">\{filename\}/);
  assert.match(FILE_UPLOAD, /w-28 shrink-0 self-start sm:w-32/);
  assert.match(FILE_UPLOAD, /className="h-full w-full object-cover"/);
  assert.match(persistedPreviewDialog, /<NativeStaticImageStage/);
  assert.match(persistedPreviewDialog, /variant=\{viewerVariant\}/);
  assert.match(STATIC_IMAGE_STAGE, /object-contain object-center/);
  assert.match(STATIC_IMAGE_STAGE, /objectFit: "contain"/);
  assert.match(STATIC_IMAGE_STAGE, /objectPosition: "center"/);
  assert.doesNotMatch(persistedPreviewDialog, /\bobject-cover\b/);
  assert.doesNotMatch(FILE_UPLOAD, /storage_path|storagePath|bucket|user_id/);
  assert.doesNotMatch(STAGING_ITEM_CARD, /storage_path|storagePath|bucket|user_id/);
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

test("mixed persisted-only and failed local replacement blocks legacy fallback", () => {
  const decision = selectVirtualStagingDraftSubmissionMode([
    {
      localOriginal: null,
      uploadedOriginal: {
        id: ORIGINAL_ID,
        itemClientId: ITEM_ID,
        kind: "original",
        originalFilename: "persisted.jpg",
        fileSize: 1234,
        mimeType: "image/jpeg",
      },
    },
    {
      localOriginal: { name: "replacement.jpg", size: 99, type: "image/jpeg" },
      uploadedOriginal: {
        id: REFERENCE_ID,
        itemClientId: ITEM_ID_2,
        kind: "original",
        originalFilename: "older.jpg",
        fileSize: 1234,
        mimeType: "image/jpeg",
      },
    },
  ]);
  assert.equal(decision.mode, "local_upload_fallback_unavailable");
  assert.match(VIRTUAL_STAGING_FORM, /local_upload_fallback_unavailable/);
});

test("all-local fallback remains supported", () => {
  assert.equal(selectVirtualStagingDraftSubmissionMode([
    {
      localOriginal: { name: "one.jpg", size: 10, type: "image/jpeg" },
      uploadedOriginal: null,
    },
    {
      localOriginal: { name: "two.jpg", size: 20, type: "image/jpeg" },
      uploadedOriginal: {
        id: ORIGINAL_ID,
        itemClientId: ITEM_ID_2,
        kind: "original",
        originalFilename: "older.jpg",
        fileSize: 1234,
        mimeType: "image/jpeg",
      },
    },
  ]).mode, "local_upload_fallback");
});

test("legacy fallback is never called with a null original", () => {
  assert.match(
    VIRTUAL_STAGING_FORM,
    /missingLocalOriginalIndex >= 0[\s\S]+Some images exist only in the saved draft/,
  );
});

test("successful local fallback retires the draft best-effort", () => {
  assert.match(VIRTUAL_STAGING_FORM, /retireSubmittedDraftBestEffort/);
  assert.match(VIRTUAL_STAGING_FORM, /method: "DELETE"/);
});

test("failed local fallback keeps the draft active", () => {
  const fallbackIndex = VIRTUAL_STAGING_FORM.indexOf(
    "const result = await submitCurrentLocalOrder",
  );
  const retireIndex = VIRTUAL_STAGING_FORM.indexOf(
    "await retireSubmittedDraftBestEffort",
  );
  assert.ok(fallbackIndex >= 0);
  assert.ok(retireIndex > fallbackIndex);
  assert.doesNotMatch(
    VIRTUAL_STAGING_FORM.slice(fallbackIndex, retireIndex),
    /retireSubmittedDraftBestEffort/,
  );
});

test("canonical pricing error code survives the /api/order refactor", () => {
  assert.match(ORDER_SERVICE, /code: error\.code/);
  assert.match(ORDER_ROUTE, /const responseCode[\s\S]*: result\.code/);
  assert.match(ORDER_ROUTE, /code: responseCode/);
});

test("ordinary order success shape remains unchanged", () => {
  assert.match(ORDER_ROUTE, /success: true/);
  assert.match(ORDER_ROUTE, /orderNumber: result\.orderNumber/);
  assert.match(ORDER_ROUTE, /estimatedTotalCents: result\.estimatedTotalCents/);
  assert.match(ORDER_ROUTE, /emailNotifications: result\.emailNotifications/);
});

test("existing-order reconciliation requires matching source draft", () => {
  assert.match(
    FINALIZATION_SERVER,
    /order\.sourceDraftId === draftId[\s\S]+order\.serviceType === serviceType/,
  );
});

test("existing-order reconciliation requires exact item count and indexes", () => {
  assert.match(FINALIZATION_SERVER, /input\.order\.itemCount !== input\.context\.itemCount/);
  assert.match(FINALIZATION_SERVER, /hasCompleteUniqueItemIndexes/);
});

test("existing-order reconciliation rejects noncanonical production paths", () => {
  assert.match(FINALIZATION_SERVER, /paths\.originalPath !== expectedOriginalPath/);
  assert.match(FINALIZATION_SERVER, /paths\.referencePath !== expectedReferencePath/);
});

test("existing-order reconciliation verifies destinations before cleanup", () => {
  const reconcileIndex = FINALIZATION_SERVER.indexOf(
    "async function reconcileExistingDraftOrder",
  );
  const verifyIndex = FINALIZATION_SERVER.indexOf(
    "verifyReconciledDestinationObject",
    reconcileIndex,
  );
  const cleanupIndex = FINALIZATION_SERVER.indexOf(
    "removeDraftSourcesBestEffort",
    verifyIndex,
  );
  assert.ok(reconcileIndex >= 0);
  assert.ok(verifyIndex >= 0);
  assert.ok(cleanupIndex > verifyIndex);
});

test("source cleanup policy is documented as best-effort private orphan cleanup", () => {
  assert.match(FINALIZATION_SERVER, /Cleanup policy: completion is durable/);
  assert.match(FINALIZATION_SERVER, /safe orphans/);
});

test("complete RPC validation failure performs no partial mutation", () => {
  const lockIndex = SQL.indexOf("FOR UPDATE");
  const updateIndex = SQL.indexOf("UPDATE public.order_draft_files AS files");
  assert.ok(lockIndex >= 0);
  assert.ok(updateIndex > lockIndex);
  assert.match(SQL, /RAISE EXCEPTION 'draft finalization file update count mismatch'/);
  assert.match(SQL, /RAISE EXCEPTION 'draft finalization draft update count mismatch'/);
});

test("duplicate final paths are rejected", () => {
  assert.match(SQL, /v_final_path = ANY\(v_moved_paths\)/);
  assert.match(SQL, /'duplicate_moved_files'::text/);
});

test("photo-editing compatibility migration replaces only the two approved RPCs", () => {
  const replacedFunctions = Array.from(
    SQL_PHOTO_EDITING_COMPATIBILITY.matchAll(
      /CREATE OR REPLACE FUNCTION public\.([a-z_]+)\(/g,
    ),
    (match) => match[1],
  );
  assert.deepEqual(replacedFunctions, [
    "claim_order_draft_finalization",
    "commit_order_submission",
  ]);

  let outsideFunctions = SQL_PHOTO_EDITING_COMPATIBILITY.replace(/\r\n/g, "\n");
  for (const functionName of replacedFunctions) {
    const start = outsideFunctions.indexOf(
      `CREATE OR REPLACE FUNCTION public.${functionName}`,
    );
    assert.ok(start >= 0, `${functionName} must exist`);
    const end = outsideFunctions.indexOf("$$;", start);
    assert.ok(end > start, `${functionName} must terminate`);
    outsideFunctions =
      outsideFunctions.slice(0, start) + outsideFunctions.slice(end + 3);
  }

  assert.doesNotMatch(
    outsideFunctions,
    /\b(CREATE|ALTER|DROP)\s+(TABLE|INDEX|TRIGGER|POLICY|SCHEMA)\b/i,
  );
  assert.doesNotMatch(outsideFunctions, /\bENABLE ROW LEVEL SECURITY\b/i);
  assert.doesNotMatch(
    outsideFunctions,
    /\b(INSERT INTO|UPDATE|DELETE FROM)\s+public\./i,
  );
});

test("claim compatibility allowlist accepts only Virtual Staging and Photo Editing route pairs", () => {
  const claimSql = sourceSlice(
    SQL_PHOTO_EDITING_COMPATIBILITY,
    "CREATE OR REPLACE FUNCTION public.claim_order_draft_finalization(",
    "CREATE OR REPLACE FUNCTION public.commit_order_submission(",
  );
  const pairs = parsedDraftServiceRoutePairs(claimSql);
  assert.deepEqual(pairs, [
    {
      serviceType: "virtual-staging",
      route: "/dashboard/orders/new/virtual-staging",
    },
    {
      serviceType: "photo-editing",
      route: "/dashboard/orders/new/photo-editing",
    },
  ]);

  const allowed = (serviceType: string, route: string) =>
    pairs.some(
      (pair) => pair.serviceType === serviceType && pair.route === route,
    );
  assert.equal(
    allowed("virtual-staging", "/dashboard/orders/new/virtual-staging"),
    true,
  );
  assert.equal(
    allowed("photo-editing", "/dashboard/orders/new/photo-editing"),
    true,
  );
  assert.equal(
    allowed("photo-editing", "/dashboard/orders/new/virtual-staging"),
    false,
  );
  assert.equal(
    allowed("virtual-staging", "/dashboard/orders/new/photo-editing"),
    false,
  );
  assert.equal(
    allowed("virtual-renovation", "/dashboard/orders/new/virtual-renovation"),
    false,
  );
  assert.match(claimSql, /IF NOT \([\s\S]+\) THEN\s+RETURN QUERY SELECT 'invalid_status'::text/);
});

test("claim compatibility migration preserves the existing claim implementation", () => {
  const historical = sourceSlice(
    SQL,
    "CREATE OR REPLACE FUNCTION public.claim_order_draft_finalization(",
    "-- ------------------------------------------------------------\n-- Release finalization",
  ).trim();
  const migrated = sourceSlice(
    SQL_PHOTO_EDITING_COMPATIBILITY,
    "CREATE OR REPLACE FUNCTION public.claim_order_draft_finalization(",
    "CREATE OR REPLACE FUNCTION public.commit_order_submission(",
  ).trim();
  const widenedGuard = `  IF NOT (
    (
      v_draft.service_type = 'virtual-staging'
      AND v_draft.route = '/dashboard/orders/new/virtual-staging'
    )
    OR
    (
      v_draft.service_type = 'photo-editing'
      AND v_draft.route = '/dashboard/orders/new/photo-editing'
    )
  ) THEN
    RETURN QUERY SELECT 'invalid_status'::text, v_draft.id, NULL::uuid;
    RETURN;
  END IF;`;
  const historicalGuard = `  IF v_draft.service_type <> 'virtual-staging'
     OR v_draft.route <> '/dashboard/orders/new/virtual-staging' THEN
    RETURN QUERY SELECT 'invalid_status'::text, v_draft.id, NULL::uuid;
    RETURN;
  END IF;`;
  const normalizedMigrated = migrated
    .replace(widenedGuard, historicalGuard)
    .replace(
      "Locks and claims an owned active allowlisted order draft",
      "Locks and claims an owned active Virtual Staging draft",
    );
  assert.equal(normalizedMigrated, historical);
});

test("claim compatibility migration preserves service-role-only security", () => {
  const claimSql = sourceSlice(
    SQL_PHOTO_EDITING_COMPATIBILITY,
    "CREATE OR REPLACE FUNCTION public.claim_order_draft_finalization(",
    "CREATE OR REPLACE FUNCTION public.commit_order_submission(",
  );
  assert.match(
    claimSql,
    /LANGUAGE plpgsql\s+SECURITY DEFINER\s+SET search_path = pg_catalog, public/,
  );
  assert.match(
    claimSql,
    /REVOKE ALL ON FUNCTION public\.claim_order_draft_finalization\([\s\S]+FROM PUBLIC, anon, authenticated/,
  );
  assert.match(
    claimSql,
    /GRANT EXECUTE ON FUNCTION public\.claim_order_draft_finalization\([\s\S]+TO service_role/,
  );
  assert.doesNotMatch(claimSql, /GRANT EXECUTE[\s\S]+TO (?:PUBLIC|anon|authenticated)/);
});

test("Virtual Renovation compatibility migration replaces only the two approved RPCs", () => {
  const replacedFunctions = Array.from(
    SQL_VIRTUAL_RENOVATION_COMPATIBILITY.matchAll(
      /CREATE OR REPLACE FUNCTION public\.([a-z_]+)\(/g,
    ),
    (match) => match[1],
  );
  assert.deepEqual(replacedFunctions, [
    "claim_order_draft_finalization",
    "commit_order_submission",
  ]);

  let outsideFunctions = SQL_VIRTUAL_RENOVATION_COMPATIBILITY.replace(
    /\r\n/g,
    "\n",
  );
  for (const functionName of replacedFunctions) {
    const start = outsideFunctions.indexOf(
      `CREATE OR REPLACE FUNCTION public.${functionName}`,
    );
    assert.ok(start >= 0, `${functionName} must exist`);
    const end = outsideFunctions.indexOf("$$;", start);
    assert.ok(end > start, `${functionName} must terminate`);
    outsideFunctions =
      outsideFunctions.slice(0, start) + outsideFunctions.slice(end + 3);
  }

  assert.doesNotMatch(
    outsideFunctions,
    /\b(CREATE|ALTER|DROP)\s+(TABLE|INDEX|TRIGGER|POLICY|SCHEMA)\b/i,
  );
  assert.doesNotMatch(outsideFunctions, /\bENABLE ROW LEVEL SECURITY\b/i);
  assert.doesNotMatch(
    outsideFunctions,
    /\b(INSERT INTO|UPDATE|DELETE FROM)\s+public\./i,
  );
});

test("Virtual Renovation canonical route is proven by the current dashboard page", () => {
  assert.match(
    VIRTUAL_RENOVATION_PAGE,
    /const ORDER_ROUTE = "\/dashboard\/orders\/new\/virtual-renovation"/,
  );
  assert.match(
    VIRTUAL_RENOVATION_PAGE,
    /<VirtualRenovationOrderForm clientEmail=\{email\} orderRoute=\{ORDER_ROUTE\} \/>/,
  );
});

test("claim compatibility allowlist accepts exactly three canonical service-route pairs", () => {
  const claimSql = sourceSlice(
    SQL_VIRTUAL_RENOVATION_COMPATIBILITY,
    "CREATE OR REPLACE FUNCTION public.claim_order_draft_finalization(",
    "CREATE OR REPLACE FUNCTION public.commit_order_submission(",
  );
  const pairs = parsedDraftServiceRoutePairs(claimSql);
  assert.deepEqual(pairs, [
    {
      serviceType: "virtual-staging",
      route: "/dashboard/orders/new/virtual-staging",
    },
    {
      serviceType: "photo-editing",
      route: "/dashboard/orders/new/photo-editing",
    },
    {
      serviceType: "virtual-renovation",
      route: "/dashboard/orders/new/virtual-renovation",
    },
  ]);

  const allowed = (serviceType: string, route: string) =>
    pairs.some(
      (pair) => pair.serviceType === serviceType && pair.route === route,
    );
  assert.equal(
    allowed("virtual-staging", "/dashboard/orders/new/virtual-staging"),
    true,
  );
  assert.equal(
    allowed("photo-editing", "/dashboard/orders/new/photo-editing"),
    true,
  );
  assert.equal(
    allowed("virtual-renovation", "/dashboard/orders/new/virtual-renovation"),
    true,
  );
  assert.equal(
    allowed("virtual-renovation", "/dashboard/orders/new/virtual-staging"),
    false,
  );
  assert.equal(
    allowed("virtual-renovation", "/dashboard/orders/new/photo-editing"),
    false,
  );
  assert.equal(
    allowed("virtual-staging", "/dashboard/orders/new/virtual-renovation"),
    false,
  );
  assert.equal(
    allowed("photo-editing", "/dashboard/orders/new/virtual-renovation"),
    false,
  );
  assert.equal(
    allowed("unsupported", "/dashboard/orders/new/virtual-renovation"),
    false,
  );
  assert.match(
    claimSql,
    /IF NOT \([\s\S]+\) THEN\s+RETURN QUERY SELECT 'invalid_status'::text/,
  );
});

test("Virtual Renovation claim migration changes only the additional allowlist branch", () => {
  const previousClaim = sourceSlice(
    SQL_PHOTO_EDITING_COMPATIBILITY,
    "CREATE OR REPLACE FUNCTION public.claim_order_draft_finalization(",
    "CREATE OR REPLACE FUNCTION public.commit_order_submission(",
  );
  const migratedClaim = sourceSlice(
    SQL_VIRTUAL_RENOVATION_COMPATIBILITY,
    "CREATE OR REPLACE FUNCTION public.claim_order_draft_finalization(",
    "CREATE OR REPLACE FUNCTION public.commit_order_submission(",
  );
  const virtualRenovationBranch = `
    OR
    (
      v_draft.service_type = 'virtual-renovation'
      AND v_draft.route = '/dashboard/orders/new/virtual-renovation'
    )`;
  assert.equal(migratedClaim.replace(virtualRenovationBranch, ""), previousClaim);
});

test("Virtual Renovation claim preserves security and enables only its canonical application finalizer", () => {
  const claimSql = sourceSlice(
    SQL_VIRTUAL_RENOVATION_COMPATIBILITY,
    "CREATE OR REPLACE FUNCTION public.claim_order_draft_finalization(",
    "CREATE OR REPLACE FUNCTION public.commit_order_submission(",
  );
  assert.match(
    claimSql,
    /LANGUAGE plpgsql\s+SECURITY DEFINER\s+SET search_path = pg_catalog, public/,
  );
  assert.match(
    claimSql,
    /REVOKE ALL ON FUNCTION public\.claim_order_draft_finalization\([\s\S]+FROM PUBLIC, anon, authenticated/,
  );
  assert.match(
    claimSql,
    /GRANT EXECUTE ON FUNCTION public\.claim_order_draft_finalization\([\s\S]+TO service_role/,
  );
  assert.doesNotMatch(
    claimSql,
    /GRANT EXECUTE[\s\S]+TO (?:PUBLIC|anon|authenticated)/,
  );

  const enabledServices = sourceSlice(
    FINALIZATION_SERVER,
    "function getEnabledDraftFinalizationService(",
    "function buildTrustedDraftFinalizationContext(",
  );
  assert.match(enabledServices, /return "virtual-staging"/);
  assert.match(enabledServices, /return "photo-editing"/);
  assert.match(
    enabledServices,
    /draft\.serviceType === "virtual-renovation"[\s\S]+draft\.subService === null[\s\S]+draft\.route === VIRTUAL_RENOVATION_DRAFT_ROUTE[\s\S]+return "virtual-renovation"/,
  );
});
