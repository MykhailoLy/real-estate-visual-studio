import assert from "node:assert/strict";
import test from "node:test";
import { costaBlancaDemo } from "./registry.ts";
import {
  immutablePropertySlugError,
  mergePropertyShowcaseUpdate,
} from "./updates.ts";
import type { PropertyShowcase } from "./types.ts";

function cloneProperty(): PropertyShowcase {
  return structuredClone(costaBlancaDemo);
}

function withExternalMedia(): PropertyShowcase {
  const property = cloneProperty();
  property.coverImage =
    "https://grvltquwenaorucsvooc.supabase.co/storage/v1/object/public/site-media/property-showcases/altea/cover.webp";
  property.gallery = [
    {
      id: "gallery-1",
      src: property.coverImage,
      alt: { en: "Cover" },
      label: { en: "Cover" },
      sortOrder: 1,
    },
    {
      id: "gallery-2",
      src: "https://grvltquwenaorucsvooc.supabase.co/storage/v1/object/public/site-media/property-showcases/altea/kitchen.webp",
      alt: { en: "Kitchen" },
      label: { en: "Kitchen" },
      sortOrder: 2,
    },
  ];
  property.virtualTour = {
    provider: "kuula",
    embedUrl: "https://kuula.co/share/abc",
    externalUrl: "https://mls.kuu.la/share/abc",
    posterImage: property.coverImage,
  };
  property.floorPlans = [
    {
      id: "main-floor",
      title: { en: "Main floor" },
      imageUrl:
        "https://grvltquwenaorucsvooc.supabase.co/storage/v1/object/public/site-media/property-showcases/altea/floor.webp",
      downloadUrl:
        "https://grvltquwenaorucsvooc.supabase.co/storage/v1/object/public/site-media/property-showcases/altea/floor-download.webp",
      interactiveProvider: "cubiCasa",
      interactiveExternalUrl: "https://unbranded.visithome.ai/demo-plan",
      interactiveEmbedUrl:
        "https://unbranded.visithome.ai/demo-plan?mode=embed",
      sortOrder: 1,
    },
  ];
  property.interactiveFloorPlanTour = {
    enabled: true,
    provider: "cubiCasa",
    externalUrl: "https://unbranded.visithome.ai/demo-plan",
    embedUrl: "https://unbranded.visithome.ai/demo-plan?mode=embed",
    posterImage:
      "https://grvltquwenaorucsvooc.supabase.co/storage/v1/object/public/site-media/property-showcases/altea/floor.webp",
  };
  return property;
}

test("editing price preserves gallery", () => {
  const existing = withExternalMedia();
  const incoming = cloneProperty();
  incoming.price = "EUR 725,000";
  incoming.gallery = [];

  const result = mergePropertyShowcaseUpdate(existing, incoming, "details");

  assert.equal(result.ok, true);
  assert.deepEqual(result.property?.gallery, existing.gallery);
  assert.equal(result.property?.virtualTour?.provider, "kuula");
  assert.equal(
    result.property?.floorPlans[0]?.interactiveExternalUrl,
    "https://unbranded.visithome.ai/demo-plan",
  );
  assert.equal(
    result.property?.interactiveFloorPlanTour?.externalUrl,
    "https://unbranded.visithome.ai/demo-plan",
  );
  assert.equal(result.property?.price, "EUR 725,000");
});

test("slug changes after creation are rejected", () => {
  const existing = withExternalMedia();
  const incoming = {
    ...existing,
    slug: "new-altea-slug",
  };

  assert.equal(
    immutablePropertySlugError(existing, incoming),
    "Property slug cannot be changed after creation.",
  );
});

test("editing description preserves floor plans", () => {
  const existing = withExternalMedia();
  const incoming = cloneProperty();
  incoming.description = [{ en: "Updated description." }];
  incoming.floorPlans = [];

  const result = mergePropertyShowcaseUpdate(existing, incoming, "details");

  assert.equal(result.ok, true);
  assert.deepEqual(result.property?.floorPlans, existing.floorPlans);
  assert.equal(result.property?.description[0]?.en, "Updated description.");
});

test("editing agent data preserves CubiCasa interactive URLs", () => {
  const existing = withExternalMedia();
  const incoming = cloneProperty();
  incoming.agent = {
    ...incoming.agent,
    agentName: "Updated Agent",
  };
  incoming.floorPlans = [
    {
      ...existing.floorPlans[0],
      interactiveProvider: undefined,
      interactiveExternalUrl: undefined,
      interactiveEmbedUrl: undefined,
    },
  ];

  const result = mergePropertyShowcaseUpdate(existing, incoming, "details");

  assert.equal(result.ok, true);
  assert.equal(
    result.property?.floorPlans[0]?.interactiveExternalUrl,
    "https://unbranded.visithome.ai/demo-plan",
  );
  assert.equal(
    result.property?.floorPlans[0]?.interactiveEmbedUrl,
    "https://unbranded.visithome.ai/demo-plan?mode=embed",
  );
  assert.equal(result.property?.agent.agentName, "Updated Agent");
});

test("explicitly removing Kuula clears the virtual tour", () => {
  const existing = withExternalMedia();
  const incoming = cloneProperty();
  incoming.virtualTour = undefined;

  const result = mergePropertyShowcaseUpdate(existing, incoming, "details", {
    removeVirtualTour: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.property?.virtualTour, undefined);
});

test("explicitly removing CubiCasa clears interactive floor plan URLs", () => {
  const existing = withExternalMedia();
  const incoming = cloneProperty();
  incoming.floorPlans = [
    {
      ...existing.floorPlans[0],
      interactiveProvider: undefined,
      interactiveExternalUrl: undefined,
      interactiveEmbedUrl: undefined,
      interactiveUrl: undefined,
    },
  ];

  const result = mergePropertyShowcaseUpdate(existing, incoming, "details", {
    removeInteractiveFloorPlan: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.property?.floorPlans[0]?.imageUrl, existing.floorPlans[0].imageUrl);
  assert.equal(result.property?.interactiveFloorPlanTour, undefined);
  assert.equal(result.property?.floorPlans[0]?.interactiveProvider, undefined);
  assert.equal(result.property?.floorPlans[0]?.interactiveExternalUrl, undefined);
  assert.equal(result.property?.floorPlans[0]?.interactiveEmbedUrl, undefined);
  assert.equal(result.property?.floorPlans[0]?.interactiveUrl, undefined);
});

test("explicitly removing ordinary floor plans leaves floorPlans empty", () => {
  const existing = withExternalMedia();
  const incoming = {
    ...existing,
    floorPlans: [],
  };

  const result = mergePropertyShowcaseUpdate(existing, incoming, "media", {
    removeFloorPlan: true,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.property?.floorPlans, []);
});

test("media sorting preserves Kuula settings", () => {
  const existing = withExternalMedia();
  const incoming = {
    ...existing,
    gallery: [...existing.gallery].reverse().map((image, index) => ({
      ...image,
      sortOrder: index + 1,
    })),
  };

  const result = mergePropertyShowcaseUpdate(existing, incoming, "media");

  assert.equal(result.ok, true);
  assert.equal(result.property?.virtualTour?.provider, "kuula");
  assert.equal(
    result.property?.virtualTour?.externalUrl,
    "https://mls.kuu.la/share/abc",
  );
});

test("replacing the cover preserves all other property data", () => {
  const existing = withExternalMedia();
  const incoming = {
    ...existing,
    coverImage:
      "https://grvltquwenaorucsvooc.supabase.co/storage/v1/object/public/site-media/property-showcases/altea/new-cover.webp",
  };

  const result = mergePropertyShowcaseUpdate(existing, incoming, "media");

  assert.equal(result.ok, true);
  assert.equal(result.property?.coverImage, incoming.coverImage);
  assert.deepEqual(result.property?.highlights, existing.highlights);
  assert.deepEqual(result.property?.location, existing.location);
  assert.deepEqual(result.property?.agent, existing.agent);
  assert.deepEqual(
    result.property?.interactiveFloorPlanTour,
    existing.interactiveFloorPlanTour,
  );
});

test("ordinary detail saves preserve property-level interactive floor plan tour", () => {
  const existing = withExternalMedia();
  const incoming = cloneProperty();
  incoming.agent = {
    ...incoming.agent,
    agentName: "Updated Agent",
  };
  incoming.interactiveFloorPlanTour = undefined;

  const result = mergePropertyShowcaseUpdate(existing, incoming, "details");

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.property?.interactiveFloorPlanTour,
    existing.interactiveFloorPlanTour,
  );
});

test("replacing a normal floor plan preserves its interactive URLs", () => {
  const existing = withExternalMedia();
  const incoming = {
    ...existing,
    floorPlans: [
      {
        ...existing.floorPlans[0],
        imageUrl:
          "https://grvltquwenaorucsvooc.supabase.co/storage/v1/object/public/site-media/property-showcases/altea/new-floor.webp",
        downloadUrl:
          "https://grvltquwenaorucsvooc.supabase.co/storage/v1/object/public/site-media/property-showcases/altea/new-floor.webp",
        interactiveProvider: undefined,
        interactiveExternalUrl: undefined,
        interactiveEmbedUrl: undefined,
      },
    ],
  };

  const result = mergePropertyShowcaseUpdate(existing, incoming, "media");

  assert.equal(result.ok, true);
  assert.equal(
    result.property?.floorPlans[0]?.interactiveExternalUrl,
    "https://unbranded.visithome.ai/demo-plan",
  );
  assert.equal(
    result.property?.floorPlans[0]?.interactiveEmbedUrl,
    "https://unbranded.visithome.ai/demo-plan?mode=embed",
  );
  assert.equal(result.property?.floorPlans[0]?.imageUrl, incoming.floorPlans[0].imageUrl);
});

test("saving partial floor plan media preserves omitted floor plans", () => {
  const existing = withExternalMedia();
  existing.floorPlans.push({
    id: "upper-floor",
    title: { en: "Upper floor" },
    imageUrl:
      "https://grvltquwenaorucsvooc.supabase.co/storage/v1/object/public/site-media/property-showcases/altea/upper-floor.webp",
    sortOrder: 2,
  });

  const incoming = {
    ...existing,
    floorPlans: [
      {
        ...existing.floorPlans[0],
        imageUrl:
          "https://grvltquwenaorucsvooc.supabase.co/storage/v1/object/public/site-media/property-showcases/altea/new-floor.webp",
      },
    ],
  };

  const result = mergePropertyShowcaseUpdate(existing, incoming, "media");

  assert.equal(result.ok, true);
  assert.equal(result.property?.floorPlans.length, 2);
  assert.equal(result.property?.floorPlans[1]?.id, "upper-floor");
});

test("adding a second plan with media replace does not replace the first", () => {
  const existing = withExternalMedia();
  const incoming = {
    ...existing,
    floorPlans: [
      existing.floorPlans[0],
      {
        id: "first-floor",
        title: { en: "First floor", es: "Primera planta" },
        imageUrl:
          "https://grvltquwenaorucsvooc.supabase.co/storage/v1/object/public/site-media/property-showcases/altea/first-floor.webp",
        downloadUrl:
          "https://grvltquwenaorucsvooc.supabase.co/storage/v1/object/public/site-media/property-showcases/altea/first-floor.webp",
        sortOrder: 2,
      },
    ],
  };

  const result = mergePropertyShowcaseUpdate(existing, incoming, "media", {
    replaceFloorPlans: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.property?.floorPlans.length, 2);
  assert.equal(result.property?.floorPlans[0]?.id, "main-floor");
  assert.equal(result.property?.floorPlans[1]?.id, "first-floor");
});

test("deleting one plan with media replace does not delete other plans", () => {
  const existing = withExternalMedia();
  existing.floorPlans.push({
    id: "first-floor",
    title: { en: "First floor" },
    imageUrl:
      "https://grvltquwenaorucsvooc.supabase.co/storage/v1/object/public/site-media/property-showcases/altea/first-floor.webp",
    sortOrder: 2,
  });

  const incoming = {
    ...existing,
    floorPlans: [existing.floorPlans[1]],
  };

  const result = mergePropertyShowcaseUpdate(existing, incoming, "media", {
    replaceFloorPlans: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.property?.floorPlans.length, 1);
  assert.equal(result.property?.floorPlans[0]?.id, "first-floor");
});

test("sorting plans preserves titles and interactive metadata", () => {
  const existing = withExternalMedia();
  existing.floorPlans.push({
    id: "first-floor",
    title: { en: "First floor", es: "Primera planta" },
    imageUrl:
      "https://grvltquwenaorucsvooc.supabase.co/storage/v1/object/public/site-media/property-showcases/altea/first-floor.webp",
    sortOrder: 2,
  });

  const incoming = {
    ...existing,
    floorPlans: [existing.floorPlans[1], existing.floorPlans[0]],
  };

  const result = mergePropertyShowcaseUpdate(existing, incoming, "media", {
    replaceFloorPlans: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.property?.floorPlans[0]?.id, "first-floor");
  assert.equal(result.property?.floorPlans[0]?.sortOrder, 1);
  assert.equal(result.property?.floorPlans[1]?.id, "main-floor");
  assert.equal(
    result.property?.floorPlans[1]?.interactiveExternalUrl,
    "https://unbranded.visithome.ai/demo-plan",
  );
});

test("virtual tour changes do not remove floor plans", () => {
  const existing = withExternalMedia();
  const incoming = {
    ...existing,
    virtualTour: {
      provider: "kuula" as const,
      embedUrl: "https://kuula.co/share/new-tour",
      externalUrl: "https://mls.kuu.la/share/new-tour",
    },
    floorPlans: [],
  };

  const result = mergePropertyShowcaseUpdate(existing, incoming, "details");

  assert.equal(result.ok, true);
  assert.deepEqual(result.property?.floorPlans, existing.floorPlans);
  assert.equal(
    result.property?.virtualTour?.externalUrl,
    "https://mls.kuu.la/share/new-tour",
  );
});

test("floor plan media changes do not remove Kuula", () => {
  const existing = withExternalMedia();
  const incoming = {
    ...existing,
    floorPlans: [
      {
        ...existing.floorPlans[0],
        imageUrl:
          "https://grvltquwenaorucsvooc.supabase.co/storage/v1/object/public/site-media/property-showcases/altea/replaced-floor.webp",
      },
    ],
  };

  const result = mergePropertyShowcaseUpdate(existing, incoming, "media", {
    replaceFloorPlans: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.property?.virtualTour?.provider, "kuula");
  assert.equal(result.property?.floorPlans[0]?.imageUrl, incoming.floorPlans[0].imageUrl);
});

test("saving media does not remove highlights, location or agent data", () => {
  const existing = withExternalMedia();
  const incoming = {
    ...existing,
    gallery: [existing.gallery[1], existing.gallery[0]].map((image, index) => ({
      ...image,
      sortOrder: index + 1,
    })),
  };

  const result = mergePropertyShowcaseUpdate(existing, incoming, "media");

  assert.equal(result.ok, true);
  assert.deepEqual(result.property?.highlights, existing.highlights);
  assert.deepEqual(result.property?.location, existing.location);
  assert.deepEqual(result.property?.agent, existing.agent);
});
