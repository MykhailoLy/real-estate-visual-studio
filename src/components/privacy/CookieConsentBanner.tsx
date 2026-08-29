"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  COOKIE_SETTINGS_OPEN_EVENT,
  getStoredCookieConsent,
  storeCookieConsent,
  type CookieConsentChoice,
} from "@/lib/cookie-consent";

const EXCLUDED_CONSENT_PREFIXES = ["/admin", "/dashboard"];

function isExcludedConsentPath(pathname: string) {
  return EXCLUDED_CONSENT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default function CookieConsentBanner() {
  const pathname = usePathname() ?? "/";
  const isSpanish = pathname === "/es" || pathname.startsWith("/es/");
  const copy = isSpanish
    ? {
        ariaLabel: "Consentimiento de cookies",
        title: "Cookies de analítica",
        description:
          "Usamos cookies de analítica para mejorar PicchuSpot. Puedes aceptarlas o rechazarlas.",
        policyLabel: "Política de cookies",
        policyHref: "/es/cookies",
        reject: "Rechazar",
        accept: "Aceptar analítica",
      }
    : {
        ariaLabel: "Cookie consent",
        title: "Analytics cookies",
        description:
          "We use analytics cookies to improve PicchuSpot. You can accept or reject them.",
        policyLabel: "Cookie Policy",
        policyHref: "/cookies",
        reject: "Reject",
        accept: "Accept analytics",
      };
  const [choice, setChoice] = useState<CookieConsentChoice | null>(null);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    window.queueMicrotask(() => {
      setChoice(getStoredCookieConsent());
      setReady(true);
    });

    const onOpenSettings = () => setSettingsOpen(true);
    window.addEventListener(COOKIE_SETTINGS_OPEN_EVENT, onOpenSettings);
    return () =>
      window.removeEventListener(COOKIE_SETTINGS_OPEN_EVENT, onOpenSettings);
  }, []);

  if (!ready || isExcludedConsentPath(pathname)) return null;
  if (choice && !settingsOpen) return null;

  const saveChoice = (nextChoice: CookieConsentChoice) => {
    storeCookieConsent(nextChoice);
    setChoice(nextChoice);
    setSettingsOpen(false);
  };

  return (
    <aside
      aria-label={copy.ariaLabel}
      className="fixed inset-x-2 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-2xl rounded-xl border border-line bg-white/95 p-3 shadow-2xl shadow-primary/15 backdrop-blur sm:inset-x-4 sm:p-4 lg:bottom-6 lg:left-6 lg:right-auto lg:mx-0"
    >
      <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-5">
        <div>
          <p className="text-xs font-bold text-primary sm:text-sm">
            {copy.title}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted sm:text-sm">
            {copy.description}
          </p>
        </div>

        <div className="grid min-w-0 grid-cols-[minmax(0,0.9fr)_minmax(4.25rem,0.7fr)_minmax(0,1.35fr)] items-center gap-1.5 sm:flex sm:gap-2">
          <Link
            href={copy.policyHref}
            className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-md px-1 text-center text-[11px] font-semibold leading-tight text-primary underline decoration-line underline-offset-4 transition-colors hover:bg-ivory focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-2 sm:text-xs"
          >
            {copy.policyLabel}
          </Link>
          <button
            type="button"
            onClick={() => saveChoice("rejected")}
            className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-md border border-border-strong bg-white px-2 text-xs font-bold text-primary transition-colors hover:bg-ivory focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-4 sm:text-sm"
          >
            {copy.reject}
          </button>
          <button
            type="button"
            onClick={() => saveChoice("accepted")}
            className="inline-flex min-h-11 min-w-0 items-center justify-center whitespace-nowrap rounded-md bg-primary px-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:px-4 sm:text-sm"
          >
            {copy.accept}
          </button>
        </div>
      </div>
    </aside>
  );
}
