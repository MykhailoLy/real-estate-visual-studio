import assert from "node:assert/strict";
import test from "node:test";
import {
  PROPERTY_MARKETING_PREVIEW_DEBOUNCE_MS,
  shouldApplyPropertyMarketingPreview,
} from "./marketing-preview-client.ts";

test("live brochure preview uses the required bounded debounce", () => {
  assert.ok(PROPERTY_MARKETING_PREVIEW_DEBOUNCE_MS >= 300);
  assert.ok(PROPERTY_MARKETING_PREVIEW_DEBOUNCE_MS <= 500);
});

test("stale and cancelled brochure preview responses cannot replace the latest", () => {
  assert.equal(shouldApplyPropertyMarketingPreview(4, 5, false), false);
  assert.equal(shouldApplyPropertyMarketingPreview(5, 5, true), false);
  assert.equal(shouldApplyPropertyMarketingPreview(5, 5, false), true);
});
