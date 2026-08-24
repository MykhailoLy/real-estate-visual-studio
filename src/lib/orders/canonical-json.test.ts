import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "./canonical-json.ts";

test("canonical JSON recursively sorts object keys and preserves arrays", () => {
  assert.equal(
    canonicalJson({ z: 1, a: { y: 2, x: 3 }, list: [{ b: 2, a: 1 }] }),
    '{"a":{"x":3,"y":2},"list":[{"a":1,"b":2}],"z":1}',
  );
});

test("canonical JSON omits undefined object properties", () => {
  assert.equal(canonicalJson({ b: undefined, a: null }), '{"a":null}');
});
