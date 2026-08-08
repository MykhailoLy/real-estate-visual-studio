import assert from "node:assert/strict";
import test from "node:test";
import { buildPropertyMetadata } from "./property-metadata.ts";
import { costaBlancaDemo } from "./registry.ts";
import { computePropertySocialImageVersion } from "./social-image-version.ts";
import type { PropertyShowcase } from "./types.ts";

test("Open Graph and Twitter metadata use one versioned social-image URL", () => {
  const property: PropertyShowcase = structuredClone(costaBlancaDemo);
  const version = computePropertySocialImageVersion(property);
  const metadata = buildPropertyMetadata(property, version);
  const expectedImageUrl =
    `https://picchuspot.com/property/${property.slug}/opengraph-image?v=${version}`;
  const openGraphImage = (metadata.openGraph?.images as Array<{
    secureUrl?: string;
    url: string;
  }>)[0];
  const twitterImages = metadata.twitter?.images as string[];

  assert.equal(openGraphImage.url, expectedImageUrl);
  assert.equal(openGraphImage.secureUrl, expectedImageUrl);
  assert.deepEqual(twitterImages, [expectedImageUrl]);
  assert.equal(
    metadata.alternates?.canonical,
    `https://picchuspot.com/property/${property.slug}`,
  );
  assert.equal(String(metadata.alternates?.canonical).includes("?v="), false);
});

test("custom property branding updates Open Graph site name but not the canonical URL", () => {
  const property: PropertyShowcase = structuredClone(costaBlancaDemo);
  property.branding = {
    enabled: true,
    brandName: "Costa Blanca Luxury Homes",
  };

  const metadata = buildPropertyMetadata(
    property,
    computePropertySocialImageVersion(property),
  );

  assert.equal(metadata.openGraph?.siteName, "Costa Blanca Luxury Homes");
  assert.equal(
    metadata.alternates?.canonical,
    `https://picchuspot.com/property/${property.slug}`,
  );
});

test("social preview identity controls Open Graph site name while canonical stays stable", () => {
  const property: PropertyShowcase = structuredClone(costaBlancaDemo);
  property.socialPreview = { brandingMode: "picchuspot", titleMode: "automatic" };
  const picchuMetadata = buildPropertyMetadata(
    property,
    computePropertySocialImageVersion(property),
  );
  assert.equal(picchuMetadata.openGraph?.siteName, "PicchuSpot");

  property.socialPreview = { brandingMode: "unbranded", titleMode: "automatic" };
  const unbrandedMetadata = buildPropertyMetadata(
    property,
    computePropertySocialImageVersion(property),
  );
  assert.equal(unbrandedMetadata.openGraph?.siteName, undefined);
  assert.equal(
    unbrandedMetadata.alternates?.canonical,
    `https://picchuspot.com/property/${property.slug}`,
  );
});
