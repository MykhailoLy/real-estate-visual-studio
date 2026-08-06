import { absoluteUrl } from "@/lib/seo";
import {
  createPropertyMarketingMaterialResponse,
  parsePropertyMarketingAsset,
  PROPERTY_MARKETING_ERROR_CACHE_CONTROL,
} from "@/features/property-showcase/marketing-material-response";
import {
  getPublishedPropertyShowcase,
  isPropertyShowcaseSupabaseConfigured,
} from "@/features/property-showcase/server";
import { getPropertyShowcase } from "@/features/property-showcase/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Context {
  params: Promise<{ slug: string; asset: string }>;
}

export async function GET(request: Request, context: Context) {
  const { slug, asset: rawAsset } = await context.params;
  const asset = parsePropertyMarketingAsset(rawAsset);
  if (!asset) {
    return new Response("Unknown marketing material", {
      status: 404,
      headers: { "Cache-Control": PROPERTY_MARKETING_ERROR_CACHE_CONTROL },
    });
  }
  const property =
    (await getPublishedPropertyShowcase(slug)) ??
    (!isPropertyShowcaseSupabaseConfigured()
      ? getPropertyShowcase(slug)
      : null);
  if (!property) {
    return new Response("Property not found", {
      status: 404,
      headers: { "Cache-Control": PROPERTY_MARKETING_ERROR_CACHE_CONTROL },
    });
  }
  return createPropertyMarketingMaterialResponse({
    property,
    canonicalUrl: absoluteUrl(`/property/${property.slug}`),
    asset,
    requestUrl: request.url,
  });
}
