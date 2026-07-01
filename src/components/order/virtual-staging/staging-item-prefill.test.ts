import assert from "node:assert/strict";
import test from "node:test";
import {
  applyVirtualStagingInitialAddOns,
  isVirtualStagingSupportPrefillOnlyState,
  normalizeVirtualStagingAddOnIds,
  shouldAllowVirtualStagingSupportPrefillAutosave,
  type VirtualStagingSupportPrefillDraftSource,
  type VirtualStagingSupportPrefillItemSource,
} from "./staging-item-prefill.ts";

const RECOMMENDED_ADD_ON_IDS = ["image-enhancement"] as const;

function item(selectedAddons: string[] = []) {
  return {
    clientItemId: "item-1",
    selectedAddons,
    roomName: "",
  };
}

function sourceItem(
  overrides: Partial<VirtualStagingSupportPrefillItemSource> = {},
): VirtualStagingSupportPrefillItemSource {
  return {
    file: null,
    roomName: "",
    furnitureStyle: "",
    fileSizeLimit: "",
    disclaimerText: "",
    referenceLink: "",
    referenceFile: null,
    additionalInfo: "",
    selectedAddons: ["image-enhancement"],
    originalFilename: null,
    referenceFilename: null,
    ...overrides,
  };
}

function draftSource(
  overrides: Partial<VirtualStagingSupportPrefillDraftSource> = {},
): VirtualStagingSupportPrefillDraftSource {
  return {
    jobTitle: "",
    items: [sourceItem()],
    orderTerms: {
      accepted: false,
      allowPortfolio: false,
    },
    ...overrides,
  };
}

test("valid initial add-on is applied to a fresh item", () => {
  assert.deepEqual(
    applyVirtualStagingInitialAddOns(item(), ["image-enhancement"])
      .selectedAddons,
    ["image-enhancement"],
  );
});

test("invalid add-on is ignored", () => {
  assert.deepEqual(
    applyVirtualStagingInitialAddOns(item(), ["unknown"]).selectedAddons,
    [],
  );
});

test("duplicates are removed", () => {
  assert.deepEqual(
    applyVirtualStagingInitialAddOns(item(["image-enhancement"]), [
      "image-enhancement",
    ]).selectedAddons,
    ["image-enhancement"],
  );
});

test("existing item data is not mutated", () => {
  const existing = item(["day-to-dusk"]);
  const updated = applyVirtualStagingInitialAddOns(existing, [
    "image-enhancement",
  ]);

  assert.notEqual(updated, existing);
  assert.deepEqual(existing.selectedAddons, ["day-to-dusk"]);
  assert.deepEqual(updated.selectedAddons, [
    "day-to-dusk",
    "image-enhancement",
  ]);
});

test("a new item can inherit the recommended add-on", () => {
  const recommendedAddOnIds = ["image-enhancement"];

  assert.deepEqual(
    applyVirtualStagingInitialAddOns(item(), recommendedAddOnIds).selectedAddons,
    ["image-enhancement"],
  );
});

test("an item from a restored draft is left unchanged unless helper is applied", () => {
  const restored = item(["turn-on-lights"]);

  assert.deepEqual(restored.selectedAddons, ["turn-on-lights"]);
  assert.deepEqual(normalizeVirtualStagingAddOnIds(restored.selectedAddons), [
    "turn-on-lights",
  ]);
});

test("one empty item with only Image Enhancement recommendation is recommendation-only", () => {
  assert.equal(
    isVirtualStagingSupportPrefillOnlyState(
      draftSource(),
      RECOMMENDED_ADD_ON_IDS,
    ),
    true,
  );
});

test("multiple empty items inheriting Image Enhancement are recommendation-only", () => {
  assert.equal(
    isVirtualStagingSupportPrefillOnlyState(
      draftSource({
        items: [sourceItem(), sourceItem({ selectedAddons: ["image-enhancement"] })],
      }),
      ["image-enhancement", "image-enhancement"],
    ),
    true,
  );
});

test("unchecking Image Enhancement while empty remains recommendation-only", () => {
  const source = draftSource({
    items: [sourceItem({ selectedAddons: [] })],
  });

  assert.equal(
    isVirtualStagingSupportPrefillOnlyState(source, RECOMMENDED_ADD_ON_IDS),
    true,
  );
  assert.equal(
    shouldAllowVirtualStagingSupportPrefillAutosave({
      currentDraftId: null,
      source,
      recommendedAddOnIds: RECOMMENDED_ADD_ON_IDS,
      supportRecommendationApplied: true,
    }),
    false,
  );
});

test("invalid recommended add-on IDs cannot mark a state recommendation-only", () => {
  assert.equal(
    isVirtualStagingSupportPrefillOnlyState(draftSource(), ["unknown"]),
    false,
  );
});

test("a non-recommended add-on makes the state meaningful", () => {
  assert.equal(
    isVirtualStagingSupportPrefillOnlyState(
      draftSource({
        items: [sourceItem({ selectedAddons: ["day-to-dusk"] })],
      }),
      RECOMMENDED_ADD_ON_IDS,
    ),
    false,
  );
});

test("job title makes the state meaningful", () => {
  assert.equal(
    isVirtualStagingSupportPrefillOnlyState(
      draftSource({ jobTitle: "Living room staging" }),
      RECOMMENDED_ADD_ON_IDS,
    ),
    false,
  );
});

test("room makes the state meaningful", () => {
  assert.equal(
    isVirtualStagingSupportPrefillOnlyState(
      draftSource({ items: [sourceItem({ roomName: "Living Room" })] }),
      RECOMMENDED_ADD_ON_IDS,
    ),
    false,
  );
});

test("furniture style makes the state meaningful", () => {
  assert.equal(
    isVirtualStagingSupportPrefillOnlyState(
      draftSource({ items: [sourceItem({ furnitureStyle: "Modern" })] }),
      RECOMMENDED_ADD_ON_IDS,
    ),
    false,
  );
});

test("original or reference files and stored filenames make the state meaningful", () => {
  const meaningfulItemStates: Array<
    Partial<VirtualStagingSupportPrefillItemSource>
  > = [
    { file: { name: "original.jpg" } },
    { referenceFile: { name: "reference.jpg" } },
    { originalFilename: "stored-original.jpg" },
    { referenceFilename: "stored-reference.jpg" },
  ];

  for (const meaningfulItemState of meaningfulItemStates) {
    assert.equal(
      isVirtualStagingSupportPrefillOnlyState(
        draftSource({ items: [sourceItem(meaningfulItemState)] }),
        RECOMMENDED_ADD_ON_IDS,
      ),
      false,
    );
  }
});

test("notes, disclaimer, reference link, or file-size choice make the state meaningful", () => {
  const meaningfulItemStates: Array<
    Partial<VirtualStagingSupportPrefillItemSource>
  > = [
    { additionalInfo: "Please keep the wall color." },
    { disclaimerText: "Do not alter the fireplace." },
    { referenceLink: "https://example.com/inspiration" },
    { fileSizeLimit: "MLS-ready" },
  ];

  for (const meaningfulItemState of meaningfulItemStates) {
    assert.equal(
      isVirtualStagingSupportPrefillOnlyState(
        draftSource({ items: [sourceItem(meaningfulItemState)] }),
        RECOMMENDED_ADD_ON_IDS,
      ),
      false,
    );
  }
});

test("accepted terms or portfolio selection make the state meaningful", () => {
  assert.equal(
    isVirtualStagingSupportPrefillOnlyState(
      draftSource({
        orderTerms: { accepted: true, allowPortfolio: false },
      }),
      RECOMMENDED_ADD_ON_IDS,
    ),
    false,
  );
  assert.equal(
    isVirtualStagingSupportPrefillOnlyState(
      draftSource({
        orderTerms: { accepted: false, allowPortfolio: true },
      }),
      RECOMMENDED_ADD_ON_IDS,
    ),
    false,
  );
});

test("existing item and source objects are not mutated by recommendation-only checks", () => {
  const existingItem = sourceItem({ selectedAddons: ["image-enhancement"] });
  const source = draftSource({ items: [existingItem] });
  const sourceBefore = JSON.stringify(source);
  const recommendedAddOnIds = ["image-enhancement", "image-enhancement"];
  const recommendedBefore = [...recommendedAddOnIds];

  assert.equal(
    isVirtualStagingSupportPrefillOnlyState(source, recommendedAddOnIds),
    true,
  );

  assert.equal(JSON.stringify(source), sourceBefore);
  assert.deepEqual(recommendedAddOnIds, recommendedBefore);
});

test("no draft ID plus recommendation-only state blocks automatic autosave", () => {
  assert.equal(
    shouldAllowVirtualStagingSupportPrefillAutosave({
      currentDraftId: null,
      source: draftSource(),
      recommendedAddOnIds: RECOMMENDED_ADD_ON_IDS,
      supportRecommendationApplied: true,
    }),
    false,
  );
});

test("a real meaningful change allows automatic autosave", () => {
  assert.equal(
    shouldAllowVirtualStagingSupportPrefillAutosave({
      currentDraftId: null,
      source: draftSource({ jobTitle: "Living room staging" }),
      recommendedAddOnIds: RECOMMENDED_ADD_ON_IDS,
      supportRecommendationApplied: true,
    }),
    true,
  );
});

test("an existing draft keeps autosave behavior allowed", () => {
  assert.equal(
    shouldAllowVirtualStagingSupportPrefillAutosave({
      currentDraftId: "draft-1",
      source: draftSource(),
      recommendedAddOnIds: RECOMMENDED_ADD_ON_IDS,
      supportRecommendationApplied: true,
    }),
    true,
  );
});

test("explicit forced or manual save is not blocked by the recommendation-only guard", () => {
  assert.equal(
    shouldAllowVirtualStagingSupportPrefillAutosave({
      currentDraftId: null,
      force: true,
      source: draftSource(),
      recommendedAddOnIds: RECOMMENDED_ADD_ON_IDS,
      supportRecommendationApplied: true,
    }),
    true,
  );
});
