import assert from "node:assert/strict";
import test from "node:test";
import { getCatalogPrice } from "../../../lib/pricing/catalog.ts";
import { formatMoney } from "../../../lib/pricing/format.ts";
import { buildVirtualStagingReviewRows } from "./virtual-staging-review.ts";

const baseItem = {
  roomName: "Living Room - With TV",
  furnitureStyle: "Modern",
  fileSizeLimit: "MLS",
  disclaimerText: "Keep the city view visible.",
  referenceLink: "https://example.com/inspiration/modern-living-room",
  additionalInfo: "Match the existing window treatments.",
  selectedAddons: ["image-enhancement", "shadow-removal", "turn-on-lights"],
};

test("review mapping keeps all Virtual Staging image choices readable", () => {
  const rows = buildVirtualStagingReviewRows(baseItem, "USD");
  const values = Object.fromEntries(rows.map((row) => [row.label, row.value]));

  assert.equal(values["Room Name / Area"], "Living Room - With TV");
  assert.equal(values["Furniture Style"], "Modern");
  assert.equal(values["File Size Limit"], "MLS");
  assert.equal(values["Disclaimer Text"], "Keep the city view visible.");
  assert.equal(
    values["Reference Link"],
    "https://example.com/inspiration/modern-living-room",
  );
  assert.equal(
    values["Additional Information"],
    "Match the existing window treatments.",
  );
  assert.equal(
    values["Selected Add-ons"],
    [
      `Image Enhancement (${formatMoney(
        getCatalogPrice("image-enhancement", "USD"),
        "USD",
      )})`,
      `Shadow Removal (${formatMoney(
        getCatalogPrice("shadow-removal", "USD"),
        "USD",
      )})`,
      `Turn On Lights (${formatMoney(
        getCatalogPrice("turn-on-lights", "USD"),
        "USD",
      )})`,
    ].join(", "),
  );
});

test("review mapping keeps multiple images independent and uses explicit empty values", () => {
  const first = buildVirtualStagingReviewRows(baseItem, "USD");
  const second = buildVirtualStagingReviewRows(
    {
      ...baseItem,
      roomName: "Bedroom 2",
      furnitureStyle: "Scandinavian",
      fileSizeLimit: "",
      disclaimerText: "",
      referenceLink: "",
      additionalInfo: "",
      selectedAddons: [],
    },
    "USD",
  );

  assert.equal(first[0]?.value, "Living Room - With TV");
  assert.equal(second[0]?.value, "Bedroom 2");
  assert.equal(second[1]?.value, "Scandinavian");
  assert.equal(second[2]?.value, "Not specified");
  assert.equal(second[3]?.value, "None");
  assert.equal(second[4]?.value, "None");
  assert.equal(second[5]?.value, "None");
  assert.equal(second[6]?.value, "None");
});
