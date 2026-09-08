import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import {
  preparePropertyMarketingAssets,
  type PreparedPropertyMarketingAssets,
} from "../../src/features/property-showcase/marketing-material-assets";
import {
  renderPropertyMarketingPng,
  renderPropertySocialCardPng,
} from "../../src/features/property-showcase/marketing-material-renderer";
import { getPropertyShowcase } from "../../src/features/property-showcase/registry";
import { getPropertySocialPreview } from "../../src/features/property-showcase/social-preview";
import type { PropertySocialCardRenderInput } from "../../src/features/property-showcase/social-image-response";
import type {
  PropertyMarketingBrochureTemplate,
  PropertyShowcase,
} from "../../src/features/property-showcase/types";

const fixtureColors = [
  { id: "primary-red", rgb: [224, 38, 38] as const },
  { id: "support-green", rgb: [22, 163, 74] as const },
  { id: "support-blue", rgb: [37, 99, 235] as const },
  { id: "support-yellow", rgb: [234, 179, 8] as const },
  { id: "support-purple", rgb: [147, 51, 234] as const },
] as const;

async function fixturePng(
  rgb: readonly [number, number, number],
) {
  return sharp({
    create: {
      width: 320,
      height: 320,
      channels: 3,
      background: { r: rgb[0], g: rgb[1], b: rgb[2] },
    },
  }).png().toBuffer();
}

async function preparedAssets(
  template: PropertyMarketingBrochureTemplate,
  colorOrder: readonly (typeof fixtureColors)[number][] = fixtureColors,
  preview = true,
  supportingMediaIds = colorOrder.slice(1).map(({ id }) => id),
  failedMediaIds: readonly string[] = [],
): Promise<PreparedPropertyMarketingAssets> {
  const registered = getPropertyShowcase("sea-view-residence");
  expect(registered).not.toBeNull();
  const property = structuredClone(registered) as PropertyShowcase;
  const baseImage = property.gallery[0];
  const sourceBytes = new Map<string, Buffer>();
  property.gallery = await Promise.all(colorOrder.map(async ({ id, rgb }, index) => {
    const src = `/property-render-fixtures/${id}.png`;
    sourceBytes.set(src, await fixturePng(rgb));
    return {
      ...baseImage,
      id,
      src,
      alt: { en: id },
      label: { en: id },
      focalPoint: { x: 0.5, y: 0.5 },
      sortOrder: index + 1,
    };
  }));
  property.coverImage = property.gallery[0]?.src ?? property.coverImage;
  property.marketingMaterials = {
    enabled: true,
    brandingMode: "picchuspot",
    includeAgent: true,
    includeAgencyLogo: false,
    includeQrCode: false,
    includeDisclaimer: false,
    marketingCopyMode: "summary",
    brochure: {
      orientation: template.startsWith("a4-") ? "portrait" : "landscape",
      template,
      primaryMediaId: colorOrder[0]?.id,
      supportingMediaIds,
    },
  };
  return preparePropertyMarketingAssets(
    property,
    "https://picchuspot.com/property/sea-view-residence",
    {
      preview,
      loadSource: async (_property, imageUrl) => {
        const pathname = new URL(imageUrl).pathname;
        if (failedMediaIds.some((id) => pathname.endsWith(`/${id}.png`))) {
          return { ok: false as const, reason: "fetch-failed" as const };
        }
        const bytes = sourceBytes.get(pathname);
        return bytes
          ? { ok: true as const, source: { bytes, contentType: "image/png" } }
          : { ok: false as const, reason: "untrusted-url" as const };
      },
    },
  );
}

async function render(
  template: PropertyMarketingBrochureTemplate,
  colorOrder: readonly (typeof fixtureColors)[number][] = fixtureColors,
  preview = true,
) {
  const response = renderPropertyMarketingPng(
    await preparedAssets(template, colorOrder, preview),
    { preview },
  );
  expect(response.ok).toBe(true);
  return Buffer.from(await response.arrayBuffer());
}

async function socialInput(
  imageCount = 3,
  branding: "picchuspot" | "agency" | "unbranded" = "picchuspot",
): Promise<PropertySocialCardRenderInput> {
  const registered = getPropertyShowcase("sea-view-residence");
  expect(registered).not.toBeNull();
  const property = structuredClone(registered) as PropertyShowcase;
  property.socialPreview = { brandingMode: branding };
  property.highlights = [
    { text: { en: "Fireplace" }, sortOrder: 1 },
    { text: { en: "Private terrace" }, sortOrder: 2 },
    { text: { en: "Renovated kitchen" }, sortOrder: 3 },
  ];
  property.facts.push(
    { key: "custom-heating", label: { en: "Heating" }, value: "Central", sortOrder: 1000 },
    { key: "custom-orientation", label: { en: "Orientation" }, value: "South East", sortOrder: 1001 },
  );
  const images = await Promise.all(fixtureColors.slice(0, imageCount).map(async ({ id, rgb }) => {
    // Prepared social images are JPEGs; keep the fixture bytes and MIME in sync.
    const bytes = await sharp(await fixturePng(rgb)).jpeg().toBuffer();
    return {
      imageId: id,
      imageUrl: `data:image/jpeg;base64,${bytes.toString("base64")}`,
      imageAlt: id,
      focalPoint: { x: 0.5, y: 0.5 },
      byteLength: bytes.byteLength,
      contentType: "image/jpeg" as const,
    };
  }));
  return {
    property,
    preview: getPropertySocialPreview(property),
    propertyImages: images,
    brandingLogo: null,
    level: "full",
  };
}

async function renderSocial(input: PropertySocialCardRenderInput): Promise<Buffer> {
  const response = renderPropertySocialCardPng(input);
  expect(response.ok).toBe(true);
  return Buffer.from(await response.arrayBuffer());
}

async function colorPixelCounts(buffer: Buffer) {
  const { data, info } = await sharp(buffer)
    .resize({ width: 480, height: 270, fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const counts = new Map(fixtureColors.map(({ id }) => [id, 0]));
  for (let offset = 0; offset < data.length; offset += info.channels) {
    for (const { id, rgb } of fixtureColors) {
      if (
        Math.abs(data[offset] - rgb[0]) <= 12 &&
        Math.abs(data[offset + 1] - rgb[1]) <= 12 &&
        Math.abs(data[offset + 2] - rgb[2]) <= 12
      ) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
  }
  return counts;
}

async function colorCentroids(buffer: Buffer) {
  const { data, info } = await sharp(buffer)
    .resize({ width: 480 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const sums = new Map(
    fixtureColors.map(({ id }) => [id, { count: 0, x: 0, y: 0 }]),
  );
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      for (const { id, rgb } of fixtureColors) {
        if (
          Math.abs(data[offset] - rgb[0]) <= 12 &&
          Math.abs(data[offset + 1] - rgb[1]) <= 12 &&
          Math.abs(data[offset + 2] - rgb[2]) <= 12
        ) {
          const sum = sums.get(id)!;
          sum.count += 1;
          sum.x += x;
          sum.y += y;
        }
      }
    }
  }
  return new Map(
    [...sums].map(([id, sum]) => [
      id,
      sum.count > 0
        ? { x: sum.x / sum.count / info.width, y: sum.y / sum.count / info.height }
        : null,
    ]),
  );
}

async function brochurePalette(buffer: Buffer) {
  const { data, info } = await sharp(buffer)
    .resize({ width: 480 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let white = 0;
  let navy = 0;
  let gold = 0;
  let cream = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const rgb = [data[offset], data[offset + 1], data[offset + 2]];
    if (rgb.every((channel) => channel >= 248)) white += 1;
    if (Math.abs(rgb[0] - 11) < 10 && Math.abs(rgb[1] - 31) < 10 && Math.abs(rgb[2] - 58) < 10) navy += 1;
    if (Math.abs(rgb[0] - 184) < 10 && Math.abs(rgb[1] - 138) < 10 && Math.abs(rgb[2] - 68) < 10) gold += 1;
    if (Math.abs(rgb[0] - 247) < 6 && Math.abs(rgb[1] - 244) < 6 && Math.abs(rgb[2] - 237) < 6) cream += 1;
  }
  const total = data.length / info.channels;
  return {
    white: white / total,
    navy: navy / total,
    gold: gold / total,
    cream: cream / total,
  };
}

test("Hero + supporting renders the selected primary and both supporting fixtures", async () => {
  const counts = await colorPixelCounts(await render("hero-two-square"));
  for (const id of ["primary-red", "support-green", "support-blue"] as const) {
    expect(counts.get(id), `${id} should be visible`).toBeGreaterThan(500);
  }
});

test("Hero + four grid renders the selected primary and all four supporting fixtures", async () => {
  const counts = await colorPixelCounts(await render("hero-four-grid"));
  for (const { id } of fixtureColors) {
    expect(counts.get(id), `${id} should be visible`).toBeGreaterThan(500);
  }
});

test("supporting order and template selection change rendered pixels", async () => {
  const original = await render("hero-four-grid");
  const reordered = await render("hero-four-grid", [
    fixtureColors[0],
    fixtureColors[4],
    fixtureColors[3],
    fixtureColors[2],
    fixtureColors[1],
  ]);
  const supporting = await render("hero-two-square");
  const hash = (buffer: Buffer) => createHash("sha256").update(buffer).digest("hex");
  expect(hash(reordered)).not.toBe(hash(original));
  expect(hash(supporting)).not.toBe(hash(original));
});

test("prepared selection preserves every distinct ID and compact fallbacks use every remaining image", async () => {
  const fullAssets = await preparedAssets("hero-four-grid");
  expect(fullAssets.images.map((image) => image.id)).toEqual(
    fixtureColors.map(({ id }) => id),
  );

  const duplicateAssets = await preparedAssets(
    "hero-four-grid",
    fixtureColors,
    true,
    [
      fixtureColors[1].id,
      fixtureColors[1].id,
      fixtureColors[2].id,
      fixtureColors[3].id,
      fixtureColors[4].id,
    ],
  );
  expect(duplicateAssets.images.map((image) => image.id)).toEqual(
    fixtureColors.map(({ id }) => id),
  );

  const failedAssets = await preparedAssets(
    "hero-four-grid",
    fixtureColors,
    true,
    undefined,
    [fixtureColors[4].id],
  );
  expect(failedAssets.images.map((image) => image.id)).toEqual(
    fixtureColors.slice(0, 4).map(({ id }) => id),
  );
  const failedResponse = renderPropertyMarketingPng(failedAssets, { preview: true });
  const failedCounts = await colorPixelCounts(
    Buffer.from(await failedResponse.arrayBuffer()),
  );
  for (const { id } of fixtureColors.slice(0, 4)) {
    expect(failedCounts.get(id), `${id} should survive failed-image filtering`).toBeGreaterThan(500);
  }
  expect(failedCounts.get("support-purple")).toBe(0);

  const fourUsable = fixtureColors.slice(0, 4);
  const fourCounts = await colorPixelCounts(
    await render("hero-four-grid", fourUsable),
  );
  for (const { id } of fourUsable) {
    expect(fourCounts.get(id), `${id} should remain in the compact grid`).toBeGreaterThan(500);
  }
  expect(fourCounts.get("support-purple")).toBe(0);

  const threeUsable = fixtureColors.slice(0, 3);
  const threeCounts = await colorPixelCounts(
    await render("hero-four-grid", threeUsable),
  );
  for (const { id } of threeUsable) {
    expect(threeCounts.get(id), `${id} should remain in the two-support fallback`).toBeGreaterThan(500);
  }
  expect(threeCounts.get("support-yellow")).toBe(0);
});

test("replacing one supporting image replaces its rendered pixels", async () => {
  const before = await colorPixelCounts(
    await render("hero-two-square", fixtureColors.slice(0, 3)),
  );
  const replacementOrder = [fixtureColors[0], fixtureColors[1], fixtureColors[4]];
  const after = await colorPixelCounts(
    await render("hero-two-square", replacementOrder),
  );
  expect(before.get("support-blue")).toBeGreaterThan(500);
  expect(before.get("support-purple")).toBe(0);
  expect(after.get("support-blue")).toBe(0);
  expect(after.get("support-purple")).toBeGreaterThan(500);
});

test("portrait and landscape preview/final output preserve normalized image positions", async () => {
  for (const template of ["hero-four-grid", "a4-editorial"] as const) {
    const preview = await colorCentroids(await render(template, fixtureColors, true));
    const final = await colorCentroids(await render(template, fixtureColors, false));
    const expectedImages = template === "a4-editorial"
      ? fixtureColors.slice(0, 3)
      : fixtureColors;
    for (const { id } of expectedImages) {
      const previewPoint = preview.get(id);
      const finalPoint = final.get(id);
      expect(previewPoint, `${template} ${id} preview centroid`).not.toBeNull();
      expect(finalPoint, `${template} ${id} final centroid`).not.toBeNull();
      expect(Math.abs(previewPoint!.x - finalPoint!.x)).toBeLessThan(0.025);
      expect(Math.abs(previewPoint!.y - finalPoint!.y)).toBeLessThan(0.025);
    }
  }
});

test("portrait highlights fallback renders pixels and keeps the media-led A4 composition", async () => {
  const fallbackAssets = await preparedAssets("a4-editorial");
  fallbackAssets.view.copy = "";
  fallbackAssets.view.highlights = [
    "Open Mediterranean views",
    "South-east orientation",
    "Contemporary finishes",
    "Ready for international buyers",
  ];
  const noCopyAssets = await preparedAssets("a4-editorial");
  noCopyAssets.view.copy = "";
  noCopyAssets.view.highlights = [];

  const fallbackResponse = renderPropertyMarketingPng(fallbackAssets, { preview: true });
  const noCopyResponse = renderPropertyMarketingPng(noCopyAssets, { preview: true });
  expect(fallbackResponse.ok).toBe(true);
  expect(noCopyResponse.ok).toBe(true);
  const fallback = Buffer.from(await fallbackResponse.arrayBuffer());
  const noCopy = Buffer.from(await noCopyResponse.arrayBuffer());
  expect(createHash("sha256").update(fallback).digest("hex")).not.toBe(
    createHash("sha256").update(noCopy).digest("hex"),
  );

  const metadata = await sharp(fallback).metadata();
  expect(metadata.width).toBe(620);
  expect(metadata.height).toBe(877);
  const counts = await colorPixelCounts(fallback);
  expect(counts.get("primary-red")).toBeGreaterThan(500);
  expect(counts.get("support-green")).toBeGreaterThan(500);
});

test("portrait and landscape brochures use white editorial surfaces without brand-color panels", async () => {
  for (const template of ["hero-four-grid", "a4-editorial"] as const) {
    const palette = await brochurePalette(await render(template));
    expect(palette.white, `${template} white surface`).toBeGreaterThan(0.2);
    expect(palette.navy, `${template} navy is typography only`).toBeLessThan(0.04);
    expect(palette.gold, `${template} gold is wordmark-only`).toBeLessThan(0.01);
    expect(palette.cream, `${template} has no cream panel`).toBeLessThan(0.01);
  }
});

test("portrait variants reflow full, sparse, privacy-safe, highlight-heavy, and custom-fact-heavy content", async () => {
  const full = await preparedAssets("a4-editorial");
  full.view.highlights = Array.from({ length: 10 }, (_, index) => `Highlight ${index + 1}`);
  full.view.customFacts = Array.from({ length: 18 }, (_, index) => ({
    key: `custom-${index + 1}`,
    label: `Specification ${index + 1}`,
    value: `Value ${index + 1}`,
  }));
  const sparse = await preparedAssets("a4-editorial");
  sparse.view.copy = "";
  sparse.view.highlights = [];
  sparse.view.customFacts = [];
  const approximate = await preparedAssets("a4-editorial");
  approximate.view.location = "Altea Hills, Alicante";
  const hidden = await preparedAssets("a4-editorial");
  hidden.view.location = "";
  hidden.view.agent = null;
  hidden.agencyLogoUrl = undefined;
  hidden.agentPortraitUrl = undefined;

  const outputs = await Promise.all([full, sparse, approximate, hidden].map(async (assets) => {
    const response = renderPropertyMarketingPng(assets, { preview: true });
    expect(response.ok).toBe(true);
    const output = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(output).metadata();
    expect(metadata.width).toBe(620);
    expect(metadata.height).toBe(877);
    return createHash("sha256").update(output).digest("hex");
  }));
  expect(new Set(outputs).size).toBe(4);
});

test("social card uses a 52/22/26 primary, supporting, and navy-panel composition", async () => {
  const output = await renderSocial(await socialInput(3));
  const metadata = await sharp(output).metadata();
  expect(metadata.width).toBe(1200);
  expect(metadata.height).toBe(630);
  const centroids = await colorCentroids(output);
  expect(centroids.get("primary-red")?.x ?? 1).toBeLessThan(0.52);
  expect(centroids.get("support-green")?.x ?? 0).toBeGreaterThan(0.52);
  expect(centroids.get("support-green")?.x ?? 1).toBeLessThan(0.75);
  expect(centroids.get("support-green")?.y ?? 1).toBeLessThan(0.48);
  expect(centroids.get("support-blue")?.y ?? 0).toBeGreaterThan(0.52);
});

test("social card expands a single hero when supporting photos are absent and stays byte-identical for preview/final rendering", async () => {
  const oneSupport = await renderSocial(await socialInput(2));
  const noSupportInput = await socialInput(1);
  const noSupportPreview = await renderSocial(noSupportInput);
  const noSupportFinal = await renderSocial(noSupportInput);
  const oneSupportCounts = await colorPixelCounts(oneSupport);
  const noSupportCounts = await colorPixelCounts(noSupportPreview);
  expect(oneSupportCounts.get("support-green")).toBeGreaterThan(500);
  expect(noSupportCounts.get("support-green")).toBe(0);
  expect(noSupportCounts.get("primary-red")).toBeGreaterThan(
    oneSupportCounts.get("primary-red") ?? 0,
  );
  expect(noSupportPreview.equals(noSupportFinal)).toBe(true);
});

test("social logo treatments and supplemental highlights/custom facts render deterministically", async () => {
  const darkAgency = await renderSocial(await socialInput(3, "agency"));
  const lightBrand = await renderSocial(await socialInput(3, "picchuspot"));
  const unbranded = await renderSocial(await socialInput(3, "unbranded"));
  const hash = (buffer: Buffer) => createHash("sha256").update(buffer).digest("hex");
  expect(hash(darkAgency)).not.toBe(hash(lightBrand));
  expect(hash(lightBrand)).not.toBe(hash(unbranded));
});

test("missing logo, portrait, phone, or complete realtor data reflows without breaking either orientation", async () => {
  for (const template of ["hero-two-square", "a4-classic"] as const) {
    const assets = await preparedAssets(template, fixtureColors.slice(0, 3));
    assets.view.config.brandingMode = "agency";
    assets.view.agent = {
      agencyName: "Costa Blanca International Property Partners",
      name: "Alexandra Montgomery-Rodriguez",
      role: "Senior international property advisor",
      phone: "+34 600 123 456",
    };
    assets.agencyLogoUrl = undefined;
    assets.agentPortraitUrl = undefined;
    let response = renderPropertyMarketingPng(assets, { preview: true });
    expect(response.ok).toBe(true);
    let metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    expect(metadata.width).toBe(template.startsWith("a4-") ? 620 : 960);
    expect(metadata.height).toBe(template.startsWith("a4-") ? 877 : 540);

    assets.view.agent = null;
    response = renderPropertyMarketingPng(assets, { preview: true });
    expect(response.ok).toBe(true);
    metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    expect(metadata.width).toBe(template.startsWith("a4-") ? 620 : 960);
    expect(metadata.height).toBe(template.startsWith("a4-") ? 877 : 540);
  }
});
