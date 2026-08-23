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
      aria-label="Cookie consent"
      className="fixed inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-lg rounded-lg border border-stone-200 bg-white/95 p-3.5 shadow-2xl shadow-primary/15 backdrop-blur sm:inset-x-4 sm:p-4 lg:bottom-6 lg:left-6 lg:right-auto lg:mx-0"
    >
      <div className="space-y-2.5 sm:space-y-3">
        <div>
          <p className="text-xs font-bold text-primary sm:text-sm">Analytics cookies</p>
          <p className="mt-1 text-xs leading-relaxed text-foreground/75 sm:text-sm">
            We use analytics cookies to understand how visitors use PicchuSpot
            and improve the website. You can accept or reject analytics cookies.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/privacy"
            className="inline-flex min-h-[44px] items-center text-xs font-bold uppercase tracking-[0.12em] text-primary transition-colors hover:text-primary-light sm:min-h-0"
          >
            Privacy Policy
          </Link>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <button
              type="button"
              onClick={() => saveChoice("rejected")}
              className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-primary transition-colors hover:border-primary/30 hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-4 sm:py-2.5 sm:text-sm"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => saveChoice("accepted")}
              className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:px-4 sm:py-2.5 sm:text-sm"
            >
              Accept analytics
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
