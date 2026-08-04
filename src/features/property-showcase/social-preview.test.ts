import assert from "node:assert/strict";
import test from "node:test";
import { costaBlancaDemo } from "./registry.ts";
import {
  getPropertySocialPreview,
  resolvePropertySocialImageUrl,
  resolvedPropertySocialImages,
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
  assert.equal(resolvedPropertySocialImages(property).length, 2);
});
