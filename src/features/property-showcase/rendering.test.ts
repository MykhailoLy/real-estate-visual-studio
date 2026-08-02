import assert from "node:assert/strict";
import test from "node:test";
import { costaBlancaDemo } from "./registry.ts";
import { shouldRenderInteractiveFloorPlan } from "./rendering.ts";
import type { PropertyShowcase } from "./types.ts";

function cloneProperty(): PropertyShowcase {
  return structuredClone(costaBlancaDemo);
}

test("external CubiCasa floor plan renders without native roomId mappings", () => {
  const property = cloneProperty();
  property.gallery = property.gallery.map((image) => ({
    ...image,
    roomId: undefined,
    hotspot: undefined,
  }));
  property.floorPlans = [
    {
      ...property.floorPlans[0],
      interactiveProvider: "cubiCasa",
      interactiveExternalUrl: "https://unbranded.visithome.ai/demo-plan",
    },
  ];

  assert.equal(shouldRenderInteractiveFloorPlan(property), true);
});

test("native interactive plan does not render without roomId or external URL", () => {
  const property = cloneProperty();
  property.gallery = property.gallery.map((image) => ({
    ...image,
    roomId: undefined,
    hotspot: undefined,
  }));
  property.floorPlans = [
    {
      ...property.floorPlans[0],
      interactiveProvider: undefined,
      interactiveExternalUrl: undefined,
      interactiveEmbedUrl: undefined,
      interactiveUrl: undefined,
    },
  ];

  assert.equal(shouldRenderInteractiveFloorPlan(property), false);
});
