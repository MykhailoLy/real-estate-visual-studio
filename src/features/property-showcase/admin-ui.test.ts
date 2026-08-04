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
