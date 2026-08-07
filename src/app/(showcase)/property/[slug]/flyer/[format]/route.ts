import {
  createPropertyCustomFlyerDownloadHandler,
} from "@/features/property-showcase/custom-flyer-download";
import { downloadStoredPropertyCustomFlyer } from "@/features/property-showcase/custom-flyer-storage";
import { getPropertyShowcase } from "@/features/property-showcase/registry";
import {
  getPublishedPropertyShowcase,
  isPropertyShowcaseSupabaseConfigured,
} from "@/features/property-showcase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Context {
  params: Promise<{ slug: string; format: string }>;
}

const downloadCustomFlyer = createPropertyCustomFlyerDownloadHandler({
  resolveProperty: async (slug) =>
    (await getPublishedPropertyShowcase(slug)) ??
    (!isPropertyShowcaseSupabaseConfigured()
      ? getPropertyShowcase(slug)
      : null),
  downloadFile: downloadStoredPropertyCustomFlyer,
});

export async function GET(request: Request, context: Context) {
  return downloadCustomFlyer(request, context);
}
