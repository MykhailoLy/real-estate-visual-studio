import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const mediaManagerSource = readFileSync(
  new URL(
    "../../app/(public)/admin/properties/media/OptimizedPropertyMediaManagerClient.tsx",
    import.meta.url,
  ),
  "utf8",
);
const propertyEditorSource = readFileSync(
  new URL(
    "../../app/(public)/admin/properties/PropertiesAdminClient.tsx",
    import.meta.url,
  ),
  "utf8",
);
const propertyMapCanvasSource = readFileSync(
  new URL(
    "../../app/(showcase)/property/PropertyMapCanvas.tsx",
    import.meta.url,
  ),
  "utf8",
);
const virtualTourSource = readFileSync(
  new URL(
    "../../app/(showcase)/property/ImmersivePropertyTour.tsx",
    import.meta.url,
  ),
  "utf8",
);
const interactivePlanSource = readFileSync(
  new URL(
    "../../app/(showcase)/property/InteractivePropertyFloorPlan.tsx",
    import.meta.url,
  ),
  "utf8",
);
const propertyShowcaseSource = readFileSync(
  new URL(
    "../../app/(showcase)/property/PropertyShowcaseView.tsx",
    import.meta.url,
  ),
  "utf8",
);
const propertyHeroSlideshowSource = readFileSync(
  new URL(
    "../../app/(showcase)/property/PropertyHeroSlideshow.tsx",
    import.meta.url,
  ),
  "utf8",
);
const propertySectionNavSource = readFileSync(
  new URL(
    "../../app/(showcase)/property/costa-blanca-demo/PropertySectionNav.tsx",
    import.meta.url,
  ),
  "utf8",
);
const propertySocialBrandIconSource = readFileSync(
  new URL(
    "../../app/(showcase)/property/PropertySocialBrandIcon.tsx",
    import.meta.url,
  ),
  "utf8",
);
const propertyPageSource = readFileSync(
  new URL(
    "../../app/(showcase)/property/[slug]/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const propertyMetadataSource = readFileSync(
  new URL("./property-metadata.ts", import.meta.url),
  "utf8",
);
const propertyOpenGraphImageSource = readFileSync(
  new URL(
    "../../app/(showcase)/property/[slug]/opengraph-image/route.tsx",
    import.meta.url,
  ),
  "utf8",
);
const marketingMaterialRendererSource = readFileSync(
  new URL("./marketing-material-renderer.tsx", import.meta.url),
  "utf8",
);
const marketingMaterialsSource = readFileSync(
  new URL("./marketing-materials.ts", import.meta.url),
  "utf8",
);
const marketingConfiguratorSource = readFileSync(
  new URL(
    "../../app/(public)/admin/properties/media/PropertyMarketingConfigurator.tsx",
    import.meta.url,
  ),
  "utf8",
);
const marketingPreviewRouteSource = readFileSync(
  new URL(
    "../../app/(public)/api/admin/properties/[id]/materials/preview/route.ts",
    import.meta.url,
  ),
  "utf8",
);
const socialPreviewRouteSource = readFileSync(
  new URL(
    "../../app/(public)/api/admin/properties/[id]/social-card/preview/route.ts",
    import.meta.url,
  ),
  "utf8",
);
const socialPreviewComponentSource = readFileSync(
  new URL(
    "../../app/(public)/admin/properties/media/PropertySocialCardPreview.tsx",
    import.meta.url,
  ),
  "utf8",
);
const socialPreviewResponseSource = readFileSync(
  new URL("./social-preview-response.ts", import.meta.url),
  "utf8",
);
const marketingDownloadsSource = readFileSync(
  new URL(
    "../../app/(showcase)/property/PropertyMarketingDownloads.tsx",
    import.meta.url,
  ),
  "utf8",
);
const marketingAssetsSource = readFileSync(
  new URL("./marketing-material-assets.ts", import.meta.url),
  "utf8",
);
const propertyVideoSource = readFileSync(
  new URL(
    "../../app/(showcase)/property/PropertyVideoSection.tsx",
    import.meta.url,
  ),
  "utf8",
);
const viewingDialogSource = readFileSync(
  new URL(
    "../../app/(showcase)/property/PropertyViewingRequestDialog.tsx",
    import.meta.url,
  ),
  "utf8",
);
const propertyActionsSource = readFileSync(
  new URL(
    "../../app/(showcase)/property/PropertyShowcaseActions.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("ordinary floor-plan cards hide legacy CubiCasa and raw URL controls", () => {
  assert.equal(mediaManagerSource.includes("Legacy interactive plan metadata"), false);
  assert.equal(mediaManagerSource.includes("Normalized embed URL"), false);
  assert.equal(mediaManagerSource.includes("Original/fallback URL"), false);
  assert.equal(mediaManagerSource.includes("Download URL"), false);
});

test("legacy tour promotion remains an explicit property-editor action", () => {
  assert.equal(
    propertyEditorSource.includes(
      "Move legacy tour to property-level settings",
    ),
    true,
  );
  assert.equal(
    propertyEditorSource.includes("Select the correct legacy tour"),
    true,
  );
});

test("map admin distinguishes generated maps from an explicit custom embed", () => {
  assert.equal(
    propertyEditorSource.includes("Use custom Google Maps embed"),
    true,
  );
  assert.equal(
    propertyEditorSource.includes("Generated exact marker map"),
    true,
  );
  assert.equal(
    propertyEditorSource.includes("Generated approximate map"),
    true,
  );
  assert.equal(
    propertyEditorSource.includes("Custom Google Maps embed"),
    true,
  );
});

test("public exact maps do not add a marker status overlay", () => {
  assert.equal(propertyMapCanvasSource.includes("exact-map-marker-status"), false);
  assert.equal(propertyMapCanvasSource.includes("Exact map with marker"), false);
});

test("map admin exposes a fixed approximate center and radius preview", () => {
  assert.equal(propertyEditorSource.includes("Fixed approximate zone"), true);
  assert.equal(
    propertyEditorSource.includes("Approximate center latitude"),
    true,
  );
  assert.equal(
    propertyEditorSource.includes("Approximate center longitude"),
    true,
  );
  assert.equal(
    propertyEditorSource.includes("Approximate radius (meters)"),
    true,
  );
  assert.equal(propertyMapCanvasSource.includes("pointer-events-none"), true);
});

test("media manager exposes featured and primary social image controls", () => {
  assert.equal(mediaManagerSource.includes("Featured / best for sharing"), true);
  assert.equal(mediaManagerSource.includes("Set social primary"), true);
  assert.equal(mediaManagerSource.includes("Social sharing preview"), true);
  assert.equal(mediaManagerSource.includes("social-card-admin-preview"), true);
  assert.equal(
    mediaManagerSource.includes("Protected Vercel branch previews"),
    true,
  );
  assert.equal(
    mediaManagerSource.includes(
      "Images marked Best for sharing are also used for the automatic hero slideshow.",
    ),
    true,
  );
});

test("listing facts and highlights use one open responsive composition", () => {
  assert.equal(
    propertyShowcaseSource.includes("property-details-composition"),
    true,
  );
  assert.equal(propertyShowcaseSource.includes("min-[1400px]:grid-cols-8"), true);
  assert.equal(propertyShowcaseSource.includes("min-[900px]:grid-cols-4"), true);
  assert.equal(propertyShowcaseSource.includes("min-[360px]:grid-cols-4"), true);
  assert.equal(propertyShowcaseSource.includes("gap-y-5 py-7"), true);
  assert.equal(propertyShowcaseSource.includes("min-[380px]:grid-cols-2"), true);
  assert.equal(propertyShowcaseSource.includes("xl:grid-cols-3"), true);
  assert.equal(propertyShowcaseSource.includes("border-r border-black/8"), false);
  assert.equal(propertyShowcaseSource.includes("min-h-40"), false);
  assert.equal(propertyShowcaseSource.includes("<h2 className=\"sr-only\">"), true);
});

test("property address admin keeps structured fields and the legacy fallback", () => {
  for (const label of [
    "Street address",
    "City / locality",
    "Region / province / state (optional)",
    "Postal code (optional)",
    "Country (optional)",
    "Full display-address fallback (advanced)",
  ]) {
    assert.equal(propertyEditorSource.includes(label), true);
  }
  assert.equal(propertyEditorSource.includes("Calle San Pablo 46"), true);
  assert.equal(propertyEditorSource.includes("formatStructuredPropertyAddress"), true);
});

test("hero uses the sharing image selection without visible status or reference pills", () => {
  assert.equal(propertyShowcaseSource.includes("PropertyHeroSlideshow"), true);
  assert.equal(propertyShowcaseSource.includes("selectPropertyHeroImages"), true);
  assert.equal(propertyShowcaseSource.includes("ui.status[property.status]"), false);
  assert.equal(propertyShowcaseSource.includes("listingReferenceLabel"), false);
  assert.equal(propertyHeroSlideshowSource.includes("ROTATION_INTERVAL_MS = 7000"), true);
  assert.equal(propertyHeroSlideshowSource.includes("FADE_DURATION_MS = 1500"), true);
  assert.equal(
    propertyHeroSlideshowSource.includes("prefers-reduced-motion: reduce"),
    true,
  );
  assert.equal(propertyHeroSlideshowSource.includes("document.hidden"), true);
  assert.equal(propertyHeroSlideshowSource.includes("preload={activeIndex === 0}"), true);
  assert.equal(propertyHeroSlideshowSource.includes("property-hero-slideshow"), true);
});

test("property footer is PicchuSpot-only and calculates the current year", () => {
  assert.equal(propertyShowcaseSource.includes("Full Frame Media"), false);
  assert.equal(propertyShowcaseSource.includes("Property showcase by"), true);
  assert.equal(propertyShowcaseSource.includes("BrandWordmark"), true);
  assert.equal(propertyShowcaseSource.includes("new Date().getFullYear()"), true);
  assert.equal(propertyShowcaseSource.includes("CookieSettingsButton"), true);
  assert.equal(propertyShowcaseSource.includes('href="/terms"'), true);
});

test("realtor section is compact and never prints a raw website URL", () => {
  assert.equal(propertyShowcaseSource.includes("property-contact-section"), true);
  assert.equal(propertyShowcaseSource.includes("lg:py-10"), true);
  assert.equal(propertyShowcaseSource.includes(">{agent.website}<"), false);
  assert.match(propertyShowcaseSource, /<Globe2[\s\S]+Website[\s\S]+<\/a>/);
});

test("media visibility controls and navigation are driven by rendered sections", () => {
  assert.equal(propertyEditorSource.includes("Show 360 virtual tour"), true);
  assert.equal(
    propertyEditorSource.includes(
      "Show property-level interactive floor-plan tour",
    ),
    true,
  );
  assert.equal(propertySectionNavSource.includes("showVirtualTour"), true);
  assert.equal(propertySectionNavSource.includes("showVideo"), true);
  assert.equal(propertySectionNavSource.includes("showInteractivePlan"), true);
  assert.equal(propertySectionNavSource.includes("showContact"), true);
  assert.equal(propertySectionNavSource.includes("showLocation"), true);
  assert.equal(propertySectionNavSource.includes("property-mobile-section-nav"), true);
  assert.equal(propertySectionNavSource.includes("More sections"), true);
  assert.equal(propertySectionNavSource.includes("overflow-x-auto"), false);
  assert.equal(
    propertyEditorSource.indexOf('<Section title="4. Listing facts">') <
      propertyEditorSource.indexOf('<Section title="5. Highlights">'),
    true,
  );
});

test("property video admin and public player remain metadata-only and lazy", () => {
  assert.equal(propertyEditorSource.includes("7. Property video"), true);
  assert.equal(propertyEditorSource.includes("Show property videos"), true);
  assert.equal(propertyEditorSource.includes("Add video"), true);
  assert.equal(propertyEditorSource.includes("Primary video"), true);
  assert.equal(propertyEditorSource.includes("Public video URL or embed code"), true);
  assert.equal(propertyEditorSource.includes("upload video"), false);
  assert.equal(propertyVideoSource.includes("property-video-section"), true);
  assert.equal(propertyVideoSource.includes('status !== "poster" && canEmbed'), true);
  assert.equal(propertyVideoSource.includes("property-video-iframe"), true);
  assert.equal(propertyVideoSource.includes("videos.map"), true);
  assert.equal(
    propertyVideoSource.includes('canEmbed && status !== "poster"'),
    true,
  );
});

test("ordinary floor plans have independent visibility without clearing media", () => {
  assert.equal(propertyEditorSource.includes("Show ordinary floor plans"), true);
  assert.equal(
    propertyEditorSource.includes(
      "without deleting uploaded plan images",
    ),
    true,
  );
  assert.equal(propertyShowcaseSource.includes("showFloorPlans && primaryFloorPlan"), true);
});

test("the brand bar is removed and the dynamic section nav is the top sticky bar", () => {
  assert.equal(propertyShowcaseSource.includes("property-brand-bar"), false);
  assert.equal(propertySectionNavSource.includes("sticky top-0"), true);
  assert.equal(propertySectionNavSource.includes('href: "#video"'), true);
  assert.equal(propertySectionNavSource.includes("PROPERTY_LANGUAGE_LABELS"), true);
});

test("hero viewing CTA opens an accessible keyboard-native dialog", () => {
  assert.equal(propertyShowcaseSource.includes("hero-request-viewing"), true);
  assert.equal(propertyShowcaseSource.includes("setViewingDialogOpen(true)"), true);
  assert.equal(viewingDialogSource.includes("<dialog"), true);
  assert.equal(viewingDialogSource.includes("showModal()"), true);
  assert.equal(viewingDialogSource.includes("onCancel"), true);
  assert.equal(viewingDialogSource.includes("property_lead"), true);
  assert.equal(viewingDialogSource.includes("Continue in WhatsApp"), true);
});

test("sharing never derives a URL from the current admin or preview location", () => {
  assert.equal(propertyActionsSource.includes("window.location.href"), false);
  assert.equal(propertyActionsSource.includes("url: canonicalUrl"), true);
  assert.equal(propertyActionsSource.includes("writeText(canonicalUrl)"), true);
});

test("social-card rendering validates image bytes and has a deliberate fallback", () => {
  assert.equal(propertyOpenGraphImageSource.includes("preparePropertySocialAssets"), true);
  assert.equal(propertyOpenGraphImageSource.includes("createPropertySocialImageHandler"), true);
  assert.equal(propertyOpenGraphImageSource.includes("renderPropertySocialCardPng"), true);
  assert.equal(marketingMaterialRendererSource.includes("model.title"), true);
  assert.equal(propertyOpenGraphImageSource.includes("property-social-emergency.png"), true);
  assert.equal(propertyEditorSource.includes("Social-card branding"), true);
  assert.equal(propertyEditorSource.includes("PropertySocialCardPreview"), true);
  assert.equal(mediaManagerSource.includes("PropertySocialCardPreview"), true);
  assert.equal(socialPreviewResponseSource.includes("preparePropertySocialAssets"), true);
  assert.equal(socialPreviewResponseSource.includes("renderPropertySocialCardPng"), true);
  assert.equal(propertyEditorSource.includes("FullFrame Media"), false);
});

test("admin verifies the saved public generated endpoint without downloading its body", () => {
  assert.equal(mediaManagerSource.includes('method: "HEAD"'), true);
  assert.equal(mediaManagerSource.includes("generatedSocialImagePath"), true);
  assert.equal(mediaManagerSource.includes("Generated image available"), true);
  assert.equal(mediaManagerSource.includes("Generated image fallback"), true);
  assert.equal(mediaManagerSource.includes("Generated image failed"), true);
  assert.equal(mediaManagerSource.includes("href={generatedSocialImagePath}"), true);
  assert.equal(mediaManagerSource.includes("/api/admin/"), true);
  assert.equal(mediaManagerSource.includes("absoluteUrl(`/property/"), false);
});

test("approximate map links require an explicit text-only public-area option", () => {
  assert.equal(
    propertyEditorSource.includes(
      "Allow opening approximate area in Google Maps",
    ),
    true,
  );
  assert.equal(
    propertyEditorSource.includes(
      "Exact and approximate numeric coordinates are never placed in the external URL.",
    ),
    true,
  );
  assert.equal(
    /form\.privacyMode === "exact"\s*\?\s*exactAddress\s*:\s*form\.approximateLabel\.trim\(\)/.test(
      propertyEditorSource,
    ),
    true,
  );
  assert.equal(propertyMapCanvasSource.includes("property-map-external-link"), true);
});

test("realtor social links use local recognizable brand marks", () => {
  for (const provider of [
    "facebook",
    "instagram",
    "linkedin",
    "youtube",
    "tiktok",
    "whatsapp",
    "x",
    "pinterest",
  ]) {
    assert.equal(
      propertySocialBrandIconSource.includes(`social-icon-${provider}`),
      true,
    );
  }
  assert.equal(propertyShowcaseSource.includes("PropertySocialBrandIcon"), true);
  assert.equal(propertyShowcaseSource.includes("BriefcaseBusiness"), false);
  assert.equal(propertyShowcaseSource.includes("Camera,"), false);
  assert.equal(propertyShowcaseSource.includes("Users,"), false);
});

test("property metadata uses a production-domain 1200 by 630 PNG route", () => {
  assert.equal(propertyPageSource.includes("buildPropertyMetadata"), true);
  assert.equal(
    propertyPageSource.includes("getPropertySocialImageVersion(property)"),
    true,
  );
  assert.equal(propertyMetadataSource.includes("absoluteUrl(canonicalPath)"), true);
  assert.equal(
    propertyMetadataSource.includes(
      "opengraph-image?v=${encodeURIComponent(version)}",
    ),
    true,
  );
  assert.equal(propertyMetadataSource.includes('width: 1200'), true);
  assert.equal(propertyMetadataSource.includes('height: 630'), true);
  assert.equal(propertyMetadataSource.includes('type: "image/png"'), true);
  assert.equal(marketingMaterialRendererSource.includes("ImageResponse"), true);
  assert.equal(marketingMaterialRendererSource.includes("width={1200}"), true);
  assert.equal(marketingMaterialRendererSource.includes("height={630}"), true);
  assert.equal(propertyOpenGraphImageSource.includes("export async function GET"), true);
  assert.equal(
    propertyOpenGraphImageSource.includes("preparePropertySocialAssets"),
    true,
  );
});

test("media admin exposes configurable social card controls and local preview", () => {
  for (const expectedText of [
    "Social card settings",
    "Content selection",
    "Custom facts",
    "Image focused (large photos)",
    "Balanced (photos and details)",
    "Minimal (one dominant photo)",
    "Show location",
    "Show price",
    "Show branding",
    "Show Powered by PicchuSpot",
    "Reset defaults",
    "Open generated social PNG",
  ]) {
    assert.equal(mediaManagerSource.includes(expectedText), true);
  }
  assert.equal(mediaManagerSource.includes("updateSocialCard: socialCardChanged"), true);
  assert.equal(mediaManagerSource.includes('method: "HEAD"'), true);
  assert.equal(mediaManagerSource.includes("record.updatedAt"), true);
  assert.equal(mediaManagerSource.includes("PROPERTY_SOCIAL_CARD_MAX_FACTS"), true);
  assert.equal(mediaManagerSource.includes("Move ${PROPERTY_SOCIAL_CARD_FACT_LABELS[key]} earlier"), true);
});

test("flyer admin exposes only the three approved modes and an unsaved landscape preview", () => {
  for (const expected of [
    "7. Property flyer",
    "Choose flyer type",
    "No flyer",
    "Automatic landscape",
    "Custom flyer",
    "Custom property flyer",
    "Live flyer preview",
    "Supporting image order",
    "Unsaved changes",
    "Preview reflects unsaved changes",
  ]) {
    assert.equal(marketingConfiguratorSource.includes(expected), true, expected);
  }
  assert.equal(marketingConfiguratorSource.includes("AbortController"), true);
  assert.equal(marketingConfiguratorSource.includes("shouldApplyPropertyMarketingPreview"), true);
  assert.equal(marketingConfiguratorSource.includes("flyerMode !== \"automatic-landscape\""), true);
  assert.equal(marketingConfiguratorSource.includes("Portrait / A4"), false);
  assert.equal(marketingConfiguratorSource.includes("A4 Classic"), false);
  assert.equal(marketingConfiguratorSource.includes("flyer/verify"), true);
});

test("unsaved brochure preview is authenticated, bounded, no-store and read-only", () => {
  assert.equal(marketingPreviewRouteSource.includes("isAdminAuthenticated"), true);
  assert.equal(marketingPreviewRouteSource.indexOf("isAdminAuthenticated") < marketingPreviewRouteSource.indexOf("getPropertyShowcaseForAdminById"), true);
  assert.equal(marketingPreviewRouteSource.includes("PropertyMarketingPreviewDraftSchema"), true);
  assert.equal(marketingPreviewRouteSource.includes("256 * 1024"), true);
  assert.equal(marketingPreviewRouteSource.includes("existing property gallery"), true);
  assert.equal(marketingPreviewRouteSource.includes("gallery: sourceProperty.gallery"), true);
  assert.equal(marketingPreviewRouteSource.includes(".update("), false);
  assert.equal(marketingPreviewRouteSource.includes(".insert("), false);
  assert.equal(marketingPreviewRouteSource.includes(".delete("), false);
  assert.equal(marketingPreviewRouteSource.includes("createPropertyMarketingPreviewResponse"), true);
});

test("brochure preparation handles selected photos once and preview uses reduced assets", () => {
  assert.equal(marketingAssetsSource.includes("view.brochureImages"), true);
  assert.equal(marketingAssetsSource.includes("Promise.all"), true);
  assert.equal(marketingAssetsSource.includes("new Map(selected.map"), true);
  assert.equal(marketingAssetsSource.includes("preview ? 1000 : 2200"), true);
  assert.equal(marketingMaterialRendererSource.includes("getPropertyMarketingRenderDimensions"), true);
  assert.equal(marketingMaterialRendererSource.includes("calc("), false);
  assert.equal(marketingMaterialsSource.includes("{ width: 620, height: 877 }"), true);
  assert.equal(marketingMaterialsSource.includes("{ width: 960, height: 540 }"), true);
});

test("brochure compositions reflow sparse portrait content and never reserve failed media slots", () => {
  assert.equal(marketingMaterialRendererSource.includes("const hasHeader = hasRealtor"), true);
  assert.equal(marketingMaterialRendererSource.includes("model.qrCodeUrl || model.disclaimer"), true);
  assert.equal(marketingMaterialRendererSource.includes("model.highlights.length > 0"), true);
  assert.equal(marketingMaterialRendererSource.includes("model.customFacts.length > 0"), true);
  assert.equal(marketingMaterialRendererSource.includes("More property details available online"), true);
  assert.equal(marketingMaterialRendererSource.includes("supporting.length === 0"), true);
  assert.equal(marketingMaterialRendererSource.includes("images.slice(1"), true);
  assert.equal(marketingAssetsSource.includes("filter((image): image is PreparedMarketingImage"), true);
  assert.equal(marketingMaterialRendererSource.includes('const WHITE = "#ffffff"'), true);
  assert.equal(marketingMaterialRendererSource.includes('background: editorial ? "#f7f4ed"'), false);
  assert.equal(marketingMaterialRendererSource.includes("Full Frame Media"), false);
  assert.equal(marketingMaterialRendererSource.includes('fontSize: s(portrait ? 48 : 40)'), true);
  assert.equal(marketingMaterialRendererSource.includes('fontSize: s(portrait ? 38 : 32)'), true);
  assert.equal(marketingMaterialRendererSource.includes('width: s(portrait ? 390 : 270)'), true);
  assert.equal(marketingMaterialRendererSource.includes('objectFit: "contain"'), true);
  assert.equal(marketingMaterialRendererSource.includes("model.agentPhone ?"), true);
  assert.equal(marketingMaterialRendererSource.includes("const useHighlights = !view.copy && view.highlights.length > 0"), true);
  assert.equal(marketingMaterialRendererSource.includes("const hasSparseDetails"), true);
  assert.equal(marketingMaterialRendererSource.includes("SocialCardComposition"), true);
  assert.equal(marketingMaterialRendererSource.includes("LandscapeBrochureComposition"), true);
});

test("social preview uses the final renderer with an authenticated no-store unsaved draft", () => {
  assert.equal(socialPreviewComponentSource.includes("AbortController"), true);
  assert.equal(socialPreviewComponentSource.includes("requestSequence !== sequence.current"), true);
  assert.equal(socialPreviewComponentSource.includes("Updating preview"), true);
  assert.equal(socialPreviewComponentSource.includes('previewStatus === "updating" && previewUrl'), true);
  assert.equal(socialPreviewRouteSource.includes("isAdminAuthenticated"), true);
  assert.equal(socialPreviewRouteSource.includes("PropertyShowcaseSchema"), true);
  assert.equal(socialPreviewRouteSource.includes("256 * 1024"), true);
  assert.equal(socialPreviewRouteSource.includes("createPropertySocialPreviewResponse"), true);
  assert.equal(socialPreviewRouteSource.includes(".update("), false);
  assert.equal(socialPreviewRouteSource.includes(".insert("), false);
  assert.equal(socialPreviewRouteSource.includes(".delete("), false);
});

test("public brochure dialog uses available files only and has no print action", () => {
  assert.equal(marketingDownloadsSource.includes("Finished property brochure preview"), true);
  assert.equal(marketingDownloadsSource.includes('id: "print"'), false);
  assert.equal(marketingDownloadsSource.includes("window.print"), false);
  assert.equal(marketingDownloadsSource.includes("Printer"), false);
  assert.equal(marketingDownloadsSource.includes('id: "pdf"'), true);
  assert.equal(marketingDownloadsSource.includes('id: "jpg"'), true);
  assert.equal(marketingDownloadsSource.includes('id: "png"'), true);
  assert.equal(marketingDownloadsSource.includes("Download PDF"), true);
  assert.equal(marketingDownloadsSource.includes("Download JPG"), true);
  assert.equal(marketingDownloadsSource.includes("Download PNG"), true);
  assert.equal(marketingDownloadsSource.includes("actions.find"), true);
  assert.equal(marketingDownloadsSource.includes("PDF brochure ready to download"), true);
  assert.equal(marketingDownloadsSource.includes("links.previewKind === \"document\""), true);
  assert.equal(marketingDownloadsSource.includes("src={links.preview}"), true);
  assert.equal(marketingDownloadsSource.includes("object-contain"), true);
  assert.equal(marketingDownloadsSource.includes("Preparing brochure preview"), true);
  assert.equal(marketingDownloadsSource.includes("landscapePng"), false);
  assert.equal(marketingDownloadsSource.includes("flyerPdf"), false);
});

test("immersive provider views omit large marketing and status overlays", () => {
  assert.equal(
    virtualTourSource.includes("Enter the property without leaving the page"),
    false,
  );
  assert.equal(virtualTourSource.includes("Ready to load"), false);
  assert.equal(
    interactivePlanSource.includes("Walk through the home room by room"),
    false,
  );
  assert.equal(interactivePlanSource.includes("Ready to open"), false);
  assert.equal(virtualTourSource.includes("virtual-tour-controls"), true);
  assert.equal(interactivePlanSource.includes("interactive-plan-controls"), true);
});
