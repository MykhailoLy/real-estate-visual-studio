"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  CURRENCY_COOKIE_NAME,
  CURRENCY_STORAGE_KEY,
  DEFAULT_CURRENCY,
  SUPPORTED_CURRENCIES,
  isCurrencyCode,
  resolveRegionalPrice,
  type CurrencyCode,
  type RegionalPrice,
} from "@/lib/currency";

const CURRENCY_EVENT = "picchuspot:currency-change";

const EU_REGIONS = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
]);

function readStoredCurrency(): CurrencyCode | null {
  try {
    const stored = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (isCurrencyCode(stored)) return stored;
  } catch {
    // Ignore unavailable storage.
  }
  return null;
}

function detectCurrencyFromBrowser(pathname: string): CurrencyCode {
  if (pathname === "/es" || pathname.startsWith("/es/")) return "EUR";

  const languages =
    navigator.languages && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];

  for (const language of languages) {
    const normal = language.toLowerCase();
    if (normal === "es" || normal.startsWith("es-")) return "EUR";

    const region = language.split("-")[1]?.toUpperCase();
    if (region && EU_REGIONS.has(region)) return "EUR";
  }

  return DEFAULT_CURRENCY;
}

function writeCurrency(currency: CurrencyCode) {
  try {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
  } catch {
    // Ignore unavailable storage.
  }

  document.cookie = `${CURRENCY_COOKIE_NAME}=${currency}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.dispatchEvent(
    new CustomEvent(CURRENCY_EVENT, { detail: { currency } })
  );
}

function useDisplayCurrency(): [CurrencyCode, (currency: CurrencyCode) => void] {
  const [currency, setCurrencyState] = useState<CurrencyCode>(DEFAULT_CURRENCY);

  useEffect(() => {
    const preferred =
      readStoredCurrency() ?? detectCurrencyFromBrowser(window.location.pathname);
    if (preferred !== DEFAULT_CURRENCY) {
      window.queueMicrotask(() => setCurrencyState(preferred));
    }

    const onStorage = (event: StorageEvent) => {
      if (
        event.key === CURRENCY_STORAGE_KEY &&
        isCurrencyCode(event.newValue)
      ) {
        setCurrencyState(event.newValue);
      }
    };
    const onCurrency = (event: Event) => {
      const detail = (event as CustomEvent<{ currency?: unknown }>).detail;
      if (isCurrencyCode(detail?.currency)) {
        setCurrencyState(detail.currency);
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(CURRENCY_EVENT, onCurrency);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CURRENCY_EVENT, onCurrency);
    };
  }, []);

  const setCurrency = (next: CurrencyCode) => {
    setCurrencyState(next);
    writeCurrency(next);
  };

  return [currency, setCurrency];
}

export function CurrencySwitcher({ className }: { className?: string }) {
  const [currency, setCurrency] = useDisplayCurrency();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border border-stone-300 bg-white p-1 shadow-sm",
        className
      )}
      aria-label="Display currency"
    >
      {SUPPORTED_CURRENCIES.map((code) => {
        const active = currency === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setCurrency(code)}
            className={cn(
              "min-w-12 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] transition-colors",
              active
                ? "bg-primary text-white"
                : "text-foreground/70 hover:bg-surface hover:text-primary"
            )}
            aria-pressed={active}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}

export function RegionalPriceText({
  price,
  className,
}: {
  price: RegionalPrice;
  className?: string;
}) {
  const [currency] = useDisplayCurrency();
  const text = useMemo(
    () => resolveRegionalPrice(price, currency),
    [currency, price]
  );

  return <span className={className}>{text}</span>;
}
