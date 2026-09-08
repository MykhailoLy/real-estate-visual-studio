import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVirtualStagingDraftFingerprint,
  buildVirtualStagingCreateDraftInput,
  buildVirtualStagingPricingPreview,
  buildVirtualStagingUpdateDraftInput,
  findMissingVirtualStagingRequiredFields,
  hasMeaningfulVirtualStagingDraftChange,
  isVirtualStagingFinalSubmissionReady,
  mapVirtualStagingDraftToFormState,
  mapVirtualStagingFormToDraftState,
  markVirtualStagingSaveConflict,
  markVirtualStagingSaveSuccess,
  resetVirtualStagingDraftIdentity,
  resolveVirtualStagingDraftRegion,
  selectVirtualStagingSaveMethod,
  shouldApplyVirtualStagingSaveResult,
  shouldShowVirtualStagingResumedFileWarning,
  shouldShowVirtualStagingSavedImagesNotice,
  shouldSkipDuplicateVirtualStagingSave,
  shouldSkipFailedVirtualStagingAutosave,
  updateOriginalFileDraftMetadata,
  updateReferenceFileDraftMetadata,
  validateVirtualStagingDraftForResume,
  VIRTUAL_STAGING_DRAFT_CURRENT_STEP,
  VIRTUAL_STAGING_DRAFT_ROUTE,
  VIRTUAL_STAGING_DRAFT_STATE_SCHEMA_VERSION,
} from "./virtual-staging.ts";
import type { OrderDraftRow } from "./types.ts";

const ITEM_ID = "11111111-1111-4111-8111-111111111111";

function fileLike(name: string) {
  return { name };
}

function source() {
  return {
    jobTitle: "  Sunny Condo  ",
    currency: "USD" as const,
    region: "US" as const,
    orderTerms: {
      accepted: true,
      earlyPerformanceRequested: true,
      allowPortfolio: true,
    },
    items: [
      {
        clientItemId: ITEM_ID,
        file: fileLike("living.jpg"),
        roomName: "Living Room",
        furnitureStyle: "Modern",
        fileSizeLimit: "MLS",
        disclaimerText: "Use MLS size",
        referenceLink: "https://example.com/style",
        referenceFile: fileLike("reference.png"),
        additionalInfo: "Keep the view visible",
        selectedAddons: ["turn-on-lights"],
        originalFilename: null,
        referenceFilename: null,
      },
    ],
  };
}

function draftRow(state = mapVirtualStagingFormToDraftState(source())) {
  return {
    serviceType: "virtual-staging",
    route: VIRTUAL_STAGING_DRAFT_ROUTE,
    state,
    stateSchemaVersion: VIRTUAL_STAGING_DRAFT_STATE_SCHEMA_VERSION,
    version: 4,
  } satisfies Pick<
    OrderDraftRow,
    "serviceType" | "route" | "state" | "stateSchemaVersion" | "version"
  >;
}

test("required-field validation reports every missing Virtual Staging value", () => {
  assert.deepEqual(
    findMissingVirtualStagingRequiredFields({
      jobTitleValid: false,
      termsAccepted: false,
      items: [
        {
          clientItemId: ITEM_ID,
          hasOriginal: false,
          roomName: "",
          furnitureStyle: "",
        },
      ],
    }),
    [
      { kind: "job-title", itemIndex: null, clientItemId: null },
      { kind: "original", itemIndex: 0, clientItemId: ITEM_ID },
      { kind: "room", itemIndex: 0, clientItemId: ITEM_ID },
      { kind: "furniture-style", itemIndex: 0, clientItemId: ITEM_ID },
      { kind: "terms", itemIndex: null, clientItemId: null },
    ],
  );
});

test("required-field validation clears values as soon as they become valid", () => {
  assert.deepEqual(
    findMissingVirtualStagingRequiredFields({
      jobTitleValid: true,
      termsAccepted: true,
      items: [
        {
          clientItemId: ITEM_ID,
          hasOriginal: true,
          roomName: "Living Room",
          furnitureStyle: "Modern",
        },
      ],
    }),
    [],
  );
});

test("form mapping creates versioned JSON-safe Virtual Staging draft state", () => {
  const state = mapVirtualStagingFormToDraftState(source());
  assert.equal(state.schemaVersion, VIRTUAL_STAGING_DRAFT_STATE_SCHEMA_VERSION);
  assert.equal(state.currentStep, VIRTUAL_STAGING_DRAFT_CURRENT_STEP);
  assert.equal(state.defaultFurnitureStyle, "Modern");
  assert.equal(state.jobTitle, "Sunny Condo");
  assert.equal(state.items[0]?.clientItemId, ITEM_ID);
  assert.equal(state.items[0]?.state.originalFilename, "living.jpg");
  assert.equal(state.items[0]?.state.referenceFilename, "reference.png");
  assert.equal("file" in state.items[0]!.state, false);
  assert.equal("referenceFile" in state.items[0]!.state, false);
});

test("draft mapping restores safe fields without file re-selection", () => {
  const form = mapVirtualStagingDraftToFormState(
    mapVirtualStagingFormToDraftState(source()),
  );
  assert.equal(form.jobTitle, "Sunny Condo");
  assert.equal(form.defaultFurnitureStyle, "Modern");
  assert.equal(form.orderTerms.accepted, true);
  assert.equal(form.orderTerms.earlyPerformanceRequested, true);
  assert.equal(form.items[0]?.file, null);
  assert.equal(form.items[0]?.referenceFile, null);
  assert.equal(form.items[0]?.originalFilename, "living.jpg");
  assert.equal(form.items[0]?.needsOriginalFileReselection, false);
  assert.equal(form.items[0]?.furnitureStyle, "Modern");
});

test("legacy Virtual Staging drafts restore a missing early-performance request as false", () => {
  const legacy = mapVirtualStagingFormToDraftState(source()) as unknown as {
    termsUi: Record<string, unknown>;
  };
  delete legacy.termsUi.earlyPerformanceRequested;

  const restored = mapVirtualStagingDraftToFormState(legacy);
  assert.equal(restored.orderTerms.earlyPerformanceRequested, false);
});

test("global default and individual styles survive draft serialization", () => {
  const initial = source();
  const state = mapVirtualStagingFormToDraftState({
    ...initial,
    defaultFurnitureStyle: "Modern",
    items: [
      { ...initial.items[0]!, furnitureStyle: "Farmhouse" },
      {
        ...initial.items[0]!,
        clientItemId: "22222222-2222-4222-8222-222222222222",
        furnitureStyle: "Modern",
      },
    ],
  });
  const restored = mapVirtualStagingDraftToFormState(state);

  assert.equal(restored.defaultFurnitureStyle, "Modern");
  assert.deepEqual(
    restored.items.map((item) => item.furnitureStyle),
    ["Farmhouse", "Modern"],
  );
});

test("older drafts without a global style derive it from the first valid item", () => {
  const current = mapVirtualStagingFormToDraftState(source());
  const legacy = { ...current } as Record<string, unknown>;
  delete legacy.defaultFurnitureStyle;
  const restored = mapVirtualStagingDraftToFormState(legacy);

  assert.equal(restored.defaultFurnitureStyle, "Modern");
  assert.equal(restored.items[0]?.furnitureStyle, "Modern");
});

test("stable item IDs and original filename metadata are preserved", () => {
  const initial = source();
  const first = mapVirtualStagingFormToDraftState(initial);
  const second = mapVirtualStagingFormToDraftState({
    ...initial,
    items: [{ ...initial.items[0]!, roomName: "Bedroom" }],
  });
  assert.equal(first.items[0]?.clientItemId, second.items[0]?.clientItemId);
  assert.equal(second.items[0]?.state.originalFilename, "living.jpg");
});

test("unsupported schema and wrong service are rejected on resume", () => {
  const wrongService = validateVirtualStagingDraftForResume({
    ...draftRow(),
    serviceType: "photo-editing",
  });
  assert.equal(wrongService.ok, false);
  assert.equal(wrongService.code, "wrong_service");

  const unsupportedSchema = validateVirtualStagingDraftForResume({
    ...draftRow(),
    stateSchemaVersion: 99,
  });
  assert.equal(unsupportedSchema.ok, false);
  assert.equal(unsupportedSchema.code, "unsupported_schema");

  const wrongRoute = validateVirtualStagingDraftForResume({
    ...draftRow(),
    route: "/dashboard/orders/new/photo-editing",
  });
  assert.equal(wrongRoute.ok, false);
  assert.equal(wrongRoute.code, "wrong_route");
});

test("valid resume returns current optimistic version", () => {
  const result = validateVirtualStagingDraftForResume(draftRow());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.version, 4);
  assert.equal(result.form.items[0]?.needsOriginalFileReselection, false);
});

test("meaningful-change detection avoids empty abandoned drafts", () => {
  assert.equal(
    hasMeaningfulVirtualStagingDraftChange({
      jobTitle: "",
      currency: "USD",
      orderTerms: {
        accepted: false,
        earlyPerformanceRequested: false,
        allowPortfolio: false,
      },
      items: [
        {
          clientItemId: ITEM_ID,
          file: null,
          roomName: "",
          furnitureStyle: "",
          fileSizeLimit: "",
          disclaimerText: "",
          referenceLink: "",
          referenceFile: null,
          additionalInfo: "",
          selectedAddons: [],
          originalFilename: null,
          referenceFilename: null,
        },
      ],
    }),
    false,
  );
  assert.equal(hasMeaningfulVirtualStagingDraftChange(source()), true);
});

test("stable serialization prevents duplicate saves", () => {
  const fingerprint = buildVirtualStagingDraftFingerprint(source());
  assert.equal(
    shouldSkipDuplicateVirtualStagingSave(fingerprint, fingerprint),
    true,
  );
  assert.equal(shouldSkipDuplicateVirtualStagingSave(null, fingerprint), false);
});

test("failed autosave fingerprint skips unchanged automatic retries", () => {
  const fingerprint = buildVirtualStagingDraftFingerprint(source());
  assert.equal(
    shouldSkipFailedVirtualStagingAutosave(fingerprint, fingerprint, false),
    true,
  );
});

test("failed autosave fingerprint allows changed or forced saves", () => {
  const fingerprint = buildVirtualStagingDraftFingerprint(source());
  const changedFingerprint = buildVirtualStagingDraftFingerprint({
    ...source(),
    jobTitle: "Changed title",
  });

  assert.equal(
    shouldSkipFailedVirtualStagingAutosave(
      fingerprint,
      changedFingerprint,
      false,
    ),
    false,
  );
  assert.equal(
    shouldSkipFailedVirtualStagingAutosave(fingerprint, fingerprint, true),
    false,
  );
});

test("fingerprint includes currency and region but ignores object insertion order", () => {
  const base = source();
  const sameDifferentOrder = {
    ...base,
    items: [
      {
        selectedAddons: ["turn-on-lights"],
        additionalInfo: "Keep the view visible",
        referenceFile: fileLike("reference.png"),
        referenceLink: "https://example.com/style",
        disclaimerText: "Use MLS size",
        fileSizeLimit: "MLS",
        furnitureStyle: "Modern",
        roomName: "Living Room",
        file: fileLike("living.jpg"),
        clientItemId: ITEM_ID,
        originalFilename: null,
        referenceFilename: null,
      },
    ],
  };

  assert.equal(
    buildVirtualStagingDraftFingerprint(base),
    buildVirtualStagingDraftFingerprint(sameDifferentOrder),
  );
  assert.notEqual(
    buildVirtualStagingDraftFingerprint(base),
    buildVirtualStagingDraftFingerprint({ ...base, currency: "EUR" }),
  );
  assert.notEqual(
    buildVirtualStagingDraftFingerprint(base),
    buildVirtualStagingDraftFingerprint({ ...base, region: "CA" }),
  );
});

test("save method selects first POST versus later PATCH", () => {
  assert.equal(selectVirtualStagingSaveMethod(null), "create");
  assert.equal(selectVirtualStagingSaveMethod("draft-id"), "patch");
});

test("optimistic save success and conflict states are explicit", () => {
  assert.deepEqual(markVirtualStagingSaveSuccess(1, 2), {
    version: 2,
    status: "saved",
  });
  assert.deepEqual(markVirtualStagingSaveConflict(), {
    status: "conflict",
    canRetryAutomatically: false,
  });
});

test("new-order reset clears draft identity and preserves unrelated query params", () => {
  const reset = resetVirtualStagingDraftIdentity("draft=abc&campaign=spring&tab=form");
  assert.equal(reset.identity.draftId, null);
  assert.equal(reset.identity.draftVersion, null);
  assert.equal(reset.identity.savedFingerprint, null);
  assert.equal(reset.identity.failedAutosaveFingerprint, null);
  assert.equal(reset.identity.saveStatus, "not_saved");
  assert.equal(reset.identity.conflictMessage, "");
  assert.equal(reset.identity.resumeState, "ready");
  assert.equal(reset.nextSearch, "campaign=spring&tab=form");
});

test("stale save results cannot restore an old draft session", () => {
  assert.equal(shouldApplyVirtualStagingSaveResult(1, 1), true);
  assert.equal(shouldApplyVirtualStagingSaveResult(1, 2), false);
});

test("queued save token captured before execution rejects stale work", async () => {
  let currentSession = 7;
  const sessionAtEnqueue = currentSession;
  let staleWorkAppliedToNewSession = false;

  currentSession += 1;

  const queuedSave = async (): Promise<boolean> => {
    if (
      !shouldApplyVirtualStagingSaveResult(
        sessionAtEnqueue,
        currentSession,
      )
    ) {
      return false;
    }

    staleWorkAppliedToNewSession = true;
    return true;
  };

  assert.equal(await queuedSave(), false);
  assert.equal(staleWorkAppliedToNewSession, false);
  assert.equal(
    shouldApplyVirtualStagingSaveResult(currentSession, currentSession),
    true,
  );
  assert.equal(
    shouldApplyVirtualStagingSaveResult(sessionAtEnqueue, currentSession),
    false,
  );
});

test("resume resolves region from consistent region/currency and normalizes mismatches", () => {
  assert.equal(
    resolveVirtualStagingDraftRegion({
      ...draftRow(),
      currency: "EUR",
      region: "EU",
    }),
    "EU",
  );
  assert.equal(
    resolveVirtualStagingDraftRegion({
      ...draftRow(),
      currency: "EUR",
      region: "US",
    }),
    "EU",
  );
  assert.equal(
    resolveVirtualStagingDraftRegion({
      ...draftRow(),
      currency: "CAD",
      region: null,
    }),
    "CA",
  );
});

test("file metadata removal clears stale filenames", () => {
  const item = {
    originalFilename: "old.jpg",
    referenceFilename: "old-ref.png",
    needsOriginalFileReselection: true,
  };
  assert.deepEqual(updateOriginalFileDraftMetadata(item, null), {
    originalFilename: null,
    needsOriginalFileReselection: false,
  });
  assert.deepEqual(updateOriginalFileDraftMetadata(item, fileLike("new.jpg")), {
    originalFilename: "new.jpg",
    needsOriginalFileReselection: false,
  });
  assert.deepEqual(updateReferenceFileDraftMetadata(item, null), {
    referenceFilename: null,
  });
  assert.deepEqual(updateReferenceFileDraftMetadata(item, fileLike("ref.jpg")), {
    referenceFilename: "ref.jpg",
  });
});

test("legacy resumed-file warning stays hidden and saved-images notice is summary-driven", () => {
  assert.equal(
    shouldShowVirtualStagingResumedFileWarning([
      { needsOriginalFileReselection: true, file: null },
    ]),
    false,
  );
  assert.equal(
    shouldShowVirtualStagingResumedFileWarning([
      { needsOriginalFileReselection: false, file: fileLike("living.jpg") },
    ]),
    false,
  );
  assert.equal(
    shouldShowVirtualStagingResumedFileWarning([
      { needsOriginalFileReselection: false, file: null },
    ]),
    false,
  );
  assert.equal(shouldShowVirtualStagingSavedImagesNotice(0), false);
  assert.equal(shouldShowVirtualStagingSavedImagesNotice(1), true);
});

test("save inputs use draft API shape and non-authoritative pricing preview", () => {
  const createInput = buildVirtualStagingCreateDraftInput(source());
  const updateInput = buildVirtualStagingUpdateDraftInput(source(), 3);
  assert.equal(createInput.serviceType, "virtual-staging");
  assert.equal(createInput.route, VIRTUAL_STAGING_DRAFT_ROUTE);
  assert.equal(createInput.pricingPreview?.nonAuthoritative, true);
  assert.equal(updateInput.expectedVersion, 3);
  assert.equal(updateInput.pricingPreview?.nonAuthoritative, true);
  assert.equal(buildVirtualStagingPricingPreview(source())?.nonAuthoritative, true);
});

test("file-selection save snapshot contains the selected filename", () => {
  const before = {
    ...source(),
    items: [
      {
        ...source().items[0]!,
        file: null,
        originalFilename: null,
      },
    ],
  };
  const after = {
    ...before,
    items: [
      {
        ...before.items[0]!,
        file: fileLike("selected-after-render.jpg"),
        originalFilename: "selected-after-render.jpg",
      },
    ],
  };

  const staleState = mapVirtualStagingFormToDraftState(before);
  const savedSnapshotState = mapVirtualStagingFormToDraftState(after);

  assert.equal(staleState.items[0]?.state.originalFilename, null);
  assert.equal(
    savedSnapshotState.items[0]?.state.originalFilename,
    "selected-after-render.jpg",
  );
});

test("final submission readiness accepts uploaded draft originals", () => {
  const resumed = mapVirtualStagingDraftToFormState(
    mapVirtualStagingFormToDraftState(source()),
  );
  assert.equal(isVirtualStagingFinalSubmissionReady(resumed.items), false);
  assert.equal(
    isVirtualStagingFinalSubmissionReady([
      { ...resumed.items[0]!, uploadedOriginal: { id: "draft-file" } },
    ]),
    true,
  );
  assert.equal(
    isVirtualStagingFinalSubmissionReady([{ file: new File(["x"], "living.jpg") }]),
    true,
  );
});
