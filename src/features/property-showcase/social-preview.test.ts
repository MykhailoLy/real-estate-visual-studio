import assert from "node:assert/strict";
import test from "node:test";
import { costaBlancaDemo } from "./registry.ts";
import {
  getPropertySocialPreview,
  selectPropertySocialImage,
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

test("social listing text includes public core details without approximate address", () => {
  const property = cloneProperty();
  const approximate = getPropertySocialPreview(property);

  assert.equal(approximate.title.includes("Sea View Residence"), true);
  assert.equal(approximate.title.includes("\u20ac695,000"), true);
  assert.equal(approximate.description.includes("Altea, Alicante"), false);

  property.location.privacyMode = "exact";
  const exact = getPropertySocialPreview(property);
  assert.equal(exact.description.includes("Altea, Alicante"), true);
});
