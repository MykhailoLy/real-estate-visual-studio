import assert from "node:assert/strict";
import test from "node:test";
import { costaBlancaDemo } from "./registry.ts";
import {
  immutablePropertyPrimaryLanguageError,
  immutablePropertySlugError,
  mergePropertyShowcaseUpdate,
} from "./updates.ts";
import { isSafeApproximateMapCenter } from "./map-location.ts";
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

test("primary language changes after creation are rejected", () => {
  const existing = withExternalMedia();
  const incoming = {
    ...existing,
    primaryLanguage: "es" as const,
  };

  assert.equal(
    immutablePropertyPrimaryLanguageError(existing, incoming),
    "Primary content language cannot be changed after creation.",
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

test("explicitly removing the interactive poster clears only poster media", () => {
  const existing = withExternalMedia();
  const incoming = {
    ...existing,
    interactiveFloorPlanTour: {
      ...existing.interactiveFloorPlanTour!,
      posterImage: "",
    },
  };

  const result = mergePropertyShowcaseUpdate(existing, incoming, "media", {
    removeInteractivePoster: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.property?.interactiveFloorPlanTour?.posterImage, undefined);
  assert.equal(
    result.property?.interactiveFloorPlanTour?.externalUrl,
    existing.interactiveFloorPlanTour?.externalUrl,
  );
  assert.deepEqual(result.property?.gallery, existing.gallery);
  assert.deepEqual(result.property?.floorPlans, existing.floorPlans);
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

test("details saves preserve 360 URLs while visibility is disabled and restored", () => {
  const existing = withExternalMedia();
  const disabled = structuredClone(existing);
  disabled.virtualTour = {
    ...existing.virtualTour!,
    enabled: false,
  };

  const disabledResult = mergePropertyShowcaseUpdate(
    existing,
    disabled,
    "details",
  );
  assert.equal(disabledResult.ok, true);
  assert.equal(disabledResult.property?.virtualTour?.enabled, false);
  assert.equal(
    disabledResult.property?.virtualTour?.externalUrl,
    existing.virtualTour?.externalUrl,
  );

  const reenabled = structuredClone(disabledResult.property!);
  reenabled.virtualTour!.enabled = true;
  const reenabledResult = mergePropertyShowcaseUpdate(
    disabledResult.property!,
    reenabled,
    "details",
  );
  assert.equal(reenabledResult.property?.virtualTour?.enabled, true);
  assert.equal(
    reenabledResult.property?.virtualTour?.externalUrl,
    existing.virtualTour?.externalUrl,
  );
});

test("details saves preserve interactive URLs across disable and re-enable", () => {
  const existing = withExternalMedia();
  const disabled = structuredClone(existing);
  disabled.interactiveFloorPlanTour = {
    ...existing.interactiveFloorPlanTour!,
    enabled: false,
  };

  const disabledResult = mergePropertyShowcaseUpdate(
    existing,
    disabled,
    "details",
  );
  assert.equal(disabledResult.ok, true);
  assert.equal(disabledResult.property?.interactiveFloorPlanTour?.enabled, false);
  assert.equal(
    disabledResult.property?.interactiveFloorPlanTour?.externalUrl,
    existing.interactiveFloorPlanTour?.externalUrl,
  );

  const reenabled = structuredClone(disabledResult.property!);
  reenabled.interactiveFloorPlanTour!.enabled = true;
  const reenabledResult = mergePropertyShowcaseUpdate(
    disabledResult.property!,
    reenabled,
    "details",
  );
  assert.equal(reenabledResult.property?.interactiveFloorPlanTour?.enabled, true);
  assert.equal(
    reenabledResult.property?.interactiveFloorPlanTour?.externalUrl,
    existing.interactiveFloorPlanTour?.externalUrl,
  );
});

test("media saves do not duplicate property-level CubiCasa data onto ordinary plans", () => {
  const existing = withExternalMedia();
  existing.floorPlans = existing.floorPlans.map((plan) => ({
    id: plan.id,
    title: plan.title,
    imageUrl: plan.imageUrl,
    downloadUrl: plan.downloadUrl,
    sortOrder: plan.sortOrder,
  }));
  const incoming = structuredClone(existing);

  const result = mergePropertyShowcaseUpdate(existing, incoming, "media", {
    replaceFloorPlans: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.property?.interactiveFloorPlanTour?.provider, "cubiCasa");
  assert.equal(result.property?.floorPlans[0]?.interactiveProvider, undefined);
  assert.equal(result.property?.floorPlans[0]?.interactiveExternalUrl, undefined);
  assert.equal(result.property?.floorPlans[0]?.interactiveEmbedUrl, undefined);
});

test("details saves preserve exact and approximate privacy selections", () => {
  const existing = withExternalMedia();
  existing.location.privacyMode = "exact";
  const approximate = structuredClone(existing);
  approximate.location.privacyMode = "approximate";

  const approximateResult = mergePropertyShowcaseUpdate(
    existing,
    approximate,
    "details",
  );
  assert.equal(approximateResult.property?.location.privacyMode, "approximate");

  const exact = structuredClone(approximateResult.property!);
  exact.location.privacyMode = "exact";
  const exactResult = mergePropertyShowcaseUpdate(
    approximateResult.property!,
    exact,
    "details",
  );
  assert.equal(exactResult.property?.location.privacyMode, "exact");
});

test("approximate saves persist one generated center and require a public label", () => {
  const incoming = cloneProperty();
  incoming.location = {
    displayAddress: { en: "Private source address" },
    approximateLabel: { en: "Arroyo Vista, Arizona" },
    privacyMode: "approximate",
    showMap: true,
    latitude: 31.4982437,
    longitude: -110.1957096,
    approximateRadiusMeters: 1500,
  };

  const first = mergePropertyShowcaseUpdate(null, incoming, "replace");
  assert.equal(first.ok, true);
  assert.notEqual(first.property?.location.approximateLatitude, undefined);
  assert.notEqual(first.property?.location.approximateLongitude, undefined);
  assert.notEqual(first.property?.location.approximateLatitude, incoming.location.latitude);

  const second = mergePropertyShowcaseUpdate(
    first.property!,
    first.property!,
    "replace",
  );
  assert.equal(second.ok, true);
  assert.equal(
    second.property?.location.approximateLatitude,
    first.property?.location.approximateLatitude,
  );
  assert.equal(
    second.property?.location.approximateLongitude,
    first.property?.location.approximateLongitude,
  );

  incoming.location.approximateLabel = { en: "" };
  const missingLabel = mergePropertyShowcaseUpdate(null, incoming, "replace");
  assert.equal(missingLabel.ok, false);
  assert.equal(
    missingLabel.errors.includes("Approximate maps need a public area label."),
    true,
  );
});

test("server regenerates unsafe legacy approximate centers and preserves safe centers", () => {
  const incoming = cloneProperty();
  incoming.location = {
    displayAddress: { en: "2418 Copper Mesa Drive" },
    approximateLabel: { en: "Arroyo Vista, Arizona" },
    privacyMode: "approximate",
    showMap: true,
    latitude: 31.4982437,
    longitude: -110.1957096,
    approximateLatitude: 31.4982437,
    approximateLongitude: -110.1957096,
    approximateRadiusMeters: 1500,
    googleMapsLink:
      "https://www.google.com/maps/search/?api=1&query=31.4982437%2C-110.1957096",
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=private-exact-parcel",
    useCustomMapEmbed: true,
  };

  const corrected = mergePropertyShowcaseUpdate(null, incoming, "replace");
  assert.equal(corrected.ok, true);
  assert.ok(corrected.property);
  const correctedLocation = corrected.property.location;
  assert.notEqual(correctedLocation.approximateLatitude, incoming.location.latitude);
  assert.notEqual(correctedLocation.approximateLongitude, incoming.location.longitude);
  assert.equal(
    isSafeApproximateMapCenter(
      { latitude: incoming.location.latitude!, longitude: incoming.location.longitude! },
      {
        latitude: correctedLocation.approximateLatitude!,
        longitude: correctedLocation.approximateLongitude!,
      },
      incoming.location.approximateRadiusMeters!,
    ),
    true,
  );

  const increasedRadius = structuredClone(corrected.property!);
  increasedRadius.location.approximateRadiusMeters = 50_000;
  const regenerated = mergePropertyShowcaseUpdate(
    corrected.property!,
    increasedRadius,
    "replace",
  );
  assert.equal(regenerated.ok, true);
  assert.ok(regenerated.property);
  assert.equal(
    isSafeApproximateMapCenter(
      {
        latitude: incoming.location.latitude!,
        longitude: incoming.location.longitude!,
      },
      {
        latitude: regenerated.property.location.approximateLatitude!,
        longitude: regenerated.property.location.approximateLongitude!,
      },
      increasedRadius.location.approximateRadiusMeters!,
    ),
    true,
  );

  const decreasedRadius = structuredClone(corrected.property!);
  decreasedRadius.location.approximateRadiusMeters = 1000;
  const preserved = mergePropertyShowcaseUpdate(
    corrected.property!,
    decreasedRadius,
    "replace",
  );
  assert.equal(preserved.ok, true);
  assert.equal(
    preserved.property?.location.approximateLatitude,
    correctedLocation.approximateLatitude,
  );
  assert.equal(
    preserved.property?.location.approximateLongitude,
    correctedLocation.approximateLongitude,
  );
});

test("server derives an exact source from a raw Google Maps link before saving", () => {
  const incoming = cloneProperty();
  incoming.location = {
    displayAddress: { en: "2418 Copper Mesa Drive" },
    approximateLabel: { en: "Arroyo Vista, Arizona" },
    privacyMode: "approximate",
    showMap: true,
    approximateLatitude: 31.4982437,
    approximateLongitude: -110.1957096,
    approximateRadiusMeters: 1500,
    googleMapsLink:
      "https://www.google.com/maps/search/?api=1&query=31.4982437%2C-110.1957096",
  };

  const result = mergePropertyShowcaseUpdate(null, incoming, "replace");
  assert.equal(result.ok, true);
  assert.ok(result.property);
  assert.equal(
    isSafeApproximateMapCenter(
      { latitude: 31.4982437, longitude: -110.1957096 },
      {
        latitude: result.property.location.approximateLatitude!,
        longitude: result.property.location.approximateLongitude!,
      },
      1500,
    ),
    true,
  );
});

test("details saves preserve sharing media while updating a structured address", () => {
  const existing = withExternalMedia();
  existing.gallery[0].featuredForSharing = true;
  existing.gallery[0].primarySocialPreview = true;
  const incoming = structuredClone(existing);
  incoming.location = {
    ...incoming.location,
    streetAddress: "Calle San Pablo 46",
    city: "Altea",
    region: "Alicante",
    postalCode: "03590",
  };

  const result = mergePropertyShowcaseUpdate(existing, incoming, "details");

  assert.equal(result.ok, true);
  assert.deepEqual(result.property?.gallery, existing.gallery);
  assert.equal(result.property?.location.streetAddress, "Calle San Pablo 46");
  assert.equal(result.property?.location.city, "Altea");
  assert.equal(result.property?.location.postalCode, "03590");
});

test("media saves preserve structured address details and privacy settings", () => {
  const existing = withExternalMedia();
  existing.location = {
    ...existing.location,
    streetAddress: "Calle San Pablo 46",
    city: "Altea",
    region: "Alicante",
    postalCode: "03590",
    privacyMode: "exact",
  };
  const incoming = {
    ...existing,
    gallery: [...existing.gallery].reverse(),
  };

  const result = mergePropertyShowcaseUpdate(existing, incoming, "media");

  assert.equal(result.ok, true);
  assert.deepEqual(result.property?.location, existing.location);
});

test("details saves preserve a disabled custom map embed without rendering intent", () => {
  const existing = withExternalMedia();
  existing.location = {
    displayAddress: { en: "Exact address" },
    privacyMode: "exact",
    showMap: true,
    latitude: 38.603912,
    longitude: -0.045316,
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=legacy-area",
    useCustomMapEmbed: true,
  };
  const incoming = structuredClone(existing);
  incoming.location.useCustomMapEmbed = false;

  const result = mergePropertyShowcaseUpdate(existing, incoming, "details");

  assert.equal(result.ok, true);
  assert.equal(
    result.property?.location.mapEmbedUrl,
    "https://www.google.com/maps/embed?pb=legacy-area",
  );
  assert.equal(result.property?.location.useCustomMapEmbed, false);
});

test("details and media saves preserve disabled video data and floor-plan visibility", () => {
  const existing = withExternalMedia();
  existing.videos = {
    enabled: false,
    items: [
      {
        id: "property-film",
        provider: "youtube",
        externalUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
        sortOrder: 1,
      },
    ],
  };
  existing.floorPlansEnabled = false;
  const details = structuredClone(existing);
  details.summary.en = "Updated metadata only";

  const detailsResult = mergePropertyShowcaseUpdate(existing, details, "details");
  assert.equal(detailsResult.ok, true);
  assert.equal(detailsResult.property?.videos?.enabled, false);
  assert.equal(detailsResult.property?.videos?.items.length, 1);
  assert.equal(detailsResult.property?.floorPlansEnabled, false);
  assert.deepEqual(detailsResult.property?.floorPlans, existing.floorPlans);

  const media = structuredClone(detailsResult.property!);
  media.gallery = [...media.gallery].reverse();
  const mediaResult = mergePropertyShowcaseUpdate(
    detailsResult.property!,
    media,
    "media",
  );
  assert.equal(mediaResult.ok, true);
  assert.deepEqual(mediaResult.property?.videos, detailsResult.property?.videos);
  assert.equal(mediaResult.property?.floorPlansEnabled, false);
});

test("ordinary detail and media saves preserve social card settings", () => {
  const existing = withExternalMedia();
  existing.socialCard = {
    mode: "custom",
    layout: "image-focused",
    visibleFacts: ["listing-reference", "bedrooms"],
    factOrder: [
      "listing-reference",
      "bedrooms",
      "bathrooms",
      "built-area",
      "parking",
      "plot-area",
      "year-built",
    ],
    showLocation: false,
    showPrice: true,
    showBranding: true,
    showPoweredByPicchuSpot: false,
  };
  const details = cloneProperty();
  details.socialCard = undefined;
  details.price = "EUR 700,000";

  const detailsResult = mergePropertyShowcaseUpdate(existing, details, "details");
  assert.equal(detailsResult.ok, true);
  assert.deepEqual(detailsResult.property?.socialCard, existing.socialCard);

  const media = structuredClone(existing);
  media.socialCard = { ...existing.socialCard, layout: "minimal" };
  const mediaResult = mergePropertyShowcaseUpdate(existing, media, "media");
  assert.equal(mediaResult.ok, true);
  assert.deepEqual(mediaResult.property?.socialCard, existing.socialCard);
});

test("media editor can intentionally save social card settings without changing media", () => {
  const existing = withExternalMedia();
  existing.socialCard = {
    mode: "automatic",
    layout: "balanced",
    visibleFacts: ["bedrooms", "bathrooms", "built-area", "parking"],
    factOrder: [
      "bedrooms",
      "bathrooms",
      "built-area",
      "parking",
      "plot-area",
      "year-built",
      "listing-reference",
    ],
    showLocation: true,
    showPrice: true,
    showBranding: true,
    showPoweredByPicchuSpot: true,
  };
  const incoming = structuredClone(existing);
  incoming.socialCard = {
    ...existing.socialCard,
    layout: "minimal",
    showLocation: false,
  };

  const result = mergePropertyShowcaseUpdate(existing, incoming, "media", {
    updateSocialCard: true,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.property?.socialCard, incoming.socialCard);
  assert.deepEqual(result.property?.gallery, existing.gallery);
  assert.deepEqual(result.property?.floorPlans, existing.floorPlans);
});
