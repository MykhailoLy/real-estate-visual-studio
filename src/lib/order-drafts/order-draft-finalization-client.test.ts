import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import {
  parseDraftFinalizationRetryContext,
  serializeDraftFinalizationRetryContext,
  shouldApplyVirtualStagingFinalizationResult,
  shouldPreserveDraftFinalizationKeyAfterFailure,
  type DraftFinalizationRetryContext,
} from "./finalization.ts";
import type { DraftFinalizationClientResult } from "./finalization-client.ts";

const DRAFT_ID = "22222222-2222-4222-8222-222222222222";
const OLD_KEY = "77777777-7777-4777-8777-777777777777";

// Execute the existing form callbacks without mounting the UI. React state,
// network, and draft saves are controlled; callback control flow is production
// source, so these checks catch a form failing to forward the release signal.
function formCallback(source: ts.SourceFile, name: string, bindings: Record<string, unknown>) {
  let expression: ts.Expression | ts.FunctionDeclaration | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) {
      expression = node.initializer;
    }
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
      expression = node;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(expression, `Missing form callback ${name}`);
  if (ts.isCallExpression(expression) && expression.expression.getText(source) === "useCallback") {
    expression = expression.arguments[0];
  }
  const code = ts.transpileModule(`(${expression.getText(source)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return runInNewContext(code, bindings) as (...args: unknown[]) => unknown;
}

for (const [service, form] of [
  ["virtual-staging", "VirtualStaging"],
  ["photo-editing", "PhotoEditing"],
  ["virtual-renovation", "VirtualRenovation"],
  ["floor-plans", "FloorPlans"],
] as const) {
  test(`${service}: actual callbacks preserve ambiguous K1, unlock released failure, and submit edited draft with K2`, async () => {
    const path = `src/components/order/${service}/${form}OrderForm.tsx`;
    const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const initial: DraftFinalizationRetryContext = { draftId: DRAFT_ID, expectedVersion: 1, finalizationKey: OLD_KEY };
    const retryRef = { current: initial as DraftFinalizationRetryContext | null };
    const currentRetry = (): DraftFinalizationRetryContext | null => retryRef.current;
    const keyRef = { current: OLD_KEY as string | null };
    const inFlight = { current: false };
    let stored: string | null = serializeDraftFinalizationRetryContext(initial);
    let retryState: DraftFinalizationRetryContext | null = initial;
    let savedVersion = 1;
    let saves = 0;
    let generatedKeys = 0;
    const sent: DraftFinalizationRetryContext[] = [];
    const ambiguous: DraftFinalizationClientResult = {
      ok: false, code: "storage_error", status: 500, message: "Storage result unavailable.",
    };
    const item = { clientItemId: "item-1", file: null, referenceFile: null };
    const noop = () => undefined;
    const bindings: Record<string, unknown> = {
      finalizationRetryContextRef: retryRef,
      finalizationKeyRef: keyRef,
      submissionInFlightRef: inFlight,
      draftIdRef: { current: DRAFT_ID },
      draftSessionRef: { current: 1 },
      mountedRef: { current: true },
      itemsRef: { current: [item] },
      uploadedDraftFilesRef: { current: [] },
      orderTermsRef: { current: { accepted: true, earlyPerformanceRequested: true } },
      pendingScrollRef: { current: null },
      step: "review", screen: "review", isSubmitting: false, saveStatus: "saved", resumeState: "ready",
      hasActiveFileOperation: false, hasActiveDraftFileOperation: false,
      canSubmit: true, configurationValid: true, missingRequiredFields: [],
      currency: "USD", partnerClient: false,
      setIsSubmitting: noop, setSubmitError: noop, setFinalizationKey: noop,
      setValidationAttempted: noop, applyPartnerSnapshot: noop,
      setFinalizationRetryContext: (value: DraftFinalizationRetryContext | null) => { retryState = value; },
      removeStoredFinalizationRetryContext: () => { stored = null; },
      writeStoredFinalizationRetryContext: (value: DraftFinalizationRetryContext) => {
        stored = serializeDraftFinalizationRetryContext(value);
      },
      shouldApplyVirtualStagingFinalizationResult,
      shouldPreserveVirtualStagingFinalizationKeyAfterFailure: shouldPreserveDraftFinalizationKeyAfterFailure,
      shouldPreserveDraftFinalizationKeyAfterFailure,
      shouldApplyVirtualStagingSaveResult: () => true,
      shouldApplyPhotoEditingAsyncResult: () => true,
      shouldApplyVirtualRenovationAsyncResult: () => true,
      shouldApplyFloorPlansAsyncResult: () => true,
      buildDraftSource: () => ({}), buildDraftSourceSnapshot: () => ({}),
      enqueueDraftSave: async () => { saves += 1; return { ok: true, draftId: DRAFT_ID, version: savedVersion }; },
      listOrderDraftFiles: async () => ({ ok: true, data: [{ kind: "original", itemClientId: "item-1" }] }),
      listDraftReferenceFiles: async () => ({ ok: true, data: [] }),
      commitUploadedFiles: noop, commitItems: noop, refreshUploadedDraftFiles: async () => undefined,
      getVirtualStagingUploadedFileForSlot: () => ({}),
      selectVirtualStagingDraftSubmissionMode: () => ({ mode: "draft_finalization" }),
      createPricingExpectation: () => undefined, calculateOrderQuote: () => undefined,
      buildCurrentPricingExpectation: () => undefined,
      crypto: { randomUUID: () => { generatedKeys += 1; return randomUUID(); } },
    };
    const submit = async (draftId: string, expectedVersion: number, finalizationKey: string) => {
      sent.push({ draftId, expectedVersion, finalizationKey });
      return ambiguous;
    };
    bindings.submitOrderDraft = submit;
    bindings.submitVirtualStagingDraft = submit;
    bindings.clearFinalizationRetryContext = formCallback(source, "clearFinalizationRetryContext", bindings);
    if (service === "virtual-staging") {
      bindings.storeFinalizationRetryContext = formCallback(source, "storeFinalizationRetryContext", bindings);
      bindings.createFinalizationKey = formCallback(source, "createFinalizationKey", bindings);
    }
    const applyName = service === "virtual-staging" ? "applyDraftFinalizationResult" : "applyFinalizationResult";
    const apply = formCallback(source, applyName, bindings);
    bindings[applyName] = apply;
    if (service !== "virtual-staging") {
      bindings.submitWithContext = formCallback(source, "submitWithContext", bindings);
    }
    const handleSubmit = formCallback(source, "handleSubmit", bindings);

    for (const result of [
      ambiguous,
      { ...ambiguous, status: 503, draftReleased: true as const },
      { ...ambiguous, code: "database_error" as const, draftReleased: true as const },
      { ...ambiguous, code: "finalization_incomplete" as const, status: 503 },
    ]) {
      apply(result, initial, 1);
      assert.equal(retryRef.current?.finalizationKey, OLD_KEY);
      assert.equal(retryState?.finalizationKey, OLD_KEY);
      assert.equal(parseDraftFinalizationRetryContext(stored!, DRAFT_ID)?.finalizationKey, OLD_KEY);
    }
    await handleSubmit();
    assert.deepEqual(sent[0], initial);
    assert.equal(saves, 0, "unknown-attempt retry must bypass saving an edited version");
    assert.equal(generatedKeys, 0);

    apply({ ...ambiguous, draftReleased: true }, initial, 1);
    assert.equal(retryRef.current, null, "release must remove the edit/autosave lock ref");
    assert.equal(retryState, null, "release must enable rendered edit controls");
    assert.equal(stored, null, "reload must not restore the released K1");
    if (service === "virtual-staging") assert.equal(keyRef.current, null);

    savedVersion = 2; // Successful edit/version increment, supplied by the save boundary.
    await handleSubmit();
    assert.equal(saves, 1);
    assert.equal(generatedKeys, 1);
    assert.equal(sent[1].draftId, DRAFT_ID);
    assert.equal(sent[1].expectedVersion, 2);
    assert.notEqual(sent[1].finalizationKey, OLD_KEY);
    assert.equal(currentRetry()?.finalizationKey, sent[1].finalizationKey);
    assert.equal(parseDraftFinalizationRetryContext(stored!, DRAFT_ID)?.finalizationKey, sent[1].finalizationKey);
    await handleSubmit();
    assert.deepEqual(sent[2], sent[1], "unknown K2 retry must keep the same K2 and saved version");
    assert.equal(generatedKeys, 1);
    assert.equal(saves, 1);
  });
}
