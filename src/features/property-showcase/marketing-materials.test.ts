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
      orientation: "portrait",
      template: "a4-editorial",
      primaryMediaId: property.gallery[1]?.id,
      supportingMediaIds: [property.gallery[0]?.id, property.gallery[2]?.id].filter(
        (id): id is string => Boolean(id),
      ),
    },
  };
  property.gallery[0].focalPoint = { x: 0.2, y: 0.8 };
  return property;
}

test("properties without brochure settings receive disabled portrait defaults", () => {
  const property = cloneProperty();
  delete property.marketingMaterials;
  const config = normalizePropertyMarketingMaterialsConfig(undefined, property);
  assert.equal(config.enabled, false);
  assert.equal(config.brandingMode, "picchuspot");
  assert.equal(config.includeQrCode, true);
  assert.equal(config.brochure.orientation, "portrait");
  assert.equal(config.brochure.template, "a4-editorial");
  assert.equal(config.legacyNormalized, false);
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
  assert.equal(effectiveLandscapeLayout("hero-four-grid", 4), "hero-two-square");
  assert.equal(effectiveLandscapeLayout("hero-four-grid", 5), "hero-four-grid");
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
    templateChanged.marketingMaterials.brochure.template = "a4-classic";
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
  assert.equal(links.orientation, "portrait");
  assert.match(links.pdf ?? "", /^\/property\/sea-view-residence\/materials\/brochure\.pdf\?v=[a-f0-9]{14}$/);
  assert.equal("landscapePng" in links, false);
  assert.equal("flyerPdf" in links, false);
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
