import assert from "node:assert/strict";
import test from "node:test";
import { costaBlancaDemo } from "./registry.ts";
import {
  failedPropertyShowcaseUploadCleanupCandidates,
  isOwnedPropertyShowcaseStoragePath,
  propertyShowcaseMediaDeletionCandidates,
} from "./storage-cleanup.ts";
import type { PropertyShowcase } from "./types.ts";

const STORAGE_ORIGIN = "https://demo.supabase.co";

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
    floorPlans: [],
  };

  assert.deepEqual(
    propertyShowcaseMediaDeletionCandidates({
      existing,
      next,
      slug: "altea",
    }),
    [
      "property-showcases/altea/floor.webp",
      "property-showcases/altea/kitchen.webp",
      "property-showcases/altea/tour-poster.webp",
    ],
  );
});

test("failed upload cleanup ignores external, shared, and retained paths", () => {
  assert.deepEqual(
    failedPropertyShowcaseUploadCleanupCandidates({
      slug: "altea",
      uploaded: [
        storageUrl("property-showcases/altea/batch-1.webp"),
        storageUrl("property-showcases/moraira/batch-2.webp"),
        "property-showcases/altea/batch-3.webp",
        "https://unbranded.visithome.ai/demo-plan",
      ],
      retained: ["property-showcases/altea/batch-3.webp"],
    }),
    ["property-showcases/altea/batch-1.webp"],
  );
});
