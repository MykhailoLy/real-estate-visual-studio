import assert from "node:assert/strict";
import test from "node:test";
import { costaBlancaDemo } from "./registry.ts";
import {
  getPrimaryLanguage,
  getPropertyLanguageOptions,
  localizedText,
  translationCompletion,
} from "./localization.ts";
import { normalizeChecklistHighlights } from "./listing-details.ts";
import type { PropertyShowcase } from "./types.ts";

function cloneProperty(): PropertyShowcase {
  return structuredClone(costaBlancaDemo);
}

test("primary-language fallback uses the configured primary language", () => {
  const property = cloneProperty();
  property.primaryLanguage = "es";
  property.languages = ["es", "fr"];
  property.title = { en: "English title", es: "Titulo principal" };

  assert.equal(getPrimaryLanguage(property), "es");
  assert.equal(localizedText(property.title, "fr", "es"), "Titulo principal");
});

test("legacy English and Spanish content remains selectable", () => {
  const property = cloneProperty();
  property.primaryLanguage = undefined;
  property.languages = ["en", "es"];
  property.translations = undefined;
  property.title = { en: "Legacy English", es: "Legacy Spanish" };
  property.summary = { en: "Legacy summary", es: "Resumen legado" };
  property.description = [{ en: "Legacy description", es: "Descripcion legado" }];
  property.highlights = [{ title: { en: "Legacy", es: "Legado" } }];

  assert.deepEqual(getPropertyLanguageOptions(property), ["en", "es"]);
  assert.equal(localizedText(property.title, "es", "en"), "Legacy Spanish");
});

test("translation selection includes keyed translations", () => {
  const property = cloneProperty();
  property.languages = ["en"];
  property.translations = {
    fr: { title: "Titre francais" },
    nl: { summary: "Nederlandse samenvatting" },
  };
  property.title.fr = "Titre francais";

  assert.deepEqual(getPropertyLanguageOptions(property), ["en", "fr", "nl", "es", "de"]);
});

test("translation completion measures direct translations, not fallback text", () => {
  const property = cloneProperty();
  property.languages = ["en", "fr"];
  property.title.fr = "Titre";
  property.summary.fr = "";
  property.description = [{ en: "English paragraph." }];
  property.highlights = [{ text: { en: "English highlight" } }];

  assert.equal(translationCompletion(property, "fr"), 25);
});

test("checklist conversion supports new text and legacy title highlights", () => {
  const property = cloneProperty();
  property.highlights = [
    { text: { en: "New checklist item" } },
    {
      title: { en: "Legacy title" },
      description: { en: "Legacy description" },
    },
  ];

  assert.deepEqual(normalizeChecklistHighlights(property, "en"), [
    "New checklist item",
    "Legacy title",
  ]);
});
