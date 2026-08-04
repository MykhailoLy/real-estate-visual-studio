import assert from "node:assert/strict";
import test from "node:test";
import { costaBlancaDemo } from "./registry.ts";
import { serializePublicPropertyShowcase } from "./public-serialization.ts";
import type { PropertyShowcase } from "./types.ts";

function cloneProperty(): PropertyShowcase {
  return structuredClone(costaBlancaDemo);
}

test("public serialization keeps exact map values only for exact privacy mode", () => {
  const property = cloneProperty();
  property.location = {
    displayAddress: { en: "Exact address" },
    privacyMode: "exact",
    showMap: true,
    latitude: 38.603912,
    longitude: -0.045316,
    mapExternalUrl:
      "https://www.google.com/maps/search/?api=1&query=38.603912%2C-0.045316",
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=exact-parcel",
    useCustomMapEmbed: false,
  };

  const serialized = serializePublicPropertyShowcase(property);

  assert.equal(serialized.location.latitude, 38.603912);
  assert.equal(serialized.location.longitude, -0.045316);
  assert.equal(
    serialized.location.mapExternalUrl,
    "https://www.google.com/maps/search/?api=1&query=38.603912%2C-0.045316",
  );
  assert.equal(
    serialized.location.mapEmbedUrl,
    "https://www.google.com/maps/embed?pb=exact-parcel",
  );
  assert.equal(serialized.location.useCustomMapEmbed, false);
});

test("public serialization removes exact map URLs and rounds approximate coordinates", () => {
  const property = cloneProperty();
  property.location = {
    displayAddress: { en: "Approx area" },
    privacyMode: "approximate",
    showMap: true,
    latitude: 38.603912,
    longitude: -0.045316,
    mapExternalUrl:
      "https://www.google.com/maps/search/?api=1&query=38.603912%2C-0.045316",
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=exact-parcel",
    useCustomMapEmbed: true,
  };

  const serialized = serializePublicPropertyShowcase(property);
  const payload = JSON.stringify(serialized);

  assert.equal(serialized.location.latitude, 38.6);
  assert.equal(serialized.location.longitude, 0);
  assert.equal(serialized.location.displayAddress.en, "");
  assert.equal(serialized.location.mapExternalUrl, undefined);
  assert.equal(serialized.location.mapEmbedUrl, undefined);
  assert.equal(payload.includes("38.603912"), false);
  assert.equal(payload.includes("-0.045316"), false);
  assert.equal(payload.includes("exact-parcel"), false);
  assert.equal(payload.includes("Approx area"), false);
});

test("public serialization removes hidden map and address payload", () => {
  const property = cloneProperty();
  property.location = {
    displayAddress: { en: "123 Hidden Parcel Road" },
    privacyMode: "hidden",
    showMap: false,
    latitude: 38.688771,
    longitude: 0.134412,
    mapExternalUrl:
      "https://www.google.com/maps/search/?api=1&query=38.688771%2C0.134412",
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=hidden-parcel",
    useCustomMapEmbed: true,
  };

  const serialized = serializePublicPropertyShowcase(property);
  const payload = JSON.stringify(serialized);

  assert.equal(serialized.location.displayAddress.en, "");
  assert.equal(serialized.location.latitude, undefined);
  assert.equal(serialized.location.longitude, undefined);
  assert.equal(serialized.location.mapExternalUrl, undefined);
  assert.equal(serialized.location.mapEmbedUrl, undefined);
  assert.equal(payload.includes("38.688771"), false);
  assert.equal(payload.includes("0.134412"), false);
  assert.equal(payload.includes("hidden-parcel"), false);
  assert.equal(payload.includes("123 Hidden Parcel Road"), false);
});
