import assert from "node:assert/strict";
import test from "node:test";
import { costaBlancaDemo } from "./registry.ts";
import {
  getPropertyMapView,
  normalizeAgentProfile,
  normalizeGoogleMapsInput,
  normalizeListingFacts,
} from "./listing-details.ts";
import type { PropertyShowcase } from "./types.ts";

function cloneProperty(): PropertyShowcase {
  return structuredClone(costaBlancaDemo);
}

test("facts rendering adds price and listing reference without empty cells", () => {
  const property = cloneProperty();
  property.price = "$385,560";
  property.reference = "MLS-123";
  property.facts = [
    {
      key: "built-area",
      value: "1900 sq ft",
      label: { en: "Interior" },
    },
    {
      key: "plot-area",
      value: "",
      label: { en: "Lot" },
    },
  ];

  assert.deepEqual(normalizeListingFacts(property, "en"), [
    { key: "price", label: "Price", value: "$385,560" },
    { key: "listing-reference", label: "Listing ref", value: "MLS-123" },
    { key: "built-area", label: "Interior", value: "1,900 sq ft" },
  ]);
});

test("Google Maps normalization distinguishes links from embeddable iframes", () => {
  assert.deepEqual(
    normalizeGoogleMapsInput("https://www.google.com/maps/place/Altea"),
    {
      externalUrl: "https://www.google.com/maps/place/Altea",
      canEmbed: false,
    },
  );
  assert.deepEqual(
    normalizeGoogleMapsInput(
      '<iframe src="https://www.google.com/maps/embed?pb=abc&amp;z=14"></iframe>',
    ),
    {
      embedUrl: "https://www.google.com/maps/embed?pb=abc&z=14",
      canEmbed: true,
    },
  );
});

test("Google Maps normalization rejects lookalike, unsafe, and non-embed sources", () => {
  assert.equal(normalizeGoogleMapsInput("https://evil.example/maps/embed"), null);
  assert.equal(
    normalizeGoogleMapsInput("https://www.google.com.evil.example/maps/embed"),
    null,
  );
  assert.equal(
    normalizeGoogleMapsInput("https://user:pass@www.google.com/maps/embed"),
    null,
  );
  assert.equal(
    normalizeGoogleMapsInput("http://www.google.com/maps/embed"),
    null,
  );
  assert.deepEqual(
    normalizeGoogleMapsInput("https://maps.google.com/maps?q=Altea"),
    {
      externalUrl: "https://maps.google.com/maps?q=Altea",
      canEmbed: false,
    },
  );
});

test("map view respects hidden, approximate, and exact privacy modes", () => {
  const property = cloneProperty();

  property.location = {
    displayAddress: { en: "Exact address" },
    privacyMode: "exact",
    showMap: true,
    mapExternalUrl: "https://www.google.com/maps/place/Exact",
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=exact",
  };
  assert.equal(getPropertyMapView(property, "en").mode, "embed");

  property.location = {
    displayAddress: { en: "Approx area" },
    privacyMode: "approximate",
    showMap: true,
    latitude: 38.6,
    longitude: -0.05,
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=exact",
  };
  const approximate = getPropertyMapView(property, "en");
  assert.equal(approximate.mode, "fallback");
  assert.equal(approximate.externalUrl, undefined);

  property.location = {
    displayAddress: { en: "Hidden" },
    privacyMode: "hidden",
    showMap: true,
  };
  assert.equal(getPropertyMapView(property, "en").mode, "hidden");
});

test("agent profile normalizes safe contacts and social links", () => {
  const property = cloneProperty();
  property.agent = {
    agencyName: "Agency",
    displayProfile: true,
    agentName: "Alex Agent",
    role: { en: "Listing agent" },
    phone: "+1 555 0100",
    whatsapp: "+1 555 0100",
    email: "alex@example.com",
    website: "https://agency.example",
    socialLinks: [
      { provider: "instagram", url: "https://www.instagram.com/agency" },
      { provider: "facebook", url: "http://facebook.com/agency" },
      {
        provider: "custom",
        url: "https://agency.example/team",
        label: { en: "Team" },
      },
    ],
  };

  const profile = normalizeAgentProfile(property, "en");

  assert.equal(profile?.displayName, "Alex Agent");
  assert.equal(profile?.phoneHref, "tel:+1 555 0100");
  assert.equal(profile?.whatsappHref, "https://wa.me/15550100");
  assert.equal(profile?.website, "https://agency.example/");
  assert.deepEqual(
    profile?.socialLinks.map((link) => link.labelText),
    ["Instagram", "Team"],
  );
});
