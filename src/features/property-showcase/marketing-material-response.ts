import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { preparePropertyMarketingAssets } from "./marketing-material-assets.ts";
import {
  normalizePropertyMarketingMaterialsConfig,
  safePropertyMarketingFilename,
  type PropertyMarketingAsset,
} from "./marketing-materials.ts";
import { computePropertyMarketingMaterialVersion } from "./marketing-material-version.ts";
import type { PropertyShowcase } from "./types.ts";

export const PROPERTY_MARKETING_CACHE_CONTROL =
  "public, max-age=31536000, s-maxage=31536000, immutable";
export const PROPERTY_MARKETING_ERROR_CACHE_CONTROL = "no-store";
export const PROPERTY_MARKETING_ASSETS = new Set<PropertyMarketingAsset>([
  "landscape.png",
  "landscape.jpg",
  "flyer.png",
  "flyer.jpg",
  "flyer.pdf",
]);

export function parsePropertyMarketingAsset(
  value: string,
): PropertyMarketingAsset | null {
  return PROPERTY_MARKETING_ASSETS.has(value as PropertyMarketingAsset)
    ? (value as PropertyMarketingAsset)
    : null;
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

export async function createA4Pdf(png: Uint8Array): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const page = document.addPage([595.28, 841.89]);
  const image = await document.embedPng(png);
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
    return { bytes: await createA4Pdf(png), contentType: "application/pdf" };
  }
  return { bytes: png, contentType: "image/png" };
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
  const portrait = asset.startsWith("flyer.");
  if (
    (!adminPreview && !config.enabled) ||
    (portrait && !config.portrait.enabled) ||
    (!portrait && !config.landscape.enabled)
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
  const requestedVersion = new URL(params.requestUrl).searchParams.get("v");
  if (!adminPreview && requestedVersion !== expectedVersion) {
    return new Response("Invalid or stale marketing material version", {
      status: 404,
      headers: { "Cache-Control": PROPERTY_MARKETING_ERROR_CACHE_CONTROL },
    });
  }

  try {
    const assets = await preparePropertyMarketingAssets(property, canonicalUrl);
    const { renderPropertyMarketingPng } = await import(
      "./marketing-material-renderer.tsx"
    );
    const rendered = renderPropertyMarketingPng(
      assets,
      portrait ? "portrait" : "landscape",
    );
    if (!rendered.ok) throw new Error("MarketingMaterialRenderResponseError");
    const png = new Uint8Array(await rendered.arrayBuffer());
    if (png.byteLength < 8) throw new Error("MarketingMaterialRenderEmpty");

    const { bytes, contentType } =
      await encodePropertyMarketingMaterialFormat(png, asset);

    return binaryResponse(bytes, 200, {
      "Cache-Control": adminPreview
        ? "private, no-store"
        : PROPERTY_MARKETING_CACHE_CONTROL,
      "Content-Disposition": `attachment; filename="${safePropertyMarketingFilename(property.slug, asset)}"`,
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
