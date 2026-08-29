import assert from "node:assert/strict";
import test from "node:test";
import {
  SINGLE_EXPOSURE_DRAFT_ROUTE,
  buildSingleExposureCreateDraftInput,
  buildSingleExposureDraftFingerprint,
  isSingleExposureItemConfigurationValid,
  mapSingleExposureDraftToFormState,
  mapSingleExposureFormToDraftState,
  validateSingleExposureDraftForResume,
  type SingleExposureFormDraftSource,
} from "./single-exposure.ts";

const itemId = "123e4567-e89b-42d3-a456-426614174000";

function source(): SingleExposureFormDraftSource {
  return {
    jobTitle: "Ocean View",
    step: "review",
    currency: "CAD",
    region: "CA",
    orderTerms: {
      accepted: true,
      earlyPerformanceRequested: true,
      allowPortfolio: true,
    },
    items: [
      {
        clientItemId: itemId,
        file: { name: "source.jpg" },
        referenceFile: { name: "marked.png" },
        fileSizeLimit: "MLS",
        disclaimerText: "Dimensions are approximate.",
        additionalInfo: "Keep the window view.",
        grassRepair: "yes",
        skyReplacement: "yes",
        tvScreenReplacement: "no",
        addFireToFireplace: "expert-decide",
        daySkyStyle: "deep-blue",
        selectedAddons: ["shadow-removal", "colour-change-pe"],
        aerialEditing: "single-lot-highlight",
        aerialEditingInstructions: "Outline the supplied boundary.",
      },
    ],
  };
}

test("draft serialization preserves sky memory, add-ons, aerial state and files", () => {
  const state = mapSingleExposureFormToDraftState(source());
  assert.equal(state.currentStep, "review");
  assert.equal(state.items[0]?.state.daySkyStyle, "deep-blue");
  assert.deepEqual(state.items[0]?.state.selectedAddons, [
    "shadow-removal",
    "colour-change-pe",
  ]);
  assert.equal(state.items[0]?.state.aerialEditing, "single-lot-highlight");
  assert.equal(state.items[0]?.state.originalFilename, "source.jpg");
  assert.equal(state.items[0]?.state.referenceFilename, "marked.png");

  const restored = mapSingleExposureDraftToFormState(state);
  assert.equal(restored.step, "review");
  assert.equal(restored.items[0]?.file, null);
  assert.equal(restored.items[0]?.referenceFile, null);
  assert.equal(restored.items[0]?.daySkyStyle, "deep-blue");
  assert.equal(restored.items[0]?.referenceFilename, "marked.png");
});

test("older version-one drafts restore new fields with backward-compatible defaults", () => {
  const current = mapSingleExposureFormToDraftState(source());
  const older = structuredClone(current) as Record<string, unknown>;
  const items = older.items as Array<{ state: Record<string, unknown> }>;
  delete items[0]?.state.selectedAddons;
  delete items[0]?.state.aerialEditing;
  delete items[0]?.state.aerialEditingInstructions;
  delete items[0]?.state.referenceFilename;

  const restored = mapSingleExposureDraftToFormState(older);
  assert.deepEqual(restored.items[0]?.selectedAddons, []);
  assert.equal(restored.items[0]?.aerialEditing, "none");
  assert.equal(restored.items[0]?.aerialEditingInstructions, "");
  assert.equal(restored.items[0]?.referenceFilename, null);
});

test("draft fingerprint changes with active Single Exposure configuration", () => {
  const first = source();
  const second = source();
  second.items[0]!.aerialEditing = "full-markup";
  assert.notEqual(
    buildSingleExposureDraftFingerprint(first),
    buildSingleExposureDraftFingerprint(second),
  );
});

test("draft create input uses existing photo-editing service and no schema change", () => {
  const input = buildSingleExposureCreateDraftInput(source());
  assert.equal(input.serviceType, "photo-editing");
  assert.equal(input.subService, "image-enhancement-single-exposure");
  assert.equal(input.route, SINGLE_EXPOSURE_DRAFT_ROUTE);
  assert.equal(input.pricingPreview?.nonAuthoritative, true);
});

test("resume rejects unrelated drafts and accepts current Single Exposure drafts", () => {
  const state = mapSingleExposureFormToDraftState(source());
  const valid = validateSingleExposureDraftForResume({
    serviceType: "photo-editing",
    subService: "image-enhancement-single-exposure",
    route: SINGLE_EXPOSURE_DRAFT_ROUTE,
    state,
    stateSchemaVersion: 1,
    version: 4,
  });
  assert.equal(valid.ok, true);
  const invalid = validateSingleExposureDraftForResume({
    serviceType: "virtual-staging",
    subService: null,
    route: "/dashboard/orders/new/virtual-staging",
    state,
    stateSchemaVersion: 1,
    version: 4,
  });
  assert.equal(invalid.ok, false);
});

test("configuration validation is conditional for sky and aerial details", () => {
  assert.equal(
    isSingleExposureItemConfigurationValid({
      hasOriginal: true,
      hasReference: false,
      skyReplacement: "no",
      daySkyStyle: undefined,
      aerialEditing: "none",
      aerialEditingInstructions: "",
    }),
    true,
  );
  assert.equal(
    isSingleExposureItemConfigurationValid({
      hasOriginal: true,
      hasReference: false,
      skyReplacement: "yes",
      daySkyStyle: "expert-decide",
      aerialEditing: "drop-pin",
      aerialEditingInstructions: "",
    }),
    false,
  );
  assert.equal(
    isSingleExposureItemConfigurationValid({
      hasOriginal: true,
      hasReference: true,
      skyReplacement: "yes",
      daySkyStyle: "expert-decide",
      aerialEditing: "drop-pin",
      aerialEditingInstructions: "",
    }),
    true,
  );
});
