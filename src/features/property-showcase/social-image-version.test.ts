import assert from "node:assert/strict";
import test from "node:test";
import { costaBlancaDemo } from "./registry.ts";
import { normalizePropertySocialCardConfig } from "./social-card.ts";
import {
  computePropertySocialImageVersion,
  createPropertySocialImageVersionInput,
  stableSerializeSocialImageVersionInput,
} from "./social-image-version.ts";
import type { PropertyShowcase } from "./types.ts";

function cloneProperty(): PropertyShowcase {
  return structuredClone(costaBlancaDemo);
}

function customFactProperty(): PropertyShowcase {
  const property = cloneProperty();
  property.socialCard = {
    ...normalizePropertySocialCardConfig(property.socialCard),
    mode: "custom",
    visibleFacts: ["bedrooms", "bathrooms", "built-area", "year-built"],
    factOrder: [
      "bedrooms",
      "bathrooms",
      "built-area",
      "year-built",
      "listing-reference",
      "parking",
      "plot-area",
    ],
  };
  return property;
}

test("identical public social-card inputs produce the same short SHA-256 version", () => {
  const first = cloneProperty();
  const second = structuredClone(first);

  assert.equal(
    computePropertySocialImageVersion(first),
    computePropertySocialImageVersion(second),
  );
  assert.match(computePropertySocialImageVersion(first), /^[0-9a-f]{14}$/);
  assert.equal(
    stableSerializeSocialImageVersionInput({ z: 1, a: undefined }),
    stableSerializeSocialImageVersionInput({ a: undefined, z: 1 }),
  );
});

test("changing the primary social image changes the version", () => {
  const property = cloneProperty();
  const changed = cloneProperty();
  for (const image of changed.gallery) {
    image.primarySocialPreview = image.id === "living-room";
  }

  assert.notEqual(
    computePropertySocialImageVersion(property),
    computePropertySocialImageVersion(changed),
  );
});

test("adding a sharing image or changing supporting-image order changes the version", () => {
  const property = cloneProperty();
  const exterior = property.gallery.find((image) => image.id === "exterior");
  const livingRoom = property.gallery.find(
    (image) => image.id === "living-room",
  );
  assert.ok(exterior);
  assert.ok(livingRoom);
  exterior.featuredForSharing = true;
  exterior.socialPreviewOrder = 2;
  livingRoom.socialPreviewOrder = 3;

  const reordered = structuredClone(property);
  const reorderedExterior = reordered.gallery.find(
    (image) => image.id === "exterior",
  );
  const reorderedLivingRoom = reordered.gallery.find(
    (image) => image.id === "living-room",
  );
  assert.ok(reorderedExterior);
  assert.ok(reorderedLivingRoom);
  reorderedExterior.socialPreviewOrder = 3;
  reorderedLivingRoom.socialPreviewOrder = 2;

  const removed = structuredClone(property);
  const removedExterior = removed.gallery.find(
    (image) => image.id === "exterior",
  );
  assert.ok(removedExterior);
  removedExterior.featuredForSharing = false;

  assert.notEqual(
    computePropertySocialImageVersion(property),
    computePropertySocialImageVersion(reordered),
  );
  assert.notEqual(
    computePropertySocialImageVersion(property),
    computePropertySocialImageVersion(removed),
  );
});

test("changing social-card layout or branding mode changes the version", () => {
  const property = cloneProperty();
  const layoutChanged = cloneProperty();
  layoutChanged.socialCard = {
    ...normalizePropertySocialCardConfig(layoutChanged.socialCard),
    layout: "minimal",
  };
  const brandingChanged = cloneProperty();
  brandingChanged.socialPreview = { brandingMode: "agency" };

  assert.notEqual(
    computePropertySocialImageVersion(property),
    computePropertySocialImageVersion(layoutChanged),
  );
  assert.notEqual(
    computePropertySocialImageVersion(property),
    computePropertySocialImageVersion(brandingChanged),
  );
});

test("changing resolved branded card colors or social copy changes the version", () => {
  const property = cloneProperty();
  property.branding = {
    enabled: true,
    brandName: "Alegria Real Estate",
    primaryColor: "#3B0000",
    accentColor: "#FF8A00",
  };
  property.socialPreview = {
    brandingMode: "agency",
    titleMode: "custom",
    customTitle: { en: "Luxury Home in Altea Hills" },
    descriptionMode: "custom",
    customDescription: { en: "Exclusive home with panoramic surroundings." },
  };
  const changedColor = structuredClone(property);
  if (changedColor.branding) changedColor.branding.primaryColor = "#0B1F3A";
  const changedCopy = structuredClone(property);
  changedCopy.socialPreview = {
    ...changedCopy.socialPreview,
    customDescription: { en: "A different custom description." },
  };

  const version = computePropertySocialImageVersion(property);
  assert.notEqual(version, computePropertySocialImageVersion(changedColor));
  assert.notEqual(version, computePropertySocialImageVersion(changedCopy));
});

test("changing visible fact selection or order changes the version", () => {
  const property = customFactProperty();
  const reordered = structuredClone(property);
  assert.ok(reordered.socialCard);
  reordered.socialCard.factOrder = [
    "bathrooms",
    "bedrooms",
    "built-area",
    "year-built",
    "listing-reference",
    "parking",
    "plot-area",
  ];
  const selectionChanged = structuredClone(property);
  assert.ok(selectionChanged.socialCard);
  selectionChanged.socialCard.visibleFacts = [
    "bedrooms",
    "bathrooms",
    "built-area",
    "listing-reference",
  ];

  assert.notEqual(
    computePropertySocialImageVersion(property),
    computePropertySocialImageVersion(reordered),
  );
  assert.notEqual(
    computePropertySocialImageVersion(property),
    computePropertySocialImageVersion(selectionChanged),
  );
});

test("changing title, displayed price, or a displayed listing fact changes the version", () => {
  const property = cloneProperty();
  const titleChanged = cloneProperty();
  titleChanged.title.en = "Updated public title";
  const priceChanged = cloneProperty();
  priceChanged.price = "995000";
  const factChanged = cloneProperty();
  const bedrooms = factChanged.facts.find((fact) => fact.key === "bedrooms");
  assert.ok(bedrooms);
  bedrooms.value = "5";
  const yearChanged = cloneProperty();
  const yearBuilt = yearChanged.facts.find(
    (fact) => fact.key === "year-built",
  );
  assert.ok(yearBuilt);
  yearBuilt.value = "2025";

  const originalVersion = computePropertySocialImageVersion(property);
  assert.notEqual(
    originalVersion,
    computePropertySocialImageVersion(titleChanged),
  );
  assert.notEqual(
    originalVersion,
    computePropertySocialImageVersion(priceChanged),
  );
  assert.notEqual(
    originalVersion,
    computePropertySocialImageVersion(factChanged),
  );
  assert.notEqual(
    originalVersion,
    computePropertySocialImageVersion(yearChanged),
  );
});

test("agency name and logo affect the version only in agency branding mode", () => {
  const property = cloneProperty();
  property.socialPreview = { brandingMode: "agency" };
  property.agent.agencyName = "Public Agency";
  property.agent.logoUrl = "/brand/agency-a.png";
  const changed = structuredClone(property);
  changed.agent.agencyName = "Updated Public Agency";
  changed.agent.logoUrl = "/brand/agency-b.png";

  assert.notEqual(
    computePropertySocialImageVersion(property),
    computePropertySocialImageVersion(changed),
  );

  property.socialPreview = { brandingMode: "picchuspot" };
  changed.socialPreview = { brandingMode: "picchuspot" };
  assert.equal(
    computePropertySocialImageVersion(property),
    computePropertySocialImageVersion(changed),
  );
});

test("agent contact data and unrelated gallery images do not affect the version", () => {
  const property = cloneProperty();
  const changed = cloneProperty();
  changed.agent.email = "private-agent@example.com";
  changed.agent.phone = "+34 600 111 222";
  changed.agent.whatsapp = "+34 600 333 444";
  const unrelated = changed.gallery.find(
    (image) => image.id === "principal-bedroom",
  );
  assert.ok(unrelated);
  unrelated.src = "/property-demo/unrelated-gallery-update.svg";

  assert.equal(
    computePropertySocialImageVersion(property),
    computePropertySocialImageVersion(changed),
  );
});

test("private exact coordinates do not affect Approximate-mode versions", () => {
  const property = cloneProperty();
  property.location = {
    ...property.location,
    privacyMode: "approximate",
    approximateLabel: { en: "Public coastal area" },
    displayAddress: { en: "17 Private Exact Street" },
    streetAddress: "17 Private Exact Street",
    latitude: 38.612345,
    longitude: -0.054321,
  };
  const changed = structuredClone(property);
  changed.location.displayAddress.en = "99 Different Private Street";
  changed.location.streetAddress = "99 Different Private Street";
  changed.location.latitude = 37.123456;
  changed.location.longitude = -1.987654;

  assert.equal(
    computePropertySocialImageVersion(property),
    computePropertySocialImageVersion(changed),
  );
});

test("Approximate and Hidden version inputs never contain private address data", () => {
  for (const privacyMode of ["approximate", "hidden"] as const) {
    const property = cloneProperty();
    property.location = {
      ...property.location,
      privacyMode,
      approximateLabel: { en: "Public area label" },
      displayAddress: { en: "PRIVATE-ADDRESS-SENTINEL" },
      streetAddress: "PRIVATE-STREET-SENTINEL",
      latitude: 38.612345,
      longitude: -0.054321,
    };
    property.agent.email = "PRIVATE-EMAIL-SENTINEL";
    property.agent.phone = "PRIVATE-PHONE-SENTINEL";

    const serializedInput = stableSerializeSocialImageVersionInput(
      createPropertySocialImageVersionInput(property),
    );

    assert.equal(serializedInput.includes("PRIVATE-ADDRESS-SENTINEL"), false);
    assert.equal(serializedInput.includes("PRIVATE-STREET-SENTINEL"), false);
    assert.equal(serializedInput.includes("38.612345"), false);
    assert.equal(serializedInput.includes("-0.054321"), false);
    assert.equal(serializedInput.includes("PRIVATE-EMAIL-SENTINEL"), false);
    assert.equal(serializedInput.includes("PRIVATE-PHONE-SENTINEL"), false);
  }
});
