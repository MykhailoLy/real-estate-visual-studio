import assert from "node:assert/strict";
import test from "node:test";
import { costaBlancaDemo } from "./registry.ts";
import { PropertyShowcaseSchema } from "./schema.ts";
import {
  DEFAULT_PROPERTY_SOCIAL_CARD_CONFIG,
  getPropertySocialCardFacts,
  movePropertySocialCardFact,
  normalizePropertySocialCardConfig,
  PROPERTY_SOCIAL_CARD_LAYOUTS,
  resetPropertySocialCardConfig,
  setPropertySocialCardFactVisible,
} from "./social-card.ts";
import type { PropertyShowcase } from "./types.ts";

function cloneProperty(): PropertyShowcase {
  return structuredClone(costaBlancaDemo);
}

test("properties without settings use backward-compatible automatic defaults", () => {
  const property = cloneProperty();
  delete property.socialCard;

  assert.deepEqual(
    normalizePropertySocialCardConfig(property.socialCard),
    DEFAULT_PROPERTY_SOCIAL_CARD_CONFIG,
  );
  assert.deepEqual(
    getPropertySocialCardFacts(property).map((fact) => fact.key),
    ["bedrooms", "bathrooms", "built-area", "parking"],
  );
});

test("automatic mode skips hidden and empty facts then continues its priority", () => {
  const property = cloneProperty();
  property.facts = property.facts.map((fact) =>
    fact.key === "bathrooms"
      ? { ...fact, visible: false }
      : fact.key === "parking"
        ? { ...fact, value: " " }
        : fact,
  );

  assert.deepEqual(
    getPropertySocialCardFacts(property).map((fact) => fact.key),
    ["bedrooms", "built-area", "plot-area", "year-built"],
  );
});

test("custom mode honors selected fact order and skips unavailable facts", () => {
  const property = cloneProperty();
  property.socialCard = {
    ...resetPropertySocialCardConfig(),
    mode: "custom",
    visibleFacts: ["year-built", "listing-reference", "bathrooms", "parking"],
    factOrder: [
      "parking",
      "bathrooms",
      "listing-reference",
      "year-built",
      "bedrooms",
      "built-area",
      "plot-area",
    ],
  };
  property.facts = property.facts.map((fact) =>
    fact.key === "bathrooms" ? { ...fact, visible: false } : fact,
  );

  assert.deepEqual(
    getPropertySocialCardFacts(property).map((fact) => fact.key),
    ["parking", "listing-reference", "year-built"],
  );
});

test("minimal layout uses one dominant-image definition and at most two facts", () => {
  const property = cloneProperty();
  property.socialCard = {
    ...resetPropertySocialCardConfig(),
    layout: "minimal",
  };

  assert.equal(PROPERTY_SOCIAL_CARD_LAYOUTS["image-focused"].imageWidth, 880);
  assert.equal(PROPERTY_SOCIAL_CARD_LAYOUTS.balanced.imageWidth, 760);
  assert.equal(PROPERTY_SOCIAL_CARD_LAYOUTS.minimal.showSupportingImages, false);
  assert.equal(getPropertySocialCardFacts(property).length, 2);
});

test("custom selection enforces four facts and exposes accessible reorder state", () => {
  let config = resetPropertySocialCardConfig();
  config = { ...config, mode: "custom" };
  const blocked = setPropertySocialCardFactVisible(
    config,
    "year-built",
    true,
  );
  assert.equal(blocked.error, "Choose up to 4 facts.");
  assert.deepEqual(blocked.config.visibleFacts, config.visibleFacts);

  const moved = movePropertySocialCardFact(config, "parking", -1);
  assert.deepEqual(moved.factOrder.slice(0, 4), [
    "bedrooms",
    "bathrooms",
    "parking",
    "built-area",
  ]);
});

test("social card JSON schema accepts valid settings and rejects more than four facts", () => {
  const property = cloneProperty();
  delete property.translations;
  property.socialCard = resetPropertySocialCardConfig();
  assert.equal(PropertyShowcaseSchema.safeParse(property).success, true);

  const invalid = structuredClone(property) as PropertyShowcase & {
    socialCard: NonNullable<PropertyShowcase["socialCard"]>;
  };
  invalid.socialCard.visibleFacts = [
    "bedrooms",
    "bathrooms",
    "built-area",
    "parking",
    "year-built",
  ];
  assert.equal(PropertyShowcaseSchema.safeParse(invalid).success, false);
});
