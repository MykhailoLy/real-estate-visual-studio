import assert from "node:assert/strict";
import test from "node:test";
import {
  DAY_TO_DUSK_DRAFT_ROUTE,
  DAY_TO_DUSK_DRAFT_STATE_SCHEMA_VERSION,
  buildDayToDuskCreateDraftInput,
  buildDayToDuskDraftFingerprint,
  buildDayToDuskUpdateDraftInput,
  mapDayToDuskDraftToFormState,
  mapDayToDuskFormToDraftState,
  validateDayToDuskDraftForResume,
  type DayToDuskFormDraftSource,
} from "./day-to-dusk.ts";
import type { OrderDraftRow } from "./types.ts";

const ITEM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function source(): DayToDuskFormDraftSource {
  return {
    jobTitle: "Ocean view dusk",
    step: "review",
    shareEnabled: true,
    currency: "EUR",
    region: "EU",
    orderTerms: { accepted: true, allowPortfolio: false },
    items: [
      {
        clientItemId: ITEM_ID,
        file: { name: "daylight.jpg" },
        originalFilename: null,
        referenceLink: "https://example.com/dusk",
        referenceFiles: [
          {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            file: null,
            filename: "desired-sky.webp",
            fileSize: 2048,
            mimeType: "image/webp",
            lastModified: 10,
          },
          {
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            file: null,
            filename: "lighting-notes.pdf",
            fileSize: 4096,
            mimeType: "application/pdf",
            lastModified: 11,
          },
        ],
        fileSizeLimit: "10 MB",
        disclaimerText: "Keep the address private",
        additionalInfo: "Use the PDF for exterior light positions",
        duskStyle: "warm-sun-glow",
        turnOnInteriorLights: true,
        turnOnExteriorLights: false,
        addPoolLights: true,
      },
    ],
  };
}

test("Day to Dusk drafts serialize the reference link and every reference file", () => {
  const state = mapDayToDuskFormToDraftState(source());
  assert.equal(state.schemaVersion, DAY_TO_DUSK_DRAFT_STATE_SCHEMA_VERSION);
  assert.equal(state.items[0].state.referenceLink, "https://example.com/dusk");
  assert.deepEqual(
    state.items[0].state.referenceFiles.map((file) => file.filename),
    ["desired-sky.webp", "lighting-notes.pdf"],
  );
  assert.equal(state.items[0].state.originalFilename, "daylight.jpg");
  assert.equal(state.metadata.shareEnabled, true);
});

test("Day to Dusk saved drafts restore references for Review to Edit", () => {
  const state = mapDayToDuskFormToDraftState(source());
  const restored = mapDayToDuskDraftToFormState(state);
  assert.equal(restored.step, "review");
  assert.equal(restored.items[0].file, null);
  assert.equal(restored.items[0].referenceFiles.length, 2);
  assert.equal(restored.items[0].referenceFiles[1].mimeType, "application/pdf");
  assert.equal(restored.items[0].referenceFiles[1].file, null);
});

test("Day to Dusk draft create and update inputs preserve pricing semantics", () => {
  const current = source();
  const created = buildDayToDuskCreateDraftInput(current);
  assert.equal(created.serviceType, "photo-editing");
  assert.equal(created.subService, "day-to-dusk");
  assert.equal(created.route, DAY_TO_DUSK_DRAFT_ROUTE);
  assert.equal(created.pricingPreview?.preview.itemCount, 1);
  const updated = buildDayToDuskUpdateDraftInput(current, 7);
  assert.equal(updated.expectedVersion, 7);
  assert.equal(updated.state?.items[0].state.referenceFiles.length, 2);
});

test("Day to Dusk resume accepts its draft and rejects another form", () => {
  const state = mapDayToDuskFormToDraftState(source());
  const draft = {
    serviceType: "photo-editing",
    subService: "day-to-dusk",
    route: DAY_TO_DUSK_DRAFT_ROUTE,
    state,
    stateSchemaVersion: DAY_TO_DUSK_DRAFT_STATE_SCHEMA_VERSION,
    version: 4,
  } as Pick<
    OrderDraftRow,
    "serviceType" | "subService" | "route" | "state" | "stateSchemaVersion" | "version"
  >;
  const accepted = validateDayToDuskDraftForResume(draft);
  assert.equal(accepted.ok, true);
  assert.equal(validateDayToDuskDraftForResume({ ...draft, subService: "other" }).ok, false);
});

test("Day to Dusk fingerprint changes when a reference link or file changes", () => {
  const first = source();
  const second = source();
  second.items[0].referenceLink = "https://example.com/other";
  assert.notEqual(
    buildDayToDuskDraftFingerprint(first),
    buildDayToDuskDraftFingerprint(second),
  );
  second.items[0].referenceLink = first.items[0].referenceLink;
  second.items[0].referenceFiles = second.items[0].referenceFiles?.slice(0, 1);
  assert.notEqual(
    buildDayToDuskDraftFingerprint(first),
    buildDayToDuskDraftFingerprint(second),
  );
});
