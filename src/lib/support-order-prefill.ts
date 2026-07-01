import { STAGING_ADDONS } from "../data/order-options.ts";
import { getOrderServiceCatalogEntry } from "./order-service-catalog.ts";

export interface SupportOrderPrefill {
  serviceId: string;
  addOnIds: string[];
}

export interface StoredSupportOrderPrefill extends SupportOrderPrefill {
  version: 1;
  createdAt: number;
}

export interface SupportOrderPrefillStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SUPPORT_ORDER_PREFILL_STORAGE_KEY =
  "picchuspot_support_order_prefill_v1";
export const SUPPORT_ORDER_PREFILL_VERSION = 1;
export const SUPPORT_ORDER_PREFILL_TTL_MS = 15 * 60 * 1000;
export const VIRTUAL_STAGING_IMAGE_ENHANCEMENT_RECOMMENDATION_ID =
  "virtual-staging-image-enhancement";

const VIRTUAL_STAGING_SERVICE_ID = "virtual-staging";
const IMAGE_ENHANCEMENT_ADDON_ID = "image-enhancement";
const DASHBOARD_NEW_ORDER_ROUTE = "/dashboard/orders/new";

export function resolveSupportOrderRecommendation(
  recommendationId: unknown,
  serviceId = VIRTUAL_STAGING_SERVICE_ID,
): SupportOrderPrefill | null {
  if (recommendationId !== VIRTUAL_STAGING_IMAGE_ENHANCEMENT_RECOMMENDATION_ID) {
    return null;
  }

  const service = getOrderServiceCatalogEntry(serviceId);
  if (service?.slug !== VIRTUAL_STAGING_SERVICE_ID) return null;
  if (service.availability !== "active") return null;
  if (!service.route || !isCanonicalDashboardOrderRoute(service.route)) {
    return null;
  }
  if (!isStagingAddOnId(IMAGE_ENHANCEMENT_ADDON_ID)) return null;

  return {
    serviceId: service.slug,
    addOnIds: [IMAGE_ENHANCEMENT_ADDON_ID],
  };
}

export function parseSupportOrderPrefill(
  value: unknown,
): StoredSupportOrderPrefill | null {
  const parsed = typeof value === "string" ? parseJson(value) : value;
  if (!isRecord(parsed)) return null;
  if (!hasOnlyPrefillKeys(parsed)) return null;
  if (parsed.version !== SUPPORT_ORDER_PREFILL_VERSION) return null;
  if (
    typeof parsed.createdAt !== "number" ||
    !Number.isFinite(parsed.createdAt)
  ) {
    return null;
  }
  if (!isValidVirtualStagingPrefillService(parsed.serviceId)) return null;
  if (!Array.isArray(parsed.addOnIds)) return null;

  const normalizedAddOnIds = normalizeStagingAddOnIds(parsed.addOnIds);
  if (!normalizedAddOnIds) return null;

  return {
    version: SUPPORT_ORDER_PREFILL_VERSION,
    createdAt: parsed.createdAt,
    serviceId: VIRTUAL_STAGING_SERVICE_ID,
    addOnIds: normalizedAddOnIds,
  };
}

export function writeSupportOrderPrefill(
  storage: SupportOrderPrefillStorage,
  prefill: SupportOrderPrefill,
  now = Date.now(),
): boolean {
  const parsed = parseSupportOrderPrefill({
    version: SUPPORT_ORDER_PREFILL_VERSION,
    createdAt: now,
    serviceId: prefill.serviceId,
    addOnIds: prefill.addOnIds,
  });
  if (!parsed) return false;

  try {
    storage.setItem(SUPPORT_ORDER_PREFILL_STORAGE_KEY, JSON.stringify(parsed));
    return true;
  } catch {
    return false;
  }
}

export function consumeSupportOrderPrefill(
  storage: SupportOrderPrefillStorage,
  serviceId: string,
  now = Date.now(),
): SupportOrderPrefill | null {
  let rawPayload: string | null;
  try {
    rawPayload = storage.getItem(SUPPORT_ORDER_PREFILL_STORAGE_KEY);
  } catch {
    return null;
  }

  if (!rawPayload) return null;

  const parsed = parseSupportOrderPrefill(rawPayload);
  if (!parsed) {
    removeSupportOrderPrefill(storage);
    return null;
  }

  if (parsed.serviceId !== serviceId) {
    removeSupportOrderPrefill(storage);
    return null;
  }

  if (now - parsed.createdAt > SUPPORT_ORDER_PREFILL_TTL_MS) {
    removeSupportOrderPrefill(storage);
    return null;
  }

  if (!removeSupportOrderPrefill(storage)) return null;
  return {
    serviceId: parsed.serviceId,
    addOnIds: [...parsed.addOnIds],
  };
}

function normalizeStagingAddOnIds(value: unknown[]): string[] | null {
  const normalized: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    if (!isStagingAddOnId(item)) return null;
    if (!normalized.includes(item)) normalized.push(item);
  }

  if (
    normalized.length !== 1 ||
    normalized[0] !== IMAGE_ENHANCEMENT_ADDON_ID
  ) {
    return null;
  }

  return normalized;
}

function isStagingAddOnId(addOnId: string): boolean {
  return STAGING_ADDONS.some((addOn) => addOn.id === addOnId);
}

function isValidVirtualStagingPrefillService(serviceId: unknown): boolean {
  if (serviceId !== VIRTUAL_STAGING_SERVICE_ID) return false;
  const service = getOrderServiceCatalogEntry(serviceId);
  return (
    service?.slug === VIRTUAL_STAGING_SERVICE_ID &&
    service.availability === "active" &&
    typeof service.route === "string" &&
    isCanonicalDashboardOrderRoute(service.route)
  );
}

function isCanonicalDashboardOrderRoute(route: string): boolean {
  if (route.includes("?") || route.includes("#")) return false;
  if (route === "/api" || route.startsWith("/api/")) return false;
  return (
    route === DASHBOARD_NEW_ORDER_ROUTE ||
    route.startsWith(`${DASHBOARD_NEW_ORDER_ROUTE}/`)
  );
}

function removeSupportOrderPrefill(storage: SupportOrderPrefillStorage): boolean {
  try {
    storage.removeItem(SUPPORT_ORDER_PREFILL_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function hasOnlyPrefillKeys(value: Record<string, unknown>): boolean {
  const allowedKeys = new Set(["version", "createdAt", "serviceId", "addOnIds"]);
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
