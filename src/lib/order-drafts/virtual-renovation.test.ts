import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateOrderQuote } from "../pricing/calculate.ts";
import {
  buildVirtualRenovationFinalizationItemFiles,
  mapVirtualRenovationDraftStateToProductionItems,
  validateAndMatchVirtualRenovationDraftFiles,
  validateVirtualRenovationDraftForFinalization,
} from "./finalization.ts";
import {
  VIRTUAL_RENOVATION_DRAFT_ROUTE,
  VIRTUAL_RENOVATION_DRAFT_STATE_SCHEMA_VERSION,
  VirtualRenovationDraftStateSchema,
  buildVirtualRenovationCreateDraftInput,
  buildVirtualRenovationDraftFingerprint,
  buildVirtualRenovationUpdateDraftInput,
  createVirtualRenovationFormItem,
  hasMeaningfulVirtualRenovationDraftChange,
  mapVirtualRenovationDraftToFormState,
  mapVirtualRenovationFormToDraftState,
  resetVirtualRenovationDraftIdentity,
  shouldApplyVirtualRenovationAsyncResult,
  validateVirtualRenovationDraftForResume,
  type VirtualRenovationFormDraftSource,
} from "./virtual-renovation.ts";
import type { OrderDraftFileRow } from "./types.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const DRAFT_ID = "22222222-2222-4222-8222-222222222222";
const ORIGINAL_A = "33333333-3333-4333-8333-333333333333";
const REFERENCE_A = "44444444-4444-4444-8444-444444444444";
const ORIGINAL_B = "55555555-5555-4555-8555-555555555555";
const ITEM_A = "66666666-6666-4666-8666-666666666666";
const ITEM_B = "77777777-7777-4777-8777-777777777777";

function source(): VirtualRenovationFormDraftSource {
  return {
    jobTitle: "  CODEX renovation test  ",
    items: [
      {
        clientItemId: ITEM_A,
        file: { name: "kitchen.jpg" },
        referenceFile: { name: "reference.png" },
        selectedInternal: ["replace-flooring", "kitchen-fit-out"],
        selectedExternal: [],
        room: "Kitchen",
        presentationStyle: "Modern",
        fileSizeLimit: "Under 10 MB",
        disclaimerText: "Standard disclaimer",
        referenceLink: "https://example.com/inspiration",
        additionalInfo: "Keep the existing windows",
        originalFilename: null,
        referenceFilename: null,
      },
      {
        clientItemId: ITEM_B,
        file: null,
        referenceFile: null,
        selectedInternal: [],
        selectedExternal: ["full-landscaping"],
        room: "Garden",
        presentationStyle: "Contemporary",
        fileSizeLimit: "",
        disclaimerText: "",
        referenceLink: "",
        additionalInfo: "Native plants",
        originalFilename: "garden.jpg",
        referenceFilename: null,
      },
    ],
    orderTerms: { accepted: true, allowPortfolio: false },
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
}): OrderDraftFileRow {
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
    mimeType: input.filename.endsWith(".png") ? "image/png" : "image/jpeg",
    contentHash: null,
    uploadStatus: "uploaded",
    createdAt: "2026-08-26T10:00:00.000Z",
    updatedAt: "2026-08-26T10:00:00.000Z",
    deletedAt: null,
    movedAt: null,
  };
}

test("meaningful Virtual Renovation edits create the canonical draft payload", () => {
  const input = source();
  assert.equal(hasMeaningfulVirtualRenovationDraftChange(input), true);
  const create = buildVirtualRenovationCreateDraftInput(input);
  assert.equal(create.serviceType, "virtual-renovation");
  assert.equal(create.subService, undefined);
  assert.equal(create.route, VIRTUAL_RENOVATION_DRAFT_ROUTE);
  assert.equal(
    create.state.schemaVersion,
    VIRTUAL_RENOVATION_DRAFT_STATE_SCHEMA_VERSION,
  );
  assert.equal(create.currency, "USD");
  assert.equal(create.region, "US");
});

test("empty Virtual Renovation form stays local until a meaningful edit", () => {
  assert.equal(
    hasMeaningfulVirtualRenovationDraftChange({
      jobTitle: "",
      items: [createVirtualRenovationFormItem()],
      orderTerms: { accepted: false, allowPortfolio: false },
      currency: "USD",
      region: "US",
    }),
    false,
  );
});

test("all Virtual Renovation fields, stable IDs, and filenames round-trip", () => {
  const state = mapVirtualRenovationFormToDraftState(source());
  const restored = mapVirtualRenovationDraftToFormState(state);
  assert.equal(restored.jobTitle, "CODEX renovation test");
  assert.equal(restored.items[0]?.clientItemId, ITEM_A);
  assert.deepEqual(restored.items[0]?.selectedInternal, [
    "replace-flooring",
    "kitchen-fit-out",
  ]);
  assert.equal(restored.items[0]?.room, "Kitchen");
  assert.equal(restored.items[0]?.presentationStyle, "Modern");
  assert.equal(restored.items[0]?.referenceLink, "https://example.com/inspiration");
  assert.equal(restored.items[0]?.originalFilename, "kitchen.jpg");
  assert.equal(restored.items[0]?.referenceFilename, "reference.png");
  assert.equal(restored.items.every((item) => item.file === null), true);
  assert.equal(restored.items.every((item) => item.referenceFile === null), true);
});

test("draft fingerprint serializes filenames but never browser File data", () => {
  const fingerprint = buildVirtualRenovationDraftFingerprint(source());
  assert.doesNotMatch(fingerprint, /blob:/);
  assert.doesNotMatch(fingerprint, /lastModified/);
  assert.match(fingerprint, /originalFilename/);
  assert.match(fingerprint, /referenceFilename/);
});

test("stable item identities are unique UUIDs and duplicates fail closed", () => {
  const ids = Array.from(
    { length: 50 },
    () => createVirtualRenovationFormItem().clientItemId,
  );
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[0-9a-f-]{36}$/);

  const state = mapVirtualRenovationFormToDraftState(source());
  state.items[1] = {
    ...state.items[1]!,
    clientItemId: state.items[0]!.clientItemId,
  };
  assert.equal(VirtualRenovationDraftStateSchema.safeParse(state).success, false);
});

test("resume rejects wrong service, sub-service, route, and schema", () => {
  const state = mapVirtualRenovationFormToDraftState(source());
  const base = {
    serviceType: "virtual-renovation" as const,
    subService: null,
    route: VIRTUAL_RENOVATION_DRAFT_ROUTE,
    state,
    stateSchemaVersion: VIRTUAL_RENOVATION_DRAFT_STATE_SCHEMA_VERSION,
    version: 4,
  };
  assert.equal(validateVirtualRenovationDraftForResume(base).ok, true);
  assert.equal(
    validateVirtualRenovationDraftForResume({
      ...base,
      serviceType: "virtual-staging",
    }).ok,
    false,
  );
  assert.equal(
    validateVirtualRenovationDraftForResume({ ...base, subService: "other" }).ok,
    false,
  );
  assert.equal(
    validateVirtualRenovationDraftForResume({
      ...base,
      route: "/dashboard/orders/new/virtual-staging",
    }).ok,
    false,
  );
  assert.equal(
    validateVirtualRenovationDraftForResume({ ...base, stateSchemaVersion: 99 })
      .ok,
    false,
  );
});

test("optimistic updates and stale async guards preserve draft identity", () => {
  const update = buildVirtualRenovationUpdateDraftInput(source(), 7);
  assert.equal(update.expectedVersion, 7);
  assert.equal(update.state?.items[1]?.clientItemId, ITEM_B);
  assert.equal(shouldApplyVirtualRenovationAsyncResult(3, 3), true);
  assert.equal(shouldApplyVirtualRenovationAsyncResult(3, 4), false);
  assert.equal(shouldApplyVirtualRenovationAsyncResult(3, 3, 2, 2), true);
  assert.equal(shouldApplyVirtualRenovationAsyncResult(3, 3, 2, 3), false);
});

test("Start New removes only the draft query value", () => {
  const reset = resetVirtualRenovationDraftIdentity(
    `draft=${DRAFT_ID}&from=dashboard`,
  );
  assert.deepEqual(reset, {
    nextSearch: "from=dashboard",
    draftId: null,
    draftVersion: null,
    saveStatus: "not_saved",
  });
});

test("pricing preview preserves existing Virtual Renovation semantics", () => {
  const input = source();
  const create = buildVirtualRenovationCreateDraftInput(input);
  const direct = calculateOrderQuote({
    serviceType: "virtual-renovation",
    currency: input.currency,
    items: input.items.map((item) => ({
      selectedInternal: item.selectedInternal,
      selectedExternal: item.selectedExternal,
    })),
  });
  assert.equal(create.pricingPreview?.preview.totalCents, direct.totalCents);
  assert.equal(create.pricingPreview?.preview.currency, direct.currency);
});

test("trusted finalization uses RenovationItemSchema as the authoritative mapper", () => {
  const state = mapVirtualRenovationFormToDraftState(source());
  assert.equal(
    validateVirtualRenovationDraftForFinalization({
      serviceType: "virtual-renovation",
      subService: null,
      route: VIRTUAL_RENOVATION_DRAFT_ROUTE,
      state,
      stateSchemaVersion: VIRTUAL_RENOVATION_DRAFT_STATE_SCHEMA_VERSION,
      currency: "USD",
      status: "converting",
    }).ok,
    true,
  );
  const mapped = mapVirtualRenovationDraftStateToProductionItems(state);
  assert.equal(mapped.ok, true);
  if (mapped.ok) {
    assert.deepEqual(mapped.data[0]?.selectedInternal, [
      "replace-flooring",
      "kitchen-fit-out",
    ]);
    assert.equal(mapped.data[0]?.referenceLink, "https://example.com/inspiration");
  }

  state.items[0]!.state.referenceLink = "javascript:alert(1)";
  assert.equal(mapVirtualRenovationDraftStateToProductionItems(state).ok, false);
});

test("finalization matches one original plus at most one optional reference per stable item", () => {
  const state = mapVirtualRenovationFormToDraftState(source());
  const originalA = uploadedFile({
    id: ORIGINAL_A,
    itemClientId: ITEM_A,
    filename: "kitchen.jpg",
    kind: "original",
  });
  const referenceA = uploadedFile({
    id: REFERENCE_A,
    itemClientId: ITEM_A,
    filename: "reference.png",
    kind: "reference",
  });
  const originalB = uploadedFile({
    id: ORIGINAL_B,
    itemClientId: ITEM_B,
    filename: "garden.jpg",
    kind: "original",
  });
  const matched = validateAndMatchVirtualRenovationDraftFiles({
    verifiedUserId: USER_ID,
    draftId: DRAFT_ID,
    state,
    files: [referenceA, originalB, originalA],
  });
  assert.equal(matched.ok, true);
  if (!matched.ok) return;
  assert.equal(matched.data[0]?.original.id, ORIGINAL_A);
  assert.equal(matched.data[0]?.reference?.id, REFERENCE_A);
  assert.equal(matched.data[1]?.original.id, ORIGINAL_B);
  assert.equal(matched.data[1]?.reference, null);
  const descriptors = buildVirtualRenovationFinalizationItemFiles(matched.data);
  assert.equal(descriptors[0]?.reference?.draftFileId, REFERENCE_A);
});

test("file reconciliation rejects missing, duplicate, orphan, and foreign-path slots", () => {
  const state = mapVirtualRenovationFormToDraftState(source());
  const originals = [
    uploadedFile({
      id: ORIGINAL_A,
      itemClientId: ITEM_A,
      filename: "kitchen.jpg",
      kind: "original",
    }),
    uploadedFile({
      id: ORIGINAL_B,
      itemClientId: ITEM_B,
      filename: "garden.jpg",
      kind: "original",
    }),
  ];
  const validate = (files: OrderDraftFileRow[]) =>
    validateAndMatchVirtualRenovationDraftFiles({
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
        filename: "reference.png",
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
        filename: "orphan.jpg",
        kind: "reference",
      }),
    ]),
    false,
  );
  assert.equal(
    validate([
      originals[0]!,
      { ...originals[1]!, storagePath: "drafts/another-user/file.jpg" },
    ]),
    false,
  );
});

test("removing the first item cannot reassign the second item's files", () => {
  const state = mapVirtualRenovationFormToDraftState(source());
  state.items = state.items.filter((item) => item.clientItemId === ITEM_B);
  const matched = validateAndMatchVirtualRenovationDraftFiles({
    verifiedUserId: USER_ID,
    draftId: DRAFT_ID,
    state,
    files: [
      uploadedFile({
        id: ORIGINAL_B,
        itemClientId: ITEM_B,
        filename: "garden.jpg",
        kind: "original",
      }),
    ],
  });
  assert.equal(matched.ok, true);
  if (matched.ok) {
    assert.equal(matched.data[0]?.clientItemId, ITEM_B);
    assert.equal(matched.data[0]?.itemIndex, 0);
  }
});

test("form uses durable APIs, two file slots, and navigation-free URL sync", () => {
  const form = readFileSync(
    new URL(
      "../../components/order/virtual-renovation/VirtualRenovationOrderForm.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const card = readFileSync(
    new URL(
      "../../components/order/virtual-renovation/RenovationItemCard.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const urlStart = form.indexOf("const replaceDraftUrl = useCallback(");
  const urlEnd = form.indexOf("const persistDraft = useCallback(", urlStart);
  assert.ok(urlStart >= 0 && urlEnd > urlStart);
  const urlSource = form.slice(urlStart, urlEnd);
  assert.match(urlSource, /window\.history\.replaceState\(\s*null,/);
  assert.doesNotMatch(form, /replaceState\(\s*window\.history\.state/);
  assert.doesNotMatch(form, /router\.replace|router\.refresh|useRouter/);
  assert.doesNotMatch(form, /submitOrder\(|\/api\/order["'`]/);
  assert.match(form, /const searchParams = useSearchParams\(\)/);
  assert.match(form, /requestedDraftId = searchParams\.get\("draft"\)/);
  assert.match(form, /setDraftQueryParam\(result\.data\.id\)/);
  assert.match(form, /prepareOrderDraftFileUpload/);
  assert.match(form, /uploadPreparedOrderDraftFile/);
  assert.match(form, /completeOrderDraftFileUpload/);
  assert.match(form, /kind: "original" \| "reference"/);
  assert.match(form, /fileSlotKey\(item\.clientItemId, "original"\)/);
  assert.match(form, /fileSlotKey\(item\.clientItemId, "reference"\)/);
  assert.match(form, /key=\{item\.clientItemId\}/);
  assert.match(form, /draftSessionRef\.current \+= 1/);
  assert.doesNotMatch(form, /scrollIntoView|scrollTo\(/);
  assert.match(card, /persistedOriginal/);
  assert.match(card, /persistedReference/);
});

test("trusted server dispatch derives Virtual Renovation only from loaded draft", () => {
  const server = readFileSync(new URL("./finalization-server.ts", import.meta.url), "utf8");
  const enabledStart = server.indexOf("function getEnabledDraftFinalizationService(");
  const enabledEnd = server.indexOf("function buildTrustedDraftFinalizationContext(");
  const enabled = server.slice(enabledStart, enabledEnd);
  assert.match(enabled, /draft\.serviceType === "virtual-renovation"/);
  assert.match(enabled, /draft\.subService === null/);
  assert.match(enabled, /draft\.route === VIRTUAL_RENOVATION_DRAFT_ROUTE/);
  assert.match(server, /loadClaimedDraft\(input\.userId, input\.draftId\)/);
  assert.match(server, /validateVirtualRenovationDraftForFinalization/);
  assert.match(server, /mapVirtualRenovationDraftStateToProductionItems/);
  assert.match(server, /validateAndMatchVirtualRenovationDraftFiles/);
  assert.match(server, /buildVirtualRenovationFinalizationItemFiles/);
  assert.match(server, /storageMode: "copy"/);
  assert.doesNotMatch(server, /input\.serviceType|body\.serviceType/);
});
