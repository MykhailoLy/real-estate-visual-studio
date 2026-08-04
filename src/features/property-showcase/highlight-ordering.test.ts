import assert from "node:assert/strict";
import test from "node:test";
import { moveHighlightItem } from "./highlight-ordering.ts";

test("highlight ordering moves the requested row", () => {
  assert.deepEqual(
    moveHighlightItem(["A", "B", "C"], 1, 0),
    ["B", "A", "C"],
  );
  assert.deepEqual(
    moveHighlightItem(["A", "B", "C"], 1, 2),
    ["A", "C", "B"],
  );
});

test("highlight ordering preserves matching translated text indexes", () => {
  const primary = ["Vaulted room", "Walk-in pantry", "Rear deck"];
  const translations = {
    es: ["Salon alto", "Despensa", "Terraza trasera"],
    de: ["Hoher Raum", "Speisekammer", "Hintere Terrasse"],
  };

  assert.deepEqual(moveHighlightItem(primary, 2, 1), [
    "Vaulted room",
    "Rear deck",
    "Walk-in pantry",
  ]);
  assert.deepEqual(moveHighlightItem(translations.es, 2, 1), [
    "Salon alto",
    "Terraza trasera",
    "Despensa",
  ]);
  assert.deepEqual(moveHighlightItem(translations.de, 2, 1), [
    "Hoher Raum",
    "Hintere Terrasse",
    "Speisekammer",
  ]);
});

test("highlight ordering ignores invalid moves", () => {
  assert.deepEqual(moveHighlightItem(["A", "B"], 0, -1), ["A", "B"]);
  assert.deepEqual(moveHighlightItem(["A", "B"], 1, 2), ["A", "B"]);
});
