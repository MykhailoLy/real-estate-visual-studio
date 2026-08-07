import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderPropertySocialCardPng } from "@/features/property-showcase/marketing-material-renderer";
import { getPropertyShowcase } from "@/features/property-showcase/registry";
import { getPublishedPropertyShowcase } from "@/features/property-showcase/server";
import { preparePropertySocialAssets } from "@/features/property-showcase/social-image-preparation";
import { createPropertySocialImageHandler } from "@/features/property-showcase/social-image-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PropertyOpenGraphImageContext {
  params: Promise<{ slug: string }>;
}

const getPropertySocialImage = createPropertySocialImageHandler({
  resolveProperty: async (slug) =>
    (await getPublishedPropertyShowcase(slug)) ?? getPropertyShowcase(slug),
  prepareAssets: preparePropertySocialAssets,
  renderCard: renderPropertySocialCardPng,
  loadEmergencyPng: () =>
    readFile(
      resolve(
        process.cwd(),
        "public",
        "brand",
        "property-social-emergency.png",
      ),
    ),
});

export async function GET(
  request: Request,
  context: PropertyOpenGraphImageContext,
) {
  return getPropertySocialImage(request, context);
}

export async function HEAD(
  request: Request,
  context: PropertyOpenGraphImageContext,
) {
  const response = await getPropertySocialImage(request, context);
  return new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
