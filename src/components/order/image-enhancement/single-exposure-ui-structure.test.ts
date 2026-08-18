import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const formSource = readFileSync(
  new URL("./SingleExposureOrderForm.tsx", import.meta.url),
  "utf8",
);
const itemSource = readFileSync(
  new URL("./SingleExposureItemCard.tsx", import.meta.url),
  "utf8",
);

test("Review Order changes steps and never invokes final submission", () => {
  const reviewStart = formSource.indexOf("const goToReview = () =>");
  const reviewEnd = formSource.indexOf("const goToConfigure", reviewStart);
  const reviewBody = formSource.slice(reviewStart, reviewEnd);
  assert.match(reviewBody, /setStep\("review"\)/);
  assert.doesNotMatch(reviewBody, /submitOrder\(/);
  assert.match(formSource, /submitLabel=\{isReview \? "Submit Order" : "Review Order"\}/);
  assert.match(formSource, /onSubmit=\{isReview \? handleSubmit : goToReview\}/);
});

test("final Submit Order is guarded against duplicate submission", () => {
  const submitStart = formSource.indexOf("const handleSubmit = async () =>");
  const submitEnd = formSource.indexOf("const handleNewOrder", submitStart);
  const submitBody = formSource.slice(submitStart, submitEnd);
  assert.match(submitBody, /if \(submittingRef\.current/);
  assert.match(submitBody, /submittingRef\.current = true/);
  assert.match(submitBody, /submitOrder\(/);
});

test("day sky cards render only for an enabled Sky Replacement state", () => {
  assert.match(itemSource, /data\.skyReplacement === "yes" \? \(/);
  assert.match(itemSource, /<DaySkyStyleSelector/);
});

test("standard add-on information buttons are outside checkbox labels", () => {
  const checkbox = itemSource.indexOf('type="checkbox"');
  const labelEnd = itemSource.indexOf("</label>", checkbox);
  const infoButton = itemSource.indexOf(
    "onClick={() => setPreviewAddonId(addon.id)}",
  );
  assert.ok(checkbox > -1);
  assert.ok(labelEnd > checkbox);
  assert.ok(infoButton > labelEnd);
  assert.match(itemSource, /type="button"[\s\S]*View \$\{addon\.label\} example/);
});

test("aerial dropdown defaults through the typed no-editing value", () => {
  assert.match(itemSource, /aerialEditing: AERIAL_EDITING_DEFAULT/);
  assert.match(itemSource, /value=\{data\.aerialEditing\}/);
  assert.doesNotMatch(itemSource, />Combo</);
});
