import assert from "node:assert/strict";
import test from "node:test";
import { PhotoEditItemSchema } from "./server-validation.ts";

const base = {
  subService: "image-enhancement-single-exposure",
  selectedOptions: ["image-enhancement-re"],
  additionalInfo: "",
  grassRepair: "expert-decide",
  skyReplacement: "no",
  tvScreenReplacement: "expert-decide",
  addFireToFireplace: "expert-decide",
  aerialEditing: "none",
};

test("server accepts no active sky style when Sky Replacement is No", () => {
  assert.equal(PhotoEditItemSchema.safeParse(base).success, true);
});

test("server requires a day sky style only when Sky Replacement is Yes", () => {
  assert.equal(
    PhotoEditItemSchema.safeParse({ ...base, skyReplacement: "yes" }).success,
    false,
  );
  assert.equal(
    PhotoEditItemSchema.safeParse({
      ...base,
      skyReplacement: "yes",
      daySkyStyle: "expert-decide",
    }).success,
    true,
  );
});

test("server permits approved Single Exposure add-ons and rejects aerial mismatch", () => {
  assert.equal(
    PhotoEditItemSchema.safeParse({
      ...base,
      selectedOptions: [
        "image-enhancement-re",
        "shadow-removal",
        "turn-on-lights-pe",
        "aerial-drop-pin-pe",
      ],
      aerialEditing: "drop-pin",
      aerialEditingInstructions: "Pin the main residence.",
    }).success,
    true,
  );
  assert.equal(
    PhotoEditItemSchema.safeParse({
      ...base,
      selectedOptions: ["image-enhancement-re", "aerial-full-markup-pe"],
      aerialEditing: "drop-pin",
    }).success,
    false,
  );
});

test("other dedicated photo-editing services remain pinned to one option", () => {
  assert.equal(
    PhotoEditItemSchema.safeParse({
      subService: "day-to-dusk",
      selectedOptions: ["day-to-dusk-pe", "shadow-removal"],
      duskStyle: "expert-decide",
      turnOnInteriorLights: false,
      turnOnExteriorLights: false,
      addPoolLights: false,
    }).success,
    false,
  );
});
