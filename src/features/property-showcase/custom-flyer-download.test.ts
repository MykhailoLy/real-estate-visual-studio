import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createPropertyCustomFlyerDownloadHandler,
  PROPERTY_CUSTOM_FLYER_DOWNLOAD_ERROR_CACHE_CONTROL,
} from "./custom-flyer-download.ts";
import {
  PROPERTY_CUSTOM_FLYER_FORMATS,
  safePropertyCustomFlyerFilename,
  type PropertyCustomFlyerFormat,
} from "./custom-flyer.ts";
import { getPropertyShowcase } from "./registry.ts";
import type { PropertyShowcase } from "./types.ts";

const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
test.after(() => {
  if (previousSupabaseUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
  }
});

const routeSource = readFileSync(
  new URL(
    "../../app/(showcase)/property/[slug]/flyer/[format]/route.ts",
    import.meta.url,
  ),
  "utf8",
);

const bytesByFormat: Record<PropertyCustomFlyerFormat, Uint8Array> = {
  pdf: new TextEncoder().encode("%PDF-1.7\ncustom brochure"),
  jpg: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  png: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
};

function ownedUrl(slug: string, format: PropertyCustomFlyerFormat): string {
  return `https://demo.supabase.co/storage/v1/object/public/site-media/property-showcases/${slug}/flyer/v2-custom.${format}`;
}

function customProperty(): PropertyShowcase {
  const property = structuredClone(getPropertyShowcase("sea-view-residence"));
  assert.ok(property);
  property.marketingMaterials = {
    ...property.marketingMaterials,
    flyerMode: "custom",
    customFlyer: {
      pdf: ownedUrl(property.slug, "pdf"),
      jpg: ownedUrl(property.slug, "jpg"),
      png: ownedUrl(property.slug, "png"),
    },
  };
  return property;
}

function request(slug: string, format: string): Request {
  return new Request(
    `https://picchuspot.com/property/${encodeURIComponent(slug)}/flyer/${format}`,
  );
}

function context(slug: string, format: string) {
  return { params: Promise.resolve({ slug, format }) };
}

test("custom PDF, JPG and PNG routes return same-origin attachment responses", async () => {
  const property = customProperty();
  const handler = createPropertyCustomFlyerDownloadHandler({
    resolveProperty: async () => property,
    downloadFile: async ({ format, value }) => {
      assert.equal(value, property.marketingMaterials?.customFlyer?.[format]);
      return {
        ok: true,
        bytes: bytesByFormat[format],
        contentType: PROPERTY_CUSTOM_FLYER_FORMATS[format].mime,
      };
    },
  });

  for (const format of ["pdf", "jpg", "png"] as const) {
    const response = await handler(request(property.slug, format), context(property.slug, format));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), PROPERTY_CUSTOM_FLYER_FORMATS[format].mime);
    assert.equal(
      response.headers.get("content-disposition"),
      `attachment; filename="sea-view-residence-brochure.${format}"`,
    );
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(
      new Uint8Array(await response.arrayBuffer()),
      bytesByFormat[format],
    );
  }
});

test("custom flyer filenames are normalized and never use source filenames", () => {
  assert.equal(
    safePropertyCustomFlyerFilename("../Unsafe Property Name", "pdf"),
    "unsafe-property-name-brochure.pdf",
  );
  assert.equal(safePropertyCustomFlyerFilename("---", "jpg"), "property-brochure.jpg");
});

test("missing, unknown and unpublished custom flyer requests return no-store 404", async () => {
  const property = customProperty();
  delete property.marketingMaterials?.customFlyer?.png;
  let downloadCalls = 0;
  const handler = createPropertyCustomFlyerDownloadHandler({
    resolveProperty: async (slug) => slug === property.slug ? property : null,
    downloadFile: async () => {
      downloadCalls += 1;
      throw new Error("must not download unavailable files");
    },
  });

  for (const [slug, format] of [
    [property.slug, "png"],
    [property.slug, "webp"],
    ["unpublished-property", "pdf"],
  ] as const) {
    const response = await handler(request(slug, format), context(slug, format));
    assert.equal(response.status, 404);
    assert.equal(
      response.headers.get("cache-control"),
      PROPERTY_CUSTOM_FLYER_DOWNLOAD_ERROR_CACHE_CONTROL,
    );
  }
  assert.equal(downloadCalls, 0);
});

test("wrong-property and unrelated custom flyer URLs are rejected before Storage", async () => {
  const property = customProperty();
  let downloadCalls = 0;
  const handler = createPropertyCustomFlyerDownloadHandler({
    resolveProperty: async () => property,
    downloadFile: async () => {
      downloadCalls += 1;
      throw new Error("unsafe path reached Storage");
    },
  });

  for (const unsafeUrl of [
    ownedUrl("another-property", "jpg"),
    "https://unrelated.example/storage/v1/object/public/site-media/property-showcases/sea-view-residence/flyer/custom.jpg",
  ]) {
    property.marketingMaterials!.customFlyer = { jpg: unsafeUrl };
    const response = await handler(request(property.slug, "jpg"), context(property.slug, "jpg"));
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.equal(downloadCalls, 0);
});

test("public route resolves only published properties and uses validated Storage download", () => {
  assert.equal(routeSource.includes("getPublishedPropertyShowcase"), true);
  assert.equal(routeSource.includes("downloadStoredPropertyCustomFlyer"), true);
  assert.equal(routeSource.includes("searchParams"), false);
});
