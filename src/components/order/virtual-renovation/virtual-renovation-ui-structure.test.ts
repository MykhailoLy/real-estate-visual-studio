import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const itemSource = readFileSync(
  new URL("./RenovationItemCard.tsx", import.meta.url),
  "utf8",
);
const orderFormSource = readFileSync(
  new URL("./VirtualRenovationOrderForm.tsx", import.meta.url),
  "utf8",
);

test("configure uses the wide guided workspace", () => {
  assert.match(orderFormSource, /workspaceVariant="wide"/);
  assert.match(orderFormSource, /editorial/);
  assert.match(orderFormSource, /leadingRail=\{/);
  assert.match(orderFormSource, /compactLeadingRail=\{/);
  assert.match(orderFormSource, /WHAT WE NEED/);
});

test("OrderSummary remains the only submit owner and is outside the disabled fieldset", () => {
  const summaryMatches = orderFormSource.match(/<OrderSummary/g);
  assert.equal(summaryMatches?.length, 1, "OrderSummary must be rendered exactly once");
  assert.doesNotMatch(orderFormSource, /sidebar=\{/, "OrderSummary must not be passed as OrderLayout sidebar");
  
  // Ensure </fieldset> comes before OrderSummary
  const fieldsetEndIndex = orderFormSource.lastIndexOf("</fieldset>");
  const orderSummaryIndex = orderFormSource.indexOf("<OrderSummary");
  assert.ok(fieldsetEndIndex < orderSummaryIndex, "OrderSummary must be outside the disabled fieldset");

  // Ensure it still receives the existing retry-submit conditions
  assert.match(orderFormSource, /canSubmit=\{canSubmit \|\| finalizationRetryContext !== null\}/);
  assert.match(orderFormSource, /submitLabel=\{[\s\S]*finalizationRetryContext \? "Retry submission" : undefined[\s\S]*\}/);
});

test("Internal and External option scrollbars are removed", () => {
  assert.doesNotMatch(itemSource, /max-h-64/);
  assert.doesNotMatch(itemSource, /overflow-y-auto/);
});

test("Internal option IDs are unchanged", () => {
  assert.match(itemSource, /RENOVATION_INTERNAL_OPTIONS\.map/);
  assert.match(itemSource, /checked=\{data\.selectedInternal\.includes\(opt\.id\)\}/);
  assert.match(itemSource, /onChange=\{\(\) => toggleInternal\(opt\.id\)\}/);
});

test("External option IDs are unchanged", () => {
  assert.match(itemSource, /RENOVATION_EXTERNAL_OPTIONS\.map/);
  assert.match(itemSource, /checked=\{data\.selectedExternal\.includes\(opt\.id\)\}/);
  assert.match(itemSource, /onChange=\{\(\) => toggleExternal\(opt\.id\)\}/);
});

test("priceKeys are unchanged", () => {
  assert.match(itemSource, /getCatalogPrice\(opt\.priceKey, currency\)/);
});

test("each image owns its original preview without introducing form image state", () => {
  assert.match(itemSource, /URL\.createObjectURL\(data\.file\)/);
  assert.match(itemSource, /persistedOriginal\?\.previewUrl/);
  assert.match(itemSource, /presentationVariant="workspace"/);
  assert.match(itemSource, /function CurrentPhotoPreview/);
  assert.match(itemSource, /min-\[1700px\]:grid-cols/);
});
