import { hasAnalyticsConsent } from "@/lib/cookie-consent";

type AnalyticsValue = string | number | boolean | null | undefined;
type AnalyticsParams = Record<string, AnalyticsValue>;
type ConversionLocation =
  | "header"
  | "mobile_sticky_cta"
  | "footer"
  | "cta_section"
  | "pricing_hero"
  | "pricing_card"
  | "pricing_intro"
  | "pricing_inline"
  | "contact_page"
  | "unknown";

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

function getCurrentPagePath() {
  if (typeof window === "undefined") return undefined;
  return `${window.location.pathname}${window.location.search}`;
}

function withPagePath(params: AnalyticsParams = {}): AnalyticsParams {
  return {
    ...params,
    page_path: getCurrentPagePath(),
  };
}

export function getOrderServiceSlug(href: string): string | undefined {
  const pathname = href.split(/[?#]/)[0];
  if (!pathname.startsWith("/order/")) return undefined;
  return pathname.replace(/^\/order\//, "").replace(/\/+$/, "") || undefined;
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

export function trackSignUpClick(location: ConversionLocation | string) {
  trackEvent(
    "sign_up_click",
    withPagePath({
      location,
    }),
  );
}

export function trackLoginClick(location: ConversionLocation | string) {
  trackEvent(
    "login_click",
    withPagePath({
      location,
    }),
  );
}

export function trackOrderIntentClick({
  location,
  href,
  serviceSlug,
}: {
  location: ConversionLocation | string;
  href?: string;
  serviceSlug?: string;
}) {
  trackEvent(
    "order_intent_click",
    withPagePath({
      location,
      service_slug: serviceSlug ?? (href ? getOrderServiceSlug(href) : undefined),
    }),
  );
}

export function trackPricingCtaClick({
  location,
  serviceSlug,
}: {
  location: ConversionLocation | string;
  serviceSlug?: string;
}) {
  trackEvent(
    "pricing_cta_click",
    withPagePath({
      location,
      service_slug: serviceSlug,
    }),
  );
}

export function trackContactIntentClick(location: ConversionLocation | string) {
  trackEvent(
    "contact_intent_click",
    withPagePath({
      location,
    }),
  );
}

export function trackEmailClick(location: ConversionLocation | string) {
  trackEvent(
    "email_click",
    withPagePath({
      location,
    }),
  );
}

export function trackPhoneClick(location: ConversionLocation | string) {
  trackEvent(
    "phone_click",
    withPagePath({
      location,
    }),
  );
}

export function trackSocialClick({
  location,
  platform,
}: {
  location: ConversionLocation | string;
  platform?: string;
}) {
  trackEvent(
    "social_click",
    withPagePath({
      location,
      platform,
    }),
  );
}

export function trackLanguageSwitch(
  selectedLanguage: string,
  location: ConversionLocation | string,
) {
  trackEvent(
    "language_switch",
    withPagePath({
      selected_language: selectedLanguage,
      location,
    }),
  );
}

export function trackRegionCurrencySwitch({
  selectedRegion,
  currency,
  location,
}: {
  selectedRegion: string;
  currency?: string;
  location: ConversionLocation | string;
}) {
  trackEvent(
    "region_currency_switch",
    withPagePath({
      selected_region: selectedRegion,
      currency,
      location,
    }),
  );
}
