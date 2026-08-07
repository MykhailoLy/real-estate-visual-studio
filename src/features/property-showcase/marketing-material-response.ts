import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { preparePropertyMarketingAssets } from "./marketing-material-assets.ts";
import {
  getPropertyMarketingRenderDimensions,
  normalizePropertyMarketingMaterialsConfig,
  safePropertyMarketingFilename,
  type PropertyMarketingAsset,
} from "./marketing-materials.ts";
import { computePropertyMarketingMaterialVersion } from "./marketing-material-version.ts";
import type {
  PropertyMarketingBrochureOrientation,
  PropertyShowcase,
} from "./types.ts";

export const PROPERTY_MARKETING_CACHE_CONTROL =
  "public, max-age=31536000, s-maxage=31536000, immutable";
export const PROPERTY_MARKETING_ERROR_CACHE_CONTROL = "no-store";
export const PROPERTY_MARKETING_PREVIEW_CACHE_CONTROL = "private, no-store";
export const PROPERTY_MARKETING_ASSETS = new Set<PropertyMarketingAsset>([
  "brochure.png",
  "brochure.jpg",
  "brochure.pdf",
]);

export function parsePropertyMarketingAsset(
  value: string,
): PropertyMarketingAsset | null {
  return PROPERTY_MARKETING_ASSETS.has(value as PropertyMarketingAsset)
    ? (value as PropertyMarketingAsset)
    : null;
}

export function propertyMarketingPreviewHeaders(
  orientation: PropertyMarketingBrochureOrientation,
): HeadersInit {
  const dimensions = getPropertyMarketingRenderDimensions(orientation, true);
  return {
    "Cache-Control": PROPERTY_MARKETING_PREVIEW_CACHE_CONTROL,
    "Content-Type": "image/png",
    "X-Content-Type-Options": "nosniff",
    "X-PicchuSpot-Preview-Width": String(dimensions.width),
    "X-PicchuSpot-Preview-Height": String(dimensions.height),
  };
}

function binaryResponse(
  bytes: Uint8Array,
  status: number,
  headers: HeadersInit,
): Response {
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return new Response(body, { status, headers });
}

export async function createPropertyMarketingPdf(
  png: Uint8Array,
  orientation: PropertyMarketingBrochureOrientation = "portrait",
): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const image = await document.embedPng(png);
  // Portrait brochures are print-ready A4. Landscape brochures are designed as
  // 16:9 canvases, so their PDF page must retain the PNG's native aspect ratio.
  const page = document.addPage(
    orientation === "portrait"
      ? [595.28, 841.89]
      : [image.width / 2, image.height / 2],
  );
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: page.getWidth(),
    height: page.getHeight(),
  });
  return document.save({ useObjectStreams: true });
}

export async function encodePropertyMarketingMaterialFormat(
  png: Uint8Array,
  asset: PropertyMarketingAsset,
  orientation: PropertyMarketingBrochureOrientation = "portrait",
): Promise<{ bytes: Uint8Array; contentType: string }> {
  if (asset.endsWith(".jpg")) {
    return {
      bytes: new Uint8Array(
        await sharp(png, { failOn: "error", limitInputPixels: 10_000_000 })
          .flatten({ background: "#ffffff" })
          .jpeg({ quality: 90, mozjpeg: true })
          .timeout({ seconds: 10 })
          .toBuffer(),
      ),
      contentType: "image/jpeg",
    };
  }
  if (asset.endsWith(".pdf")) {
    return {
      bytes: await createPropertyMarketingPdf(png, orientation),
      contentType: "application/pdf",
    };
  }
  return { bytes: png, contentType: "image/png" };
}

export async function createPropertyMarketingPreviewResponse(params: {
  property: PropertyShowcase;
  canonicalUrl: string;
}): Promise<Response> {
  const config = normalizePropertyMarketingMaterialsConfig(
    params.property.marketingMaterials,
    params.property,
  );
  if (config.flyerMode !== "automatic-landscape") {
    return new Response("Automatic landscape preview is not enabled", {
      status: 400,
      headers: { "Cache-Control": PROPERTY_MARKETING_ERROR_CACHE_CONTROL },
    });
  }
  try {
    const assets = await preparePropertyMarketingAssets(
      params.property,
      params.canonicalUrl,
      { preview: true },
    );
    const { renderPropertyMarketingPng } =
      await import("./marketing-material-renderer.tsx");
    const rendered = renderPropertyMarketingPng(assets, { preview: true });
    if (!rendered.ok) throw new Error("MarketingMaterialPreviewResponseError");
    const png = new Uint8Array(await rendered.arrayBuffer());
    return binaryResponse(
      png,
      200,
      propertyMarketingPreviewHeaders("landscape"),
    );
  } catch (error) {
    console.error("property-marketing-material: preview generation failed", {
      slug: params.property.slug,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return new Response("Could not generate brochure preview", {
      status: 500,
      headers: { "Cache-Control": PROPERTY_MARKETING_ERROR_CACHE_CONTROL },
    });
  }
}

export async function createPropertyMarketingMaterialResponse(params: {
  property: PropertyShowcase;
  canonicalUrl: string;
  asset: PropertyMarketingAsset;
  requestUrl: string;
  adminPreview?: boolean;
}): Promise<Response> {
  const { property, canonicalUrl, asset, adminPreview = false } = params;
  const config = normalizePropertyMarketingMaterialsConfig(
    property.marketingMaterials,
    property,
  );
  if (
    config.flyerMode !== "automatic-landscape" ||
    config.brochure.orientation !== "landscape"
  ) {
    return new Response("Marketing material not available", {
      status: 404,
      headers: { "Cache-Control": PROPERTY_MARKETING_ERROR_CACHE_CONTROL },
    });
  }

  const expectedVersion = computePropertyMarketingMaterialVersion(
    property,
    canonicalUrl,
  );
  const requestUrl = new URL(params.requestUrl);
  const requestedVersion = requestUrl.searchParams.get("v");
  if (!adminPreview && requestedVersion !== expectedVersion) {
    return new Response("Invalid or stale marketing material version", {
      status: 404,
      headers: { "Cache-Control": PROPERTY_MARKETING_ERROR_CACHE_CONTROL },
    });
  }

  try {
    const inlinePreview =
      requestUrl.searchParams.get("preview") === "1" && asset.endsWith(".png");
    const propertyForRender = property;
    const assets = await preparePropertyMarketingAssets(
      propertyForRender,
      canonicalUrl,
      { preview: inlinePreview },
    );
    const { renderPropertyMarketingPng } = await import(
      "./marketing-material-renderer.tsx"
    );
    const rendered = renderPropertyMarketingPng(assets, {
      preview: inlinePreview,
    });
    if (!rendered.ok) throw new Error("MarketingMaterialRenderResponseError");
    const png = new Uint8Array(await rendered.arrayBuffer());
    if (png.byteLength < 8) throw new Error("MarketingMaterialRenderEmpty");
    const { bytes, contentType } =
      await encodePropertyMarketingMaterialFormat(png, asset, "landscape");
    return binaryResponse(bytes, 200, {
      "Cache-Control": adminPreview
        ? PROPERTY_MARKETING_PREVIEW_CACHE_CONTROL
        : PROPERTY_MARKETING_CACHE_CONTROL,
      "Content-Disposition": `${inlinePreview ? "inline" : "attachment"}; filename="${safePropertyMarketingFilename(property.slug, asset, "landscape")}"`,
      "Content-Type": contentType,
      "X-PicchuSpot-Marketing-Version": expectedVersion,
      "X-Content-Type-Options": "nosniff",
    });
  } catch (error) {
    console.error("property-marketing-material: generation failed", {
      slug: property.slug,
      asset,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return new Response("Could not generate marketing material", {
      status: 500,
      headers: { "Cache-Control": PROPERTY_MARKETING_ERROR_CACHE_CONTROL },
    });
  }
}
