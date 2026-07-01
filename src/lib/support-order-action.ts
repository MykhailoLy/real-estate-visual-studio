import { getOrderServiceCatalogEntry } from "./order-service-catalog.ts";
import { resolveSupportOrderRecommendation } from "./support-order-prefill.ts";

const DASHBOARD_NEW_ORDER_ROUTE = "/dashboard/orders/new";

export interface SupportOrderAction {
  type: "start_order";
  serviceId: string;
  recommendationId?: string;
}

export interface ResolvedSupportOrderAction extends SupportOrderAction {
  href: string;
}

export function resolveSupportOrderAction(
  serviceId: string,
  recommendationId?: string,
): ResolvedSupportOrderAction | null {
  const service = getOrderServiceCatalogEntry(serviceId);
  if (service?.availability !== "active") return null;
  if (!service.route || !isCanonicalDashboardOrderRoute(service.route)) {
    return null;
  }

  const recommendation = resolveSupportOrderRecommendation(
    recommendationId,
    service.slug,
  );

  return {
    type: "start_order",
    serviceId: service.slug,
    href: service.route,
    ...(recommendation && typeof recommendationId === "string"
      ? { recommendationId }
      : {}),
  };
}

export function parseSupportOrderAction(
  value: unknown,
): SupportOrderAction | null {
  if (!isRecord(value)) return null;
  if (value.type !== "start_order") return null;
  if (typeof value.serviceId !== "string") return null;

  const recommendationId =
    typeof value.recommendationId === "string"
      ? value.recommendationId
      : undefined;
  const resolved = resolveSupportOrderAction(value.serviceId, recommendationId);
  if (!resolved) return null;

  return {
    type: "start_order",
    serviceId: resolved.serviceId,
    ...(resolved.recommendationId
      ? { recommendationId: resolved.recommendationId }
      : {}),
  };
}

function isCanonicalDashboardOrderRoute(route: string) {
  if (route.includes("?") || route.includes("#")) return false;
  if (route === "/api" || route.startsWith("/api/")) return false;
  return (
    route === DASHBOARD_NEW_ORDER_ROUTE ||
    route.startsWith(`${DASHBOARD_NEW_ORDER_ROUTE}/`)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
