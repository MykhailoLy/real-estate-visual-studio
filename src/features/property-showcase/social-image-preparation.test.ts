import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { costaBlancaDemo } from "./registry.ts";
import {
  DEFAULT_PROPERTY_SOCIAL_IMAGE_LIMITS,
  preparePropertySocialAssets,
  PROPERTY_SOCIAL_IMAGE_EVENTS,
} from "./social-image-preparation.ts";
import type {
  PropertySocialImageFailureReason,
  PropertySocialImageSourceResult,
} from "./social-image-source.ts";
import type { PropertyShowcase } from "./types.ts";

type SourceFixture =
  | { bytes: Buffer; contentType: string }
  | { reason: PropertySocialImageFailureReason };

function cloneProperty(): PropertyShowcase {
  return structuredClone(costaBlancaDemo);
}

function propertyWithSelectedImages(paths: string[]): PropertyShowcase {
  const property = cloneProperty();
  property.coverImage = paths[0] ?? "";
  property.gallery = paths.map((src, index) => ({
    id: `social-${index}`,
    src,
    alt: { en: `Social photo ${index + 1}` },
    label: { en: `Social photo ${index + 1}` },
    featuredForSharing: true,
    primarySocialPreview: index === 0,
    sortOrder: index + 1,
  }));
  return property;
}

function fixtureLoader(fixtures: ReadonlyMap<string, SourceFixture>) {
  return async (
    _property: Pick<PropertyShowcase, "slug">,
    imageUrl: string,
  ): Promise<PropertySocialImageSourceResult> => {
    const fixture = fixtures.get(
      new URL(imageUrl, "https://picchuspot.com").pathname,
    );
    if (!fixture) return { ok: false, reason: "fetch-failed" };
    if ("reason" in fixture) return { ok: false, reason: fixture.reason };
    return {
      ok: true,
      source: { bytes: fixture.bytes, contentType: fixture.contentType },
    };
  };
}

function decodeDataUri(value: string): Buffer {
  const encoded = value.split(",", 2)[1];
  assert.ok(encoded);
  return Buffer.from(encoded, "base64");
}

async function raster(
  format: "jpeg" | "png" | "webp",
  options: { alpha?: number } = {},
) {
  const image = sharp({
    create: {
      width: 1400,
      height: 900,
      channels: options.alpha === undefined ? 3 : 4,
      background: {
        r: 32,
        g: 96,
        b: 164,
        alpha: options.alpha,
      },
    },
  });
  return image[format]().toBuffer();
}

test("normalizes selected JPEG, PNG and WebP photos to bounded JPEG data URIs", async () => {
  const property = propertyWithSelectedImages([
    "/social/primary.jpg",
    "/social/support.png",
    "/social/support.webp",
    "/social/unused.webp",
  ]);
  const fixtures = new Map<string, SourceFixture>([
    ["/social/primary.jpg", { bytes: await raster("jpeg"), contentType: "image/jpeg" }],
    ["/social/support.png", { bytes: await raster("png"), contentType: "image/png" }],
    ["/social/support.webp", { bytes: await raster("webp"), contentType: "image/webp" }],
    ["/social/unused.webp", { bytes: await raster("webp"), contentType: "image/webp" }],
  ]);

  const prepared = await preparePropertySocialAssets(property, {
    sourceLoader: fixtureLoader(fixtures),
  });

  assert.equal(prepared.propertyImages.length, 3);
  assert.equal(prepared.skippedPhotoCount, 0);
  assert.ok(
    prepared.totalBytes <=
      DEFAULT_PROPERTY_SOCIAL_IMAGE_LIMITS.cumulativeMaxBytes,
  );
  for (const [index, image] of prepared.propertyImages.entries()) {
    assert.match(image.imageUrl, /^data:image\/jpeg;base64,/);
    assert.equal(image.contentType, "image/jpeg");
    const metadata = await sharp(decodeDataUri(image.imageUrl)).metadata();
    assert.equal(metadata.format, "jpeg");
    assert.ok((metadata.width ?? Infinity) <= (index === 0 ? 760 : 380));
    assert.ok((metadata.height ?? Infinity) <= (index === 0 ? 630 : 220));
  }
});

test("rasterizes SVG and WebP agency logos to a small transparent-capable PNG", async () => {
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="300"><rect width="800" height="300" rx="40" fill="#B88A44"/></svg>',
  );
  const webp = await raster("webp", { alpha: 0.5 });

  for (const [path, fixture] of [
    ["/social/agency.svg", { bytes: svg, contentType: "image/svg+xml" }],
    ["/social/agency.webp", { bytes: webp, contentType: "image/webp" }],
  ] as const) {
    const property = propertyWithSelectedImages([]);
    property.socialPreview = { brandingMode: "agency" };
    property.agent.logoUrl = path;
    const prepared = await preparePropertySocialAssets(property, {
      sourceLoader: fixtureLoader(new Map([[path, fixture]])),
    });

    assert.ok(prepared.brandingLogo);
    assert.match(prepared.brandingLogo.imageUrl, /^data:image\/png;base64,/);
    const metadata = await sharp(
      decodeDataUri(prepared.brandingLogo.imageUrl),
    ).metadata();
    assert.equal(metadata.format, "png");
    assert.ok((metadata.width ?? Infinity) <= 160);
    assert.ok((metadata.height ?? Infinity) <= 80);
  }
});

test("skips corrupted, failed, timed-out and oversized candidates in configured order", async () => {
  const property = propertyWithSelectedImages([
    "/social/corrupt.webp",
    "/social/failed.webp",
    "/social/timed-out.webp",
    "/social/oversized.webp",
    "/social/usable.webp",
  ]);
  const fixtures = new Map<string, SourceFixture>([
    ["/social/corrupt.webp", { bytes: Buffer.from("not-an-image"), contentType: "image/webp" }],
    ["/social/failed.webp", { reason: "fetch-failed" }],
    ["/social/timed-out.webp", { reason: "fetch-timeout" }],
    ["/social/oversized.webp", { reason: "source-too-large" }],
    ["/social/usable.webp", { bytes: await raster("webp"), contentType: "image/webp" }],
  ]);
  const events: string[] = [];

  const prepared = await preparePropertySocialAssets(property, {
    sourceLoader: fixtureLoader(fixtures),
    log: (event) => events.push(event),
  });

  assert.equal(prepared.propertyImages.length, 1);
  assert.equal(prepared.propertyImages[0]?.imageAlt, "Social photo 5");
  assert.equal(prepared.skippedPhotoCount, 4);
  assert.ok(events.includes(PROPERTY_SOCIAL_IMAGE_EVENTS.normalizeFailed));
  assert.ok(events.includes(PROPERTY_SOCIAL_IMAGE_EVENTS.sourceSkipped));
});

test("enforces the cumulative normalized budget after accepting the primary", async () => {
  const property = propertyWithSelectedImages([
    "/social/primary.webp",
    "/social/support-a.webp",
    "/social/support-b.webp",
  ]);
  const image = await raster("webp");
  const fixtures = new Map<string, SourceFixture>([
    ["/social/primary.webp", { bytes: image, contentType: "image/webp" }],
    ["/social/support-a.webp", { bytes: image, contentType: "image/webp" }],
    ["/social/support-b.webp", { bytes: image, contentType: "image/webp" }],
  ]);
  const baseline = await preparePropertySocialAssets(property, {
    sourceLoader: fixtureLoader(fixtures),
  });
  const primaryBytes = baseline.propertyImages[0]?.byteLength ?? 0;
  assert.ok(primaryBytes > 0);

  const events: Array<{ event: string; reason?: string }> = [];
  const limited = await preparePropertySocialAssets(property, {
    sourceLoader: fixtureLoader(fixtures),
    limits: { cumulativeMaxBytes: primaryBytes + 1 },
    log: (event, details) =>
      events.push({ event, reason: String(details.reason ?? "") }),
  });

  assert.equal(limited.propertyImages.length, 1);
  assert.ok(
    events.some(
      ({ event, reason }) =>
        event === PROPERTY_SOCIAL_IMAGE_EVENTS.budgetSkipped &&
        reason === "cumulative-output-limit",
    ),
  );
});

test("returns a text-card input when no property image or agency logo is usable", async () => {
  const property = propertyWithSelectedImages(["/social/missing.webp"]);
  property.socialPreview = { brandingMode: "agency" };
  property.agent.logoUrl = "/social/missing-logo.svg";
  const prepared = await preparePropertySocialAssets(property, {
    sourceLoader: fixtureLoader(new Map()),
    log: () => undefined,
  });

  assert.deepEqual(prepared.propertyImages, []);
  assert.equal(prepared.brandingLogo, null);
  assert.equal(prepared.preview.brandingMode, "agency");
});

test("PicchuSpot, agency and unbranded modes preserve their requested branding", async () => {
  for (const brandingMode of ["picchuspot", "agency", "unbranded"] as const) {
    const property = propertyWithSelectedImages([]);
    property.socialPreview = { brandingMode };
    property.agent.logoUrl = undefined;
    const prepared = await preparePropertySocialAssets(property, {
      sourceLoader: fixtureLoader(new Map()),
    });

    assert.equal(prepared.preview.brandingMode, brandingMode);
    assert.equal(prepared.brandingLogo, null);
  }
});
