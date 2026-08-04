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
const propertyOpenGraphImageSource = readFileSync(
  new URL(
    "../../app/(showcase)/property/[slug]/opengraph-image/route.tsx",
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
  assert.equal(propertyShowcaseSource.includes(">\n                            Website"), true);
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
  assert.equal(propertyPageSource.includes("absoluteUrl(canonicalPath)"), true);
  assert.equal(
    propertyPageSource.includes("`${canonicalPath}/opengraph-image`"),
    true,
  );
  assert.equal(propertyPageSource.includes('width: 1200'), true);
  assert.equal(propertyPageSource.includes('height: 630'), true);
  assert.equal(propertyPageSource.includes('type: "image/png"'), true);
  assert.equal(propertyOpenGraphImageSource.includes("ImageResponse"), true);
  assert.equal(propertyOpenGraphImageSource.includes("width: 1200"), true);
  assert.equal(propertyOpenGraphImageSource.includes("height: 630"), true);
  assert.equal(propertyOpenGraphImageSource.includes("export async function GET"), true);
  assert.equal(
    propertyOpenGraphImageSource.includes("resolvedPropertySocialImages"),
    true,
  );
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
