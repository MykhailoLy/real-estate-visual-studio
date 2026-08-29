import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateOrderQuote } from "../pricing/calculate.ts";
import {
  mapPhotoEditingDraftStateToProductionItems,
  validateAndMatchPhotoEditingDraftFiles,
  validatePhotoEditingDraftForFinalization,
} from "./finalization.ts";
import {
  PHOTO_EDITING_DRAFT_ROUTE,
  PHOTO_EDITING_DRAFT_STATE_SCHEMA_VERSION,
  PHOTO_EDITING_DRAFT_STEP,
  PhotoEditingDraftStateSchema,
  buildPhotoEditingCreateDraftInput,
  buildPhotoEditingDraftFingerprint,
  buildPhotoEditingUpdateDraftInput,
  createPhotoEditingFormItem,
  hasMeaningfulPhotoEditingDraftChange,
  mapPhotoEditingDraftToFormState,
  mapPhotoEditingFormToDraftState,
  resetPhotoEditingDraftIdentity,
  shouldApplyPhotoEditingAsyncResult,
  validatePhotoEditingDraftForResume,
  type PhotoEditingFormDraftSource,
} from "./photo-editing.ts";
import type { OrderDraftFileRow } from "./types.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const DRAFT_ID = "22222222-2222-4222-8222-222222222222";
const FILE_ID_A = "33333333-3333-4333-8333-333333333333";
const FILE_ID_B = "44444444-4444-4444-8444-444444444444";
const ITEM_ID_A = "55555555-5555-4555-8555-555555555555";
const ITEM_ID_B = "66666666-6666-4666-8666-666666666666";

function source(): PhotoEditingFormDraftSource {
  return {
    jobTitle: "  Listing photos  ",
    items: [
      {
        clientItemId: ITEM_ID_A,
        file: { name: "living.jpg" },
        selectedOptions: ["image-enhancement-re", "shadow-removal"],
        fileSizeLimit: "Under 10 MB",
        disclaimerText: "Standard disclaimer",
        additionalInfo: "Brighten the windows",
        originalFilename: null,
      },
      {
        clientItemId: ITEM_ID_B,
        file: null,
        selectedOptions: ["day-to-dusk-pe"],
        fileSizeLimit: "",
        disclaimerText: "",
        additionalInfo: "Keep the pool lights",
        originalFilename: "exterior.png",
      },
    ],
    orderTerms: {
      accepted: true,
      earlyPerformanceRequested: true,
      allowPortfolio: false,
    },
    currency: "USD",
    region: "US",
  };
}

function uploadedFile(input: {
  id: string;
  itemClientId: string;
  filename: string;
  kind?: "original" | "reference";
}): OrderDraftFileRow {
  return {
    id: input.id,
    draftId: DRAFT_ID,
    itemClientId: input.itemClientId,
    itemIndex: null,
    kind: input.kind ?? "original",
    bucket: "order-files",
    storagePath: `drafts/${USER_ID}/${DRAFT_ID}/${input.id}/${input.filename}`,
    originalFilename: input.filename,
    fileSize: 128,
    mimeType: input.filename.endsWith(".png") ? "image/png" : "image/jpeg",
    contentHash: null,
    uploadStatus: "uploaded",
    createdAt: "2026-08-26T10:00:00.000Z",
    updatedAt: "2026-08-26T10:00:00.000Z",
    deletedAt: null,
    movedAt: null,
  };
}

test("meaningful Photo Editing edits create the generic draft payload", () => {
  const input = source();
  assert.equal(hasMeaningfulPhotoEditingDraftChange(input), true);
  const create = buildPhotoEditingCreateDraftInput(input);
  assert.equal(create.serviceType, "photo-editing");
  assert.equal(create.subService, undefined);
  assert.equal(create.route, PHOTO_EDITING_DRAFT_ROUTE);
  assert.equal(create.state.schemaVersion, PHOTO_EDITING_DRAFT_STATE_SCHEMA_VERSION);
  assert.equal(create.currentStep, PHOTO_EDITING_DRAFT_STEP);
  assert.equal(create.state.currentStep, "configure");
  assert.equal(create.currency, "USD");
  assert.equal(create.region, "US");
});

test("empty Photo Editing form stays local until it has a meaningful edit", () => {
  assert.equal(
    hasMeaningfulPhotoEditingDraftChange({
      jobTitle: "",
      items: [createPhotoEditingFormItem()],
      orderTerms: {
        accepted: false,
        earlyPerformanceRequested: false,
        allowPortfolio: false,
      },
      currency: "USD",
      region: "US",
    }),
    false,
  );
});

test("legacy Photo Editing drafts restore a missing early-performance request as false", () => {
  const legacy = mapPhotoEditingFormToDraftState(source()) as unknown as {
    termsUi: Record<string, unknown>;
  };
  delete legacy.termsUi.earlyPerformanceRequested;

  const restored = mapPhotoEditingDraftToFormState(legacy);
  assert.equal(restored.orderTerms.earlyPerformanceRequested, false);
});

test("job title, options, multiple items, terms, and filenames restore", () => {
  const state = mapPhotoEditingFormToDraftState(source());
  const restored = mapPhotoEditingDraftToFormState(state);
  assert.equal(restored.jobTitle, "Listing photos");
  assert.equal(restored.items.length, 2);
  assert.deepEqual(restored.items[0]?.selectedOptions, [
    "image-enhancement-re",
    "shadow-removal",
  ]);
  assert.equal(restored.items[0]?.originalFilename, "living.jpg");
  assert.equal(restored.items[1]?.clientItemId, ITEM_ID_B);
  assert.equal(restored.items[1]?.originalFilename, "exterior.png");
  assert.deepEqual(restored.orderTerms, {
    accepted: true,
    earlyPerformanceRequested: true,
    allowPortfolio: false,
  });
  assert.equal(restored.items.every((item) => item.file === null), true);
});

test("draft fingerprints never serialize File, Blob, or blob URLs", () => {
  const fingerprint = buildPhotoEditingDraftFingerprint(source());
  assert.doesNotMatch(fingerprint, /blob:/);
  assert.doesNotMatch(fingerprint, /lastModified/);
  assert.doesNotMatch(fingerprint, /living\.jpg[^}]+size/);
  assert.match(fingerprint, /originalFilename/);
});

test("stable client item IDs remain unique UUIDs", () => {
  const ids = Array.from({ length: 50 }, () => createPhotoEditingFormItem().clientItemId);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[0-9a-f-]{36}$/);
});

test("draft schema rejects duplicate stable item IDs", () => {
  const state = mapPhotoEditingFormToDraftState(source());
  state.items[1] = {
    ...state.items[1]!,
    clientItemId: state.items[0]!.clientItemId,
  };
  assert.equal(PhotoEditingDraftStateSchema.safeParse(state).success, false);
});

test("removing the first item does not reassign the second item's file", () => {
  const state = mapPhotoEditingFormToDraftState(source());
  state.items = state.items.filter((item) => item.clientItemId !== ITEM_ID_A);
  const match = validateAndMatchPhotoEditingDraftFiles({
    verifiedUserId: USER_ID,
    draftId: DRAFT_ID,
    state,
    files: [
      uploadedFile({
        id: FILE_ID_B,
        itemClientId: ITEM_ID_B,
        filename: "exterior.png",
      }),
    ],
  });
  assert.equal(match.ok, true);
  if (match.ok) {
    assert.equal(match.data[0]?.clientItemId, ITEM_ID_B);
    assert.equal(match.data[0]?.original.id, FILE_ID_B);
    assert.equal(match.data[0]?.itemIndex, 0);
  }
});

test("Start New clears draft identity and preserves unrelated query values", () => {
  const reset = resetPhotoEditingDraftIdentity(
    `draft=${DRAFT_ID}&from=dashboard`,
  );
  assert.equal(reset.draftId, null);
  assert.equal(reset.draftVersion, null);
  assert.equal(reset.saveStatus, "not_saved");
  assert.equal(reset.nextSearch, "from=dashboard");
});

test("resume fails closed for wrong service, sub-service, route, and schema", () => {
  const state = mapPhotoEditingFormToDraftState(source());
  const base = {
    serviceType: "photo-editing" as const,
    subService: null,
    route: PHOTO_EDITING_DRAFT_ROUTE,
    state,
    stateSchemaVersion: PHOTO_EDITING_DRAFT_STATE_SCHEMA_VERSION,
    version: 3,
  };
  assert.equal(validatePhotoEditingDraftForResume(base).ok, true);
  assert.equal(
    validatePhotoEditingDraftForResume({
      ...base,
      serviceType: "virtual-staging",
    }).ok,
    false,
  );
  assert.equal(
    validatePhotoEditingDraftForResume({ ...base, subService: "day-to-dusk" }).ok,
    false,
  );
  assert.equal(
    validatePhotoEditingDraftForResume({ ...base, route: "/dashboard/orders/new/virtual-staging" }).ok,
    false,
  );
  assert.equal(
    validatePhotoEditingDraftForResume({ ...base, stateSchemaVersion: 99 }).ok,
    false,
  );
});

test("optimistic update payload carries the expected version", () => {
  const update = buildPhotoEditingUpdateDraftInput(source(), 7);
  assert.equal(update.expectedVersion, 7);
  assert.equal(update.state?.items[1]?.clientItemId, ITEM_ID_B);
});

test("stale save and upload results are ignored by session and slot generation", () => {
  assert.equal(shouldApplyPhotoEditingAsyncResult(3, 3), true);
  assert.equal(shouldApplyPhotoEditingAsyncResult(3, 4), false);
  assert.equal(shouldApplyPhotoEditingAsyncResult(3, 3, 2, 2), true);
  assert.equal(shouldApplyPhotoEditingAsyncResult(3, 3, 2, 3), false);
});

test("Photo Editing finalization validates trusted service and route", () => {
  const state = mapPhotoEditingFormToDraftState(source());
  const valid = validatePhotoEditingDraftForFinalization({
    serviceType: "photo-editing",
    subService: null,
    route: PHOTO_EDITING_DRAFT_ROUTE,
    state,
    stateSchemaVersion: PHOTO_EDITING_DRAFT_STATE_SCHEMA_VERSION,
    currency: "USD",
    status: "converting",
  });
  assert.equal(valid.ok, true);
  assert.equal(
    validatePhotoEditingDraftForFinalization({
      serviceType: "photo-editing",
      subService: null,
      route: "/dashboard/orders/new/day-to-dusk",
      state,
      stateSchemaVersion: PHOTO_EDITING_DRAFT_STATE_SCHEMA_VERSION,
      currency: "USD",
      status: "converting",
    }).ok,
    false,
  );
});

test("Photo Editing state maps to the existing production item shape", () => {
  const state = mapPhotoEditingFormToDraftState(source());
  const mapped = mapPhotoEditingDraftStateToProductionItems(state);
  assert.equal(mapped.ok, true);
  if (!mapped.ok) return;
  assert.deepEqual(mapped.data[0]?.selectedOptions, [
    "image-enhancement-re",
    "shadow-removal",
  ]);
  assert.equal(mapped.data[0]?.fileSizeLimit, "Under 10 MB");
  assert.equal(mapped.data[0]?.disclaimerText, "Standard disclaimer");
  assert.equal(mapped.data[0]?.additionalInfo, "Brighten the windows");
});

test("Photo Editing persisted files require one exact original per stable item", () => {
  const state = mapPhotoEditingFormToDraftState(source());
  const files = [
    uploadedFile({ id: FILE_ID_A, itemClientId: ITEM_ID_A, filename: "living.jpg" }),
    uploadedFile({ id: FILE_ID_B, itemClientId: ITEM_ID_B, filename: "exterior.png" }),
  ];
  assert.equal(
    validateAndMatchPhotoEditingDraftFiles({
      verifiedUserId: USER_ID,
      draftId: DRAFT_ID,
      state,
      files,
    }).ok,
    true,
  );
  assert.equal(
    validateAndMatchPhotoEditingDraftFiles({
      verifiedUserId: USER_ID,
      draftId: DRAFT_ID,
      state,
      files: files.slice(0, 1),
    }).ok,
    false,
  );
  assert.equal(
    validateAndMatchPhotoEditingDraftFiles({
      verifiedUserId: USER_ID,
      draftId: DRAFT_ID,
      state,
      files: [
        ...files,
        uploadedFile({
          id: "77777777-7777-4777-8777-777777777777",
          itemClientId: ITEM_ID_A,
          filename: "reference.jpg",
          kind: "reference",
        }),
      ],
    }).ok,
    false,
  );
});

test("draft pricing preview preserves current Photo Editing pricing semantics", () => {
  const input = source();
  const create = buildPhotoEditingCreateDraftInput(input);
  const direct = calculateOrderQuote({
    serviceType: "photo-editing",
    currency: "USD",
    items: input.items.map((item) => ({
      selectedOptions: item.selectedOptions,
    })),
  });
  assert.equal(create.pricingPreview?.preview.totalCents, direct.totalCents);
  assert.equal(create.pricingPreview?.preview.currency, direct.currency);
});

test("Photo Editing form uses durable APIs and navigation-free URL sync", () => {
  const form = readFileSync(
    new URL(
      "../../components/order/photo-editing/PhotoEditingOrderForm.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const urlSyncStart = form.indexOf("const replaceDraftUrl = useCallback(");
  const urlSyncEnd = form.indexOf("const persistDraft = useCallback(", urlSyncStart);
  assert.ok(urlSyncStart >= 0);
  assert.ok(urlSyncEnd > urlSyncStart);
  const urlSyncSource = form.slice(urlSyncStart, urlSyncEnd);

  assert.match(
    urlSyncSource,
    /window\.history\.replaceState\(\s*null,\s*"",\s*`\$\{pathname\}\$\{suffix\}\$\{window\.location\.hash\}`,?\s*\)/,
  );
  assert.match(urlSyncSource, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(urlSyncSource, /next\.set\("draft", nextDraftId\)/);
  assert.match(urlSyncSource, /next\.delete\("draft"\)/);
  assert.match(urlSyncSource, /replaceDraftUrl\(next\.toString\(\)\)/);
  assert.doesNotMatch(form, /replaceState\(\s*window\.history\.state/);
  assert.doesNotMatch(form, /router\.replace|useRouter/);
  assert.doesNotMatch(form, /submitOrder\(|\/api\/order["'`]/);
  assert.match(form, /prepareOrderDraftFileUpload/);
  assert.match(form, /uploadPreparedOrderDraftFile/);
  assert.match(form, /completeOrderDraftFileUpload/);
  assert.match(form, /submitOrderDraft/);
  assert.match(form, /key=\{item\.clientItemId\}/);
  assert.match(form, /draftSessionRef\.current \+= 1/);
  assert.doesNotMatch(form, /scrollIntoView|scrollTo\(/);
});

test("first draft URL sync preserves restore guards without an RSC navigation", () => {
  const form = readFileSync(
    new URL(
      "../../components/order/photo-editing/PhotoEditingOrderForm.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const createStart = form.indexOf("if (!currentId) {");
  const createEnd = form.indexOf(
    "const currentVersion = draftVersionRef.current;",
    createStart,
  );
  assert.ok(createStart >= 0);
  assert.ok(createEnd > createStart);

  const createSource = form.slice(createStart, createEnd);
  const draftRef = createSource.indexOf("draftIdRef.current = result.data.id;");
  const fingerprint = createSource.indexOf("savedFingerprintRef.current = fingerprint;");
  const updateUrl = createSource.indexOf("setDraftQueryParam(result.data.id);");
  assert.ok(draftRef >= 0);
  assert.ok(fingerprint > draftRef);
  assert.ok(updateUrl > fingerprint);
  assert.match(form, /const searchParams = useSearchParams\(\)/);
  assert.match(form, /const requestedDraftId = searchParams\.get\("draft"\)/);
  assert.match(
    form,
    /requestedDraftId === draftIdRef\.current\s*&&\s*savedFingerprintRef\.current !== null/,
  );
  assert.match(form, /getOrderDraft\(requestedDraftId, controller\.signal\)/);
  assert.match(form, /listOrderDraftFiles\(result\.data\.id, controller\.signal\)/);
  assert.doesNotMatch(form, /router\.replace|router\.refresh|useRouter/);
});

test("Start New and browser history keep the draft query synchronized", () => {
  const form = readFileSync(
    new URL(
      "../../components/order/photo-editing/PhotoEditingOrderForm.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const resetStart = form.indexOf("const startNewOrder = useCallback(");
  const resetEnd = form.indexOf(
    "const hasActiveFileOperation =",
    resetStart,
  );
  assert.ok(resetStart >= 0);
  assert.ok(resetEnd > resetStart);
  const resetSource = form.slice(resetStart, resetEnd);

  assert.match(
    resetSource,
    /resetPhotoEditingDraftIdentity\(window\.location\.search\)/,
  );
  assert.match(resetSource, /replaceDraftUrl\(reset\.nextSearch\)/);
  assert.match(
    form,
    /commitUploadedFiles,\s*requestedDraftId,\s*requestedDraftIsValid,\s*setRegion,/,
  );
  assert.doesNotMatch(form, /window\.onpopstate|addEventListener\("popstate"/);
});

test("normal ready state renders a guarded Start New only for an active draft", () => {
  const form = readFileSync(
    new URL(
      "../../components/order/photo-editing/PhotoEditingOrderForm.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const orderLayout = form.indexOf("<OrderLayout");
  const readyReturn = form.lastIndexOf("return (", orderLayout);
  const readyFieldset = form.indexOf("<fieldset", readyReturn);

  assert.ok(orderLayout >= 0);
  assert.ok(readyReturn >= 0);
  assert.ok(readyFieldset > orderLayout);
  assert.ok(readyReturn > form.indexOf('if (resumeState === "error")'));

  const readyHeader = form.slice(readyReturn, readyFieldset);
  assert.match(
    readyHeader,
    /className="flex min-h-5 flex-wrap items-center justify-between gap-3"/,
  );
  assert.match(
    readyHeader,
    /\{draftId !== null \? \([\s\S]*onClick=\{startNewOrder\}[\s\S]*Start New[\s\S]*\) : null\}/,
  );
  assert.match(readyHeader, /disabled=\{startNewDisabled\}/);
  assert.doesNotMatch(readyHeader, /<fieldset/);
  assert.match(
    form,
    /const editsDisabled = isSubmitting \|\| finalizationRetryContext !== null;/,
  );
  assert.match(
    form,
    /const startNewDisabled =\s*editsDisabled \|\| hasActiveFileOperation \|\| saveStatus === "saving";/,
  );

  const resetStart = form.indexOf("const startNewOrder = useCallback(");
  const resetEnd = form.indexOf("const hasActiveFileOperation =", resetStart);
  const resetSource = form.slice(resetStart, resetEnd);
  assert.match(resetSource, /draftSessionRef\.current \+= 1/);
  assert.match(resetSource, /setDraftId\(reset\.draftId\)/);
  assert.match(resetSource, /draftIdRef\.current = reset\.draftId/);
  assert.match(resetSource, /replaceDraftUrl\(reset\.nextSearch\)/);
});

test("Photo Editing form keeps the complete durable original-file lifecycle", () => {
  const form = readFileSync(
    new URL(
      "../../components/order/photo-editing/PhotoEditingOrderForm.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const prepare = form.indexOf("await prepareOrderDraftFileUpload");
  const upload = form.indexOf("await uploadPreparedOrderDraftFile", prepare);
  const complete = form.indexOf("await completeOrderDraftFileUpload", upload);
  assert.ok(prepare >= 0);
  assert.ok(upload > prepare);
  assert.ok(complete > upload);
  assert.match(form, /await listOrderDraftFiles\(result\.data\.id/);
  assert.match(form, /filter\([\s\S]+originalSlotKey\(candidate\.itemClientId\) !== slotKey/);
  assert.match(form, /await deleteOrderDraftFile\(currentDraftId, persisted\.id\)/);
  assert.match(form, /retryFile: file/);
  assert.match(form, /pendingFileId: prepared\.data\.file\.id/);
  assert.match(form, /requestedDraftId[\s\S]+getOrderDraft\(requestedDraftId/);
});

test("trusted server dispatch selects Photo Editing from the loaded draft", () => {
  const server = readFileSync(
    new URL("./finalization-server.ts", import.meta.url),
    "utf8",
  );
  const route = readFileSync(
    new URL(
      "../../app/(public)/api/order-drafts/[draftId]/submit/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(route, /submitOrderDraftForUser/);
  assert.doesNotMatch(route, /serviceType:\s*body|body\.serviceType/);
  assert.match(server, /loadClaimedDraft\(input\.userId, input\.draftId\)/);
  assert.match(server, /if \(draft\.serviceType === "photo-editing"\)/);
  assert.match(server, /validatePhotoEditingDraftForFinalization/);
  assert.match(server, /storageMode: "copy"/);
  assert.match(server, /sourceDraftId: input\.draftId/);
});

test("existing signature validation, singleton browser client, and ownership filter remain", () => {
  const filesServer = readFileSync(new URL("./files-server.ts", import.meta.url), "utf8");
  const browserClient = readFileSync(
    new URL("../supabase/browser.ts", import.meta.url),
    "utf8",
  );
  const draftServer = readFileSync(new URL("./server.ts", import.meta.url), "utf8");
  assert.match(filesServer, /verifyStoredUploadContent/);
  assert.match(browserClient, /let _client: SupabaseClient \| null = null/);
  assert.match(browserClient, /if \(_client\) return _client/);
  assert.match(draftServer, /\.eq\("user_id", userId\)/);
});
