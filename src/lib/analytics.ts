import { hasAnalyticsConsent } from "@/lib/cookie-consent";

type AnalyticsValue = string | number | boolean | null | undefined;
type AnalyticsParams = Record<string, AnalyticsValue>;
const EXCLUDED_ANALYTICS_PREFIXES = ["/admin", "/dashboard"];

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function cleanParams(params: AnalyticsParams): AnalyticsParams {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  );
}

function isExcludedAnalyticsPath(pathname: string) {
  return EXCLUDED_ANALYTICS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function trackEvent(name: string, params: AnalyticsParams = {}) {
  if (
    typeof window === "undefined" ||
    typeof window.gtag !== "function" ||
    !hasAnalyticsConsent() ||
    isExcludedAnalyticsPath(window.location.pathname)
  ) {
    return;
  }

  try {
    window.gtag("event", name, cleanParams(params));
  } catch {
    // Analytics must never interrupt the user experience.
  }
}

export function trackButtonClick(label: string, location: string) {
  trackEvent("button_click", {
    button_label: label,
    location,
  });
}

export function trackLeadIntent(type: string, location: string) {
  trackEvent("lead_intent", {
    intent_type: type,
    location,
  });
}
