import { isAdminAuthenticated } from "@/lib/admin-auth";
import { absoluteUrl } from "@/lib/seo";
import {
  createPropertyMarketingMaterialResponse,
  parsePropertyMarketingAsset,
  PROPERTY_MARKETING_ERROR_CACHE_CONTROL,
} from "@/features/property-showcase/marketing-material-response";
import { getPropertyShowcaseForAdminById } from "@/features/property-showcase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Context {
  params: Promise<{ id: string; asset: string }>;
}
export async function GET(request: Request, context: Context) {
  if (!(await isAdminAuthenticated())) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "Cache-Control": PROPERTY_MARKETING_ERROR_CACHE_CONTROL },
    });
  }
  const { id, asset: rawAsset } = await context.params;
  const asset = parsePropertyMarketingAsset(rawAsset);
  if (!asset) {
    return new Response("Unknown marketing material", {
      status: 404,
      headers: { "Cache-Control": PROPERTY_MARKETING_ERROR_CACHE_CONTROL },
    });
  }
  const record = await getPropertyShowcaseForAdminById(id);
  if (!record) {
    return new Response("Property not found", {
      status: 404,
      headers: { "Cache-Control": PROPERTY_MARKETING_ERROR_CACHE_CONTROL },
    });
  }
  return createPropertyMarketingMaterialResponse({
    property: record.property,
    canonicalUrl: absoluteUrl(`/property/${record.slug}`),
    asset,
    requestUrl: request.url,
    adminPreview: true,
  });
}
