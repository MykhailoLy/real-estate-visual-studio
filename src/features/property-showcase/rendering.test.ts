import assert from "node:assert/strict";
import test from "node:test";
import { costaBlancaDemo } from "./registry.ts";
import {
  getExternalInteractiveFloorPlan,
  getLegacyInteractiveTourCandidates,
  getPropertyLevelInteractiveFloorPlanTour,
  getVisibleVirtualTour,
  hasExternalInteractiveFloorPlan,
  promoteLegacyInteractiveTour,
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

test("one unique legacy CubiCasa tour can be promoted only by explicit action", () => {
  const property = cloneProperty();
  property.interactiveFloorPlanTour = undefined;
  property.floorPlans = [
    {
      ...property.floorPlans[0],
      interactiveProvider: "cubiCasa",
      interactiveExternalUrl: "https://unbranded.visithome.ai/legacy-tour",
      interactiveEmbedUrl: undefined,
    },
    {
      ...property.floorPlans[1],
      interactiveProvider: "cubiCasa",
      interactiveExternalUrl: "https://unbranded.visithome.ai/legacy-tour",
    },
  ];

  const candidates = getLegacyInteractiveTourCandidates(property);
  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0].planIds, ["main-floor", "first-floor"]);
  assert.equal(property.interactiveFloorPlanTour, undefined);

  const promoted = promoteLegacyInteractiveTour(property);
  assert.equal(
    promoted?.interactiveFloorPlanTour?.externalUrl,
    "https://unbranded.visithome.ai/legacy-tour",
  );
});

test("conflicting legacy tours require an explicit administrator selection", () => {
  const property = cloneProperty();
  property.interactiveFloorPlanTour = undefined;
  property.floorPlans = [
    {
      ...property.floorPlans[0],
      interactiveProvider: "cubiCasa",
      interactiveExternalUrl: "https://unbranded.visithome.ai/tour-a",
    },
    {
      ...property.floorPlans[1],
      interactiveProvider: "cubiCasa",
      interactiveExternalUrl: "https://unbranded.visithome.ai/tour-b",
    },
  ];

  const candidates = getLegacyInteractiveTourCandidates(property);
  assert.equal(candidates.length, 2);
  assert.equal(promoteLegacyInteractiveTour(property), null);
  assert.equal(
    promoteLegacyInteractiveTour(property, candidates[1].id)
      ?.interactiveFloorPlanTour?.externalUrl,
    "https://unbranded.visithome.ai/tour-b",
  );
});

test("property-level interactive tour remains preferred over legacy metadata", () => {
  const property = cloneProperty();
  property.interactiveFloorPlanTour = {
    enabled: true,
    provider: "cubiCasa",
    externalUrl: "https://unbranded.visithome.ai/property-level",
  };
  property.floorPlans[0].interactiveExternalUrl =
    "https://unbranded.visithome.ai/legacy";

  assert.equal(
    getPropertyLevelInteractiveFloorPlanTour(property)?.externalUrl,
    "https://unbranded.visithome.ai/property-level",
  );
  assert.equal(
    promoteLegacyInteractiveTour(property)?.interactiveFloorPlanTour?.externalUrl,
    "https://unbranded.visithome.ai/property-level",
  );
});

test("explicit interactive disable suppresses every legacy fallback", () => {
  const property = cloneProperty();
  property.interactiveFloorPlanTour = {
    enabled: false,
    provider: "cubiCasa",
    externalUrl: "https://unbranded.visithome.ai/preserved-property-level",
  };
  property.floorPlans[0].interactiveProvider = "cubiCasa";
  property.floorPlans[0].interactiveExternalUrl =
    "https://unbranded.visithome.ai/legacy-fallback";

  assert.equal(getPropertyLevelInteractiveFloorPlanTour(property), undefined);
  assert.equal(hasExternalInteractiveFloorPlan(property), false);
  assert.equal(shouldRenderInteractiveFloorPlan(property), false);
  assert.equal(promoteLegacyInteractiveTour(property), null);
  assert.equal(
    property.interactiveFloorPlanTour.externalUrl,
    "https://unbranded.visithome.ai/preserved-property-level",
  );
});

test("interactive tour returns after re-enabling without replacing URLs", () => {
  const property = cloneProperty();
  property.interactiveFloorPlanTour = {
    enabled: false,
    provider: "cubiCasa",
    externalUrl: "https://unbranded.visithome.ai/preserved-tour",
  };

  assert.equal(shouldRenderInteractiveFloorPlan(property), false);
  property.interactiveFloorPlanTour.enabled = true;
  assert.equal(shouldRenderInteractiveFloorPlan(property), true);
  assert.equal(
    getPropertyLevelInteractiveFloorPlanTour(property)?.externalUrl,
    "https://unbranded.visithome.ai/preserved-tour",
  );
});

test("360 visibility defaults on for legacy URLs and honors explicit disable", () => {
  const property = cloneProperty();
  assert.equal(getVisibleVirtualTour(property)?.provider, "kuula");

  property.virtualTour = {
    ...property.virtualTour!,
    enabled: false,
  };
  assert.equal(getVisibleVirtualTour(property), undefined);
  assert.equal(
    property.virtualTour.externalUrl,
    "https://mls.kuu.la/share/abc",
  );

  property.virtualTour.enabled = true;
  assert.equal(getVisibleVirtualTour(property)?.provider, "kuula");
});
