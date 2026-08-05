import assert from "node:assert/strict";
import test from "node:test";
import { costaBlancaDemo } from "./registry.ts";
import {
  getPropertySocialPreview,
  resolvePropertySocialImageUrl,
  resolvedPropertySocialImages,
  selectPropertyHeroImages,
  selectPropertySocialImageCandidates,
  selectPropertySocialImage,
  selectPropertySocialImages,
  updateGallerySocialPreview,
} from "./social-preview.ts";
import type { PropertyShowcase } from "./types.ts";

function cloneProperty(): PropertyShowcase {
  return structuredClone(costaBlancaDemo);
}

test("primary featured gallery image wins the social preview", () => {
  const property = cloneProperty();
  property.gallery = property.gallery.map((image) => ({
    ...image,
    featuredForSharing: image.id === "living-room" || image.id === "terrace",
    primarySocialPreview: image.id === "terrace",
  }));

  assert.deepEqual(selectPropertySocialImage(property), {
    imageUrl: "/property-demo/terrace.svg",
    imageAlt: "Private terrace overlooking the Mediterranean coast",
  });
});

test("social preview uses the first featured image and then the cover", () => {
  const property = cloneProperty();
  property.gallery = property.gallery.map((image) => ({
    ...image,
    featuredForSharing: image.id === "living-room" || image.id === "terrace",
    primarySocialPreview: false,
  }));

  assert.equal(
    selectPropertySocialImage(property).imageUrl,
    "/property-demo/living-room.svg",
  );

  property.gallery = property.gallery.map((image) => ({
    ...image,
    featuredForSharing: false,
  }));
  assert.equal(
    selectPropertySocialImage(property).imageUrl,
    property.coverImage,
  );
});

test("hero selection is static for a cover or one selected sharing image", () => {
  const property = cloneProperty();
  property.gallery = property.gallery.map((image) => ({
    ...image,
    featuredForSharing: false,
    primarySocialPreview: false,
  }));

  assert.deepEqual(selectPropertyHeroImages(property).map((image) => image.imageUrl), [
    property.coverImage,
  ]);

  property.gallery = property.gallery.map((image) => ({
    ...image,
    featuredForSharing: image.id === "living-room",
  }));
  assert.deepEqual(selectPropertyHeroImages(property).map((image) => image.imageUrl), [
    "/property-demo/living-room.svg",
  ]);
});

test("hero selection places the social primary first and removes duplicate URLs", () => {
  const property = cloneProperty();
  property.gallery = property.gallery.map((image) => ({
    ...image,
    src: image.id === "living-room" ? "/property-demo/shared.svg" : image.src,
    featuredForSharing: ["exterior", "living-room", "terrace"].includes(image.id),
    primarySocialPreview: image.id === "terrace",
  }));
  property.gallery = property.gallery.map((image) =>
    image.id === "exterior" ? { ...image, src: "/property-demo/shared.svg" } : image,
  );

  assert.deepEqual(selectPropertyHeroImages(property).map((image) => image.imageUrl), [
    "/property-demo/terrace.svg",
    "/property-demo/shared.svg",
  ]);
});

test("social collage keeps the primary image first and adds featured images", () => {
  const property = cloneProperty();
  property.gallery = property.gallery.map((image) => ({
    ...image,
    featuredForSharing: ["exterior", "living-room", "terrace"].includes(
      image.id,
    ),
    primarySocialPreview: image.id === "terrace",
  }));

  assert.deepEqual(
    selectPropertySocialImages(property).map((image) => image.imageUrl),
    [
      "/property-demo/terrace.svg",
      "/property-demo/exterior.svg",
      "/property-demo/living-room.svg",
    ],
  );
});

test("setting a social primary also marks it featured and clears old primaries", () => {
  const property = cloneProperty();
  const updated = updateGallerySocialPreview(
    property.gallery,
    "living-room",
    "set-primary",
  );

  assert.equal(
    updated.find((image) => image.id === "living-room")?.featuredForSharing,
    true,
  );
  assert.equal(
    updated.find((image) => image.id === "living-room")?.primarySocialPreview,
    true,
  );
  assert.equal(
    updated.find((image) => image.id === "terrace")?.primarySocialPreview,
    false,
  );
});

test("social listing text includes core facts and respects location privacy", () => {
  const property = cloneProperty();
  property.location.displayAddress = { en: "123 Private Parcel Road" };
  property.location.streetAddress = "123 Private Parcel Road";
  property.location.city = "Wasilla";
  property.location.postalCode = "99654";
  property.location.approximateLabel = { en: "Wasilla, Alaska" };
  property.location.privacyMode = "approximate";
  const approximate = getPropertySocialPreview(property);

  assert.equal(approximate.title.includes("Sea View Residence"), true);
  assert.equal(approximate.title.includes("\u20ac695,000"), true);
  assert.equal(approximate.description.includes("Wasilla, Alaska"), true);
  assert.equal(approximate.description.includes("123 Private Parcel Road"), false);
  assert.equal(approximate.description.includes("PS-001"), true);
  assert.equal(approximate.description.includes("3 bedrooms"), true);
  assert.equal(approximate.description.includes("2 bathrooms"), true);
  assert.equal(approximate.description.includes("142\u00a0m\u00b2"), true);

  property.location.privacyMode = "exact";
  const exact = getPropertySocialPreview(property);
  assert.equal(exact.description.includes("123 Private Parcel Road"), true);
  assert.equal(exact.description.includes("99654"), true);

  property.location.privacyMode = "hidden";
  const hidden = getPropertySocialPreview(property);
  assert.equal(hidden.description.includes("123 Private Parcel Road"), false);
  assert.equal(hidden.description.includes("Wasilla, Alaska"), false);
});

test("social image resolution accepts public site paths and rejects external lookalikes", () => {
  const property = cloneProperty();
  assert.equal(
    resolvePropertySocialImageUrl(property, "/property-demo/terrace.svg"),
    "https://picchuspot.com/property-demo/terrace.svg",
  );
  assert.equal(
    resolvePropertySocialImageUrl(
      property,
      "https://evil.example/property-demo/terrace.svg",
    ),
    null,
  );
  assert.equal(
    resolvePropertySocialImageUrl(property, "/property-demo/%2e%2e/private"),
    null,
  );
  assert.equal(resolvedPropertySocialImages(property).length, 3);
});

test("social image candidates preserve primary, featured and cover fallback order", () => {
  const property = cloneProperty();
  assert.deepEqual(
    selectPropertySocialImageCandidates(property).map((image) => image.imageUrl),
    [
      "/property-demo/terrace.svg",
      "/property-demo/living-room.svg",
      "/property-demo/exterior.svg",
    ],
  );
});

test("social image candidates keep a non-gallery cover as the final fallback", () => {
  const property = cloneProperty();
  property.coverImage = "/property-demo/cover-only.svg";
  property.gallery[0].featuredForSharing = true;
  property.gallery[0].primarySocialPreview = true;

  const candidates = selectPropertySocialImageCandidates(property);
  assert.equal(candidates[0].imageUrl, property.gallery[0].src);
  assert.equal(candidates.at(-1)?.imageUrl, property.coverImage);
});

test("social-card branding defaults to PicchuSpot and supports agency and unbranded modes", () => {
  const property = cloneProperty();
  const defaultPreview = getPropertySocialPreview(property);
  assert.equal(defaultPreview.brandingMode, "picchuspot");
  assert.equal(defaultPreview.brandingName, "PicchuSpot");

  property.socialPreview = { brandingMode: "agency" };
  property.agent.logoUrl = "/property-demo/agency.svg";
  const agencyPreview = getPropertySocialPreview(property);
  assert.equal(agencyPreview.brandingName, "Demo Real Estate Agency");
  assert.equal(agencyPreview.brandingLogoUrl, "/property-demo/agency.svg");
  assert.equal(agencyPreview.brandingAttribution, "Powered by PicchuSpot");

  property.socialPreview = { brandingMode: "unbranded" };
  const unbrandedPreview = getPropertySocialPreview(property);
  assert.equal(unbrandedPreview.brandingName, undefined);
  assert.equal(unbrandedPreview.brandingLogoUrl, undefined);
  assert.equal(unbrandedPreview.brandingAttribution, undefined);
});
