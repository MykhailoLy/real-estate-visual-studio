import { handlePropertyLeadRequest } from "@/features/property-showcase/property-leads";
import { createPropertyLeadDependencies } from "@/features/property-showcase/property-leads-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handlePropertyLeadRequest(request, createPropertyLeadDependencies());
}
