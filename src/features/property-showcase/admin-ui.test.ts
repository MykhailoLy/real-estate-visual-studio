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
const propertySectionNavSource = readFileSync(
  new URL(
    "../../app/(showcase)/property/costa-blanca-demo/PropertySectionNav.tsx",
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
});

test("listing facts and highlights use one open responsive composition", () => {
  assert.equal(
    propertyShowcaseSource.includes("property-details-composition"),
    true,
  );
  assert.equal(propertyShowcaseSource.includes("min-[1400px]:grid-cols-8"), true);
  assert.equal(propertyShowcaseSource.includes("min-[900px]:grid-cols-4"), true);
  assert.equal(propertyShowcaseSource.includes("grid-cols-2 gap-x-4"), true);
  assert.equal(
    propertyShowcaseSource.includes("min-[900px]:grid-cols-2"),
    true,
  );
  assert.equal(propertyShowcaseSource.includes("border-r border-black/8"), false);
  assert.equal(propertyShowcaseSource.includes("min-h-40"), false);
  assert.equal(propertyShowcaseSource.includes("<h2 className=\"sr-only\">"), true);
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
  assert.equal(
    propertyEditorSource.indexOf('<Section title="4. Listing facts">') <
      propertyEditorSource.indexOf('<Section title="5. Highlights">'),
    true,
  );
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
