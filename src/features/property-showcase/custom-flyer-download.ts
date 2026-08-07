import {
  PROPERTY_CUSTOM_FLYER_FORMATS,
  safePropertyCustomFlyerFilename,
  type PropertyCustomFlyerFormat,
} from "./custom-flyer.ts";
import { normalizePropertyMarketingMaterialsConfig } from "./marketing-materials.ts";
import { ownedPropertyCustomFlyerStoragePath } from "./storage-cleanup.ts";
import type { PropertyShowcase } from "./types.ts";

export const PROPERTY_CUSTOM_FLYER_DOWNLOAD_CACHE_CONTROL = "private, no-store";
export const PROPERTY_CUSTOM_FLYER_DOWNLOAD_ERROR_CACHE_CONTROL = "no-store";

type DownloadResult =
  | { ok: true; bytes: Uint8Array; contentType: string }
  | { ok: false; error: string };

interface PropertyCustomFlyerDownloadDependencies {
  resolveProperty(slug: string): Promise<PropertyShowcase | null>;
  downloadFile(params: {
    slug: string;
    format: PropertyCustomFlyerFormat;
    value: string;
  }): Promise<DownloadResult>;
}

interface PropertyCustomFlyerDownloadContext {
  params: Promise<{ slug: string; format: string }>;
}

function unavailable(message: string): Response {
  return new Response(message, {
    status: 404,
    headers: { "Cache-Control": PROPERTY_CUSTOM_FLYER_DOWNLOAD_ERROR_CACHE_CONTROL },
  });
}

function parseFormat(value: string): PropertyCustomFlyerFormat | null {
  return value === "pdf" || value === "jpg" || value === "png" ? value : null;
}

function binaryResponse(
  bytes: Uint8Array,
  contentType: string,
  filename: string,
): Response {
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return new Response(body, {
    status: 200,
    headers: {
      "Cache-Control": PROPERTY_CUSTOM_FLYER_DOWNLOAD_CACHE_CONTROL,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(bytes.byteLength),
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function createPropertyCustomFlyerDownloadHandler(
  dependencies: PropertyCustomFlyerDownloadDependencies,
) {
  return async function GET(
    _request: Request,
    { params }: PropertyCustomFlyerDownloadContext,
  ): Promise<Response> {
    const { slug, format: rawFormat } = await params;
    const format = parseFormat(rawFormat);
    if (!format) return unavailable("Custom flyer format not found");

    let property: PropertyShowcase | null;
    try {
      property = await dependencies.resolveProperty(slug);
    } catch {
      return unavailable("Property not found");
    }
    if (!property || property.slug !== slug) return unavailable("Property not found");

    const config = normalizePropertyMarketingMaterialsConfig(
      property.marketingMaterials,
      property,
    );
    if (config.flyerMode !== "custom") {
      return unavailable("Custom flyer not found");
    }

    const value = config.customFlyer[format];
    if (!value) return unavailable("Custom flyer format not found");
    if (!ownedPropertyCustomFlyerStoragePath(value, property.slug)) {
      return unavailable("Custom flyer format not found");
    }

    let downloaded: DownloadResult;
    try {
      downloaded = await dependencies.downloadFile({
        slug: property.slug,
        format,
        value,
      });
    } catch {
      return unavailable("Custom flyer format not found");
    }
    if (!downloaded.ok) return unavailable("Custom flyer format not found");

    const expectedContentType = PROPERTY_CUSTOM_FLYER_FORMATS[format].mime;
    if (downloaded.contentType !== expectedContentType) {
      return unavailable("Custom flyer format not found");
    }

    return binaryResponse(
      downloaded.bytes,
      expectedContentType,
      safePropertyCustomFlyerFilename(property.slug, format),
    );
  };
}
