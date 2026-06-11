"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  COOKIE_CONSENT_CHANGE_EVENT,
  COOKIE_CONSENT_STORAGE_KEY,
  getGoogleConsentModeState,
  getStoredCookieConsent,
  isCookieConsentChoice,
  updateGoogleConsentMode,
  type CookieConsentChoice,
} from "@/lib/cookie-consent";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const EXCLUDED_PAGEVIEW_PREFIXES = ["/admin", "/dashboard"];

function isExcludedPageview(pathname: string) {
  return EXCLUDED_PAGEVIEW_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function GoogleAnalyticsPageViews({
  enabled,
  measurementId,
}: {
  enabled: boolean;
  measurementId: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (
      !enabled ||
      !pathname ||
      isExcludedPageview(pathname) ||
      typeof window === "undefined" ||
      typeof window.gtag !== "function"
    ) {
      return;
    }

    const queryString = searchParams.toString();
    const pagePath = queryString ? `${pathname}?${queryString}` : pathname;
    if (lastTrackedPath.current === pagePath) return;

    lastTrackedPath.current = pagePath;
    window.gtag("event", "page_view", {
      page_path: pagePath,
      page_location: window.location.href,
      page_title: document.title,
      send_to: measurementId,
    });
  }, [enabled, measurementId, pathname, searchParams]);

  return null;
}

export default function GoogleAnalytics() {
  const [isReady, setIsReady] = useState(false);
  const [consentChoice, setConsentChoice] =
    useState<CookieConsentChoice | null>(null);

  useEffect(() => {
    window.queueMicrotask(() => setConsentChoice(getStoredCookieConsent()));

    const onConsentChange = (event: Event) => {
      const detail = (event as CustomEvent<{ choice?: unknown }>).detail;
      setConsentChoice(
        isCookieConsentChoice(detail?.choice) ? detail.choice : null,
      );
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== COOKIE_CONSENT_STORAGE_KEY) return;
      setConsentChoice(
        isCookieConsentChoice(event.newValue) ? event.newValue : null,
      );
    };

    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, onConsentChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, onConsentChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (!isReady || typeof window === "undefined") return;

    updateGoogleConsentMode(consentChoice);

    if (
      consentChoice === "accepted" &&
      typeof window.gtag === "function" &&
      !window.picchuspotGaConfigured
    ) {
      window.gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });
      window.picchuspotGaConfigured = true;
    }
  }, [consentChoice, isReady]);

  if (!GA_MEASUREMENT_ID) return null;

  const measurementId = JSON.stringify(GA_MEASUREMENT_ID);
  const consentStorageKey = JSON.stringify(COOKIE_CONSENT_STORAGE_KEY);
  const deniedConsent = JSON.stringify(getGoogleConsentModeState(null));

  return (
    <>
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        onReady={() => setIsReady(true)}
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){window.dataLayer.push(arguments);}
            window.gtag = gtag;
            window.picchuspotGaConfigured = false;
            var picchuConsentChoice = null;
            try {
              picchuConsentChoice = window.localStorage.getItem(${consentStorageKey});
            } catch (error) {}
            var picchuConsentState = Object.assign({}, ${deniedConsent}, {
              analytics_storage: picchuConsentChoice === 'accepted' ? 'granted' : 'denied'
            });
            gtag('consent', 'default', picchuConsentState);
            gtag('js', new Date());
            if (picchuConsentChoice === 'accepted') {
              gtag('config', ${measurementId}, { send_page_view: false });
              window.picchuspotGaConfigured = true;
            }
          `,
        }}
      />
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
          GA_MEASUREMENT_ID,
        )}`}
        strategy="afterInteractive"
      />
      <Suspense fallback={null}>
        <GoogleAnalyticsPageViews
          enabled={isReady && consentChoice === "accepted"}
          measurementId={GA_MEASUREMENT_ID}
        />
      </Suspense>
    </>
  );
}
