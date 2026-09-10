import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOrderImageNavigationItems,
  resolveOrderImageTarget,
  selectActiveOrderImageId,
  shouldShowOrderImageNavigator,
} from "./order-image-navigation.ts";

interface RestoredItem {
  clientItemId: string;
  filename: string;
  instructions: string;
}

const build = (items: readonly RestoredItem[]) =>
  buildOrderImageNavigationItems(
    items,
    (item) => item.clientItemId,
    (item) => `order-image-${item.clientItemId}`,
  );

test("navigator count and order follow the visible card collection", () => {
  const cards = Array.from({ length: 12 }, (_, index) => ({
    clientItemId: `stable-${index + 1}`,
    filename: `property-room-${index + 1}.jpg`,
    instructions: `Instructions ${index + 1}`,
  }));

  const navigation = build(cards);
  assert.equal(navigation.length, cards.length);
  assert.deepEqual(
    navigation.map((item) => item.id),
    cards.map((item) => item.clientItemId),
  );
});

test("a navigator selection resolves to the matching card anchor", () => {
  const navigation = build([
    { clientItemId: "first", filename: "living-room.jpg", instructions: "" },
    { clientItemId: "second", filename: "kitchen.jpg", instructions: "" },
  ]);

  assert.equal(resolveOrderImageTarget(navigation, "second"), "order-image-second");
  assert.equal(resolveOrderImageTarget(navigation, "missing"), null);
});

test("active state follows the intersecting card nearest the reading position", () => {
  assert.equal(
    selectActiveOrderImageId([
      { id: "first", isIntersecting: false, top: -800 },
      { id: "second", isIntersecting: true, top: -40 },
      { id: "third", isIntersecting: true, top: 220 },
    ]),
    "second",
  );
  assert.equal(
    selectActiveOrderImageId([{ id: "first", isIntersecting: false, top: 0 }]),
    null,
  );
});

test("one card stays visually quiet while large orders remain fully navigable", () => {
  assert.equal(shouldShowOrderImageNavigator(1), false);
  assert.equal(shouldShowOrderImageNavigator(2), true);

  const largeOrder = Array.from({ length: 25 }, (_, index) => ({
    clientItemId: `item-${index + 1}`,
    filename: `room-${index + 1}.jpg`,
    instructions: "",
  }));
  assert.equal(build(largeOrder).length, 25);
  assert.equal(resolveOrderImageTarget(build(largeOrder), "item-25"), "order-image-item-25");
});

test("draft-restored order and item data remain untouched", () => {
  const restored = [
    { clientItemId: "saved-c", filename: "terrace.jpg", instructions: "Keep the view" },
    { clientItemId: "saved-a", filename: "lounge.jpg", instructions: "Warm neutral style" },
    { clientItemId: "saved-b", filename: "kitchen.jpg", instructions: "Remove stools" },
  ];
  const snapshot = structuredClone(restored);

  const navigation = build(restored);

  assert.deepEqual(navigation.map((item) => item.id), ["saved-c", "saved-a", "saved-b"]);
  assert.deepEqual(restored, snapshot);
});
