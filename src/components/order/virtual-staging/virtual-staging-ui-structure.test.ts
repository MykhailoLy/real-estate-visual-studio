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
const exampleDialogSource = readFileSync(
  new URL("./ExampleDialog.tsx", import.meta.url),
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
  assert.match(stagingItemSource, /onChange=\{\(\) => toggleAddon\(addon\.id\)\}/);
});

test("closing the shared informational dialog has no form mutation contract", () => {
  assert.doesNotMatch(
    exampleDialogSource,
    /selectedAddons|furnitureStyle|onSelect|onFormChange/,
  );
  assert.match(exampleDialogSource, /const close = \(\) => onOpenChange\(false\)/);
});

test("Review Order transitions steps while final Submit Order owns submission", () => {
  const reviewAction = orderFormSource.indexOf("onSubmit={goToReview}");
  const reviewLabel = orderFormSource.indexOf('submitLabel="Review Order"');
  const finalAction = orderFormSource.indexOf("onSubmit={handleSubmit}");

  assert.ok(reviewAction > -1);
  assert.ok(reviewLabel > reviewAction);
  assert.ok(finalAction > -1);
  assert.notEqual(reviewAction, finalAction);
});
