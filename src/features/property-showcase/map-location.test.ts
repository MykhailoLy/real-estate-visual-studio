import assert from "node:assert/strict";
import test from "node:test";
import {
  APPROXIMATE_CENTER_MAX_DISTANCE_MULTIPLIER,
  APPROXIMATE_CENTER_MIN_DISTANCE_MULTIPLIER,
  createApproximateMapCenter,
  distanceBetweenCoordinatesMeters,
  extractGoogleMapsCoordinates,
  isSafeApproximateMapCenter,
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

test("generated and regenerated approximate centers stay beyond the privacy radius", () => {
  const exact = { latitude: 31.4982437, longitude: -110.1957096 };
  const privacyRadiusMeters = 1_500;
  const generated = createApproximateMapCenter(
    exact,
    privacyRadiusMeters,
    () => 0,
  );
  const regenerated = createApproximateMapCenter(
    exact,
    privacyRadiusMeters,
    () => 0.75,
  );
  const generatedDistance = distanceBetweenCoordinatesMeters(exact, generated);
  const regeneratedDistance = distanceBetweenCoordinatesMeters(
    exact,
    regenerated,
  );

  for (const distance of [generatedDistance, regeneratedDistance]) {
    assert.ok(distance >= privacyRadiusMeters);
    assert.ok(
      distance <=
        privacyRadiusMeters * APPROXIMATE_CENTER_MAX_DISTANCE_MULTIPLIER + 1,
    );
  }
  assert.ok(
    generatedDistance >=
      privacyRadiusMeters * APPROXIMATE_CENTER_MIN_DISTANCE_MULTIPLIER - 1,
  );
  assert.equal(
    isSafeApproximateMapCenter(exact, generated, privacyRadiusMeters),
    true,
  );
  assert.equal(
    isSafeApproximateMapCenter(exact, regenerated, privacyRadiusMeters),
    true,
  );
});

test("privacy radius increases regenerate only centers that become too close", () => {
  const exact = { latitude: 31.4982437, longitude: -110.1957096 };
  const existing = createApproximateMapCenter(exact, 1_500, () => 0);

  assert.equal(isSafeApproximateMapCenter(exact, existing, 1_500), true);
  assert.equal(isSafeApproximateMapCenter(exact, existing, 1_800), false);
  assert.equal(isSafeApproximateMapCenter(exact, existing, 900), true);

  const regeneratedForIncrease = createApproximateMapCenter(
    exact,
    1_800,
    () => 0,
  );
  assert.equal(
    isSafeApproximateMapCenter(exact, regeneratedForIncrease, 1_800),
    true,
  );
});

test("exact and floating-point-near centers are never privacy-safe", () => {
  const exact = { latitude: 31.4982437, longitude: -110.1957096 };

  assert.equal(isSafeApproximateMapCenter(exact, exact, 1_500), false);
  assert.equal(
    isSafeApproximateMapCenter(
      exact,
      { latitude: exact.latitude + 0.000000001, longitude: exact.longitude },
      1_500,
    ),
    false,
  );
});
