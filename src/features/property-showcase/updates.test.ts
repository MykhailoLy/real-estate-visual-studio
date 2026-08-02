import assert from "node:assert/strict";
import test from "node:test";
import { costaBlancaDemo } from "./registry.ts";
import { mergePropertyShowcaseUpdate } from "./updates.ts";
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
      interactiveUrl: "https://unbranded.visithome.ai/demo-plan",
      sortOrder: 1,
    },
  ];
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
  assert.equal(result.property?.price, "EUR 725,000");
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

test("editing agent data preserves CubiCasa interactiveUrl", () => {
  const existing = withExternalMedia();
  const incoming = cloneProperty();
  incoming.agent = {
    ...incoming.agent,
    agentName: "Updated Agent",
  };
  incoming.floorPlans = [
    {
      ...existing.floorPlans[0],
      interactiveUrl: undefined,
    },
  ];

  const result = mergePropertyShowcaseUpdate(existing, incoming, "details");

  assert.equal(result.ok, true);
  assert.equal(
    result.property?.floorPlans[0]?.interactiveUrl,
    "https://unbranded.visithome.ai/demo-plan",
  );
  assert.equal(result.property?.agent.agentName, "Updated Agent");
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
});

test("replacing a normal floor plan preserves its interactiveUrl", () => {
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
        interactiveUrl: undefined,
      },
    ],
  };

  const result = mergePropertyShowcaseUpdate(existing, incoming, "media");

  assert.equal(result.ok, true);
  assert.equal(
    result.property?.floorPlans[0]?.interactiveUrl,
    "https://unbranded.visithome.ai/demo-plan",
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
