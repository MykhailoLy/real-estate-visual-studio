import assert from "node:assert/strict";
import test from "node:test";
import { costaBlancaDemo } from "./registry.ts";
import {
  collectPropertyShowcaseMediaPaths,
  collectPropertyShowcaseReferencedSiteMediaPaths,
  failedPropertyShowcaseUploadCleanupCandidates,
  isOwnedPropertyShowcaseStoragePath,
  ownedPropertyCustomFlyerStoragePath,
  propertyShowcaseMediaDeletionCandidates,
  siteMediaObjectPathFromUrl,
} from "./storage-cleanup.ts";
import type { PropertyShowcase } from "./types.ts";

const STORAGE_ORIGIN = "https://demo.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_URL = STORAGE_ORIGIN;

function cloneProperty(): PropertyShowcase {
  return structuredClone(costaBlancaDemo);
}

function storageUrl(path: string): string {
  return `${STORAGE_ORIGIN}/storage/v1/object/public/site-media/${path}`;
}

test("property showcase storage ownership is restricted to the current slug folder", () => {
  assert.equal(
    isOwnedPropertyShowcaseStoragePath(
      storageUrl("property-showcases/altea/cover.webp"),
      "altea",
    ),
    true,
  );
  assert.equal(
    isOwnedPropertyShowcaseStoragePath(
      storageUrl("property-showcases/moraira/cover.webp"),
      "altea",
    ),
    false,
  );
  assert.equal(
    isOwnedPropertyShowcaseStoragePath("property-showcases/altea", "altea"),
    false,
  );
  assert.equal(
    isOwnedPropertyShowcaseStoragePath(
      "property-showcases/altea/../shared.webp",
      "altea",
    ),
    false,
  );
  assert.equal(
    isOwnedPropertyShowcaseStoragePath(
      "https://unbranded.visithome.ai/demo-plan",
      "altea",
    ),
    false,
  );
});

test("storage URL parsing rejects unrelated and lookalike Supabase public URLs", () => {
  const path = "property-showcases/altea/photo.webp";
  const valid = storageUrl(path);

  assert.equal(siteMediaObjectPathFromUrl(valid), path);
  assert.equal(siteMediaObjectPathFromUrl(path), null);
  assert.equal(
    siteMediaObjectPathFromUrl(path, { allowRelativeObjectPath: true }),
    path,
  );
  assert.equal(
    siteMediaObjectPathFromUrl(
      "https://evil.example/storage/v1/object/public/site-media/property-showcases/altea/photo.webp",
    ),
    null,
  );
  assert.equal(
    siteMediaObjectPathFromUrl(
      "https://demo.supabase.co.evil.example/storage/v1/object/public/site-media/property-showcases/altea/photo.webp",
    ),
    null,
  );
  assert.equal(
    siteMediaObjectPathFromUrl(
      "https://user:pass@demo.supabase.co/storage/v1/object/public/site-media/property-showcases/altea/photo.webp",
    ),
    null,
  );
  assert.equal(
    siteMediaObjectPathFromUrl(
      "https://demo.supabase.co:444/storage/v1/object/public/site-media/property-showcases/altea/photo.webp",
    ),
    null,
  );
  assert.equal(
    siteMediaObjectPathFromUrl(
      "http://demo.supabase.co/storage/v1/object/public/site-media/property-showcases/altea/photo.webp",
    ),
    null,
  );
  assert.equal(
    siteMediaObjectPathFromUrl(
      "https://demo.supabase.co/storage/v1/object/public/avatars/property-showcases/altea/photo.webp",
    ),
    null,
  );
  assert.equal(
    siteMediaObjectPathFromUrl(
      "https://demo.supabase.co/storage/v1/object/public/site-media/property-showcases/altea/%2e%2e/shared.webp",
    ),
    null,
  );
  assert.equal(
    siteMediaObjectPathFromUrl(
      "https://demo.supabase.co/storage/v1/object/public/site-media/property-showcases/altea/%E0%A4%A",
    ),
    null,
  );
});

test("read-only reference collection includes shared site-media paths", () => {
  const property = cloneProperty();
  property.coverImage = storageUrl("service-options/shared-cover.jpg");
  property.brochureUrl = "service-options/shared-brochure.pdf";

  const references = collectPropertyShowcaseReferencedSiteMediaPaths(property);
  assert.equal(references.includes("service-options/shared-brochure.pdf"), true);
  assert.equal(references.includes("service-options/shared-cover.jpg"), true);
  const owned = collectPropertyShowcaseMediaPaths(property, property.slug);
  assert.equal(owned.includes("service-options/shared-brochure.pdf"), false);
  assert.equal(owned.includes("service-options/shared-cover.jpg"), false);
});

test("external lookalike URLs cannot become deletion candidates", () => {
  const existing = cloneProperty();
  existing.slug = "altea";
  existing.coverImage = storageUrl("property-showcases/altea/cover.webp");
  existing.gallery = [
    {
      id: "gallery-1",
      src: "https://evil.example/storage/v1/object/public/site-media/property-showcases/altea/evil.webp",
      alt: { en: "Spoofed" },
      label: { en: "Spoofed" },
      sortOrder: 1,
    },
    {
      id: "gallery-2",
      src: "https://demo.supabase.co.evil.example/storage/v1/object/public/site-media/property-showcases/altea/lookalike.webp",
      alt: { en: "Lookalike" },
      label: { en: "Lookalike" },
      sortOrder: 2,
    },
  ];

  assert.deepEqual(
    propertyShowcaseMediaDeletionCandidates({
      existing,
      next: { ...existing, gallery: [] },
      slug: "altea",
    }),
    [],
  );
});

test("deletion candidates include only detached current-property media objects", () => {
  const existing = cloneProperty();
  existing.slug = "altea";
  existing.coverImage = storageUrl("property-showcases/altea/cover.webp");
  existing.gallery = [
    {
      id: "gallery-1",
      src: existing.coverImage,
      alt: { en: "Cover" },
      label: { en: "Cover" },
      sortOrder: 1,
    },
    {
      id: "gallery-2",
      src: storageUrl("property-showcases/altea/kitchen.webp"),
      alt: { en: "Kitchen" },
      label: { en: "Kitchen" },
      sortOrder: 2,
    },
  ];
  existing.virtualTour = {
    provider: "kuula",
    externalUrl: "https://mls.kuu.la/share/demo",
    posterImage: storageUrl("property-showcases/altea/tour-poster.webp"),
  };
  existing.interactiveFloorPlanTour = {
    enabled: true,
    provider: "cubiCasa",
    externalUrl: "https://unbranded.visithome.ai/demo-plan",
    posterImage: storageUrl("property-showcases/altea/interactive-poster.webp"),
  };
  existing.videos = {
    enabled: true,
    items: [
      {
        id: "video-1",
        provider: "youtube",
        externalUrl: "https://www.youtube.com/watch?v=abcdefghijk",
        embedUrl: "https://www.youtube-nocookie.com/embed/abcdefghijk",
        posterUrl: storageUrl("property-showcases/altea/video-poster.webp"),
        sortOrder: 1,
      },
    ],
  };
  existing.agent = {
    ...existing.agent,
    portraitUrl: storageUrl("property-showcases/altea/agent.webp"),
    logoUrl: storageUrl("property-showcases/altea/logo.webp"),
  };
  existing.floorPlans = [
    {
      id: "main-floor",
      title: { en: "Main floor" },
      imageUrl: storageUrl("property-showcases/altea/floor.webp"),
      downloadUrl: storageUrl("property-showcases/shared/floor.webp"),
      interactiveProvider: "cubiCasa",
      interactiveExternalUrl: "https://unbranded.visithome.ai/demo-plan",
      interactiveEmbedUrl: "https://unbranded.visithome.ai/demo-plan?embed=1",
      sortOrder: 1,
    },
  ];

  const next = {
    ...existing,
    gallery: [existing.gallery[0]],
    virtualTour: undefined,
    interactiveFloorPlanTour: undefined,
    videos: { enabled: false, items: [] },
    agent: {
      ...existing.agent,
      portraitUrl: undefined,
      logoUrl: undefined,
    },
    floorPlans: [],
  };

  assert.deepEqual(
    propertyShowcaseMediaDeletionCandidates({
      existing,
      next,
      slug: "altea",
    }),
    [
      "property-showcases/altea/agent.webp",
      "property-showcases/altea/floor.webp",
      "property-showcases/altea/interactive-poster.webp",
      "property-showcases/altea/kitchen.webp",
      "property-showcases/altea/logo.webp",
      "property-showcases/altea/tour-poster.webp",
      "property-showcases/altea/video-poster.webp",
    ],
  );
});

test("interactive poster removal deletes only the detached owned poster", () => {
  const existing = cloneProperty();
  existing.slug = "altea";
  existing.interactiveFloorPlanTour = {
    enabled: true,
    provider: "cubiCasa",
    externalUrl: "https://unbranded.visithome.ai/demo-plan",
    posterImage: storageUrl("property-showcases/altea/interactive-poster.webp"),
  };
  existing.coverImage = storageUrl("property-showcases/altea/cover.webp");
  existing.gallery = [
    {
      id: "gallery-1",
      src: existing.coverImage,
      alt: { en: "Cover" },
      label: { en: "Cover" },
      sortOrder: 1,
    },
  ];

  const next = {
    ...existing,
    interactiveFloorPlanTour: {
      ...existing.interactiveFloorPlanTour,
      posterImage: undefined,
    },
  };

  assert.deepEqual(
    propertyShowcaseMediaDeletionCandidates({
      existing,
      next,
      slug: "altea",
    }),
    ["property-showcases/altea/interactive-poster.webp"],
  );
});

test("deleting one floor plan keeps retained floor-plan images out of cleanup", () => {
  const existing = cloneProperty();
  existing.slug = "altea";
  existing.coverImage = storageUrl("property-showcases/altea/cover.webp");
  existing.gallery = [
    {
      id: "gallery-1",
      src: existing.coverImage,
      alt: { en: "Cover" },
      label: { en: "Cover" },
      sortOrder: 1,
    },
  ];
  existing.floorPlans = [
    {
      id: "ground-floor",
      title: { en: "Ground floor" },
      imageUrl: storageUrl("property-showcases/altea/ground-floor.webp"),
      downloadUrl: storageUrl("property-showcases/altea/ground-floor.webp"),
      sortOrder: 1,
    },
    {
      id: "first-floor",
      title: { en: "First floor" },
      imageUrl: storageUrl("property-showcases/altea/first-floor.webp"),
      downloadUrl: storageUrl("property-showcases/altea/first-floor.webp"),
      sortOrder: 2,
    },
  ];

  const next = {
    ...existing,
    floorPlans: [existing.floorPlans[1]],
  };

  assert.deepEqual(
    propertyShowcaseMediaDeletionCandidates({
      existing,
      next,
      slug: "altea",
    }),
    ["property-showcases/altea/ground-floor.webp"],
  );
});

test("failed upload cleanup ignores external, shared, and retained paths", () => {
  assert.deepEqual(
    failedPropertyShowcaseUploadCleanupCandidates({
      slug: "altea",
      uploaded: [
        storageUrl("property-showcases/altea/batch-1.webp"),
        storageUrl("property-showcases/moraira/batch-2.webp"),
        storageUrl("property-showcases/altea/batch-3.webp"),
        "https://unbranded.visithome.ai/demo-plan",
      ],
      retained: [storageUrl("property-showcases/altea/batch-3.webp")],
    }),
    ["property-showcases/altea/batch-1.webp"],
  );
});

test("custom flyer paths are restricted to the current property flyer folder", () => {
  const jpg = storageUrl("property-showcases/altea/flyer/170-custom.jpg");
  assert.equal(
    ownedPropertyCustomFlyerStoragePath(jpg, "altea"),
    "property-showcases/altea/flyer/170-custom.jpg",
  );
  assert.equal(
    ownedPropertyCustomFlyerStoragePath(
      storageUrl("property-showcases/altea/gallery/170-custom.jpg"),
      "altea",
    ),
    null,
  );
  assert.equal(
    ownedPropertyCustomFlyerStoragePath(
      storageUrl("property-showcases/moraira/flyer/170-custom.jpg"),
      "altea",
    ),
    null,
  );
});

test("replacing or removing one custom flyer format cleans up only that format", () => {
  const existing = cloneProperty();
  existing.slug = "altea";
  existing.marketingMaterials = {
    flyerMode: "custom",
    customFlyer: {
      pdf: storageUrl("property-showcases/altea/flyer/1-custom.pdf"),
      jpg: storageUrl("property-showcases/altea/flyer/1-custom.jpg"),
      png: storageUrl("property-showcases/altea/flyer/1-custom.png"),
    },
  };
  const replacement = structuredClone(existing);
  replacement.marketingMaterials!.customFlyer!.jpg = storageUrl(
    "property-showcases/altea/flyer/2-custom.jpg",
  );
  assert.deepEqual(
    propertyShowcaseMediaDeletionCandidates({ existing, next: replacement, slug: "altea" }),
    ["property-showcases/altea/flyer/1-custom.jpg"],
  );

  const removed = structuredClone(existing);
  delete removed.marketingMaterials!.customFlyer!.png;
  assert.deepEqual(
    propertyShowcaseMediaDeletionCandidates({ existing, next: removed, slug: "altea" }),
    ["property-showcases/altea/flyer/1-custom.png"],
  );
  assert.deepEqual(
    collectPropertyShowcaseMediaPaths(existing, "altea").filter((path) => path.includes("/flyer/")),
    [
      "property-showcases/altea/flyer/1-custom.jpg",
      "property-showcases/altea/flyer/1-custom.pdf",
      "property-showcases/altea/flyer/1-custom.png",
    ],
  );
});

test("property delete collection includes only owned current-slug media paths", () => {
  const property = cloneProperty();
  property.slug = "altea";
  property.coverImage = storageUrl("property-showcases/altea/cover.webp");
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
      src: storageUrl("property-showcases/altea/kitchen.webp"),
      alt: { en: "Kitchen" },
      label: { en: "Kitchen" },
      sortOrder: 2,
    },
    {
      id: "gallery-3",
      src: storageUrl("property-showcases/moraira/shared.webp"),
      alt: { en: "Shared" },
      label: { en: "Shared" },
      sortOrder: 3,
    },
  ];
  property.virtualTour = {
    provider: "kuula",
    externalUrl: "https://mls.kuu.la/share/demo",
    posterImage: storageUrl("property-showcases/altea/poster.webp"),
  };
  property.interactiveFloorPlanTour = {
    enabled: true,
    provider: "cubiCasa",
    externalUrl: "https://unbranded.visithome.ai/demo-plan",
    posterImage: storageUrl("property-showcases/altea/interactive-poster.webp"),
  };
  property.videos = {
    enabled: true,
    items: [
      {
        id: "video-1",
        provider: "vimeo",
        externalUrl: "https://vimeo.com/123456789",
        embedUrl: "https://player.vimeo.com/video/123456789",
        posterUrl: storageUrl("property-showcases/altea/video-poster.webp"),
        sortOrder: 1,
      },
      {
        id: "video-2",
        provider: "youtube",
        externalUrl: "https://www.youtube.com/watch?v=abcdefghijk",
        posterUrl: storageUrl("property-showcases/moraira/shared-video.webp"),
        sortOrder: 2,
      },
    ],
  };
  property.agent = {
    ...property.agent,
    portraitUrl: storageUrl("property-showcases/altea/agent.webp"),
    logoUrl: storageUrl("property-showcases/moraira/shared-logo.webp"),
  };
  property.floorPlans = [
    {
      id: "main-floor",
      title: { en: "Main floor" },
      imageUrl: storageUrl("property-showcases/altea/floor.webp"),
      downloadUrl:
        "https://evil.example/storage/v1/object/public/site-media/property-showcases/altea/fake-floor.webp",
      interactiveExternalUrl: "https://unbranded.visithome.ai/demo-plan",
      sortOrder: 1,
    },
  ];

  assert.deepEqual(collectPropertyShowcaseMediaPaths(property, "altea"), [
    "property-showcases/altea/agent.webp",
    "property-showcases/altea/cover.webp",
    "property-showcases/altea/floor.webp",
    "property-showcases/altea/interactive-poster.webp",
    "property-showcases/altea/kitchen.webp",
    "property-showcases/altea/poster.webp",
    "property-showcases/altea/video-poster.webp",
  ]);
});
