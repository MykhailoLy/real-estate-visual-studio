import {
  PROPERTY_SOCIAL_IMAGE_EVENTS,
  type PreparedPropertySocialAssets,
  type PreparedPropertySocialImage,
  type PreparedPropertySocialLogo,
  type PropertySocialImageLog,
} from "./social-image-preparation.ts";
import type { PropertySocialPreview } from "./social-preview.ts";
import type { PropertyShowcase } from "./types.ts";

export const PROPERTY_SOCIAL_IMAGE_CACHE_CONTROL =
  "public, max-age=0, s-maxage=300, stale-while-revalidate=86400";

export type PropertySocialImageLevel =
  | "full"
  | "reduced"
  | "text"
  | "emergency";

export interface PropertySocialCardRenderInput {
  property: PropertyShowcase;
  preview: PropertySocialPreview;
  propertyImages: PreparedPropertySocialImage[];
  brandingLogo: PreparedPropertySocialLogo | null;
  level: Exclude<PropertySocialImageLevel, "emergency">;
}

type ResolveProperty = (slug: string) => Promise<PropertyShowcase | null>;
type PrepareAssets = (
  property: PropertyShowcase,
) => Promise<PreparedPropertySocialAssets>;
type RenderCard = (
  input: PropertySocialCardRenderInput,
) => Response | Promise<Response>;

interface PropertySocialImageHandlerDependencies {
  resolveProperty: ResolveProperty;
  prepareAssets: PrepareAssets;
  renderCard: RenderCard;
  loadEmergencyPng: () => Promise<Buffer>;
  log?: PropertySocialImageLog;
}

type PropertyOpenGraphImageContext = {
  params: Promise<{ slug: string }>;
};

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function defaultLog(
  event: Parameters<PropertySocialImageLog>[0],
  details: Parameters<PropertySocialImageLog>[1],
) {
  console.warn(event, details);
}

function safeErrorName(error: unknown): string {
  return error instanceof Error && error.name ? error.name : "UnknownError";
}

export function hasPngSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= PNG_SIGNATURE.length &&
    PNG_SIGNATURE.every((value, index) => bytes[index] === value)
  );
}

function pngResponse(
  bytes: Uint8Array,
  level: PropertySocialImageLevel,
): Response {
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return new Response(body, {
    status: 200,
    headers: {
      "Cache-Control": PROPERTY_SOCIAL_IMAGE_CACHE_CONTROL,
      "Content-Type": "image/png",
      "X-PicchuSpot-Social-Image-Status":
        level === "full" || level === "reduced" ? "generated" : "fallback",
      "X-PicchuSpot-Social-Image-Level": level,
    },
  });
}

async function materializePngResponse(
  response: Response,
  level: Exclude<PropertySocialImageLevel, "emergency">,
): Promise<Response> {
  if (!response.ok) throw new Error("SocialImageRenderResponseError");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!hasPngSignature(bytes)) {
    throw new Error("SocialImageRenderOutputError");
  }
  return pngResponse(bytes, level);
}

export function createPropertySocialImageHandler(
  dependencies: PropertySocialImageHandlerDependencies,
) {
  const log = dependencies.log ?? defaultLog;

  async function emergencyResponse(
    slug: string,
    reason: string,
  ): Promise<Response> {
    log(PROPERTY_SOCIAL_IMAGE_EVENTS.emergencyFallback, { slug, reason });
    const bytes = await dependencies.loadEmergencyPng();
    if (!hasPngSignature(bytes)) {
      throw new Error("Bundled social image fallback is not a PNG");
    }
    return pngResponse(bytes, "emergency");
  }

  return async function GET(
    _request: Request,
    { params }: PropertyOpenGraphImageContext,
  ): Promise<Response> {
    const { slug } = await params;
    let property: PropertyShowcase | null;
    try {
      property = await dependencies.resolveProperty(slug);
    } catch (error) {
      log(PROPERTY_SOCIAL_IMAGE_EVENTS.lookupFailed, {
        slug,
        errorName: safeErrorName(error),
      });
      return emergencyResponse(slug, "lookup-failed");
    }

    if (!property) return new Response("Property not found", { status: 404 });

    let assets: PreparedPropertySocialAssets;
    try {
      assets = await dependencies.prepareAssets(property);
    } catch (error) {
      log(PROPERTY_SOCIAL_IMAGE_EVENTS.preparationFailed, {
        slug,
        errorName: safeErrorName(error),
      });
      return emergencyResponse(slug, "preparation-failed");
    }

    const attempts: PropertySocialCardRenderInput[] = [];
    if (assets.propertyImages.length > 0) {
      attempts.push({
        property,
        preview: assets.preview,
        propertyImages: assets.propertyImages,
        brandingLogo: assets.brandingLogo,
        level: "full",
      });
      if (assets.propertyImages.length > 1) {
        attempts.push({
          property,
          preview: assets.preview,
          propertyImages: assets.propertyImages.slice(0, 1),
          brandingLogo: assets.brandingLogo,
          level: "reduced",
        });
      }
    }
    attempts.push({
      property,
      preview: assets.preview,
      propertyImages: [],
      brandingLogo: assets.brandingLogo,
      level: "text",
    });
    if (assets.brandingLogo) {
      attempts.push({
        property,
        preview: assets.preview,
        propertyImages: [],
        brandingLogo: null,
        level: "text",
      });
    }

    for (const attempt of attempts) {
      try {
        return await materializePngResponse(
          await dependencies.renderCard(attempt),
          attempt.level,
        );
      } catch (error) {
        log(PROPERTY_SOCIAL_IMAGE_EVENTS.renderFailed, {
          slug,
          level: attempt.level,
          imageCount: attempt.propertyImages.length,
          hasLogo: Boolean(attempt.brandingLogo),
          errorName: safeErrorName(error),
        });
      }
    }

    return emergencyResponse(slug, "all-renders-failed");
  };
}
