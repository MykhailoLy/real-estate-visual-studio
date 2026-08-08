import { handlePropertyAnalyticsRequest } from "@/features/property-showcase/property-analytics";
import { createPropertyAnalyticsDependencies } from "@/features/property-showcase/property-analytics-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handlePropertyAnalyticsRequest(
    request,
    createPropertyAnalyticsDependencies(),
  );
}
