import assert from "node:assert/strict";
import test from "node:test";
import { getCatalogPrice } from "../../../lib/pricing/catalog.ts";
import { formatMoney } from "../../../lib/pricing/format.ts";
import { buildVirtualRenovationReviewRows } from "./virtual-renovation-review.ts";

const baseItem = {
  selectedInternal: ["replace-flooring", "add-remove-walls"],
  selectedExternal: ["add-pool"],
  room: "Living Room",
  presentationStyle: "Modern",
  fileSizeLimit: "MLS",
  disclaimerText: "Concept visualisation only.",
  referenceLink: "https://example.com/reference",
  additionalInfo: "Use warm timber finishes.",
};

test("review rows preserve every customer-facing Renovation choice", () => {
  const rows = buildVirtualRenovationReviewRows(baseItem, "USD");
  const values = Object.fromEntries(rows.map((row) => [row.label, row.value]));
  assert.equal(
    values["Internal Renovations"],
    [
      `Replace Flooring (${formatMoney(
        getCatalogPrice("renovation-replace-flooring", "USD"),
        "USD",
      )})`,
      `Add / Remove Walls (${formatMoney(
        getCatalogPrice("renovation-add-remove-walls", "USD"),
        "USD",
      )})`,
    ].join(", "),
  );
  assert.equal(
    values["External Renovations"],
    `Add Pool Only (${formatMoney(
      getCatalogPrice("renovation-add-pool", "USD"),
      "USD",
    )})`,
  );
  assert.equal(values["Room / Area"], "Living Room");
  assert.equal(values["Presentation Style"], "Modern");
  assert.equal(values["File Size Limit"], "MLS");
  assert.equal(values["Disclaimer Text"], "Concept visualisation only.");
  assert.equal(values["Reference Link"], "https://example.com/reference");
  assert.equal(values["Additional Information"], "Use warm timber finishes.");
});

test("review rows use explicit empty-state labels", () => {
  const rows = buildVirtualRenovationReviewRows(
    {
      ...baseItem,
      selectedInternal: [],
      selectedExternal: [],
      presentationStyle: "",
      fileSizeLimit: "",
      disclaimerText: "",
      referenceLink: "",
      additionalInfo: "",
    },
    "EUR",
  );
  const values = Object.fromEntries(rows.map((row) => [row.label, row.value]));
  assert.equal(values["Internal Renovations"], "None");
  assert.equal(values["External Renovations"], "None");
  assert.equal(values["Presentation Style"], "None");
  assert.equal(values["File Size Limit"], "Not specified");
  assert.equal(values["Disclaimer Text"], "None");
  assert.equal(values["Reference Link"], "None");
  assert.equal(values["Additional Information"], "None");
});
