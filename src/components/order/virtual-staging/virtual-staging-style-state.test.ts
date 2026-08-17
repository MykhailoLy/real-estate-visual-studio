import assert from "node:assert/strict";
import test from "node:test";
import {
  STAGING_ADDONS,
  STAGING_STYLE_CARDS,
  VIRTUAL_STAGING_MEDIA_KEYS,
} from "../../../data/order-options.ts";
import {
  applyFurnitureStyleToAll,
  applyIndividualFurnitureStyle,
  countIndividualFurnitureStyles,
  deriveVirtualStagingDefaultFurnitureStyle,
  hasExampleMedia,
  inheritFurnitureStyle,
  requestGlobalFurnitureStyleChange,
  resolveFurnitureStyleThumbnail,
} from "./virtual-staging-style-state.ts";

function item(
  furnitureStyle: string,
  id: string,
  selectedAddons: string[] = [],
) {
  return {
    id,
    furnitureStyle,
    file: { name: `${id}.jpg` },
    roomName: "Living Room",
    selectedAddons,
    referenceLink: `https://example.com/${id}`,
  };
}

test("global style selection updates every current image and nothing else", () => {
  const original = [
    item("Modern", "one", ["day-to-dusk"]),
    item("Scandinavian", "two", ["turn-on-lights"]),
  ];
  const result = applyFurnitureStyleToAll(original, "Traditional");

  assert.deepEqual(
    result.map((entry) => entry.furnitureStyle),
    ["Traditional", "Traditional"],
  );
  assert.equal(result[0]?.file, original[0]?.file);
  assert.equal(result[0]?.selectedAddons, original[0]?.selectedAddons);
  assert.equal(result[1]?.referenceLink, original[1]?.referenceLink);
});

test("a new image inherits the current global style", () => {
  const fresh = inheritFurnitureStyle(item("", "new"), "Hamptons");
  assert.equal(fresh.furnitureStyle, "Hamptons");
  assert.equal(fresh.file.name, "new.jpg");
});

test("per-image selection changes only that image", () => {
  const original = [item("Modern", "one"), item("Modern", "two")];
  const result = applyIndividualFurnitureStyle(
    original,
    1,
    "Mid-Century Modern",
  );
  assert.equal(result[0], original[0]);
  assert.equal(result[0]?.furnitureStyle, "Modern");
  assert.equal(result[1]?.furnitureStyle, "Mid-Century Modern");
});

test("per-image override leaves the separately tracked global style unchanged", () => {
  const globalStyle = "Modern";
  const result = applyIndividualFurnitureStyle(
    [item(globalStyle, "one"), item(globalStyle, "two")],
    0,
    "Farmhouse",
  );
  assert.equal(globalStyle, "Modern");
  assert.equal(countIndividualFurnitureStyles(result, globalStyle), 1);
});

test("selecting a different global style requests confirmation for overrides", () => {
  const request = requestGlobalFurnitureStyleChange(
    [item("Farmhouse", "one"), item("Modern", "two")],
    "Modern",
    "Traditional",
  );
  assert.deepEqual(request, { kind: "confirm", overrideCount: 1 });
});

test("cancelling a requested replacement preserves all styles", () => {
  const original = [item("Farmhouse", "one"), item("Modern", "two")];
  const request = requestGlobalFurnitureStyleChange(
    original,
    "Modern",
    "Traditional",
  );
  assert.equal(request.kind, "confirm");
  const afterCancel = original;
  assert.deepEqual(
    afterCancel.map((entry) => entry.furnitureStyle),
    ["Farmhouse", "Modern"],
  );
});

test("Apply to All replaces every individual override", () => {
  const result = applyFurnitureStyleToAll(
    [item("Farmhouse", "one"), item("Modern", "two")],
    "Traditional",
  );
  assert.equal(countIndividualFurnitureStyles(result, "Traditional"), 0);
});

test("a different global style applies immediately when no overrides exist", () => {
  assert.deepEqual(
    requestGlobalFurnitureStyleChange(
      [item("Modern", "one"), item("Modern", "two")],
      "Modern",
      "Scandinavian",
    ),
    { kind: "apply", overrideCount: 0 },
  );
});

test("legacy defaults derive from the first valid item style", () => {
  assert.equal(
    deriveVirtualStagingDefaultFurnitureStyle(undefined, [
      item("not-a-style", "one"),
      item("Contemporary", "two"),
    ]),
    "Contemporary",
  );
  assert.equal(
    deriveVirtualStagingDefaultFurnitureStyle(undefined, [item("", "one")]),
    "",
  );
});

test("admin thumbnail precedence is After, single Image, then static fallback", () => {
  assert.equal(
    resolveFurnitureStyleThumbnail(
      { afterUrl: "after.jpg", imageUrl: "single.jpg" },
      "static.jpg",
    ),
    "after.jpg",
  );
  assert.equal(
    resolveFurnitureStyleThumbnail({ imageUrl: "single.jpg" }, "static.jpg"),
    "single.jpg",
  );
  assert.equal(resolveFurnitureStyleThumbnail(null, "static.jpg"), "static.jpg");
});

test("missing admin media remains a safe non-preview state", () => {
  assert.equal(hasExampleMedia(undefined), false);
  assert.equal(hasExampleMedia({ imageUrl: null, beforeUrl: null, afterUrl: null }), false);
  assert.equal(hasExampleMedia({ beforeUrl: "before.jpg" }), true);
});

test("all Virtual Staging media keys are stable and unique", () => {
  assert.equal(VIRTUAL_STAGING_MEDIA_KEYS.length, 15);
  assert.equal(new Set(VIRTUAL_STAGING_MEDIA_KEYS).size, 15);
  assert.deepEqual(VIRTUAL_STAGING_MEDIA_KEYS, [
    "virtual-staging-style-modern",
    "virtual-staging-style-urban-industrial",
    "virtual-staging-style-scandinavian",
    "virtual-staging-style-mid-century-modern",
    "virtual-staging-style-farmhouse",
    "virtual-staging-style-hamptons",
    "virtual-staging-style-contemporary",
    "virtual-staging-style-traditional",
    "virtual-staging-style-commercial-office",
    "virtual-staging-style-commercial-non-office",
    "virtual-staging-addon-image-enhancement",
    "virtual-staging-addon-day-to-dusk",
    "virtual-staging-addon-item-removal",
    "virtual-staging-addon-turn-on-lights",
    "virtual-staging-addon-colour-change",
  ]);
  assert.ok(STAGING_STYLE_CARDS.every((style) => style.description.length > 0));
  assert.ok(STAGING_ADDONS.every((addon) => addon.description.length > 0));
});

test("canonical add-on pricing keys remain unchanged", () => {
  assert.deepEqual(
    STAGING_ADDONS.map((addon) => [addon.id, addon.priceKey]),
    [
      ["image-enhancement", "image-enhancement"],
      ["day-to-dusk", "day-to-dusk"],
      ["item-removal", "item-removal-virtual-cleaning"],
      ["turn-on-lights", "turn-on-lights"],
      ["colour-change", "colour-change"],
    ],
  );
});
