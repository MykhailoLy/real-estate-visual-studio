import assert from "node:assert/strict";
import test from "node:test";
import {
  canShowCompletedReworkAction,
  isOneToOneImageEditingPresentation,
} from "./client-order-item-presentation.ts";

test("paired image presentation requires the dedicated one-to-one item shape", () => {
  assert.equal(
    isOneToOneImageEditingPresentation({
      details: { sub_service: "day-to-dusk" },
      hasOriginalSource: true,
      referenceCount: 0,
      deliverableCount: 0,
    }),
    true,
  );

  assert.equal(
    isOneToOneImageEditingPresentation({
      details: { sub_service: "image-enhancement" },
      hasOriginalSource: true,
      referenceCount: 0,
      deliverableCount: 1,
    }),
    true,
  );
});

test("paired image presentation leaves generic, reference, and multi-file jobs on the fallback", () => {
  const base = {
    details: { sub_service: "image-enhancement" },
    hasOriginalSource: true,
    referenceCount: 0,
    deliverableCount: 0,
  };

  assert.equal(
    isOneToOneImageEditingPresentation({ ...base, details: {} }),
    false,
  );
  assert.equal(
    isOneToOneImageEditingPresentation({ ...base, referenceCount: 1 }),
    false,
  );
  assert.equal(
    isOneToOneImageEditingPresentation({ ...base, deliverableCount: 2 }),
    false,
  );
  assert.equal(
    isOneToOneImageEditingPresentation({ ...base, hasOriginalSource: false }),
    false,
  );
});

test("rework entry is displayed only for delivered or completed results", () => {
  assert.equal(canShowCompletedReworkAction("delivered", true), true);
  assert.equal(canShowCompletedReworkAction("completed", true), true);
  assert.equal(canShowCompletedReworkAction("in-progress", true), false);
  assert.equal(canShowCompletedReworkAction("pending", true), false);
  assert.equal(canShowCompletedReworkAction("delivered", false), false);
});
