import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const formSource = readFileSync(
  new URL("./PhotoEditingOrderForm.tsx", import.meta.url),
  "utf8",
);
const reviewSource = readFileSync(
  new URL("./PhotoEditingReview.tsx", import.meta.url),
  "utf8",
);
const itemCardSource = readFileSync(
  new URL("./PhotoEditItemCard.tsx", import.meta.url),
  "utf8",
);

test("Configure advances to Review without owning production submission", () => {
  const configureAction = formSource.indexOf("onSubmit={goToReview}");
  const configureLabel = formSource.indexOf('submitLabel="Review Order"');
  const finalAction = formSource.indexOf("onSubmit={handleSubmit}");

  assert.ok(configureAction > -1);
  assert.ok(configureLabel > configureAction);
  assert.ok(finalAction > -1);
  assert.notEqual(configureAction, finalAction);
  assert.match(
    formSource,
    /header=\{<OrderStepIndicator steps=\{STEPS\} currentStepId=\{step\} \/>\}/,
  );
});

test("production finalization fails closed outside the Review step", () => {
  const submitStart = formSource.indexOf("const handleSubmit = async () => {");
  const submitEnd = formSource.indexOf(
    "const handleFinalizationRecovery = async () => {",
    submitStart,
  );
  const submitSource = formSource.slice(submitStart, submitEnd);

  assert.match(submitSource, /step !== "review"/);
  assert.match(submitSource, /submissionInFlightRef\.current/);
  assert.match(submitSource, /await enqueueDraftSave\(buildDraftSource\(\), true\)/);
  assert.match(submitSource, /await listOrderDraftFiles\(saved\.draftId\)/);
  assert.match(submitSource, /await submitWithContext/);
});

test("terms gate final Submit but do not gate entry to Review", () => {
  const reviewStart = formSource.indexOf("const canReview =");
  const reviewEnd = formSource.indexOf("const canSubmit =", reviewStart);
  const submitEnd = formSource.indexOf(
    "const reviewBlockedMessage =",
    reviewEnd,
  );
  const canReviewSource = formSource.slice(reviewStart, reviewEnd);
  const canSubmitSource = formSource.slice(reviewEnd, submitEnd);

  assert.doesNotMatch(canReviewSource, /orderTerms/);
  assert.match(canSubmitSource, /orderTerms\.accepted/);
  assert.match(reviewSource, /<OrderTermsBlock/);
  assert.doesNotMatch(
    formSource.slice(formSource.indexOf("<fieldset"), formSource.indexOf("</fieldset>")),
    /OrderTermsBlock/,
  );
});

test("Back and per-item Edit change only ephemeral UI navigation", () => {
  const navigationStart = formSource.indexOf("const goToConfigureTop = () => {");
  const navigationEnd = formSource.indexOf(
    "const handleSubmit = async () => {",
    navigationStart,
  );
  const navigationSource = formSource.slice(navigationStart, navigationEnd);

  assert.match(navigationSource, /setStep\("configure"\)/);
  assert.match(
    navigationSource,
    /pendingScrollRef\.current = \{ type: "item", clientItemId \}/,
  );
  assert.doesNotMatch(
    navigationSource,
    /commitItems|setItems|enqueueDraftSave|updateOrderDraft/,
  );
});

test("Start New resets Review state and stable clientItemId owns item targeting", () => {
  const resetStart = formSource.indexOf("const startNewOrder = useCallback(");
  const resetEnd = formSource.indexOf(
    "const hasActiveFileOperation =",
    resetStart,
  );
  const resetSource = formSource.slice(resetStart, resetEnd);

  assert.match(resetSource, /setStep\("configure"\)/);
  assert.match(formSource, /type: "item"; clientItemId: string/);
  assert.match(formSource, /photoEditItemDomId\(pending\.clientItemId\)/);
  assert.match(reviewSource, /key=\{item\.clientItemId\}/);
  assert.match(reviewSource, /onEditItem\(item\.clientItemId\)/);
  assert.match(itemCardSource, /photoEditItemDomId\(data\.clientItemId\)/);
});

test("restored finalization retry context remains reachable on Review", () => {
  const restoreStart = formSource.indexOf(
    "const storedFinalization =",
  );
  const restoreEnd = formSource.indexOf(
    'setResumeState("ready")',
    restoreStart,
  );
  const restoreSource = formSource.slice(restoreStart, restoreEnd);

  assert.match(restoreSource, /if \(storedFinalization\)/);
  assert.match(restoreSource, /setStep\("review"\)/);
  assert.match(formSource, /hasFinalizationRetryContext \? "Retry submission"/);
  assert.match(
    formSource,
    /hasFinalizationRetryContext \|\|\s*\(hasValidConfiguration && orderTerms\.accepted\)/,
  );
});

test("one canonical draft RPC remains the only production submit path", () => {
  assert.equal(formSource.match(/submitOrderDraft\(/g)?.length, 1);
  assert.doesNotMatch(formSource, /submitOrder\(|\/api\/order["'`]/);
  assert.match(reviewSource, /role="alert"/);
});
