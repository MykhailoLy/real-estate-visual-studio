import assert from "node:assert/strict";
import test from "node:test";
import { costaBlancaDemo } from "./registry.ts";
import {
  getExternalInteractiveFloorPlan,
  shouldRenderInteractiveFloorPlan,
} from "./rendering.ts";
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

test("external interactive plan can belong to a non-primary floor plan", () => {
  const property = cloneProperty();
  property.floorPlans = [
    {
      ...property.floorPlans[0],
      id: "ground-floor",
      interactiveProvider: undefined,
      interactiveExternalUrl: undefined,
      interactiveEmbedUrl: undefined,
      interactiveUrl: undefined,
      sortOrder: 1,
    },
    {
      ...property.floorPlans[0],
      id: "first-floor",
      title: { en: "First floor" },
      interactiveProvider: "cubiCasa",
      interactiveExternalUrl: "https://unbranded.visithome.ai/first-floor",
      sortOrder: 2,
    },
  ];

  assert.equal(getExternalInteractiveFloorPlan(property)?.id, "first-floor");
  assert.equal(shouldRenderInteractiveFloorPlan(property), true);
});

test("property-level interactive floor plan renders without ordinary floor plans", () => {
  const property = cloneProperty();
  property.floorPlans = [];
  property.gallery = property.gallery.map((image) => ({
    ...image,
    roomId: undefined,
    hotspot: undefined,
  }));
  property.interactiveFloorPlanTour = {
    enabled: true,
    provider: "cubiCasa",
    externalUrl: "https://unbranded.visithome.ai/property-plan",
  };

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
  property.interactiveFloorPlanTour = undefined;

  assert.equal(shouldRenderInteractiveFloorPlan(property), false);
});
