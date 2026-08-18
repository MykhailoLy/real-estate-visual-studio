import assert from "node:assert/strict";
import test from "node:test";
import { buildSingleExposureReviewRows } from "./single-exposure-review.ts";

const item = {
  fileSizeLimit: "MLS",
  disclaimerText: "Dimensions are approximate.",
  additionalInfo: "Keep the window view.",
  grassRepair: "yes",
  skyReplacement: "yes",
  tvScreenReplacement: "no",
  addFireToFireplace: "expert-decide",
  daySkyStyle: "deep-blue",
  selectedAddons: ["shadow-removal", "turn-on-lights-pe"],
  aerialEditing: "drop-pin",
  aerialEditingInstructions: "Pin the front building.",
};

test("review shows every active preference, add-on, aerial choice and reference", () => {
  const rows = buildSingleExposureReviewRows(item, "CAD", true);
  const values = Object.fromEntries(rows.map((row) => [row.label, row.value]));
  assert.equal(values["Sky Replacement"], "Yes");
  assert.equal(values["Day Sky Style"], "Deep Blue Sky");
  assert.match(values["Selected Add-ons"] ?? "", /Shadow Removal/);
  assert.match(values["Selected Add-ons"] ?? "", /CA\$10\.00/);
  assert.match(values["Aerial Editing"] ?? "", /Aerial Drop Pin/);
  assert.equal(values["Aerial Reference Image"], "Included");
  assert.equal(values["Additional Instructions"], "Keep the window view.");
});

test("hidden day-sky value is absent from review while Sky Replacement is No", () => {
  const rows = buildSingleExposureReviewRows(
    { ...item, skyReplacement: "no", daySkyStyle: "deep-blue" },
    "USD",
    false,
  );
  assert.equal(rows.find((row) => row.label === "Sky Replacement")?.value, "No");
  assert.equal(rows.some((row) => row.label === "Day Sky Style"), false);
});

test("multiple photos retain independent add-on and aerial review values", () => {
  const first = buildSingleExposureReviewRows(item, "USD", true);
  const second = buildSingleExposureReviewRows(
    {
      ...item,
      selectedAddons: ["colour-change-pe"],
      aerialEditing: "none",
      aerialEditingInstructions: "",
    },
    "USD",
    false,
  );
  assert.match(
    first.find((row) => row.label === "Selected Add-ons")?.value ?? "",
    /Shadow Removal/,
  );
  assert.equal(
    second.find((row) => row.label === "Aerial Editing")?.value,
    "No Aerial Editing",
  );
});
