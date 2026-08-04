import assert from "node:assert/strict";
import test from "node:test";
import { costaBlancaDemo } from "./registry.ts";
import {
  googleMapsEmbedUrlFromCoordinates,
  getListingReferenceLabel,
  labelForListingReferenceMode,
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
    { key: "listing-reference", label: "Reference", value: "MLS-123" },
    { key: "built-area", label: "Interior", value: "1,900\u00a0sq ft" },
  ]);
});

test("listing identifier labels support presets and custom labels", () => {
  const property = cloneProperty();
  property.reference = "26-8946";

  property.facts = [
    {
      key: "listing-reference",
      value: property.reference,
      label: labelForListingReferenceMode("property-reference", ""),
    },
  ];
  assert.equal(getListingReferenceLabel(property, "en"), "Property reference");

  property.facts[0].label = labelForListingReferenceMode("mls-number", "");
  assert.equal(getListingReferenceLabel(property, "en"), "MLS number");

  property.facts[0].label = labelForListingReferenceMode("listing-number", "");
  assert.equal(getListingReferenceLabel(property, "en"), "Listing number");

  property.facts[0].label = labelForListingReferenceMode(
    "custom",
    "Parcel code",
  );
  assert.equal(getListingReferenceLabel(property, "en"), "Parcel code");
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
  assert.deepEqual(
    normalizeGoogleMapsInput("https://maps.app.goo.gl/abc123"),
    {
      externalUrl: "https://maps.app.goo.gl/abc123",
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
    latitude: 38.603912,
    longitude: -0.045316,
    mapZoom: 16,
  };
  const exact = getPropertyMapView(property, "en");
  assert.equal(exact.mode, "embed");
  assert.equal(exact.markerMode, "exact");
  assert.equal(
    exact.externalUrl,
    "https://www.google.com/maps/search/?api=1&query=38.603912%2C-0.045316",
  );
  assert.equal(exact.embedUrl?.includes("q=38.603912%2C-0.045316"), true);
  assert.equal(exact.embedUrl?.includes("z=16"), true);

  property.location = {
    displayAddress: { en: "" },
    privacyMode: "approximate",
    showMap: true,
    latitude: 38.6,
    longitude: 0,
    mapZoom: 15,
  };
  const approximate = getPropertyMapView(property, "en");
  assert.equal(approximate.mode, "embed");
  assert.equal(approximate.markerMode, "approximate");
  assert.equal(approximate.embedUrl?.includes("ll=38.6%2C0"), true);
  assert.equal(approximate.embedUrl?.includes("q="), false);
  assert.equal(approximate.embedUrl?.includes("z=11"), true);
  assert.equal(
    approximate.externalUrl,
    "https://www.google.com/maps/search/?api=1&query=38.6%2C0",
  );

  property.location = {
    displayAddress: { en: "Hidden" },
    privacyMode: "hidden",
    showMap: true,
  };
  assert.equal(getPropertyMapView(property, "en").mode, "hidden");
});

test("coordinate map embeds use a marker only for exact mode", () => {
  const exact = googleMapsEmbedUrlFromCoordinates(38.6, -0.04, 17, "exact");
  const approximate = googleMapsEmbedUrlFromCoordinates(
    38.6,
    -0.04,
    17,
    "approximate",
  );

  assert.equal(exact.includes("q=38.6%2C-0.04"), true);
  assert.equal(exact.includes("z=17"), true);
  assert.equal(approximate.includes("ll=38.6%2C-0.04"), true);
  assert.equal(approximate.includes("q="), false);
  assert.equal(approximate.includes("z=11"), true);
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

test("agent profile supports minimal and hidden profiles", () => {
  const property = cloneProperty();
  property.agent = {
    agencyName: "Minimal Agency",
    displayProfile: true,
  };

  const minimal = normalizeAgentProfile(property, "en");
  assert.equal(minimal?.agencyName, "Minimal Agency");
  assert.equal(minimal?.displayName, "Minimal Agency");
  assert.equal(minimal?.phoneHref, undefined);
  assert.deepEqual(minimal?.socialLinks, []);

  property.agent = {
    agencyName: "Hidden Agency",
    displayProfile: false,
    website: "https://agency.example",
  };

  assert.equal(normalizeAgentProfile(property, "en"), null);
});
