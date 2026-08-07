import assert from "node:assert/strict";
import test from "node:test";
import {
  PropertyMarketingPreviewDraftSchema,
  PropertyShowcaseSchema,
} from "./schema.ts";
import { costaBlancaDemo } from "./registry.ts";
import {
  createPropertyMarketingMaterialView,
  effectiveLandscapeLayout,
  moveBrochureSupportingImage,
  normalizePropertyMarketingMaterialsConfig,
  replaceBrochureSupportingImage,
  safePropertyMarketingFilename,
  setBrochurePrimaryImage,
  toCanonicalPropertyMarketingMaterialsConfig,
  toggleBrochureSupportingImage,
} from "./marketing-materials.ts";
import {
  computePropertyMarketingMaterialVersion,
  createPropertyMarketingMaterialVersionInput,
  getPropertyMarketingMaterialLinks,
} from "./marketing-material-version.ts";
import { mergePropertyShowcaseUpdate } from "./updates.ts";
import type { PropertyMarketingMaterialsConfig, PropertyShowcase } from "./types.ts";

const canonicalUrl = "https://picchuspot.com/property/sea-view-residence";
const cloneProperty = (): PropertyShowcase => structuredClone(costaBlancaDemo);

function configuredProperty(): PropertyShowcase {
  const property = cloneProperty();
  property.marketingMaterials = {
    flyerMode: "automatic-landscape",
    enabled: true,
    brandingMode: "agency",
    includeAgent: true,
    includeAgencyLogo: true,
    includeQrCode: true,
    includeDisclaimer: true,
    marketingCopyMode: "custom",
    customMarketingCopy: { en: "  A deliberately   short marketing message. " },
    selectedFactKeys: ["bedrooms", "bathrooms", "built-area"],
    selectedHighlightIds: ["highlight-1", "highlight-2"],
    brochure: {
      orientation: "landscape",
      template: "hero-four-grid",
      primaryMediaId: property.gallery[1]?.id,
      supportingMediaIds: [property.gallery[0]?.id, property.gallery[2]?.id].filter(
        (id): id is string => Boolean(id),
      ),
    },
  };
  property.gallery[0].focalPoint = { x: 0.2, y: 0.8 };
  return property;
}

test("properties without flyer settings receive a disabled legacy-compatible default", () => {
  const property = cloneProperty();
  delete property.marketingMaterials;
  const config = normalizePropertyMarketingMaterialsConfig(undefined, property);
  assert.equal(config.enabled, false);
  assert.equal(config.flyerMode, "none");
  assert.equal(config.brandingMode, "picchuspot");
  assert.equal(config.includeQrCode, true);
  assert.equal(config.brochure.orientation, "portrait");
  assert.equal(config.brochure.template, "a4-editorial");
  assert.equal(config.legacyNormalized, false);
});

test("custom facts are ordered, individually visible, and not capped by brochure selection", () => {
  const property = configuredProperty();
  property.translations = undefined;
  property.facts.push(
    ...Array.from({ length: 18 }, (_, index) => ({
      key: `custom-specification-${index + 1}` as const,
      value: `Value ${index + 1}`,
      label: { en: `Specification ${index + 1}` },
      sortOrder: 1000 + index,
      visible: index !== 6,
    })),
  );

  assert.equal(PropertyShowcaseSchema.safeParse(property).success, true);
  const view = createPropertyMarketingMaterialView(property, canonicalUrl);
  assert.equal(view.customFacts.length, 17);
  assert.deepEqual(
    view.customFacts.slice(0, 3).map((fact) => fact.label),
    ["Specification 1", "Specification 2", "Specification 3"],
  );
  assert.equal(view.customFacts.some((fact) => fact.label === "Specification 7"), false);
});

test("legacy portrait-only and landscape-only settings normalize without a migration", () => {
  const property = cloneProperty();
  const portraitOnly: PropertyMarketingMaterialsConfig = {
    enabled: true,
    landscape: { enabled: false, layout: "hero-two-square" },
    portrait: {
      enabled: true,
      layout: "a4-classic",
      primaryMediaId: "terrace",
      secondaryMediaIds: ["living-room"],
    },
  };
  const portrait = normalizePropertyMarketingMaterialsConfig(portraitOnly, property);
  assert.equal(portrait.brochure.orientation, "portrait");
  assert.equal(portrait.flyerMode, "none");
  assert.equal(portrait.brochure.template, "a4-classic");
  assert.equal(portrait.legacyNormalized, true);

  const landscapeOnly: PropertyMarketingMaterialsConfig = {
    enabled: true,
    landscape: {
      enabled: true,
      layout: "hero-four-grid",
      primaryMediaId: "exterior",
      secondaryMediaIds: ["terrace", "living-room"],
    },
    portrait: { enabled: false, layout: "a4-editorial" },
  };
  const landscape = normalizePropertyMarketingMaterialsConfig(
    landscapeOnly,
    property,
  );
  assert.equal(landscape.brochure.orientation, "landscape");
  assert.equal(landscape.flyerMode, "automatic-landscape");
  assert.equal(landscape.brochure.template, "hero-four-grid");
  assert.deepEqual(landscape.brochure.supportingMediaIds, ["terrace", "living-room"]);
});

test("legacy dual mode prefers an explicit primary and otherwise portrait", () => {
  const property = cloneProperty();
  const landscapePrimary = normalizePropertyMarketingMaterialsConfig({
    landscape: { enabled: true, primaryMediaId: "exterior" },
    portrait: { enabled: true },
  }, property);
  assert.equal(landscapePrimary.brochure.orientation, "landscape");

  const bothPrimary = normalizePropertyMarketingMaterialsConfig({
    landscape: { enabled: true, primaryMediaId: "exterior" },
    portrait: { enabled: true, primaryMediaId: "terrace" },
  }, property);
  assert.equal(bothPrimary.brochure.orientation, "portrait");

  const neitherPrimary = normalizePropertyMarketingMaterialsConfig({
    landscape: { enabled: true },
    portrait: { enabled: true },
  }, property);
  assert.equal(neitherPrimary.brochure.orientation, "portrait");
});

test("canonical save removes legacy orientation fields and preserves unrelated settings", () => {
  const canonical = toCanonicalPropertyMarketingMaterialsConfig({
    enabled: true,
    brandingMode: "unbranded",
    includeQrCode: false,
    marketingCopyMode: "custom",
    customMarketingCopy: { en: "Keep this copy" },
    selectedFactKeys: ["bedrooms"],
    landscape: { enabled: true, primaryMediaId: "terrace" },
    portrait: { enabled: false },
  }, cloneProperty());
  assert.equal(canonical.brochure?.orientation, "landscape");
  assert.equal(canonical.flyerMode, "automatic-landscape");
  assert.equal(canonical.brandingMode, "unbranded");
  assert.equal(canonical.includeQrCode, false);
  assert.deepEqual(canonical.customMarketingCopy, { en: "Keep this copy" });
  assert.equal(canonical.landscape, undefined);
  assert.equal(canonical.portrait, undefined);
});

test("marketing and preview schemas reject unsafe values and arbitrary URLs", () => {
  const property = configuredProperty();
  property.translations = undefined;
  assert.equal(PropertyShowcaseSchema.safeParse(property).success, true);
  const invalid = cloneProperty();
  invalid.gallery[0].focalPoint = { x: -1, y: 2 };
  assert.equal(PropertyShowcaseSchema.safeParse(invalid).success, false);
  const invalidTemplate = configuredProperty() as PropertyShowcase & {
    marketingMaterials: { brochure: { template: string } };
  };
  invalidTemplate.marketingMaterials.brochure.template = "arbitrary-template";
  assert.equal(PropertyShowcaseSchema.safeParse(invalidTemplate).success, false);
  assert.equal(PropertyMarketingPreviewDraftSchema.safeParse({
    marketingMaterials: {
      ...configuredProperty().marketingMaterials,
      remoteImageUrl: "https://attacker.example/image.jpg",
    },
    focalPoints: [],
  }).success, false);
});

test("showcase schema accepts an omitted or empty optional summary", () => {
  const omitted = cloneProperty() as Partial<PropertyShowcase>;
  delete omitted.summary;
  delete omitted.translations;
  assert.equal(PropertyShowcaseSchema.safeParse(omitted).success, true);

  const empty = cloneProperty();
  empty.summary = { en: "" };
  empty.translations = undefined;
  assert.equal(PropertyShowcaseSchema.safeParse(empty).success, true);
});

test("empty configured summary and custom copy fall back to selected public highlights", () => {
  const property = configuredProperty();
  property.summary = { en: " " };
  property.marketingMaterials = {
    ...property.marketingMaterials,
    marketingCopyMode: "summary",
    selectedHighlightIds: ["highlight-1", "highlight-2", "highlight-3", "highlight-4"],
  };
  const summaryFallback = createPropertyMarketingMaterialView(property, canonicalUrl);
  assert.equal(summaryFallback.copy, "");
  assert.equal(summaryFallback.highlights.length, 4);

  property.marketingMaterials.marketingCopyMode = "custom";
  property.marketingMaterials.customMarketingCopy = { en: " " };
  const customFallback = createPropertyMarketingMaterialView(property, canonicalUrl);
  assert.equal(customFallback.copy, "");
  assert.deepEqual(customFallback.highlights, summaryFallback.highlights);

  property.marketingMaterials.marketingCopyMode = "none";
  const noCopy = createPropertyMarketingMaterialView(property, canonicalUrl);
  assert.equal(noCopy.copy, "");
  assert.deepEqual(noCopy.highlights, []);
});

test("brochure view uses the privacy-safe brochure address resolver in versioned content", () => {
  const exact = configuredProperty();
  exact.location = {
    privacyMode: "exact",
    displayAddress: { en: "Legacy brochure address" },
    streetAddress: "1 Private Street",
    city: "Altea",
    country: "Spain",
  };
  assert.equal(
    createPropertyMarketingMaterialView(exact, canonicalUrl).location,
    "Legacy brochure address",
  );

  const approximate = structuredClone(exact);
  approximate.location.privacyMode = "approximate";
  approximate.location.approximateLabel = { en: "Altea area" };
  assert.equal(
    createPropertyMarketingMaterialView(approximate, canonicalUrl).location,
    "Altea area",
  );

  const hidden = structuredClone(exact);
  hidden.location.privacyMode = "hidden";
  assert.equal(createPropertyMarketingMaterialView(hidden, canonicalUrl).location, "");
});

test("brochure QR copy follows the selected public language", () => {
  const property = configuredProperty();
  property.primaryLanguage = "es";
  assert.equal(
    createPropertyMarketingMaterialView(property, canonicalUrl).qrLabel,
    "Escanea para ver la propiedad completa",
  );
});

test("photo selection prevents duplicates and keeps stable accessible ordering", () => {
  let brochure: NonNullable<PropertyMarketingMaterialsConfig["brochure"]> = {
    orientation: "portrait",
    template: "a4-editorial",
    primaryMediaId: "one",
    supportingMediaIds: ["two", "three"],
  };
  brochure = setBrochurePrimaryImage(brochure, "two");
  assert.equal(brochure.primaryMediaId, "two");
  assert.deepEqual(brochure.supportingMediaIds, ["three"]);
  assert.equal(toggleBrochureSupportingImage(brochure, "two"), brochure);
  brochure = toggleBrochureSupportingImage(brochure, "four");
  brochure = toggleBrochureSupportingImage(brochure, "five");
  assert.deepEqual(brochure.supportingMediaIds, ["three", "four", "five"]);
  brochure = moveBrochureSupportingImage(brochure, "five", -1);
  assert.deepEqual(brochure.supportingMediaIds, ["three", "five", "four"]);
  brochure = replaceBrochureSupportingImage(brochure, 0, "six");
  assert.deepEqual(brochure.supportingMediaIds, ["six", "five", "four"]);
});

test("selected photo order and landscape fallbacks never reserve blank panels", () => {
  const property = configuredProperty();
  const view = createPropertyMarketingMaterialView(property, canonicalUrl);
  assert.equal(view.brochureImages[0]?.id, property.gallery[1]?.id);
  assert.deepEqual(
    view.brochureImages.slice(1, 3).map((image) => image.id),
    [property.gallery[0]?.id, property.gallery[2]?.id],
  );
  assert.deepEqual(view.brochureImages[1]?.focalPoint, { x: 0.2, y: 0.8 });
  assert.equal(effectiveLandscapeLayout("hero-four-grid", 0), "single-hero");
  assert.equal(effectiveLandscapeLayout("hero-four-grid", 1), "single-hero");
  assert.equal(effectiveLandscapeLayout("hero-four-grid", 2), "hero-two-square");
  assert.equal(effectiveLandscapeLayout("hero-four-grid", 3), "hero-two-square");
  assert.equal(effectiveLandscapeLayout("hero-four-grid", 4), "hero-four-grid");
  assert.equal(effectiveLandscapeLayout("hero-four-grid", 5), "hero-four-grid");
});

test("landscape selection is authoritative and never auto-fills removed supporting slots", () => {
  const property = cloneProperty();
  property.marketingMaterials = {
    enabled: true,
    brochure: {
      orientation: "landscape",
      template: "hero-four-grid",
      primaryMediaId: "terrace",
      supportingMediaIds: ["living-room", "exterior", "principal-bedroom"],
    },
  };
  const selected = createPropertyMarketingMaterialView(property, canonicalUrl);
  assert.deepEqual(selected.brochureImages.map((image) => image.id), [
    "terrace",
    "living-room",
    "exterior",
    "principal-bedroom",
  ]);

  property.marketingMaterials.brochure!.supportingMediaIds = ["living-room"];
  const removed = createPropertyMarketingMaterialView(property, canonicalUrl);
  assert.deepEqual(removed.brochureImages.map((image) => image.id), [
    "terrace",
    "living-room",
  ]);
});

test("visible orientation, order, focal points and copy deterministically version URLs", () => {
  const property = configuredProperty();
  const first = computePropertyMarketingMaterialVersion(property, canonicalUrl);
  assert.equal(first, computePropertyMarketingMaterialVersion(property, canonicalUrl));

  const focalChanged = structuredClone(property);
  focalChanged.gallery[0].focalPoint = { x: 0.3, y: 0.8 };
  assert.notEqual(computePropertyMarketingMaterialVersion(focalChanged, canonicalUrl), first);

  const templateChanged = structuredClone(property);
  if (templateChanged.marketingMaterials?.brochure) {
    templateChanged.marketingMaterials.brochure.template = "single-hero";
  }
  assert.notEqual(computePropertyMarketingMaterialVersion(templateChanged, canonicalUrl), first);

  const orderChanged = structuredClone(property);
  orderChanged.marketingMaterials?.brochure?.supportingMediaIds?.reverse();
  assert.notEqual(computePropertyMarketingMaterialVersion(orderChanged, canonicalUrl), first);

  const copyChanged = structuredClone(property);
  if (copyChanged.marketingMaterials) {
    copyChanged.marketingMaterials.customMarketingCopy = { en: "Different visible copy" };
  }
  assert.notEqual(computePropertyMarketingMaterialVersion(copyChanged, canonicalUrl), first);

  const portraitChanged = structuredClone(property);
  portraitChanged.agent.portraitUrl = "/property-demo/portrait.png";
  assert.notEqual(computePropertyMarketingMaterialVersion(portraitChanged, canonicalUrl), first);

  const privateEmailChanged = structuredClone(property);
  privateEmailChanged.agent.email = "private-change@example.com";
  assert.equal(computePropertyMarketingMaterialVersion(privateEmailChanged, canonicalUrl), first);

  const links = getPropertyMarketingMaterialLinks(property, canonicalUrl);
  assert.equal(links.mode, "automatic-landscape");
  assert.match(links.pdf ?? "", /^\/property\/sea-view-residence\/materials\/brochure\.pdf\?v=[a-f0-9]{14}$/);
  assert.equal(links.previewKind, "image");
  assert.equal("flyerPdf" in links, false);
});

test("flyer modes expose only the relevant public assets and preserve saved configuration", () => {
  const property = configuredProperty();
  const automatic = structuredClone(property.marketingMaterials!);
  property.marketingMaterials = {
    ...automatic,
    flyerMode: "none",
    customFlyer: {
      pdf: "https://demo.supabase.co/storage/v1/object/public/site-media/property-showcases/sea-view-residence/flyer/1-custom.pdf",
    },
  };
  assert.deepEqual(getPropertyMarketingMaterialLinks(property, canonicalUrl), {});
  assert.equal(property.marketingMaterials.brochure?.template, "hero-four-grid");

  property.marketingMaterials.flyerMode = "custom";
  assert.deepEqual(getPropertyMarketingMaterialLinks(property, canonicalUrl), {
    mode: "custom",
    preview: property.marketingMaterials.customFlyer?.pdf,
    previewKind: "document",
    pdf: property.marketingMaterials.customFlyer?.pdf,
    jpg: undefined,
    png: undefined,
  });

  property.marketingMaterials.customFlyer = {
    jpg: "https://demo.supabase.co/storage/v1/object/public/site-media/property-showcases/sea-view-residence/flyer/2-custom.jpg",
    png: "https://demo.supabase.co/storage/v1/object/public/site-media/property-showcases/sea-view-residence/flyer/3-custom.png",
  };
  const imageLinks = getPropertyMarketingMaterialLinks(property, canonicalUrl);
  assert.equal(imageLinks.preview, property.marketingMaterials.customFlyer.jpg);
  assert.equal(imageLinks.previewKind, "image");
  assert.equal(imageLinks.pdf, undefined);
  assert.equal(imageLinks.jpg, property.marketingMaterials.customFlyer.jpg);
  assert.equal(imageLinks.png, property.marketingMaterials.customFlyer.png);

  property.marketingMaterials.flyerMode = "automatic-landscape";
  assert.equal(property.marketingMaterials.brochure?.template, "hero-four-grid");
  assert.equal(property.marketingMaterials.customFlyer?.jpg?.includes("2-custom.jpg"), true);
  assert.equal(getPropertyMarketingMaterialLinks(property, canonicalUrl).mode, "automatic-landscape");
});

test("landscape template, replacement and supporting order are authoritative version inputs", () => {
  const property = cloneProperty();
  property.marketingMaterials = {
    enabled: true,
    brochure: {
      orientation: "landscape",
      template: "hero-four-grid",
      primaryMediaId: "terrace",
      supportingMediaIds: ["living-room", "exterior", "principal-bedroom"],
    },
  };
  const input = createPropertyMarketingMaterialVersionInput(property, canonicalUrl);
  assert.equal(input.schemaVersion, "picchuspot-property-marketing-v3");
  assert.deepEqual(input.images.map((image) => image.id), [
    "terrace",
    "living-room",
    "exterior",
    "principal-bedroom",
  ]);
  const original = computePropertyMarketingMaterialVersion(property, canonicalUrl);

  const reordered = structuredClone(property);
  reordered.marketingMaterials!.brochure!.supportingMediaIds = [
    "principal-bedroom",
    "living-room",
    "exterior",
  ];
  assert.notEqual(computePropertyMarketingMaterialVersion(reordered, canonicalUrl), original);

  const replaced = structuredClone(property);
  replaced.marketingMaterials!.brochure!.supportingMediaIds = [
    "living-room",
    "exterior",
  ];
  assert.notEqual(computePropertyMarketingMaterialVersion(replaced, canonicalUrl), original);

  const templateChanged = structuredClone(property);
  templateChanged.marketingMaterials!.brochure!.template = "hero-two-square";
  assert.notEqual(computePropertyMarketingMaterialVersion(templateChanged, canonicalUrl), original);
});

test("Approximate and Hidden versions exclude exact private location fields", () => {
  const first = configuredProperty();
  first.location.privacyMode = "approximate";
  first.location.approximateLabel = { en: "Altea area" };
  first.location.streetAddress = "Private street 1";
  first.location.latitude = 38.60123;
  first.location.longitude = -0.05123;
  const second = structuredClone(first);
  second.location.streetAddress = "Different private street";
  second.location.latitude = 37.1;
  second.location.longitude = -1.9;
  assert.equal(
    computePropertyMarketingMaterialVersion(first, canonicalUrl),
    computePropertyMarketingMaterialVersion(second, canonicalUrl),
  );
  assert.equal(
    JSON.stringify(createPropertyMarketingMaterialVersionInput(first, canonicalUrl)).includes("Private street"),
    false,
  );
  first.location.approximateLabel = { en: "" };
  const approximateInput = JSON.stringify(
    createPropertyMarketingMaterialVersionInput(first, canonicalUrl),
  );
  assert.equal(approximateInput.includes("Different private street"), false);
  assert.equal(approximateInput.includes("Private street"), false);

  const hidden = structuredClone(first);
  hidden.location.privacyMode = "hidden";
  hidden.location.approximateLabel = { en: "Altea area" };
  const hiddenInput = JSON.stringify(
    createPropertyMarketingMaterialVersionInput(hidden, canonicalUrl),
  );
  assert.equal(hiddenInput.includes("Altea area"), false);
  assert.equal(hiddenInput.includes("Private street"), false);
});

test("details and ordinary media saves preserve marketing configuration until explicitly updated", () => {
  const existing = configuredProperty();
  const details = structuredClone(existing);
  details.marketingMaterials = undefined;
  details.price = "€700,000";
  assert.deepEqual(
    mergePropertyShowcaseUpdate(existing, details, "details").property?.marketingMaterials,
    existing.marketingMaterials,
  );
  const media = structuredClone(existing);
  media.marketingMaterials = { enabled: false };
  assert.deepEqual(
    mergePropertyShowcaseUpdate(existing, media, "media").property?.marketingMaterials,
    existing.marketingMaterials,
  );
  assert.equal(
    mergePropertyShowcaseUpdate(existing, media, "media", {
      updateMarketingMaterials: true,
    }).property?.marketingMaterials?.enabled,
    false,
  );
});

test("download filenames are safe, orientation-specific and format-specific", () => {
  assert.equal(
    safePropertyMarketingFilename("house-in-altea", "brochure.pdf", "portrait"),
    "house-in-altea-portrait-brochure.pdf",
  );
  assert.equal(
    safePropertyMarketingFilename("../Unsafe Name", "brochure.png", "landscape"),
    "unsafe-name-landscape-brochure.png",
  );
});
