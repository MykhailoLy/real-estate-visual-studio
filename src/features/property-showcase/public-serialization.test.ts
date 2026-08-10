import assert from "node:assert/strict";
import test from "node:test";
import { getPropertyMapView } from "./listing-details.ts";
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

test("public serialization never derives an approximate point from an exact location", () => {
  const property = cloneProperty();
  property.location = {
    displayAddress: { en: "Approx area" },
    streetAddress: "123 Private Parcel Road",
    city: "Altea",
    postalCode: "03590",
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
  assert.equal(serialized.location.approximateLatitude, undefined);
  assert.equal(serialized.location.approximateLongitude, undefined);
  assert.equal(serialized.location.approximateRadiusMeters, 1500);
  assert.equal(serialized.location.displayAddress.en, "");
  assert.equal(serialized.location.streetAddress, undefined);
  assert.equal(serialized.location.city, undefined);
  assert.equal(serialized.location.postalCode, undefined);
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
    streetAddress: "123 Private Parcel Road",
    city: "Altea",
    region: "Alicante",
    postalCode: "03590",
    country: "Spain",
    approximateLabel: { en: "Public district" },
    privacyMode: "approximate",
    showMap: true,
    latitude: 38.603912,
    longitude: -0.045316,
    approximateLatitude: 38.72,
    approximateLongitude: -0.12,
    approximateRadiusMeters: 2600,
    allowApproximateAreaLink: true,
    googleMapsLink:
      "https://www.google.com/maps/search/?api=1&query=38.603912%2C-0.045316",
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
  assert.equal(serialized.location.streetAddress, undefined);
  assert.equal(serialized.location.city, undefined);
  assert.equal(serialized.location.region, undefined);
  assert.equal(serialized.location.postalCode, undefined);
  assert.equal(serialized.location.country, undefined);
  assert.equal(serialized.location.googleMapsLink, undefined);
  assert.equal(payload.includes("38.603912"), false);
  assert.equal(payload.includes("-0.045316"), false);
  assert.equal(payload.includes("google.com/maps/search"), false);
  assert.equal(payload.includes("private-exact-parcel"), false);
  assert.equal(payload.includes("Private exact parcel"), false);
  assert.equal(payload.includes("Public district"), true);
});

test("unsafe legacy approximate coordinates fail closed in public props and map output", () => {
  const property = cloneProperty();
  const exactLatitude = 31.4982437;
  const exactLongitude = -110.1957096;
  property.location = {
    displayAddress: { en: "2418 Copper Mesa Drive" },
    approximateLabel: { en: "Arroyo Vista, Arizona" },
    privacyMode: "approximate",
    showMap: true,
    latitude: exactLatitude,
    longitude: exactLongitude,
    approximateLatitude: exactLatitude,
    approximateLongitude: exactLongitude,
    approximateRadiusMeters: 1500,
    googleMapsLink:
      "https://www.google.com/maps/search/?api=1&query=31.4982437%2C-110.1957096",
    mapExternalUrl:
      "https://www.google.com/maps/search/?api=1&query=31.4982437%2C-110.1957096",
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=private-exact-parcel",
    useCustomMapEmbed: true,
  };

  const serialized = serializePublicPropertyShowcase(property);
  const mapView = getPropertyMapView(serialized, "en");
  const publicPayload = JSON.stringify({ property: serialized, mapView });

  assert.equal(serialized.location.approximateLatitude, undefined);
  assert.equal(serialized.location.approximateLongitude, undefined);
  assert.equal(mapView.mode, "fallback");
  assert.equal(mapView.embedUrl, undefined);
  assert.equal(mapView.externalUrl, undefined);
  assert.equal(publicPayload.includes("31.4982437"), false);
  assert.equal(publicPayload.includes("-110.1957096"), false);
  assert.equal(publicPayload.includes("private-exact-parcel"), false);
  assert.equal(publicPayload.includes("google.com/maps/search"), false);
  assert.equal(publicPayload.includes("2418 Copper Mesa Drive"), false);
  assert.equal(publicPayload.includes("Arroyo Vista, Arizona"), true);
});

test("a raw Google Maps source link cannot validate an unsafe public center", () => {
  const property = cloneProperty();
  property.location = {
    displayAddress: { en: "2418 Copper Mesa Drive" },
    approximateLabel: { en: "Arroyo Vista, Arizona" },
    privacyMode: "approximate",
    showMap: true,
    approximateLatitude: 31.4982437,
    approximateLongitude: -110.1957096,
    approximateRadiusMeters: 1500,
    googleMapsLink:
      "https://www.google.com/maps/search/?api=1&query=31.4982437%2C-110.1957096",
  };

  const serialized = serializePublicPropertyShowcase(property);
  const mapView = getPropertyMapView(serialized, "en");
  const publicPayload = JSON.stringify({ property: serialized, mapView });

  assert.equal(serialized.location.approximateLatitude, undefined);
  assert.equal(serialized.location.approximateLongitude, undefined);
  assert.equal(mapView.embedUrl, undefined);
  assert.equal(mapView.externalUrl, undefined);
  assert.equal(publicPayload.includes("31.4982437"), false);
  assert.equal(publicPayload.includes("-110.1957096"), false);
  assert.equal(publicPayload.includes("google.com/maps/search"), false);
});

test("an unverified legacy custom map source fails closed in approximate mode", () => {
  const property = cloneProperty();
  property.location = {
    displayAddress: { en: "2418 Copper Mesa Drive" },
    approximateLabel: { en: "Arroyo Vista, Arizona" },
    privacyMode: "approximate",
    showMap: true,
    approximateLatitude: 31.4982437,
    approximateLongitude: -110.1957096,
    approximateRadiusMeters: 1500,
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=unverified-legacy-map",
    useCustomMapEmbed: true,
  };

  const serialized = serializePublicPropertyShowcase(property);
  const mapView = getPropertyMapView(serialized, "en");
  const publicPayload = JSON.stringify({ property: serialized, mapView });

  assert.equal(serialized.location.approximateLatitude, undefined);
  assert.equal(serialized.location.approximateLongitude, undefined);
  assert.equal(mapView.embedUrl, undefined);
  assert.equal(mapView.externalUrl, undefined);
  assert.equal(publicPayload.includes("unverified-legacy-map"), false);
  assert.equal(publicPayload.includes("31.4982437"), false);
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
    streetAddress: "123 Hidden Parcel Road",
    city: "Altea",
    region: "Alicante",
    postalCode: "03590",
    country: "Spain",
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
  assert.equal(serialized.location.streetAddress, undefined);
  assert.equal(serialized.location.city, undefined);
  assert.equal(serialized.location.region, undefined);
  assert.equal(serialized.location.postalCode, undefined);
  assert.equal(serialized.location.country, undefined);
  assert.equal(serialized.location.latitude, undefined);
  assert.equal(serialized.location.longitude, undefined);
  assert.equal(serialized.location.approximateLatitude, undefined);
  assert.equal(serialized.location.approximateLongitude, undefined);
  assert.equal(serialized.location.approximateRadiusMeters, undefined);
  assert.equal(serialized.location.mapExternalUrl, undefined);
  assert.equal(serialized.location.mapEmbedUrl, undefined);
  assert.equal(serialized.location.googleMapsLink, undefined);
  assert.equal(payload.includes("google.com/maps/search"), false);
  assert.equal(payload.includes("38.688771"), false);
  assert.equal(payload.includes("0.134412"), false);
  assert.equal(payload.includes("hidden-parcel"), false);
  assert.equal(payload.includes("123 Hidden Parcel Road"), false);
  assert.equal(payload.includes("Hidden district"), false);
});

test("disabled video metadata remains private while enabled metadata is sanitized", () => {
  const property = cloneProperty();
  property.videos = {
    enabled: false,
    items: [
      {
        id: "hidden-film",
        provider: "youtube",
        externalUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
        posterUrl: "https://evil.example/poster.jpg",
        sortOrder: 1,
      },
    ],
  };
  const hidden = serializePublicPropertyShowcase(property);
  assert.deepEqual(hidden.videos, { enabled: false, items: [] });

  property.videos.enabled = true;
  const enabled = serializePublicPropertyShowcase(property);
  assert.equal(enabled.videos?.items.length, 1);
  assert.equal(enabled.videos?.items[0].posterUrl, undefined);
  assert.equal(
    enabled.videos?.items[0].embedUrl,
    "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ",
  );
});
