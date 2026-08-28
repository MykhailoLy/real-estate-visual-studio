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

test("OrderSummary remains the only submit owner", () => {
  const summaryMatches = orderFormSource.match(/<OrderSummary/g);
  assert.equal(summaryMatches?.length, 1);
  assert.match(orderFormSource, /sidebar=\{\s*<OrderSummary/);
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
  assert.match(itemSource, /2xl:grid-cols/);
});
