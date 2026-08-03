import assert from "node:assert/strict";
import test from "node:test";
import {
  descriptionParagraphsFromText,
  descriptionTextForAdmin,
  formatAreaLabel,
  formatPriceLabel,
  generatePropertyPageSlug,
} from "./formatting.ts";

test("page URL generation normalizes titles and falls back to references", () => {
  assert.equal(
    generatePropertyPageSlug("Villa Altea Hills!", "PS-001"),
    "villa-altea-hills",
  );
  assert.equal(generatePropertyPageSlug("", "PS 001"), "ps-001");
  assert.equal(generatePropertyPageSlug("  ---  ", ""), "property-showcase");
});

test("description text splits on blank lines and remains admin-editable", () => {
  const paragraphs = descriptionParagraphsFromText(
    "First paragraph.\n\nSecond paragraph.",
    "Primer párrafo.\n\nSegundo párrafo.",
  );

  assert.deepEqual(paragraphs, [
    { en: "First paragraph.", es: "Primer párrafo." },
    { en: "Second paragraph.", es: "Segundo párrafo." },
  ]);
  assert.equal(
    descriptionTextForAdmin(paragraphs, "en"),
    "First paragraph.\n\nSecond paragraph.",
  );
});

test("price formatting handles raw and already formatted admin input", () => {
  assert.equal(formatPriceLabel("385560"), "€385,560");
  assert.equal(formatPriceLabel("€385,560"), "€385,560");
  assert.equal(formatPriceLabel("$385,560"), "$385,560");
  assert.equal(formatPriceLabel("385.560 €"), "€385,560");
  assert.equal(formatPriceLabel("Price on request"), "Price on request");
});

test("area formatting adds a default metric unit only to unitless values", () => {
  assert.equal(formatAreaLabel("120"), "120 m²");
  assert.equal(formatAreaLabel("1900 sq ft"), "1,900 sq ft");
  assert.equal(formatAreaLabel("9.19 acres"), "9.19 acres");
  assert.equal(formatAreaLabel("approx. 120"), "approx. 120");
});
