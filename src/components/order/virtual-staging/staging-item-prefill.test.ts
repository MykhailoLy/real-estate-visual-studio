import assert from "node:assert/strict";
import test from "node:test";
import {
  applyVirtualStagingInitialAddOns,
  normalizeVirtualStagingAddOnIds,
} from "./staging-item-prefill.ts";

function item(selectedAddons: string[] = []) {
  return {
    clientItemId: "item-1",
    selectedAddons,
    roomName: "",
  };
}

test("valid initial add-on is applied to a fresh item", () => {
  assert.deepEqual(
    applyVirtualStagingInitialAddOns(item(), ["image-enhancement"])
      .selectedAddons,
    ["image-enhancement"],
  );
});

test("invalid add-on is ignored", () => {
  assert.deepEqual(
    applyVirtualStagingInitialAddOns(item(), ["unknown"]).selectedAddons,
    [],
  );
});

test("duplicates are removed", () => {
  assert.deepEqual(
    applyVirtualStagingInitialAddOns(item(["image-enhancement"]), [
      "image-enhancement",
    ]).selectedAddons,
    ["image-enhancement"],
  );
});

test("existing item data is not mutated", () => {
  const existing = item(["day-to-dusk"]);
  const updated = applyVirtualStagingInitialAddOns(existing, [
    "image-enhancement",
  ]);

  assert.notEqual(updated, existing);
  assert.deepEqual(existing.selectedAddons, ["day-to-dusk"]);
  assert.deepEqual(updated.selectedAddons, [
    "day-to-dusk",
    "image-enhancement",
  ]);
});

test("a new item can inherit the recommended add-on", () => {
  const recommendedAddOnIds = ["image-enhancement"];

  assert.deepEqual(
    applyVirtualStagingInitialAddOns(item(), recommendedAddOnIds).selectedAddons,
    ["image-enhancement"],
  );
});

test("an item from a restored draft is left unchanged unless helper is applied", () => {
  const restored = item(["turn-on-lights"]);

  assert.deepEqual(restored.selectedAddons, ["turn-on-lights"]);
  assert.deepEqual(normalizeVirtualStagingAddOnIds(restored.selectedAddons), [
    "turn-on-lights",
  ]);
});
