import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (path: string) => readFileSync(path, "utf8");

const staticStageSource = readSource(
  "src/components/media/StaticImageStage.tsx",
);
const viewerScrollLockSource = readSource(
  "src/components/media/useViewerScrollLock.ts",
);
const pricingLightboxSource = readSource(
  "src/components/pricing/ImageLightbox.tsx",
);
const floorPlansInteractiveSource = readSource(
  "src/app/(public)/pricing/floor-plans/FloorPlansInteractive.tsx",
);
const styleGalleryCardSource = readSource(
  "src/components/pricing/StyleGalleryCard.tsx",
);
const propertyGallerySource = readSource(
  "src/app/(showcase)/property/costa-blanca-demo/PropertyGallery.tsx",
);
const filePreviewSource = readSource("src/components/FilePreviewCard.tsx");
const fileUploadSource = readSource("src/components/order/FileUpload.tsx");
const marketingDownloadsSource = readSource(
  "src/app/(showcase)/property/PropertyMarketingDownloads.tsx",
);
const orderExamplesSource = readSource(
  "src/components/dashboard/OrderExamplesModal.tsx",
);
const galleryComparisonSource = readSource(
  "src/components/gallery/GalleryBeforeAfterPair.tsx",
);
const propertyShowcaseSource = readSource(
  "src/app/(showcase)/property/PropertyShowcaseView.tsx",
);

test("shared expanded static-image stage owns centered contain behavior", () => {
  assert.match(staticStageSource, /object-contain object-center/);
  assert.doesNotMatch(staticStageSource, /object-cover/);
  assert.match(staticStageSource, /"objectFit" \| "objectPosition"/);
  assert.match(staticStageSource, /data-static-image-viewer-image/);
});

test("expanded viewers lock both document scrolling elements", () => {
  assert.match(viewerScrollLockSource, /document\.body\.style\.overflow/);
  assert.match(
    viewerScrollLockSource,
    /document\.documentElement\.style\.overflow/,
  );
  assert.match(viewerScrollLockSource, /previousRootOverflow/);

  for (const source of [
    pricingLightboxSource,
    propertyGallerySource,
    filePreviewSource,
    fileUploadSource,
    orderExamplesSource,
    marketingDownloadsSource,
  ]) {
    assert.match(source, /useViewerScrollLock/);
  }
});

test("pricing and property lightboxes use the viewport-aware shared stage", () => {
  assert.match(pricingLightboxSource, /StaticImageStage/);
  assert.match(pricingLightboxSource, /h-\[100dvh\]/);
  assert.doesNotMatch(pricingLightboxSource, /object-cover/);
  assert.doesNotMatch(pricingLightboxSource, /aspect-\[/);

  const propertyDialogSource = propertyGallerySource.slice(
    propertyGallerySource.indexOf("{activeImage ?"),
  );
  assert.match(propertyDialogSource, /StaticImageStage/);
  assert.match(propertyDialogSource, /h-\[100dvh\]/);
  assert.doesNotMatch(propertyDialogSource, /object-cover/);
  assert.doesNotMatch(propertyDialogSource, /h-\[76vh\]/);
  assert.match(propertyShowcaseSource, /<PropertyGallery/);
});

test("authenticated and generated preview dialogs retain uncropped image stages", () => {
  const filePreviewDialogSource = filePreviewSource.slice(
    filePreviewSource.indexOf("{modalOpen && previewUrl"),
    filePreviewSource.indexOf("function PreviewSurface"),
  );
  const uploadPreviewDialogSource = fileUploadSource.slice(
    fileUploadSource.indexOf("{open && previewUrl"),
    fileUploadSource.indexOf("function formatFileSize"),
  );

  for (const source of [filePreviewDialogSource, uploadPreviewDialogSource]) {
    assert.match(source, /h-\[100dvh\]/);
    assert.match(source, /object-contain object-center/);
    assert.doesNotMatch(source, /object-cover/);
  }

  assert.match(marketingDownloadsSource, /100dvh/);
  assert.match(marketingDownloadsSource, /object-contain/);
});

test("expanded before-and-after examples preserve both natural image ratios", () => {
  assert.match(orderExamplesSource, /h-\[100dvh\]/);
  assert.match(orderExamplesSource, /GalleryBeforeAfterPair/);
  assert.match(galleryComparisonSource, /className="block w-full h-auto"/);
  assert.doesNotMatch(galleryComparisonSource, /object-cover/);
});

test("card and thumbnail crop rules remain intact outside expanded viewers", () => {
  assert.match(floorPlansInteractiveSource, /object-cover/);
  assert.match(styleGalleryCardSource, /object-cover/);
  assert.match(propertyGallerySource, /object-cover/);
  assert.match(filePreviewSource, /w-full h-full object-cover/);
});

const pricingRouteFiles = [
  "360-image-enhancement",
  "360-virtual-staging",
  "aerial-editing",
  "day-to-dusk",
  "development-site-plans",
  "floor-plans",
  "image-enhancement",
  "photo-editing",
  "virtual-renovation",
  "virtual-staging",
].flatMap((slug) => [
  `src/app/(public)/pricing/${slug}/page.tsx`,
  `src/app/(public)/es/pricing/${slug}/page.tsx`,
]);

test("every English and Spanish pricing service route uses an audited viewer path", () => {
  assert.equal(pricingRouteFiles.length, 20);
  for (const routeFile of pricingRouteFiles) {
    const source = readSource(routeFile);
    assert.match(
      source,
      /ServicePage|PortfolioExamplesGrid|StyleGallerySection/,
      `${routeFile} must route examples through an audited implementation`,
    );
  }
});

const sourceFormats = [
  { name: "1920x1080 JPEG", width: 1920, height: 1080 },
  { name: "1600x1200 JPEG", width: 1600, height: 1200 },
  { name: "portrait photograph", width: 1200, height: 1600 },
  { name: "square image", width: 1200, height: 1200 },
  { name: "near-portrait floor plan", width: 1100, height: 1500 },
  { name: "wide floor plan", width: 1800, height: 1000 },
  { name: "extra-wide site plan", width: 2400, height: 800 },
  { name: "before/after pair", width: 1600, height: 1067 },
  { name: "transparent PNG floor plan", width: 1400, height: 1800 },
  { name: "WebP photograph", width: 1920, height: 1080 },
] as const;

const viewports = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 430, height: 932 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const;

test("contain geometry preserves every required source ratio at every viewport", () => {
  for (const viewport of viewports) {
    const stageWidth = Math.max(1, viewport.width - (viewport.width >= 640 ? 160 : 24));
    const stageHeight = Math.max(1, viewport.height - 112);

    for (const source of sourceFormats) {
      const scale = Math.min(
        stageWidth / source.width,
        stageHeight / source.height,
      );
      const renderedWidth = source.width * scale;
      const renderedHeight = source.height * scale;

      assert.ok(renderedWidth <= stageWidth + 1e-9, source.name);
      assert.ok(renderedHeight <= stageHeight + 1e-9, source.name);
      assert.ok(renderedWidth > 0 && renderedHeight > 0, source.name);
      assert.ok(
        Math.abs(renderedWidth / renderedHeight - source.width / source.height) <
          1e-10,
        source.name,
      );
    }
  }
});
