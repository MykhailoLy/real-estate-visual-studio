import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateOrderQuote } from "../pricing/calculate.ts";
import { isDraftFileAllowedForDraft } from "./files.ts";
import {
  buildFloorPlansFinalizationItemFiles,
  mapFloorPlansDraftStateToProductionItems,
  validateAndMatchFloorPlansDraftFiles,
  validateFloorPlansDraftForFinalization,
} from "./finalization.ts";
import {
  FLOOR_PLAN_MAX_FLOORS,
  FLOOR_PLAN_MIN_FLOORS,
  FLOOR_PLANS_DRAFT_ROUTE,
  FLOOR_PLANS_DRAFT_STATE_SCHEMA_VERSION,
  FloorPlansDraftStateSchema,
  buildFloorPlansCreateDraftInput,
  buildFloorPlansDraftFingerprint,
  buildFloorPlansPricingPreview,
  buildFloorPlansUpdateDraftInput,
  createFloorPlanFormItem,
  getFloorPlanDraftUploadContentType,
  hasMeaningfulFloorPlansDraftChange,
  isCanonicalFloorPlanType,
  isValidFloorPlanFloorCount,
  mapFloorPlansDraftToFormState,
  mapFloorPlansFormToDraftState,
  parseFloorPlanFloorCountInput,
  resetFloorPlansDraftIdentity,
  shouldApplyFloorPlansAsyncResult,
  validateFloorPlansDraftForResume,
  type FloorPlansFormDraftSource,
} from "./floor-plans.ts";
import type { OrderDraftFileRow } from "./types.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const DRAFT_ID = "22222222-2222-4222-8222-222222222222";
const ORIGINAL_A = "33333333-3333-4333-8333-333333333333";
const REFERENCE_A = "44444444-4444-4444-8444-444444444444";
const ORIGINAL_B = "55555555-5555-4555-8555-555555555555";
const ITEM_A = "66666666-6666-4666-8666-666666666666";
const ITEM_B = "77777777-7777-4777-8777-777777777777";

function source(): FloorPlansFormDraftSource {
  return {
    jobTitle: "  Mesa floor plans  ",
    items: [
      {
        clientItemId: ITEM_A,
        file: { name: "ground-floor.dwg" },
        referenceFile: { name: "reference.webp" },
        planType: "3d",
        numberOfFloors: 2,
        fileSizeLimit: "10 MB & Under",
        disclaimerText: "Marketing use only",
        style3d: "Modern",
        planView3d: "Angle View",
        pageOrientation: "Landscape",
        planOrientation: "Portrait",
        flooringByRoom: {
          Kitchen: "Grey Tiles",
          Bedrooms: "Light Wood",
        },
        showAddress: true,
        streetAddress: "2418 Copper Mesa Drive",
        showTitle: true,
        projectTitle: "Copper Mesa",
        disclaimerOption: "Custom disclaimer text",
        customDisclaimer: "Measurements are approximate.",
        referenceLink: "https://example.com/reference",
        additionalInfo: "Keep room labels concise.",
        originalFilename: null,
        referenceFilename: null,
      },
      {
        clientItemId: ITEM_B,
        file: null,
        referenceFile: null,
        planType: "2d-bw",
        numberOfFloors: 1,
        fileSizeLimit: "",
        disclaimerText: "",
        style3d: "",
        planView3d: "",
        pageOrientation: "Portrait",
        planOrientation: "Landscape",
        flooringByRoom: {},
        showAddress: false,
        streetAddress: "",
        showTitle: false,
        projectTitle: "",
        disclaimerOption: "Do not show disclaimer",
        customDisclaimer: "",
        referenceLink: "",
        additionalInfo: "Include garage dimensions.",
        originalFilename: "upper-floor.pdf",
        referenceFilename: null,
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
  kind: "original" | "reference";
  path?: string;
  uploadStatus?: "pending" | "uploaded" | "failed" | "moved";
  deletedAt?: string | null;
}): OrderDraftFileRow {
  const extension = input.filename.split(".").pop()?.toLowerCase();
  const mimeType =
    extension === "png"
      ? "image/png"
      : extension === "webp"
        ? "image/webp"
        : extension === "pdf"
          ? "application/pdf"
          : extension === "dwg" || extension === "dxf" || extension === "fbx"
            ? "application/octet-stream"
            : "image/jpeg";
  return {
    id: input.id,
    draftId: DRAFT_ID,
    itemClientId: input.itemClientId,
    itemIndex: null,
    kind: input.kind,
    bucket: "order-files",
    storagePath:
      input.path ??
      `drafts/${USER_ID}/${DRAFT_ID}/${input.id}/${input.filename}`,
    originalFilename: input.filename,
    fileSize: 128,
    mimeType,
    contentHash: null,
    uploadStatus: input.uploadStatus ?? "uploaded",
    createdAt: "2026-08-26T10:00:00.000Z",
    updatedAt: "2026-08-26T10:00:00.000Z",
    deletedAt: input.deletedAt ?? null,
    movedAt: null,
  };
}

test("meaningful Floor Plans edits create the canonical durable draft payload", () => {
  const input = source();
  assert.equal(hasMeaningfulFloorPlansDraftChange(input), true);
  const create = buildFloorPlansCreateDraftInput(input);
  assert.equal(create.serviceType, "3d-floor-plans");
  assert.equal(create.subService, undefined);
  assert.equal(create.route, FLOOR_PLANS_DRAFT_ROUTE);
  assert.equal(create.state.schemaVersion, FLOOR_PLANS_DRAFT_STATE_SCHEMA_VERSION);
  assert.equal(create.currency, "USD");
  assert.equal(create.region, "US");
});

test("an untouched Floor Plans form remains local", () => {
  assert.equal(
    hasMeaningfulFloorPlansDraftChange({
      jobTitle: "",
      items: [createFloorPlanFormItem()],
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

test("legacy Floor Plans drafts restore a missing early-performance request as false", () => {
  const legacy = mapFloorPlansFormToDraftState(source()) as unknown as {
    termsUi: Record<string, unknown>;
  };
  delete legacy.termsUi.earlyPerformanceRequested;

  const restored = mapFloorPlansDraftToFormState(legacy);
  assert.equal(restored.orderTerms.earlyPerformanceRequested, false);
});

test("Floor Plans quantity input accepts only canonical integers from 1 through 20", () => {
  const inputCases = [
    ["0", null],
    ["1", FLOOR_PLAN_MIN_FLOORS],
    ["20", FLOOR_PLAN_MAX_FLOORS],
    ["21", null],
    ["1.5", null],
    ["not-a-number", null],
    ["", null],
  ] as const;

  for (const [input, expected] of inputCases) {
    assert.equal(parseFloorPlanFloorCountInput(input), expected);
  }

  assert.equal(isValidFloorPlanFloorCount(0), false);
  assert.equal(isValidFloorPlanFloorCount(1), true);
  assert.equal(isValidFloorPlanFloorCount(20), true);
  assert.equal(isValidFloorPlanFloorCount(21), false);
  assert.equal(isValidFloorPlanFloorCount(1.5), false);
  assert.equal(isValidFloorPlanFloorCount(Number.NaN), false);
});

test("draft serialization rejects invalid pricing fields instead of normalizing them", () => {
  for (const numberOfFloors of [0, 21, 1.5, Number.NaN]) {
    const input = source();
    input.items[0] = { ...input.items[0]!, numberOfFloors };
    assert.equal(buildFloorPlansPricingPreview(input), null);
    assert.throws(() => mapFloorPlansFormToDraftState(input));
    assert.throws(() => buildFloorPlansCreateDraftInput(input));
  }

  const nonCanonicalType = source();
  nonCanonicalType.items[0] = {
    ...nonCanonicalType.items[0]!,
    planType: " 3d ",
  };
  assert.equal(isCanonicalFloorPlanType("3d"), true);
  assert.equal(isCanonicalFloorPlanType(" 3d "), false);
  assert.equal(buildFloorPlansPricingPreview(nonCanonicalType), null);
  assert.throws(() => mapFloorPlansFormToDraftState(nonCanonicalType));
});

test("all Floor Plans fields, stable IDs, terms, and filenames round-trip", () => {
  const state = mapFloorPlansFormToDraftState(source());
  const restored = mapFloorPlansDraftToFormState(state);
  assert.equal(restored.jobTitle, "Mesa floor plans");
  assert.equal(restored.items[0]?.clientItemId, ITEM_A);
  assert.equal(restored.items[0]?.planType, "3d");
  assert.equal(restored.items[0]?.numberOfFloors, 2);
  assert.equal(restored.items[0]?.style3d, "Modern");
  assert.equal(restored.items[0]?.planView3d, "Angle View");
  assert.equal(restored.items[0]?.pageOrientation, "Landscape");
  assert.equal(restored.items[0]?.planOrientation, "Portrait");
  assert.deepEqual(restored.items[0]?.flooringByRoom, {
    Kitchen: "Grey Tiles",
    Bedrooms: "Light Wood",
  });
  assert.equal(restored.items[0]?.streetAddress, "2418 Copper Mesa Drive");
  assert.equal(restored.items[0]?.projectTitle, "Copper Mesa");
  assert.equal(restored.items[0]?.customDisclaimer, "Measurements are approximate.");
  assert.equal(restored.items[0]?.referenceLink, "https://example.com/reference");
  assert.equal(restored.items[0]?.additionalInfo, "Keep room labels concise.");
  assert.equal(restored.items[0]?.originalFilename, "ground-floor.dwg");
  assert.equal(restored.items[0]?.referenceFilename, "reference.webp");
  assert.equal(restored.items.every((item) => item.file === null), true);
  assert.equal(restored.items.every((item) => item.referenceFile === null), true);
});

test("draft fingerprint stores filenames without serializing browser File data", () => {
  const fingerprint = buildFloorPlansDraftFingerprint(source());
  assert.match(fingerprint, /ground-floor\.dwg/);
  assert.match(fingerprint, /reference\.webp/);
  assert.doesNotMatch(fingerprint, /blob:/);
  assert.doesNotMatch(fingerprint, /lastModified/);
});

test("stable item IDs are unique and duplicate IDs fail closed", () => {
  const ids = Array.from({ length: 50 }, () => createFloorPlanFormItem().clientItemId);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[0-9a-f-]{36}$/);

  const state = mapFloorPlansFormToDraftState(source());
  state.items[1] = {
    ...state.items[1]!,
    clientItemId: state.items[0]!.clientItemId,
  };
  assert.equal(FloorPlansDraftStateSchema.safeParse(state).success, false);
});

test("resume rejects wrong service, sub-service, route, and schema version", () => {
  const state = mapFloorPlansFormToDraftState(source());
  const base = {
    serviceType: "3d-floor-plans" as const,
    subService: null,
    route: FLOOR_PLANS_DRAFT_ROUTE,
    state,
    stateSchemaVersion: FLOOR_PLANS_DRAFT_STATE_SCHEMA_VERSION,
    version: 4,
  };
  assert.equal(validateFloorPlansDraftForResume(base).ok, true);
  assert.equal(
    validateFloorPlansDraftForResume({ ...base, serviceType: "virtual-staging" }).ok,
    false,
  );
  assert.equal(validateFloorPlansDraftForResume({ ...base, subService: "other" }).ok, false);
  assert.equal(
    validateFloorPlansDraftForResume({
      ...base,
      route: "/dashboard/orders/new/virtual-renovation",
    }).ok,
    false,
  );
  assert.equal(
    validateFloorPlansDraftForResume({ ...base, stateSchemaVersion: 99 }).ok,
    false,
  );
});

test("optimistic versions, stale async guards, and Start New preserve identity", () => {
  const update = buildFloorPlansUpdateDraftInput(source(), 7);
  assert.equal(update.expectedVersion, 7);
  assert.equal(update.state?.items[1]?.clientItemId, ITEM_B);
  assert.equal(shouldApplyFloorPlansAsyncResult(3, 3), true);
  assert.equal(shouldApplyFloorPlansAsyncResult(3, 4), false);
  assert.equal(shouldApplyFloorPlansAsyncResult(3, 3, 2, 2), true);
  assert.equal(shouldApplyFloorPlansAsyncResult(3, 3, 2, 3), false);
  assert.deepEqual(
    resetFloorPlansDraftIdentity(`draft=${DRAFT_ID}&from=dashboard`),
    {
      nextSearch: "from=dashboard",
      draftId: null,
      draftVersion: null,
      saveStatus: "not_saved",
    },
  );
});

test("pricing preview matches the catalog but remains explicitly non-authoritative", () => {
  const input = source();
  const create = buildFloorPlansCreateDraftInput(input);
  const direct = calculateOrderQuote({
    serviceType: "3d-floor-plans",
    currency: input.currency,
    items: input.items.map((item) => ({
      planType: item.planType,
      numberOfFloors: item.numberOfFloors,
    })),
  });
  assert.equal(create.pricingPreview?.nonAuthoritative, true);
  assert.equal(create.pricingPreview?.preview.totalCents, direct.totalCents);
  assert.equal(create.pricingPreview?.preview.currency, direct.currency);
  assert.equal("pricingPreview" in create.state, false);
});

test("pricing, saved draft, and final production quantities cannot diverge", () => {
  for (const numberOfFloors of [FLOOR_PLAN_MIN_FLOORS, FLOOR_PLAN_MAX_FLOORS]) {
    const input = source();
    input.items = [{ ...input.items[0]!, numberOfFloors }];
    const create = buildFloorPlansCreateDraftInput(input);
    const priced = calculateOrderQuote({
      serviceType: "3d-floor-plans",
      currency: input.currency,
      items: input.items.map((item) => ({
        planType: item.planType,
        numberOfFloors: item.numberOfFloors,
      })),
    });
    const production = mapFloorPlansDraftStateToProductionItems(create.state);
    assert.equal(production.ok, true);
    if (!production.ok) continue;

    assert.deepEqual(
      {
        pricingQuantity: priced.items[0]?.quantity,
        savedDraftQuantity: create.state.items[0]?.state.numberOfFloors,
        productionQuantity: production.data[0]?.numberOfFloors,
      },
      {
        pricingQuantity: numberOfFloors,
        savedDraftQuantity: numberOfFloors,
        productionQuantity: numberOfFloors,
      },
    );
    assert.equal(create.pricingPreview?.preview.totalCents, priced.totalCents);
  }
});

test("FloorPlanItemSchema is the authoritative production validation gate", () => {
  const state = mapFloorPlansFormToDraftState(source());
  assert.equal(
    validateFloorPlansDraftForFinalization({
      serviceType: "3d-floor-plans",
      subService: null,
      route: FLOOR_PLANS_DRAFT_ROUTE,
      state,
      stateSchemaVersion: FLOOR_PLANS_DRAFT_STATE_SCHEMA_VERSION,
      currency: "USD",
      status: "converting",
    }).ok,
    true,
  );
  const mapped = mapFloorPlansDraftStateToProductionItems(state);
  assert.equal(mapped.ok, true);
  if (mapped.ok) {
    assert.equal(mapped.data[0]?.planType, "3d");
    assert.equal(mapped.data[0]?.numberOfFloors, 2);
    assert.equal(mapped.data[0]?.referenceLink, "https://example.com/reference");
  }

  for (const numberOfFloors of [0, 21, 1.5, Number.NaN]) {
    const invalidQuantityState = mapFloorPlansFormToDraftState(source());
    invalidQuantityState.items[0]!.state.numberOfFloors = numberOfFloors;
    assert.equal(
      FloorPlansDraftStateSchema.safeParse(invalidQuantityState).success,
      false,
    );
    assert.equal(
      mapFloorPlansDraftStateToProductionItems(invalidQuantityState).ok,
      false,
    );
  }

  state.items[0]!.state.planType = "tampered-price-label";
  assert.equal(mapFloorPlansDraftStateToProductionItems(state).ok, false);
});

test("finalization requires one original and allows one optional reference per stable item", () => {
  const state = mapFloorPlansFormToDraftState(source());
  const files = [
    uploadedFile({
      id: ORIGINAL_A,
      itemClientId: ITEM_A,
      filename: "ground-floor.dwg",
      kind: "original",
    }),
    uploadedFile({
      id: REFERENCE_A,
      itemClientId: ITEM_A,
      filename: "reference.webp",
      kind: "reference",
    }),
    uploadedFile({
      id: ORIGINAL_B,
      itemClientId: ITEM_B,
      filename: "upper-floor.pdf",
      kind: "original",
    }),
  ];
  const matched = validateAndMatchFloorPlansDraftFiles({
    verifiedUserId: USER_ID,
    draftId: DRAFT_ID,
    state,
    files,
  });
  assert.equal(matched.ok, true);
  if (!matched.ok) return;
  assert.equal(matched.data[0]?.original.id, ORIGINAL_A);
  assert.equal(matched.data[0]?.reference?.id, REFERENCE_A);
  assert.equal(matched.data[1]?.original.id, ORIGINAL_B);
  assert.equal(matched.data[1]?.reference, null);
  const descriptors = buildFloorPlansFinalizationItemFiles(matched.data);
  assert.equal(descriptors[0]?.original.mimeType, "application/octet-stream");
  assert.equal(descriptors[0]?.reference?.mimeType, "image/webp");
});

test("file matching rejects missing, duplicate, unknown, foreign-path, and non-live slots", () => {
  const state = mapFloorPlansFormToDraftState(source());
  const originals = [
    uploadedFile({
      id: ORIGINAL_A,
      itemClientId: ITEM_A,
      filename: "ground-floor.dwg",
      kind: "original",
    }),
    uploadedFile({
      id: ORIGINAL_B,
      itemClientId: ITEM_B,
      filename: "upper-floor.pdf",
      kind: "original",
    }),
  ];
  const validate = (files: OrderDraftFileRow[]) =>
    validateAndMatchFloorPlansDraftFiles({
      verifiedUserId: USER_ID,
      draftId: DRAFT_ID,
      state,
      files,
    }).ok;

  assert.equal(validate(originals.slice(0, 1)), false);
  assert.equal(
    validate([
      ...originals,
      uploadedFile({
        id: REFERENCE_A,
        itemClientId: ITEM_A,
        filename: "reference.webp",
        kind: "reference",
      }),
      uploadedFile({
        id: "88888888-8888-4888-8888-888888888888",
        itemClientId: ITEM_A,
        filename: "reference-2.png",
        kind: "reference",
      }),
    ]),
    false,
  );
  assert.equal(
    validate([
      ...originals,
      uploadedFile({
        id: "99999999-9999-4999-8999-999999999999",
        itemClientId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        filename: "unknown.png",
        kind: "reference",
      }),
    ]),
    false,
  );
  assert.equal(
    validate([
      originals[0]!,
      { ...originals[1]!, storagePath: "drafts/another-user/file.pdf" },
    ]),
    false,
  );
  assert.equal(
    validate([{ ...originals[0]!, uploadStatus: "pending" }, originals[1]!]),
    false,
  );
  assert.equal(
    validate([{ ...originals[0]!, deletedAt: "2026-08-26T11:00:00.000Z" }, originals[1]!]),
    false,
  );
});

test("CAD MIME types are normalized client-side without widening server policy", () => {
  for (const extension of ["dwg", "dxf", "fbx"]) {
    assert.equal(
      getFloorPlanDraftUploadContentType(
        { name: `plan.${extension}`, type: `application/${extension}` },
        "original",
      ),
      "application/octet-stream",
    );
  }
  assert.equal(
    getFloorPlanDraftUploadContentType(
      { name: "plan.pdf", type: "application/pdf" },
      "original",
    ),
    "application/pdf",
  );
  assert.equal(
    isDraftFileAllowedForDraft(
      { serviceType: "3d-floor-plans" },
      { kind: "original", contentType: "application/octet-stream" },
    ),
    true,
  );
  assert.equal(
    isDraftFileAllowedForDraft(
      { serviceType: "3d-floor-plans" },
      { kind: "reference", contentType: "application/pdf" },
    ),
    false,
  );
  assert.equal(
    isDraftFileAllowedForDraft(
      { serviceType: "3d-floor-plans" },
      { kind: "reference", contentType: "image/webp" },
    ),
    true,
  );

  const filesClient = readFileSync(new URL("./files-client.ts", import.meta.url), "utf8");
  assert.match(filesClient, /contentType: prepared\.file\.mimeType/);
  assert.doesNotMatch(filesClient, /contentType: file\.type/);
});

test("Floor Plans form uses the durable file lifecycle and atomic finalization APIs", () => {
  const form = readFileSync(
    new URL(
      "../../components/order/floor-plans/FloorPlansOrderForm.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const itemCard = readFileSync(
    new URL(
      "../../components/order/floor-plans/FloorPlanItemCard.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const model = readFileSync(new URL("./floor-plans.ts", import.meta.url), "utf8");
  assert.match(form, /window\.history\.replaceState/);
  assert.doesNotMatch(form, /router\.replace|useRouter|submitOrder\(/);
  assert.match(form, /prepareOrderDraftFileUpload/);
  assert.match(form, /getFloorPlanDraftUploadContentType\(file, kind\)/);
  assert.match(form, /uploadPreparedOrderDraftFile/);
  assert.match(form, /completeOrderDraftFileUpload/);
  assert.match(form, /deleteOrderDraftFile/);
  assert.match(form, /submitOrderDraft/);
  assert.match(form, /key=\{item\.clientItemId\}/);
  assert.match(form, /draftSessionRef\.current \+= 1/);
  assert.match(form, /submissionInFlightRef\.current/);
  assert.match(form, /finalizationRetryContextRef\.current/);
  assert.match(form, /isCanonicalFloorPlanType\(item\.planType\)/);
  assert.match(form, /isValidFloorPlanFloorCount\(item\.numberOfFloors\)/);
  assert.match(itemCard, /parseFloorPlanFloorCountInput/);
  assert.doesNotMatch(itemCard, /Math\.max\(1|parseInt\(e\.target\.value/);
  assert.match(model, /numberOfFloors: item\.numberOfFloors/);
  assert.doesNotMatch(model, /Math\.min\(20|planType: trim\(item\.planType/);
  assert.match(
    form,
    /operation\.pendingFileId[\s\S]+deleteOrderDraftFile\(previousDraftId, operation\.pendingFileId\)/,
  );
});

test("trusted dispatcher, recovery allowlist, and retry reconciliation include only canonical Floor Plans", () => {
  const finalizationServer = readFileSync(
    new URL("./finalization-server.ts", import.meta.url),
    "utf8",
  );
  const draftServer = readFileSync(new URL("./server.ts", import.meta.url), "utf8");
  const submitRoute = readFileSync(
    new URL(
      "../../app/(public)/api/order-drafts/[draftId]/submit/route.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(submitRoute, /submitOrderDraftForUser/);
  assert.doesNotMatch(submitRoute, /body\.serviceType|serviceType:\s*body/);
  assert.match(
    finalizationServer,
    /draft\.serviceType === "3d-floor-plans"[\s\S]+draft\.subService === null[\s\S]+draft\.route === FLOOR_PLANS_DRAFT_ROUTE[\s\S]+return "3d-floor-plans"/,
  );
  assert.match(finalizationServer, /validateFloorPlansDraftForFinalization/);
  assert.match(finalizationServer, /mapFloorPlansDraftStateToProductionItems/);
  assert.match(finalizationServer, /validateAndMatchFloorPlansDraftFiles/);
  assert.match(finalizationServer, /buildFloorPlansFinalizationItemFiles/);
  assert.match(finalizationServer, /sourceDraftId: input\.draftId/);
  assert.match(finalizationServer, /reconcileExistingDraftOrder/);
  assert.match(finalizationServer, /storageMode: "copy"/);
  assert.match(
    draftServer,
    /draft\.serviceType === "3d-floor-plans"[\s\S]+draft\.subService === null[\s\S]+draft\.route === FLOOR_PLANS_DRAFT_ROUTE/,
  );
  assert.match(draftServer, /status: "finalization_in_progress"/);
  assert.match(draftServer, /status: "reconciliation_required"/);
  assert.match(draftServer, /status: "already_converted"/);
});
