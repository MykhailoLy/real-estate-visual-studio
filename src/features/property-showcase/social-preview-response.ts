import { preparePropertySocialAssets } from "./social-image-preparation.ts";
import type { PropertyShowcase } from "./types.ts";

export const PROPERTY_SOCIAL_PREVIEW_CACHE_CONTROL = "private, no-store";

function binaryResponse(bytes: Uint8Array): Response {
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return new Response(body, {
    status: 200,
    headers: {
      "Cache-Control": PROPERTY_SOCIAL_PREVIEW_CACHE_CONTROL,
      "Content-Type": "image/png",
      "X-Content-Type-Options": "nosniff",
      "X-PicchuSpot-Preview-Height": "630",
      "X-PicchuSpot-Preview-Width": "1200",
    },
  });
}

/**
 * The admin path intentionally invokes the same asset preparation and JSX
 * renderer as the public Open Graph route. Only the response cache policy is
 * different because this response represents unsaved draft state.
 */
export async function createPropertySocialPreviewResponse(
  property: PropertyShowcase,
): Promise<Response> {
  try {
    const assets = await preparePropertySocialAssets(property);
    const { renderPropertySocialCardPng } = await import(
      "./marketing-material-renderer.tsx"
    );
    const rendered = renderPropertySocialCardPng({
      property,
      preview: assets.preview,
      propertyImages: assets.propertyImages,
      brandingLogo: assets.brandingLogo,
      level: "full",
    });
    if (!rendered.ok) throw new Error("PropertySocialPreviewRenderError");
    return binaryResponse(new Uint8Array(await rendered.arrayBuffer()));
  } catch (error) {
    console.error("property-social-preview: generation failed", {
      slug: property.slug,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return new Response("Could not generate social preview", {
      status: 500,
      headers: { "Cache-Control": PROPERTY_SOCIAL_PREVIEW_CACHE_CONTROL },
    });
  }
}
