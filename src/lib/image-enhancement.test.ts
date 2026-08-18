import assert from "node:assert/strict";
import test from "node:test";
import {
  AERIAL_EDITING_DEFAULT,
  DAY_SKY_STYLE_DEFAULT,
  getEffectiveDaySkyStyle,
  getSingleExposureSelectedOptions,
  isAerialDetailRequirementSatisfied,
} from "./image-enhancement.ts";

test("Sky Replacement No has no effective day-sky style", () => {
  assert.equal(getEffectiveDaySkyStyle("no", "deep-blue"), null);
  assert.equal(getEffectiveDaySkyStyle("expert-decide", "deep-blue"), null);
});

test("Sky Replacement Yes defaults invalid or missing styles to experts", () => {
  assert.equal(
    getEffectiveDaySkyStyle("yes", undefined),
    DAY_SKY_STYLE_DEFAULT,
  );
  assert.equal(getEffectiveDaySkyStyle("yes", "not-real"), "expert-decide");
});

test("remembered sky style survives No to Yes without becoming active while hidden", () => {
  const remembered = "soft-pastel";
  assert.equal(getEffectiveDaySkyStyle("no", remembered), null);
  assert.equal(getEffectiveDaySkyStyle("yes", remembered), remembered);
});

test("Single Exposure selections keep standard add-ons and aerial pricing independent", () => {
  assert.deepEqual(
    getSingleExposureSelectedOptions(
      ["shadow-removal", "turn-on-lights-pe"],
      "drop-pin",
    ),
    [
      "image-enhancement-re",
      "shadow-removal",
      "turn-on-lights-pe",
      "aerial-drop-pin-pe",
    ],
  );
  assert.deepEqual(
    getSingleExposureSelectedOptions([], AERIAL_EDITING_DEFAULT),
    ["image-enhancement-re"],
  );
});

test("aerial detail rules require instructions or a reference only where approved", () => {
  assert.equal(
    isAerialDetailRequirementSatisfied("colour-fade", "", false),
    true,
  );
  assert.equal(
    isAerialDetailRequirementSatisfied("drop-pin", "", false),
    false,
  );
  assert.equal(
    isAerialDetailRequirementSatisfied("drop-pin", "Pin the main house", false),
    true,
  );
  assert.equal(
    isAerialDetailRequirementSatisfied("single-lot-highlight", "", true),
    true,
  );
});
