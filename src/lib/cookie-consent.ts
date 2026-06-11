export type CookieConsentChoice = "accepted" | "rejected";

export const COOKIE_CONSENT_STORAGE_KEY = "picchuspot_cookie_consent";
export const COOKIE_CONSENT_CHANGE_EVENT = "picchuspot:cookie-consent-change";
export const COOKIE_SETTINGS_OPEN_EVENT = "picchuspot:open-cookie-settings";

type ConsentModeValue = "granted" | "denied";

export type GoogleConsentModeState = {
  analytics_storage: ConsentModeValue;
  ad_storage: "denied";
  ad_user_data: "denied";
  ad_personalization: "denied";
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    picchuspotGaConfigured?: boolean;
  }
}

export function isCookieConsentChoice(
  value: unknown,
): value is CookieConsentChoice {
  return value === "accepted" || value === "rejected";
}

export function getStoredCookieConsent(): CookieConsentChoice | null {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    return isCookieConsentChoice(value) ? value : null;
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent() {
  return getStoredCookieConsent() === "accepted";
}

export function getGoogleConsentModeState(
  choice: CookieConsentChoice | null,
): GoogleConsentModeState {
  return {
    analytics_storage: choice === "accepted" ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  };
}

export function updateGoogleConsentMode(choice: CookieConsentChoice | null) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  try {
    window.gtag("consent", "update", getGoogleConsentModeState(choice));
  } catch {
    // Consent updates must never interrupt the user experience.
  }
}

export function storeCookieConsent(choice: CookieConsentChoice) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, choice);
  } catch {
    // Ignore unavailable storage; still update this page session.
  }

  updateGoogleConsentMode(choice);
  window.dispatchEvent(
    new CustomEvent(COOKIE_CONSENT_CHANGE_EVENT, { detail: { choice } }),
  );
}

export function openCookieSettings() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COOKIE_SETTINGS_OPEN_EVENT));
}
