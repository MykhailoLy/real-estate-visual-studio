import assert from "node:assert/strict";
import test from "node:test";
import {
  focalPointToObjectPosition,
  normalizePropertyImageFocalPoint,
} from "./focal-point.ts";

test("missing and invalid focal points safely normalize to centre", () => {
  assert.deepEqual(normalizePropertyImageFocalPoint(undefined), { x: 0.5, y: 0.5 });
  assert.deepEqual(
    normalizePropertyImageFocalPoint({ x: Number.NaN, y: Number.POSITIVE_INFINITY }),
    { x: 0.5, y: 0.5 },
  );
});
test("focal points are clamped and converted to deterministic CSS positions", () => {
  assert.deepEqual(normalizePropertyImageFocalPoint({ x: -0.2, y: 1.4 }), {
    x: 0,
    y: 1,
  });
  assert.equal(focalPointToObjectPosition({ x: 0.123456, y: 0.75 }), "12.346% 75%");
  assert.equal(focalPointToObjectPosition(undefined), "50% 50%");
});
