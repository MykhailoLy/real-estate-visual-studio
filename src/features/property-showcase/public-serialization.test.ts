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

test("public serialization moves legacy rounded coordinates into the approximate zone", () => {
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

  assert.equal(serialized.location.latitude, undefined);
  assert.equal(serialized.location.longitude, undefined);
  assert.equal(serialized.location.approximateLatitude, 38.6);
  assert.equal(serialized.location.approximateLongitude, 0);
  assert.equal(serialized.location.approximateRadiusMeters, 1500);
  assert.equal(serialized.location.displayAddress.en, "");
  assert.equal(serialized.location.mapExternalUrl, undefined);
  assert.equal(serialized.location.mapEmbedUrl, undefined);
  assert.equal(payload.includes("38.603912"), false);
  assert.equal(payload.includes("-0.045316"), false);
  assert.equal(payload.includes("exact-parcel"), false);
  assert.equal(payload.includes("Approx area"), false);
});

test("public serialization preserves an explicit approximate center and radius only", () => {
  const property = cloneProperty();
  property.location = {
    displayAddress: { en: "Private exact parcel" },
    approximateLabel: { en: "Public district" },
    privacyMode: "approximate",
    showMap: true,
    latitude: 38.603912,
    longitude: -0.045316,
    approximateLatitude: 38.72,
    approximateLongitude: -0.12,
    approximateRadiusMeters: 2600,
    allowApproximateAreaLink: true,
    mapExternalUrl: "https://www.google.com/maps/place/private-exact-parcel",
  };

  const serialized = serializePublicPropertyShowcase(property);
  const payload = JSON.stringify(serialized);

  assert.equal(serialized.location.latitude, undefined);
  assert.equal(serialized.location.longitude, undefined);
  assert.equal(serialized.location.approximateLatitude, 38.72);
  assert.equal(serialized.location.approximateLongitude, -0.12);
  assert.equal(serialized.location.approximateRadiusMeters, 2600);
  assert.equal(serialized.location.allowApproximateAreaLink, true);
  assert.equal(serialized.location.displayAddress.en, "Public district");
  assert.equal(payload.includes("38.603912"), false);
  assert.equal(payload.includes("-0.045316"), false);
  assert.equal(payload.includes("private-exact-parcel"), false);
  assert.equal(payload.includes("Private exact parcel"), false);
  assert.equal(payload.includes("Public district"), true);
});

test("approximate privacy remains safe when the map is disabled", () => {
  const property = cloneProperty();
  property.location = {
    displayAddress: { en: "88 Private Exact Street" },
    approximateLabel: { en: "Public city label" },
    privacyMode: "approximate",
    showMap: false,
    latitude: 38.603912,
    longitude: -0.045316,
    approximateLatitude: 38.7,
    approximateLongitude: -0.1,
    approximateRadiusMeters: 2200,
  };

  const serialized = serializePublicPropertyShowcase(property);
  const payload = JSON.stringify(serialized);

  assert.equal(serialized.location.displayAddress.en, "Public city label");
  assert.equal(serialized.location.latitude, undefined);
  assert.equal(serialized.location.longitude, undefined);
  assert.equal(serialized.location.approximateLatitude, undefined);
  assert.equal(serialized.location.approximateLongitude, undefined);
  assert.equal(serialized.location.approximateRadiusMeters, undefined);
  assert.equal(serialized.location.allowApproximateAreaLink, undefined);
  assert.equal(payload.includes("88 Private Exact Street"), false);
  assert.equal(payload.includes("38.603912"), false);
});

test("public serialization removes hidden map and address payload", () => {
  const property = cloneProperty();
  property.location = {
    displayAddress: { en: "123 Hidden Parcel Road" },
    approximateLabel: { en: "Hidden district" },
    privacyMode: "hidden",
    showMap: false,
    latitude: 38.688771,
    longitude: 0.134412,
    approximateLatitude: 38.7,
    approximateLongitude: 0.1,
    approximateRadiusMeters: 1200,
    mapExternalUrl:
      "https://www.google.com/maps/search/?api=1&query=38.688771%2C0.134412",
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=hidden-parcel",
    useCustomMapEmbed: true,
  };

  const serialized = serializePublicPropertyShowcase(property);
  const payload = JSON.stringify(serialized);

  assert.equal(serialized.location.displayAddress.en, "");
  assert.equal(serialized.location.approximateLabel, undefined);
  assert.equal(serialized.location.latitude, undefined);
  assert.equal(serialized.location.longitude, undefined);
  assert.equal(serialized.location.approximateLatitude, undefined);
  assert.equal(serialized.location.approximateLongitude, undefined);
  assert.equal(serialized.location.approximateRadiusMeters, undefined);
  assert.equal(serialized.location.mapExternalUrl, undefined);
  assert.equal(serialized.location.mapEmbedUrl, undefined);
  assert.equal(payload.includes("38.688771"), false);
  assert.equal(payload.includes("0.134412"), false);
  assert.equal(payload.includes("hidden-parcel"), false);
  assert.equal(payload.includes("123 Hidden Parcel Road"), false);
  assert.equal(payload.includes("Hidden district"), false);
});
