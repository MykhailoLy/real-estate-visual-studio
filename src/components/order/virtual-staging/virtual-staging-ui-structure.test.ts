import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styleSelectorSource = readFileSync(
  new URL("./StyleSelector.tsx", import.meta.url),
  "utf8",
);
const stagingItemSource = readFileSync(
  new URL("./StagingItemCard.tsx", import.meta.url),
  "utf8",
);
const singleExposureItemSource = readFileSync(
  new URL("../image-enhancement/SingleExposureItemCard.tsx", import.meta.url),
  "utf8",
);
const exampleDialogSource = readFileSync(
  new URL("../ExampleDialog.tsx", import.meta.url),
  "utf8",
);
const orderFormSource = readFileSync(
  new URL("./VirtualStagingOrderForm.tsx", import.meta.url),
  "utf8",
);

test("style preview control is separate from the style selection button", () => {
  const selectHandler = styleSelectorSource.indexOf("onClick={onSelect}");
  const selectionButtonEnd = styleSelectorSource.indexOf(
    "</button>",
    selectHandler,
  );
  const previewHandler = styleSelectorSource.indexOf("onClick={onPreview}");

  assert.ok(selectHandler > -1);
  assert.ok(selectionButtonEnd > selectHandler);
  assert.ok(previewHandler > selectionButtonEnd);
  assert.match(
    styleSelectorSource,
    /aria-label={`View \$\{card\.label\} style example`}/,
  );
});

test("add-on information control is outside the checkbox label", () => {
  const checkbox = stagingItemSource.indexOf('type="checkbox"');
  const checkboxLabelEnd = stagingItemSource.indexOf("</label>", checkbox);
  const infoHandler = stagingItemSource.indexOf(
    "onClick={() => setPreviewAddonId(addon.id)}",
  );

  assert.ok(checkbox > -1);
  assert.ok(checkboxLabelEnd > checkbox);
  assert.ok(infoHandler > checkboxLabelEnd);
  assert.match(
    stagingItemSource,
    /onChange=\{\(\) => toggleAddon\(addon\.id\)\}/,
  );
});

test("closing the shared informational dialog has no form mutation contract", () => {
  assert.doesNotMatch(
    exampleDialogSource,
    /selectedAddons|furnitureStyle|onSelect|onFormChange/,
  );
  assert.match(
    exampleDialogSource,
    /const close = \(\) => onOpenChange\(false\)/,
  );
});

test("existing Virtual Staging dialogs keep the pre-extraction no-media behavior", () => {
  assert.match(exampleDialogSource, /showMissingMediaPlaceholder = false/);
  assert.match(
    exampleDialogSource,
    /\) : showMissingMediaPlaceholder \? \([\s\S]*?Example media coming soon[\s\S]*?\) : null\}/,
  );
  assert.doesNotMatch(styleSelectorSource, /showMissingMediaPlaceholder/);
  assert.doesNotMatch(stagingItemSource, /showMissingMediaPlaceholder/);
  assert.doesNotMatch(singleExposureItemSource, /showMissingMediaPlaceholder/);
});

test("Review Order transitions steps while final Submit Order owns submission", () => {
  const reviewAction = orderFormSource.indexOf(
    "<OrderReviewAction onClick={goToReview}",
  );
  const finalAction = orderFormSource.indexOf("onSubmit={handleSubmit}");

  assert.ok(reviewAction > -1);
  assert.ok(finalAction > -1);
  assert.notEqual(reviewAction, finalAction);
});

test("configure uses the wide guided workspace without an order summary", () => {
  assert.match(orderFormSource, /leadingRail=\{guide\}/);
  assert.match(
    orderFormSource,
    /workspaceVariant=\{isReview \? undefined : "wide"\}/,
  );
  assert.match(orderFormSource, /sidebar=\{\s*isReview \? \(/);
  assert.match(orderFormSource, /editorial=\{!isReview\}/);
  assert.doesNotMatch(orderFormSource, /onSubmit=\{goToReview\}/);
  assert.match(
    orderFormSource,
    /<OrderReviewAction onClick=\{goToReview\} disabled=\{!canReview\}>/,
  );
  assert.equal(orderFormSource.match(/<OrderSummary/g)?.length, 1);
});

test("style selector uses compact responsive cards and preserves media behavior", () => {
  assert.match(styleSelectorSource, /grid-cols-2/);
  assert.match(styleSelectorSource, /md:grid-cols-3/);
  assert.match(styleSelectorSource, /lg:grid-cols-4/);
  assert.match(styleSelectorSource, /min-\[1600px\]:grid-cols-5/);
  assert.match(styleSelectorSource, /aspect-\[3\/2\]/);
  assert.match(styleSelectorSource, /loading="lazy"/);
  assert.match(styleSelectorSource, /<ExampleDialog/);
});

test("each image delegates its original preview to the shared workspace", () => {
  assert.match(
    stagingItemSource,
    /previewUrl: uploadedOriginalFile\.previewUrl/,
  );
  assert.match(stagingItemSource, /<OrderImageWorkspace/);
  assert.match(stagingItemSource, /hasPreview=\{hasOriginalPreview\}/);
  assert.match(stagingItemSource, /hasFileUploadPreview\(/);
  assert.match(stagingItemSource, /presentationVariant="workspace"/);
  assert.match(stagingItemSource, /inputId=\{uploadInputId\}/);
  assert.doesNotMatch(
    stagingItemSource,
    /URL\.createObjectURL|CurrentPhotoPreview/,
  );
  assert.doesNotMatch(orderFormSource, /activeImage|activePreview/);
});

test("comfortable fields and compact wide add-ons remain item-local", () => {
  assert.match(stagingItemSource, /layoutVariant="desktop-columns"/);
  assert.match(stagingItemSource, /<ReferenceFilesUploader[\s\S]*?comfortable/);
  assert.match(stagingItemSource, /rows=\{3\}/);
  assert.match(stagingItemSource, /grid gap-3 xl:grid-cols-2/);
  assert.match(stagingItemSource, /calculateStagingItemTotal/);
  assert.match(
    stagingItemSource,
    /getCatalogPrice\(addon\.priceKey, currency\)/,
  );
});

test("draft query changes synchronize through Next-compatible native history", () => {
  const urlSyncStart = orderFormSource.indexOf(
    "const replaceDraftUrl = useCallback(",
  );
  const urlSyncEnd = orderFormSource.indexOf(
    "const startNewVirtualStagingOrder = useCallback(",
    urlSyncStart,
  );

  assert.ok(urlSyncStart > -1);
  assert.ok(urlSyncEnd > urlSyncStart);

  const urlSyncSource = orderFormSource.slice(urlSyncStart, urlSyncEnd);

  assert.match(
    urlSyncSource,
    /window\.history\.replaceState\(\s*null,\s*"",\s*`\$\{pathname\}\$\{suffix\}`\s*\)/,
  );
  assert.match(urlSyncSource, /next\.set\("draft",\s*nextDraftId\)/);
  assert.match(urlSyncSource, /replaceDraftUrl\(next\.toString\(\)\)/);
  assert.doesNotMatch(urlSyncSource, /router\.replace|window\.history\.state/);
});

test("first draft save commits its restore guards before synchronizing the URL", () => {
  const createStart = orderFormSource.indexOf("if (!currentDraftId) {");
  const createEnd = orderFormSource.indexOf(
    "const expectedVersion = draftVersionRef.current;",
    createStart,
  );

  assert.ok(createStart > -1);
  assert.ok(createEnd > createStart);

  const createSource = orderFormSource.slice(createStart, createEnd);
  const draftRef = createSource.indexOf("draftIdRef.current = result.data.id;");
  const fingerprint = createSource.indexOf(
    "savedFingerprintRef.current = fingerprint;",
  );
  const updateUrl = createSource.indexOf("setDraftQueryParam(result.data.id);");

  assert.ok(draftRef > -1);
  assert.ok(fingerprint > draftRef);
  assert.ok(updateUrl > fingerprint);
  assert.match(
    orderFormSource,
    /requestedDraftId === draftIdRef\.current\s*&&\s*savedFingerprintRef\.current !== null\s*&&\s*!isRestoringRef\.current/,
  );
});

test("Start New removes the draft query through the same native history update", () => {
  const resetStart = orderFormSource.indexOf(
    "const startNewVirtualStagingOrder = useCallback(",
  );
  const resetEnd = orderFormSource.indexOf(
    "const enqueueDraftSave = useCallback(",
    resetStart,
  );

  assert.ok(resetStart > -1);
  assert.ok(resetEnd > resetStart);

  const resetSource = orderFormSource.slice(resetStart, resetEnd);

  assert.match(
    resetSource,
    /resetVirtualStagingDraftIdentity\(searchParams\.toString\(\)\)/,
  );
  assert.match(resetSource, /replaceDraftUrl\(reset\.nextSearch\)/);
});
