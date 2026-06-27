import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVirtualStagingDraftFingerprint,
  buildVirtualStagingCreateDraftInput,
  buildVirtualStagingPricingPreview,
  buildVirtualStagingUpdateDraftInput,
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
  shouldSkipDuplicateVirtualStagingSave,
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

test("form mapping creates versioned JSON-safe Virtual Staging draft state", () => {
  const state = mapVirtualStagingFormToDraftState(source());
  assert.equal(state.schemaVersion, VIRTUAL_STAGING_DRAFT_STATE_SCHEMA_VERSION);
  assert.equal(state.currentStep, VIRTUAL_STAGING_DRAFT_CURRENT_STEP);
  assert.equal(state.jobTitle, "Sunny Condo");
  assert.equal(state.items[0]?.clientItemId, ITEM_ID);
  assert.equal(state.items[0]?.state.originalFilename, "living.jpg");
  assert.equal(state.items[0]?.state.referenceFilename, "reference.png");
  assert.equal("file" in state.items[0]!.state, false);
  assert.equal("referenceFile" in state.items[0]!.state, false);
});

test("draft mapping restores safe fields and requires file re-selection", () => {
  const form = mapVirtualStagingDraftToFormState(
    mapVirtualStagingFormToDraftState(source()),
  );
  assert.equal(form.jobTitle, "Sunny Condo");
  assert.equal(form.orderTerms.accepted, true);
  assert.equal(form.items[0]?.file, null);
  assert.equal(form.items[0]?.referenceFile, null);
  assert.equal(form.items[0]?.originalFilename, "living.jpg");
  assert.equal(form.items[0]?.needsOriginalFileReselection, true);
  assert.equal(form.items[0]?.furnitureStyle, "Modern");
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
  assert.equal(
    validateVirtualStagingDraftForResume({
      ...draftRow(),
      serviceType: "photo-editing",
    }).code,
    "wrong_service",
  );
  assert.equal(
    validateVirtualStagingDraftForResume({
      ...draftRow(),
      stateSchemaVersion: 99,
    }).code,
    "unsupported_schema",
  );
  assert.equal(
    validateVirtualStagingDraftForResume({
      ...draftRow(),
      route: "/dashboard/orders/new/photo-editing",
    }).code,
    "wrong_route",
  );
});

test("valid resume returns current optimistic version", () => {
  const result = validateVirtualStagingDraftForResume(draftRow());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.version, 4);
  assert.equal(result.form.items[0]?.needsOriginalFileReselection, true);
});

test("meaningful-change detection avoids empty abandoned drafts", () => {
  assert.equal(
    hasMeaningfulVirtualStagingDraftChange({
      jobTitle: "",
      currency: "USD",
      orderTerms: { accepted: false, allowPortfolio: false },
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
    } as OrderDraftRow),
    "EU",
  );
  assert.equal(
    resolveVirtualStagingDraftRegion({
      ...draftRow(),
      currency: "EUR",
      region: "US",
    } as OrderDraftRow),
    "EU",
  );
  assert.equal(
    resolveVirtualStagingDraftRegion({
      ...draftRow(),
      currency: "CAD",
      region: null,
    } as OrderDraftRow),
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

test("resumed-file warning disappears after replacement selection", () => {
  assert.equal(
    shouldShowVirtualStagingResumedFileWarning([
      { needsOriginalFileReselection: true, file: null },
    ]),
    true,
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

test("final submission readiness is false while resumed files are missing", () => {
  const resumed = mapVirtualStagingDraftToFormState(
    mapVirtualStagingFormToDraftState(source()),
  );
  assert.equal(isVirtualStagingFinalSubmissionReady(resumed.items), false);
  assert.equal(
    isVirtualStagingFinalSubmissionReady([{ file: new File(["x"], "living.jpg") }]),
    true,
  );
});
