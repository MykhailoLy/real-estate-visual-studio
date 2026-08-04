import assert from "node:assert/strict";
import test from "node:test";
import {
  descriptionParagraphsFromLanguageTexts,
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
    "Primer parrafo.\n\nSegundo parrafo.",
  );

  assert.deepEqual(paragraphs, [
    { en: "First paragraph.", es: "Primer parrafo." },
    { en: "Second paragraph.", es: "Segundo parrafo." },
  ]);
  assert.equal(
    descriptionTextForAdmin(paragraphs, "en"),
    "First paragraph.\n\nSecond paragraph.",
  );
});

test("multilingual description paragraphs preserve primary-language fallback", () => {
  assert.deepEqual(
    descriptionParagraphsFromLanguageTexts(
      {
        es: "Primero.\n\nSegundo.",
        fr: "Premier.",
      },
      "es",
    ),
    [
      { en: "Primero.", es: "Primero.", fr: "Premier." },
      { en: "Segundo.", es: "Segundo." },
    ],
  );
});

test("price formatting preserves entered currency instead of assuming EUR", () => {
  assert.equal(formatPriceLabel("385560"), "385,560");
  assert.equal(formatPriceLabel("\u20ac385,560"), "\u20ac385,560");
  assert.equal(formatPriceLabel("$385,560"), "$385,560");
  assert.equal(formatPriceLabel("385.560 \u20ac"), "\u20ac385,560");
  assert.equal(formatPriceLabel("Price on request"), "Price on request");
});

test("area formatting preserves entered units and leaves unitless values unitless", () => {
  assert.equal(formatAreaLabel("120"), "120");
  assert.equal(formatAreaLabel("1900 sq ft"), "1,900\u00a0sq ft");
  assert.equal(formatAreaLabel("9.19 acres"), "9.19\u00a0acres");
  assert.equal(formatAreaLabel("approx. 120"), "approx. 120");
});
