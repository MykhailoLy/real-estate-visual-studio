import assert from "node:assert/strict";
import test from "node:test";
import { costaBlancaDemo } from "./registry.ts";
import {
  getPropertySocialPreview,
  getPropertyShareMessage,
  resolvePropertySocialImageUrl,
  resolvedPropertySocialImages,
  selectPropertyHeroImages,
  selectPropertySocialImageCandidates,
  selectPropertySocialImage,
  selectPropertySocialImages,
  updateGallerySocialPreview,
} from "./social-preview.ts";
import type { PropertyShowcase } from "./types.ts";

function cloneProperty(): PropertyShowcase {
  return structuredClone(costaBlancaDemo);
}

test("primary featured gallery image wins the social preview", () => {
  const property = cloneProperty();
  property.gallery = property.gallery.map((image) => ({
    ...image,
    featuredForSharing: image.id === "living-room" || image.id === "terrace",
    primarySocialPreview: image.id === "terrace",
  }));

  assert.deepEqual(selectPropertySocialImage(property), {
    imageUrl: "/property-demo/terrace.svg",
    imageAlt: "Private terrace overlooking the Mediterranean coast",
  });
});

test("social preview uses the first featured image and then the cover", () => {
  const property = cloneProperty();
  property.gallery = property.gallery.map((image) => ({
    ...image,
    featuredForSharing: image.id === "living-room" || image.id === "terrace",
    primarySocialPreview: false,
  }));

  assert.equal(
    selectPropertySocialImage(property).imageUrl,
    "/property-demo/living-room.svg",
  );

  property.gallery = property.gallery.map((image) => ({
    ...image,
    featuredForSharing: false,
  }));
  assert.equal(
    selectPropertySocialImage(property).imageUrl,
    property.coverImage,
  );
});

test("hero selection is static for a cover or one selected sharing image", () => {
  const property = cloneProperty();
  property.gallery = property.gallery.map((image) => ({
    ...image,
    featuredForSharing: false,
    primarySocialPreview: false,
  }));

  assert.deepEqual(selectPropertyHeroImages(property).map((image) => image.imageUrl), [
    property.coverImage,
  ]);

  property.gallery = property.gallery.map((image) => ({
    ...image,
    featuredForSharing: image.id === "living-room",
  }));
  assert.deepEqual(selectPropertyHeroImages(property).map((image) => image.imageUrl), [
    "/property-demo/living-room.svg",
  ]);
});

test("hero selection places the social primary first and removes duplicate URLs", () => {
  const property = cloneProperty();
  property.gallery = property.gallery.map((image) => ({
    ...image,
    src: image.id === "living-room" ? "/property-demo/shared.svg" : image.src,
    featuredForSharing: ["exterior", "living-room", "terrace"].includes(image.id),
    primarySocialPreview: image.id === "terrace",
  }));
  property.gallery = property.gallery.map((image) =>
    image.id === "exterior" ? { ...image, src: "/property-demo/shared.svg" } : image,
  );

  assert.deepEqual(selectPropertyHeroImages(property).map((image) => image.imageUrl), [
    "/property-demo/terrace.svg",
    "/property-demo/shared.svg",
  ]);
});

test("social collage keeps the primary image first and adds featured images", () => {
  const property = cloneProperty();
  property.gallery = property.gallery.map((image) => ({
    ...image,
    featuredForSharing: ["exterior", "living-room", "terrace"].includes(
      image.id,
    ),
    primarySocialPreview: image.id === "terrace",
  }));

  assert.deepEqual(
    selectPropertySocialImages(property).map((image) => image.imageUrl),
    [
      "/property-demo/terrace.svg",
      "/property-demo/exterior.svg",
      "/property-demo/living-room.svg",
    ],
  );
});

test("setting a social primary also marks it featured and clears old primaries", () => {
  const property = cloneProperty();
  const updated = updateGallerySocialPreview(
    property.gallery,
    "living-room",
    "set-primary",
  );

  assert.equal(
    updated.find((image) => image.id === "living-room")?.featuredForSharing,
    true,
  );
  assert.equal(
    updated.find((image) => image.id === "living-room")?.primarySocialPreview,
    true,
  );
  assert.equal(
    updated.find((image) => image.id === "terrace")?.primarySocialPreview,
    false,
  );
});

test("social listing text includes core facts and respects location privacy", () => {
  const property = cloneProperty();
  property.location.displayAddress = { en: "123 Private Parcel Road" };
  property.location.streetAddress = "123 Private Parcel Road";
  property.location.city = "Wasilla";
  property.location.postalCode = "99654";
  property.location.approximateLabel = { en: "Wasilla, Alaska" };
  property.location.privacyMode = "approximate";
  const approximate = getPropertySocialPreview(property);

  assert.equal(approximate.title.includes("Sea View Residence"), true);
  assert.equal(approximate.title.includes("\u20ac695,000"), true);
  assert.equal(approximate.description.includes("Wasilla, Alaska"), true);
  assert.equal(approximate.description.includes("123 Private Parcel Road"), false);
  assert.deepEqual(approximate.facts.map((fact) => fact.key), [
    "bedrooms",
    "bathrooms",
    "built-area",
    "parking",
  ]);
  assert.deepEqual(approximate.facts.map((fact) => fact.value), [
    "3",
    "2",
    "142\u00a0m\u00b2",
    "Garage + driveway",
  ]);

  property.location.privacyMode = "exact";
  const exact = getPropertySocialPreview(property);
  assert.equal(exact.description.includes("123 Private Parcel Road"), true);
  assert.equal(exact.description.includes("99654"), true);

  property.location.privacyMode = "hidden";
  const hidden = getPropertySocialPreview(property);
  assert.equal(hidden.description.includes("123 Private Parcel Road"), false);
  assert.equal(hidden.description.includes("Wasilla, Alaska"), false);

  property.socialCard = {
    mode: "automatic",
    layout: "balanced",
    visibleFacts: [],
    factOrder: [],
    showLocation: false,
    showPrice: false,
    showBranding: true,
    showPoweredByPicchuSpot: true,
  };
  property.location.privacyMode = "exact";
  const explicitlyHidden = getPropertySocialPreview(property);
  assert.equal(explicitlyHidden.location, "");
  assert.equal(explicitlyHidden.price, "");
  assert.equal(explicitlyHidden.title.includes("€695,000"), false);
  assert.equal(explicitlyHidden.description.includes("123 Private Parcel Road"), false);
});

test("social image resolution accepts public site paths and rejects external lookalikes", () => {
  const property = cloneProperty();
  assert.equal(
    resolvePropertySocialImageUrl(property, "/property-demo/terrace.svg"),
    "https://picchuspot.com/property-demo/terrace.svg",
  );
  assert.equal(
    resolvePropertySocialImageUrl(
      property,
      "https://evil.example/property-demo/terrace.svg",
    ),
    null,
  );
  assert.equal(
    resolvePropertySocialImageUrl(property, "/property-demo/%2e%2e/private"),
    null,
  );
  assert.equal(resolvedPropertySocialImages(property).length, 3);
});

test("social image candidates preserve primary, featured and cover fallback order", () => {
  const property = cloneProperty();
  assert.deepEqual(
    selectPropertySocialImageCandidates(property).map((image) => image.imageUrl),
    [
      "/property-demo/terrace.svg",
      "/property-demo/living-room.svg",
      "/property-demo/exterior.svg",
    ],
  );
});

test("social image candidates keep a non-gallery cover as the final fallback", () => {
  const property = cloneProperty();
  property.coverImage = "/property-demo/cover-only.svg";
  property.gallery[0].featuredForSharing = true;
  property.gallery[0].primarySocialPreview = true;

  const candidates = selectPropertySocialImageCandidates(property);
  assert.equal(candidates[0].imageUrl, property.gallery[0].src);
  assert.equal(candidates.at(-1)?.imageUrl, property.coverImage);
});

test("social-card branding defaults to PicchuSpot and supports agency and unbranded modes", () => {
  const property = cloneProperty();
  const defaultPreview = getPropertySocialPreview(property);
  assert.equal(defaultPreview.brandingMode, "picchuspot");
  assert.equal(defaultPreview.brandingName, "PicchuSpot");

  property.socialPreview = { brandingMode: "agency" };
  property.agent.logoUrl = "/property-demo/agency.svg";
  const agencyPreview = getPropertySocialPreview(property);
  assert.equal(agencyPreview.brandingName, "Demo Real Estate Agency");
  assert.equal(agencyPreview.brandingLogoUrl, "/property-demo/agency.svg");
  assert.equal(agencyPreview.brandingAttribution, "Powered by PicchuSpot");

  property.socialCard = {
    mode: "automatic",
    layout: "balanced",
    visibleFacts: [],
    factOrder: [],
    showLocation: true,
    showPrice: true,
    showBranding: true,
    showPoweredByPicchuSpot: false,
  };
  assert.equal(getPropertySocialPreview(property).brandingAttribution, undefined);

  property.socialPreview = { brandingMode: "unbranded" };
  const unbrandedPreview = getPropertySocialPreview(property);
  assert.equal(unbrandedPreview.brandingName, undefined);
  assert.equal(unbrandedPreview.brandingLogoUrl, undefined);
  assert.equal(unbrandedPreview.brandingAttribution, undefined);

  property.socialPreview = { brandingMode: "agency" };
  property.socialCard = {
    ...property.socialCard!,
    showBranding: false,
    showPoweredByPicchuSpot: true,
  };
  const hiddenBrandingPreview = getPropertySocialPreview(property);
  assert.equal(hiddenBrandingPreview.brandingMode, "unbranded");
  assert.equal(hiddenBrandingPreview.brandingName, undefined);
  assert.equal(hiddenBrandingPreview.brandingLogoUrl, undefined);
  assert.equal(hiddenBrandingPreview.brandingAttribution, undefined);
});

test("per-property showcase branding drives social identity without replacing agent contacts", () => {
  const property = cloneProperty();
  property.branding = {
    enabled: true,
    brandName: "Costa Blanca Luxury Homes",
    logoUrl: "/property-demo/terrace.svg",
    showPicchuSpotCredit: false,
  };
  property.socialPreview = { brandingMode: "picchuspot" };

  const preview = getPropertySocialPreview(property);
  assert.equal(preview.brandingMode, "agency");
  assert.equal(preview.brandingName, "Costa Blanca Luxury Homes");
  assert.equal(preview.brandingLogoUrl, "/property-demo/terrace.svg");
  assert.equal(preview.brandingAttribution, undefined);
  assert.equal(property.agent.agentName, "Costa Blanca Property Team");
  assert.equal(property.agent.phone, "+34 600 000 000");
});

test("social sharing controls keep metadata, card facts, agency identity, and share message aligned", () => {
  const property = cloneProperty();
  property.branding = {
    enabled: true,
    brandName: "Alegria Real Estate",
    primaryColor: "#3B0000",
    accentColor: "#FF8A00",
    showPicchuSpotCredit: false,
  };
  property.agent.logoUrl =
    `https://grvltquwenaorucsvooc.supabase.co/storage/v1/object/public/site-media/property-showcases/${property.slug}/agency-logo/alegria-logo.webp`;
  property.socialPreview = {
    brandingMode: "agency",
    shareMessage: { en: "For sale: an exceptional home for living or investment." },
    titleMode: "custom",
    customTitle: { en: "Luxury Home in Altea Hills" },
    descriptionMode: "intro-and-facts",
    descriptionIntro: { en: "Exclusive property in Altea Hills" },
  };
  property.socialCard = {
    mode: "custom",
    layout: "balanced",
    visibleFacts: ["built-area", "bedrooms", "year-built"],
    factOrder: ["built-area", "bedrooms", "year-built", "bathrooms", "parking", "plot-area", "listing-reference"],
    showLocation: false,
    showPrice: true,
    showBranding: true,
    showPoweredByPicchuSpot: true,
  };

  const preview = getPropertySocialPreview(property);
  assert.equal(preview.siteName, "Alegria Real Estate");
  assert.equal(preview.title, "Luxury Home in Altea Hills");
  assert.equal(preview.brandingLogoUrl, property.agent.logoUrl);
  assert.equal(preview.brandingAttribution, undefined);
  assert.match(preview.description, /^Exclusive property in Altea Hills\./);
  assert.deepEqual(preview.facts.map((fact) => fact.key), [
    "built-area",
    "bedrooms",
    "year-built",
  ]);
  assert.equal(
    getPropertyShareMessage(property),
    "For sale: an exceptional home for living or investment.",
  );
  assert.equal(preview.primaryColor, "#3B0000");
  assert.equal(preview.accentColor, "#FF8A00");
});

test("social identity supports PicchuSpot and an omitted site name without changing the property URL", () => {
  const property = cloneProperty();
  property.socialPreview = {
    brandingMode: "picchuspot",
    titleMode: "automatic",
  };
  assert.equal(getPropertySocialPreview(property).siteName, "PicchuSpot");

  property.socialPreview = {
    brandingMode: "unbranded",
    titleMode: "automatic",
  };
  assert.equal(getPropertySocialPreview(property).siteName, undefined);
  assert.equal(property.slug, costaBlancaDemo.slug);
});

test("social preview keeps ordered visible highlights and custom facts for the shared renderer", () => {
  const property = cloneProperty();
  property.highlights = [
    { text: { en: "First highlight" }, sortOrder: 20 },
    { text: { en: "Priority highlight" }, sortOrder: 10 },
  ];
  property.facts.push(
    {
      key: "custom-heating",
      value: "Central heating",
      label: { en: "Heating" },
      sortOrder: 1000,
    },
    {
      key: "custom-hidden",
      value: "Hidden",
      label: { en: "Hidden detail" },
      sortOrder: 1001,
      visible: false,
    },
  );

  const preview = getPropertySocialPreview(property);
  assert.deepEqual(preview.highlights, ["Priority highlight", "First highlight"]);
  assert.deepEqual(preview.customFacts, [
    { key: "custom-heating", label: "Heating", value: "Central heating" },
  ]);
});

test("social image selection enforces three photos and supports ordered photos", () => {
  const property = cloneProperty();
  let gallery = property.gallery.map((image, index) => ({
    ...image,
    featuredForSharing: index < 3,
    primarySocialPreview: index === 0,
    socialPreviewOrder: index + 1,
  }));

  gallery = updateGallerySocialPreview(
    gallery,
    property.gallery[3].id,
    "toggle-featured",
  );
  assert.equal(
    gallery.filter((image) => image.featuredForSharing).length,
    3,
  );

  gallery = updateGallerySocialPreview(
    gallery,
    property.gallery[2].id,
    "move-social-up",
  );
  property.gallery = gallery;
  assert.deepEqual(
    selectPropertySocialImages(property).map((image) => image.imageUrl),
    [property.gallery[0].src, property.gallery[2].src, property.gallery[1].src],
  );
});
