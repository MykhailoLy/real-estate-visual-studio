import assert from "node:assert/strict";
import test from "node:test";
import { PropertyShowcaseSchema } from "./schema.ts";
import { costaBlancaDemo } from "./registry.ts";
import {
  createPropertyMarketingMaterialView,
  effectiveLandscapeLayout,
  normalizePropertyMarketingMaterialsConfig,
  safePropertyMarketingFilename,
} from "./marketing-materials.ts";
import {
  computePropertyMarketingMaterialVersion,
  createPropertyMarketingMaterialVersionInput,
  getPropertyMarketingMaterialLinks,
} from "./marketing-material-version.ts";
import { mergePropertyShowcaseUpdate } from "./updates.ts";
import type { PropertyShowcase } from "./types.ts";

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
    landscape: {
      enabled: true,
      layout: "hero-two-square",
      primaryMediaId: property.gallery[1]?.id,
      secondaryMediaIds: [property.gallery[0]?.id, property.gallery[2]?.id].filter(
        (id): id is string => Boolean(id),
      ),
    },
    portrait: {
      enabled: true,
      layout: "a4-editorial",
      primaryMediaId: property.gallery[0]?.id,
      secondaryMediaIds: property.gallery.slice(1, 5).map((image) => image.id),
    },
  };
  property.gallery[0].focalPoint = { x: 0.2, y: 0.8 };
  return property;
}

test("legacy properties receive backward-compatible disabled defaults", () => {
  const property = cloneProperty();
  delete property.marketingMaterials;
  const config = normalizePropertyMarketingMaterialsConfig(undefined, property);
  assert.equal(config.enabled, false);
  assert.equal(config.brandingMode, "picchuspot");
  assert.equal(config.includeQrCode, true);
  assert.equal(config.landscape.layout, "hero-two-square");
  assert.equal(config.portrait.layout, "a4-editorial");
});

test("marketing schema accepts focal points and rejects unsafe model values", () => {
  const property = configuredProperty();
  property.translations = undefined;
  assert.equal(PropertyShowcaseSchema.safeParse(property).success, true);
  const invalid = cloneProperty();
  invalid.gallery[0].focalPoint = { x: -1, y: 2 };
  assert.equal(PropertyShowcaseSchema.safeParse(invalid).success, false);
  const invalidLayout = configuredProperty() as PropertyShowcase & {
    marketingMaterials: { landscape: { layout: string } };
  };
  invalidLayout.marketingMaterials.landscape.layout = "arbitrary-template";
  assert.equal(PropertyShowcaseSchema.safeParse(invalidLayout).success, false);
});

test("selected photo order is stable and layout fallbacks never require blank panels", () => {
  const property = configuredProperty();
  const view = createPropertyMarketingMaterialView(property, canonicalUrl);
  assert.equal(view.landscapeImages[0]?.id, property.gallery[1]?.id);
  assert.deepEqual(
    view.landscapeImages.slice(1, 3).map((image) => image.id),
    [property.gallery[0]?.id, property.gallery[2]?.id],
  );
  assert.deepEqual(view.landscapeImages[1]?.focalPoint, { x: 0.2, y: 0.8 });
  assert.equal(effectiveLandscapeLayout("hero-four-grid", 1), "single-hero");
  assert.equal(effectiveLandscapeLayout("hero-four-grid", 3), "hero-two-square");
  assert.equal(effectiveLandscapeLayout("hero-two-square", 3), "hero-two-square");
});

test("visible inputs, selection order, focal points and layouts deterministically version URLs", () => {
  const property = configuredProperty();
  const first = computePropertyMarketingMaterialVersion(property, canonicalUrl);
  assert.equal(first, computePropertyMarketingMaterialVersion(property, canonicalUrl));

  const focalChanged = structuredClone(property);
  focalChanged.gallery[0].focalPoint = { x: 0.3, y: 0.8 };
  assert.notEqual(computePropertyMarketingMaterialVersion(focalChanged, canonicalUrl), first);

  const layoutChanged = structuredClone(property);
  if (layoutChanged.marketingMaterials?.landscape) {
    layoutChanged.marketingMaterials.landscape.layout = "single-hero";
  }
  assert.notEqual(computePropertyMarketingMaterialVersion(layoutChanged, canonicalUrl), first);

  const orderChanged = structuredClone(property);
  if (orderChanged.marketingMaterials?.landscape?.secondaryMediaIds) {
    orderChanged.marketingMaterials.landscape.secondaryMediaIds.reverse();
  }
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
  assert.match(links.flyerPdf ?? "", /^\/property\/sea-view-residence\/materials\/flyer\.pdf\?v=[a-f0-9]{14}$/);
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

test("download filenames are safe and format-specific", () => {
  assert.equal(safePropertyMarketingFilename("house-in-altea", "flyer.pdf"), "house-in-altea-flyer.pdf");
  assert.equal(safePropertyMarketingFilename("../Unsafe Name", "landscape.png"), "unsafe-name-landscape.png");
});
