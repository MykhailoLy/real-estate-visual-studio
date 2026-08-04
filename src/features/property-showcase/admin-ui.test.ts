import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const mediaManagerSource = readFileSync(
  new URL(
    "../../app/(public)/admin/properties/media/OptimizedPropertyMediaManagerClient.tsx",
    import.meta.url,
  ),
  "utf8",
);
const propertyEditorSource = readFileSync(
  new URL(
    "../../app/(public)/admin/properties/PropertiesAdminClient.tsx",
    import.meta.url,
  ),
  "utf8",
);
const propertyMapCanvasSource = readFileSync(
  new URL(
    "../../app/(showcase)/property/PropertyMapCanvas.tsx",
    import.meta.url,
  ),
  "utf8",
);
const virtualTourSource = readFileSync(
  new URL(
    "../../app/(showcase)/property/ImmersivePropertyTour.tsx",
    import.meta.url,
  ),
  "utf8",
);
const interactivePlanSource = readFileSync(
  new URL(
    "../../app/(showcase)/property/InteractivePropertyFloorPlan.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("ordinary floor-plan cards hide legacy CubiCasa and raw URL controls", () => {
  assert.equal(mediaManagerSource.includes("Legacy interactive plan metadata"), false);
  assert.equal(mediaManagerSource.includes("Normalized embed URL"), false);
  assert.equal(mediaManagerSource.includes("Original/fallback URL"), false);
  assert.equal(mediaManagerSource.includes("Download URL"), false);
});

test("legacy tour promotion remains an explicit property-editor action", () => {
  assert.equal(
    propertyEditorSource.includes(
      "Move legacy tour to property-level settings",
    ),
    true,
  );
  assert.equal(
    propertyEditorSource.includes("Select the correct legacy tour"),
    true,
  );
});

test("map admin distinguishes generated maps from an explicit custom embed", () => {
  assert.equal(
    propertyEditorSource.includes("Use custom Google Maps embed"),
    true,
  );
  assert.equal(
    propertyEditorSource.includes("Generated exact marker map"),
    true,
  );
  assert.equal(
    propertyEditorSource.includes("Generated approximate map"),
    true,
  );
  assert.equal(
    propertyEditorSource.includes("Custom Google Maps embed"),
    true,
  );
});

test("public exact maps do not add a marker status overlay", () => {
  assert.equal(propertyMapCanvasSource.includes("exact-map-marker-status"), false);
  assert.equal(propertyMapCanvasSource.includes("Exact map with marker"), false);
});

test("map admin exposes a fixed approximate center and radius preview", () => {
  assert.equal(propertyEditorSource.includes("Fixed approximate zone"), true);
  assert.equal(
    propertyEditorSource.includes("Approximate center latitude"),
    true,
  );
  assert.equal(
    propertyEditorSource.includes("Approximate center longitude"),
    true,
  );
  assert.equal(
    propertyEditorSource.includes("Approximate radius (meters)"),
    true,
  );
  assert.equal(propertyMapCanvasSource.includes("pointer-events-none"), true);
});

test("media manager exposes featured and primary social image controls", () => {
  assert.equal(mediaManagerSource.includes("Featured / best for sharing"), true);
  assert.equal(mediaManagerSource.includes("Set social primary"), true);
});

test("immersive provider views omit large marketing and status overlays", () => {
  assert.equal(
    virtualTourSource.includes("Enter the property without leaving the page"),
    false,
  );
  assert.equal(virtualTourSource.includes("Ready to load"), false);
  assert.equal(
    interactivePlanSource.includes("Walk through the home room by room"),
    false,
  );
  assert.equal(interactivePlanSource.includes("Ready to open"), false);
  assert.equal(virtualTourSource.includes("virtual-tour-controls"), true);
  assert.equal(interactivePlanSource.includes("interactive-plan-controls"), true);
});
