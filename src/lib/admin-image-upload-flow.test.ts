import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  STANDARD_PUBLIC_IMAGE_SLOTS,
  usesStandardPublicImageProfile,
} from "./admin-public-image-optimization.ts";
import { failedAdminUploadCleanupCandidates } from "./admin-upload-cleanup.ts";
import {
  IMAGE_PROFILE_SETTINGS,
  STANDARD_PUBLIC_IMAGE_PROFILE,
  formatImageOptimizationSummary,
  summarizeImageOptimizations,
} from "./client-image-optimizer.ts";

const portfolioClient = readFileSync(
  new URL(
    "../app/(default)/(public)/admin/portfolio/PortfolioAdminClient.tsx",
    import.meta.url,
  ),
  "utf8",
);
const siteMediaClient = readFileSync(
  new URL(
    "../app/(default)/(public)/admin/media/MediaAdminClient.tsx",
    import.meta.url,
  ),
  "utf8",
);
const propertyMediaClient = readFileSync(
  new URL(
    "../app/(default)/(public)/admin/properties/media/OptimizedPropertyMediaManagerClient.tsx",
    import.meta.url,
  ),
  "utf8",
);
const portfolioUploadRoute = readFileSync(
  new URL(
    "../app/(public)/api/admin/portfolio/upload-url/route.ts",
    import.meta.url,
  ),
  "utf8",
);
const siteMediaUploadRoute = readFileSync(
  new URL(
    "../app/(public)/api/admin/media/upload-url/route.ts",
    import.meta.url,
  ),
  "utf8",
);

test("the shared gallery profile keeps the established property-media settings", () => {
  assert.equal(STANDARD_PUBLIC_IMAGE_PROFILE, "gallery");
  assert.deepEqual(IMAGE_PROFILE_SETTINGS.gallery, {
    maxLongSide: 2800,
    minLongSide: 1800,
    targetBytes: 1_600_000,
    initialQuality: 0.84,
    minimumQuality: 0.68,
  });
  assert.match(propertyMediaClient, /from "@\/lib\/client-image-optimizer"/);
  assert.match(
    propertyMediaClient,
    /optimizeClientImage\(sourceFile, "gallery"\)/,
  );
  assert.match(
    propertyMediaClient,
    /optimizeClientImage\(sourceFile, "floor-plan"\)/,
  );
  assert.match(propertyMediaClient, /cacheControl: "31536000"/);
});

test("optimization summaries aggregate every changed public image", () => {
  const summary = summarizeImageOptimizations([
    { originalBytes: 6_000_000, optimizedBytes: 1_400_000 },
    { originalBytes: 7_000_000, optimizedBytes: 1_500_000 },
  ]);

  assert.deepEqual(summary, {
    originalBytes: 13_000_000,
    optimizedBytes: 2_900_000,
    savedBytes: 10_100_000,
    savedPercent: 78,
  });
  assert.match(formatImageOptimizationSummary(summary), /78% saved/);
});

test("portfolio optimizes both files before requesting WebP signed uploads", () => {
  for (const status of [
    "Optimizing before image…",
    "Uploading before image…",
    "Optimizing after image…",
    "Uploading after image…",
  ]) {
    assert.equal(portfolioClient.includes(status), true, status);
  }

  assert.match(
    portfolioClient,
    /setStage\("optimizing-before"\)[\s\S]*optimizeClientImage\([\s\S]*setStage\("uploading-before"\)[\s\S]*requestSignedUrl\([\s\S]*optimized\.file/,
  );
  assert.match(
    portfolioClient,
    /setStage\("optimizing-after"\)[\s\S]*optimizeClientImage\([\s\S]*setStage\("uploading-after"\)[\s\S]*requestSignedUrl\([\s\S]*optimized\.file/,
  );
  assert.match(portfolioClient, /content_type: file\.type/);
  assert.match(portfolioClient, /file_size: file\.size/);
  assert.match(portfolioClient, /uploadOne\(optimized\.file, signed\.data\)/);
  assert.match(portfolioClient, /cacheControl: "31536000"/);
  assert.match(portfolioClient, /formatImageOptimizationSummary/);
});

test("portfolio keeps unchanged edit paths and rolls back only new uploads", () => {
  assert.match(
    portfolioClient,
    /let beforePath = isEdit && initial \? initial\.before_image_path : ""/,
  );
  assert.match(
    portfolioClient,
    /let afterPath = isEdit && initial \? initial\.after_image_path : ""/,
  );
  assert.match(portfolioClient, /uploadedPaths\.push\(signed\.data\.path\)/);
  assert.match(portfolioClient, /await cleanupFailedUploads\(/);
  assert.match(portfolioClient, /retained_paths: retainedPaths/);
});

test("site media applies the standard profile to ordinary slots only", () => {
  assert.deepEqual(STANDARD_PUBLIC_IMAGE_SLOTS, [
    "before",
    "after",
    "image",
    "poster",
  ]);
  for (const slot of STANDARD_PUBLIC_IMAGE_SLOTS) {
    assert.equal(usesStandardPublicImageProfile(slot), true);
  }
  assert.equal(usesStandardPublicImageProfile("panorama"), false);

  assert.match(
    siteMediaClient,
    /if \(usesStandardPublicImageProfile\(slot\)\) \{[\s\S]*optimizeClientImage\([\s\S]*uploadFile = optimized\.file/,
  );
  assert.match(siteMediaClient, /let uploadFile = file/);
  assert.match(
    siteMediaClient,
    /requestSignedUrl\(uploadFile, cfg\.kind\)/,
  );
  assert.match(siteMediaClient, /uploadOne\(uploadFile, signed\.data\)/);
  assert.match(siteMediaClient, /cacheControl: "31536000"/);
  assert.match(siteMediaClient, /formatImageOptimizationSummary/);
  assert.match(siteMediaClient, /await cleanupFailedUploads\(/);
});

test("failed-upload cleanup excludes retained, foreign, and duplicate paths", () => {
  assert.deepEqual(
    failedAdminUploadCleanupCandidates({
      uploadedPaths: [
        "service-hero/new-before.webp",
        "service-hero/new-before.webp",
        "service-hero/current.webp",
        "homepage-slider/foreign.webp",
      ],
      retainedPaths: ["service-hero/current.webp"],
      isOwnedPath: (path) => path.startsWith("service-hero/"),
    }),
    ["service-hero/new-before.webp"],
  );

  assert.match(portfolioUploadRoute, /unreferencedPortfolioFiles\(paths\)/);
  assert.match(siteMediaUploadRoute, /unreferencedSiteMediaFiles\(paths\)/);
});
