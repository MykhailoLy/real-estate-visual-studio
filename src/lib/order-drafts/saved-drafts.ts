import { getOrderServiceCards } from "../order-services.ts";
import type { OrderDraftSummary } from "./types.ts";

const NEW_ORDER_ROUTE_PREFIX = "/dashboard/orders/new/";

const UNKNOWN_SERVICE_FALLBACK = "Draft service";

export type SavedDraftLanguage = "en" | "es";

export function buildSavedDraftResumeUrl(
  route: string,
  draftId: string,
): string | null {
  const trimmedRoute = route.trim();
  if (
    trimmedRoute === "" ||
    trimmedRoute.startsWith("//") ||
    /^[a-z][a-z\d+.-]*:/i.test(trimmedRoute)
  ) {
    return null;
  }

  const [withoutHash] = trimmedRoute.split("#", 1);
  let parsed: URL;
  try {
    parsed = new URL(withoutHash, "https://picchuspot.local");
  } catch {
    return null;
  }

  if (!parsed.pathname.startsWith(NEW_ORDER_ROUTE_PREFIX)) {
    return null;
  }

  parsed.searchParams.set("draft", draftId);
  return `${parsed.pathname}?${parsed.searchParams.toString()}`;
}

export function getSavedDraftTitle(
  title: string | null,
  fallback: string,
): string {
  const normalized = title?.trim();
  return normalized ? normalized : fallback;
}

function humanizeSlug(value: string): string {
  return value
    .split(/[/-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function resolveSavedDraftServiceName(
  draft: Pick<OrderDraftSummary, "serviceType" | "route">,
): string {
  const services = getOrderServiceCards();
  const byServiceType = services.find((service) => service.slug === draft.serviceType);
  if (byServiceType) return byServiceType.title;

  const byRoute = services.find((service) => service.route === draft.route);
  if (byRoute) return byRoute.title;

  return humanizeSlug(draft.serviceType || draft.route) || UNKNOWN_SERVICE_FALLBACK;
}

export function formatSavedDraftUpdatedAt(
  updatedAt: string,
  language: SavedDraftLanguage,
  fallback: string,
): string {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return fallback;

  try {
    return new Intl.DateTimeFormat(language === "es" ? "es-ES" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return fallback;
  }
}
