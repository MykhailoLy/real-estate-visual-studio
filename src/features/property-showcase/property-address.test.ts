import assert from "node:assert/strict";
import test from "node:test";
import { getPropertyAddressView } from "./property-address.ts";
import type { PropertyLocation } from "./types.ts";

function exactLocation(overrides: Partial<PropertyLocation> = {}): PropertyLocation {
  return {
    displayAddress: { en: "Calle San Pablo 46, Altea, Alicante, 03590" },
    streetAddress: "Calle San Pablo 46",
    city: "Altea",
    region: "Alicante",
    postalCode: "03590",
    country: "Spain",
    privacyMode: "exact",
    ...overrides,
  };
}

test("exact structured addresses render a clean primary and secondary line", () => {
  assert.deepEqual(getPropertyAddressView(exactLocation(), "en", "en"), {
    primaryLine: "Calle San Pablo 46",
    secondaryLine: "Altea \u00b7 Alicante \u00b7 03590",
    socialText: "Calle San Pablo 46, Altea, Alicante, 03590, Spain",
  });
});

test("structured address lines omit duplicate and empty values", () => {
  const address = getPropertyAddressView(exactLocation({
    streetAddress: "Altea",
    city: "Altea",
    region: "",
    postalCode: "03590",
  }), "en", "en");

  assert.equal(address.primaryLine, "Altea");
  assert.equal(address.secondaryLine, "03590");
  assert.equal(address.secondaryLine.includes("\u00b7 \u00b7"), false);
});

test("legacy display addresses remain a backward-compatible exact fallback", () => {
  const address = getPropertyAddressView(exactLocation({
    streetAddress: undefined,
    city: undefined,
    region: undefined,
    postalCode: undefined,
    country: undefined,
    displayAddress: { en: "Legacy address only" },
  }), "en", "en");

  assert.deepEqual(address, {
    primaryLine: "Legacy address only",
    secondaryLine: "",
    socialText: "Legacy address only",
  });
});

test("approximate and hidden locations never expose structured exact address fields", () => {
  const approximate = getPropertyAddressView(exactLocation({
    approximateLabel: { en: "Altea Hills, Alicante" },
    privacyMode: "approximate",
  }), "en", "en");
  assert.deepEqual(approximate, {
    primaryLine: "Altea Hills, Alicante",
    secondaryLine: "",
    socialText: "Altea Hills, Alicante",
  });

  assert.deepEqual(getPropertyAddressView(exactLocation({
    privacyMode: "hidden",
  }), "en", "en"), {
    primaryLine: "",
    secondaryLine: "",
    socialText: "",
  });
});
