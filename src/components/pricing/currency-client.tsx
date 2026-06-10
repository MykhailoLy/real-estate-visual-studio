"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  CURRENCY_COOKIE_NAME,
  CURRENCY_STORAGE_KEY,
  DEFAULT_REGION,
  REGION_COOKIE_NAME,
  REGION_OPTIONS,
  REGION_STORAGE_KEY,
  currencyForRegion,
  isCurrencyCode,
  isRegionCode,
  resolveRegionalPrice,
  type RegionCode,
  type RegionalPrice,
} from "@/lib/currency";

const REGION_EVENT = "picchuspot:region-change";

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

function regionFromLegacyCurrency(currency: unknown): RegionCode | null {
  if (!isCurrencyCode(currency)) return null;
  if (currency === "CAD") return "CA";
  if (currency === "EUR") return "EU";
  return "US";
}

function readStoredRegion(): RegionCode | null {
  try {
    const storedRegion = window.localStorage.getItem(REGION_STORAGE_KEY);
    if (isRegionCode(storedRegion)) return storedRegion;

    const legacyCurrency = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    const legacyRegion = regionFromLegacyCurrency(legacyCurrency);
    if (legacyRegion) return legacyRegion;
  } catch {
    // Ignore unavailable storage.
  }
  return null;
}

function detectRegionFromBrowser(): RegionCode {
  const languages =
    navigator.languages && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];

  for (const language of languages) {
    const region = language.split("-")[1]?.toUpperCase();
    if (region === "CA") return "CA";
  }

  for (const language of languages) {
    const normal = language.toLowerCase();
    if (normal === "es" || normal.startsWith("es-")) return "EU";

    const region = language.split("-")[1]?.toUpperCase();
    if (region && EU_REGIONS.has(region)) return "EU";
  }

  return DEFAULT_REGION;
}

function writeRegion(region: RegionCode) {
  const currency = currencyForRegion(region);

  try {
    window.localStorage.setItem(REGION_STORAGE_KEY, region);
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
  } catch {
    // Ignore unavailable storage.
  }

  document.cookie = `${REGION_COOKIE_NAME}=${region}; Path=/; Max-Age=31536000; SameSite=Lax`;
  document.cookie = `${CURRENCY_COOKIE_NAME}=${currency}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.dispatchEvent(new CustomEvent(REGION_EVENT, { detail: { region } }));
}

function useDisplayRegion(): [RegionCode, (region: RegionCode) => void] {
  const [region, setRegionState] = useState<RegionCode>(DEFAULT_REGION);

  useEffect(() => {
    const preferred = readStoredRegion() ?? detectRegionFromBrowser();
    if (preferred !== DEFAULT_REGION) {
      window.queueMicrotask(() => setRegionState(preferred));
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key === REGION_STORAGE_KEY && isRegionCode(event.newValue)) {
        setRegionState(event.newValue);
        return;
      }

      if (event.key === CURRENCY_STORAGE_KEY) {
        const legacyRegion = regionFromLegacyCurrency(event.newValue);
        if (legacyRegion) setRegionState(legacyRegion);
      }
    };
    const onRegion = (event: Event) => {
      const detail = (event as CustomEvent<{ region?: unknown }>).detail;
      if (isRegionCode(detail?.region)) {
        setRegionState(detail.region);
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(REGION_EVENT, onRegion);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(REGION_EVENT, onRegion);
    };
  }, []);

  const setRegion = (next: RegionCode) => {
    setRegionState(next);
    writeRegion(next);
  };

  return [region, setRegion];
}

export function RegionCurrencySelector({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [region, setRegion] = useDisplayRegion();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const activeOption =
    REGION_OPTIONS.find((option) => option.code === region) ??
    REGION_OPTIONS[0];

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex items-center justify-between gap-2 rounded-lg border border-stone-200 bg-white/95 px-3 py-2 shadow-sm transition-colors",
          "hover:border-primary/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          compact ? "min-w-[7.5rem]" : "w-full min-w-[12.5rem]"
        )}
      >
        {!compact && (
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
            Region
          </span>
        )}
        <span className="text-xs font-bold text-primary">
          {activeOption.shortLabel}
        </span>
        <span aria-hidden className="text-[10px] text-primary">
          v
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Select market region and display currency"
          className="absolute right-0 top-full z-[10000] mt-2 w-64 overflow-hidden rounded-lg border border-stone-200 bg-white py-1.5 shadow-xl"
        >
          {REGION_OPTIONS.map((option) => {
            const active = option.code === region;
            return (
              <button
                key={option.code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setRegion(option.code);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                  active
                    ? "bg-primary/5 text-primary"
                    : "text-foreground hover:bg-surface hover:text-primary"
                )}
              >
                <span>
                  {option.flag} {option.label} {"\u2014"} {option.currency}
                </span>
                {active && (
                  <span className="text-xs font-bold uppercase tracking-[0.12em]">
                    Selected
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
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
  const [region] = useDisplayRegion();
  const text = useMemo(
    () => resolveRegionalPrice(price, currencyForRegion(region)),
    [region, price]
  );

  return <span className={className}>{text}</span>;
}
