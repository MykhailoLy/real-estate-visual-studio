import assert from "node:assert/strict";
import test from "node:test";
import {
  createApproximateMapCenter,
  distanceBetweenCoordinatesMeters,
  extractGoogleMapsCoordinates,
  resolveGoogleMapsLink,
} from "./map-location.ts";

test("extracts coordinates from common expanded Google Maps links", () => {
  assert.deepEqual(
    extractGoogleMapsCoordinates(
      "https://www.google.com/maps/search/?api=1&query=31.4982437%2C-110.1957096",
    ),
    { latitude: 31.4982437, longitude: -110.1957096 },
  );
  assert.deepEqual(
    extractGoogleMapsCoordinates(
      "https://www.google.com/maps/place/Example/@31.4982437,-110.1957096,16z",
    ),
    { latitude: 31.4982437, longitude: -110.1957096 },
  );
  assert.deepEqual(
    extractGoogleMapsCoordinates(
      "https://www.google.com/maps/place/Example/data=!3d31.4982437!4d-110.1957096",
    ),
    { latitude: 31.4982437, longitude: -110.1957096 },
  );
});

test("does not parse unsafe or non-coordinate Google Maps inputs", () => {
  assert.equal(
    extractGoogleMapsCoordinates("https://www.google.com.evil.example/maps?q=1,2"),
    null,
  );
  assert.equal(
    extractGoogleMapsCoordinates("https://www.google.com/maps/place/Arroyo+Vista"),
    null,
  );
  assert.equal(
    extractGoogleMapsCoordinates("https://www.google.com/maps/place/%ZZ"),
    null,
  );
});

test("resolves only trusted Google Maps redirects", async () => {
  const resolved = await resolveGoogleMapsLink(
    "https://maps.app.goo.gl/example",
    async () => new Response(null, {
      status: 302,
      headers: {
        location: "https://www.google.com/maps/place/Example/@31.4982437,-110.1957096,16z",
      },
    }),
  );
  assert.equal(resolved.ok, true);
  if (resolved.ok) {
    assert.deepEqual(resolved.value.coordinates, {
      latitude: 31.4982437,
      longitude: -110.1957096,
    });
  }

  const rejected = await resolveGoogleMapsLink(
    "https://maps.app.goo.gl/example",
    async () => new Response(null, {
      status: 302,
      headers: { location: "https://evil.example/coordinates" },
    }),
  );
  assert.deepEqual(rejected, {
    ok: false,
    error: "The Google Maps link redirected to an unsupported destination.",
  });
});

test("generated approximate centers remain inside the requested privacy radius", () => {
  const exact = { latitude: 31.4982437, longitude: -110.1957096 };
  const center = createApproximateMapCenter(exact, 1_500, () => 0.5);
  const distance = distanceBetweenCoordinatesMeters(exact, center);

  assert.ok(distance >= 899);
  assert.ok(distance <= 1_501);
});
