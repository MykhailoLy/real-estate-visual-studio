import assert from "node:assert/strict";
import test from "node:test";
import {
  PROPERTY_MARKETING_PREVIEW_DEBOUNCE_MS,
  serializePropertyMarketingPreviewRequest,
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

test("unsaved landscape preview payload preserves template and supporting image order", () => {
  const serialized = serializePropertyMarketingPreviewRequest(
    {
      enabled: true,
      brochure: {
        orientation: "landscape",
        template: "hero-four-grid",
        primaryMediaId: "primary",
        supportingMediaIds: ["green", "blue", "yellow", "purple"],
      },
    },
    [
      { mediaId: "green", focalPoint: { x: 0.2, y: 0.8 } },
      { mediaId: "blue", focalPoint: { x: 0.7, y: 0.3 } },
    ],
  );
  const parsed = JSON.parse(serialized) as {
    marketingMaterials: {
      brochure: { template: string; supportingMediaIds: string[] };
    };
    focalPoints: Array<{ mediaId: string }>;
  };
  assert.equal(parsed.marketingMaterials.brochure.template, "hero-four-grid");
  assert.deepEqual(parsed.marketingMaterials.brochure.supportingMediaIds, [
    "green",
    "blue",
    "yellow",
    "purple",
  ]);
  assert.deepEqual(parsed.focalPoints.map((item) => item.mediaId), ["green", "blue"]);
});
