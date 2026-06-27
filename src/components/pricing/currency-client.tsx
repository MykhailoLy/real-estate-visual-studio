"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { trackRegionCurrencySwitch } from "@/lib/analytics";
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
  formatRegionalCents,
  resolveRegionalPrice,
  type RegionCode,
  type RegionalPrice,
} from "@/lib/currency";
import { getCatalogPrice } from "@/lib/pricing/catalog";
import { formatMoney } from "@/lib/pricing/format";
import type { PriceKey } from "@/lib/pricing/types";

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

export function useDisplayRegion(): [RegionCode, (region: RegionCode) => void] {
  const [region, setRegionState] = useState<RegionCode>(DEFAULT_REGION);

  useEffect(() => {
    const stored = readStoredRegion();
    const preferred = stored ?? detectRegionFromBrowser();
    if (preferred !== DEFAULT_REGION) {
      window.queueMicrotask(() => setRegionState(preferred));
    }
    if (!stored) {
      writeRegion(preferred);
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

  const setRegion = useCallback((next: RegionCode) => {
    setRegionState(next);
    writeRegion(next);
  }, []);

  return [region, setRegion];
}

export function RegionCurrencySelector({
  className,
  compact = false,
  tight = false,
  analyticsLocation = "region_currency_selector",
}: {
  className?: string;
  compact?: boolean;
  tight?: boolean;
  analyticsLocation?: string;
}) {
  const [region, setRegion] = useDisplayRegion();
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const activeOption =
    REGION_OPTIONS.find((option) => option.code === region) ??
    REGION_OPTIONS[0];

  const updatePanelPosition = useCallback(() => {
    if (!buttonRef.current || !compact) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPanelPos({
      top: rect.bottom + 8,
      right: Math.max(12, window.innerWidth - rect.right),
    });
  }, [compact]);

  useEffect(() => {
    if (!open) return;

    updatePanelPosition();

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const insideRoot = rootRef.current?.contains(target) ?? false;
      const insidePanel = panelRef.current?.contains(target) ?? false;
      if (!insideRoot && !insidePanel) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition);
    };
  }, [open, compact, updatePanelPosition]);

  const options = (
    <div
      ref={panelRef}
      role="listbox"
      aria-label="Select market region and display currency"
      style={
        compact && panelPos
          ? {
              position: "fixed",
              top: panelPos.top,
              right: panelPos.right,
              zIndex: 10000,
            }
          : undefined
      }
      className={cn(
        "max-w-full overflow-hidden rounded-lg border border-stone-200 bg-white py-1.5 shadow-xl",
        compact ? (tight ? "w-56" : "w-64") : "mt-2 w-full shadow-sm"
      )}
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
              trackRegionCurrencySwitch({
                selectedRegion: option.code,
                currency: option.currency,
                location: analyticsLocation,
              });
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors",
              active
                ? "bg-primary/5 text-primary"
                : "text-foreground hover:bg-surface hover:text-primary"
            )}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <RegionFlag code={option.code} />
              <span className="truncate">
                {option.label} {"\u2014"} {option.currency}
              </span>
            </span>
            {active && (
              <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-[0.12em]">
                Selected
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative",
        compact ? "inline-flex" : "flex w-full min-w-0 flex-col",
        className
      )}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          updatePanelPosition();
          setOpen((value) => !value);
        }}
        className={cn(
          "inline-flex items-center justify-between gap-2 rounded-lg border border-stone-200 bg-white/95 px-3 py-2 shadow-sm transition-colors",
          "hover:border-primary/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          compact
            ? tight
              ? "h-9 min-w-[4.25rem] gap-1 px-2 py-1.5"
              : "min-w-[7.5rem]"
            : "w-full min-w-[12.5rem]"
        )}
      >
        {!compact && (
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
            Region
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
          <RegionFlag code={activeOption.code} />
          {activeOption.currency}
        </span>
        <span aria-hidden className="text-[10px] text-primary">
          v
        </span>
      </button>

      {open && compact && panelPos && createPortal(options, document.body)}
      {open && !compact && options}
    </div>
  );
}

export function RegionFlag({ code }: { code: RegionCode }) {
  if (code === "CA") {
    return (
      <span
        aria-hidden
        className="relative inline-flex h-4 w-5 shrink-0 overflow-hidden rounded-[3px] border border-stone-200 bg-white shadow-sm"
      >
        <span className="h-full w-[28%] bg-red-600" />
        <svg
          viewBox="0 0 20 20"
          className="h-full flex-1 text-red-600"
          fill="currentColor"
        >
          <path d="M10 3.2 8.8 6.5 6.4 5.3l1.1 2.8-2.8.7 2.7 1.5-1.2 2.1 2.6-.5L10 16l1.2-4.1 2.6.5-1.2-2.1 2.7-1.5-2.8-.7 1.1-2.8-2.4 1.2L10 3.2Z" />
        </svg>
        <span className="h-full w-[28%] bg-red-600" />
      </span>
    );
  }

  if (code === "EU") {
    const dots = Array.from({ length: 12 }, (_, index) => {
      const angle = (index / 12) * Math.PI * 2 - Math.PI / 2;
      return {
        cx: 10 + Math.cos(angle) * 5.6,
        cy: 10 + Math.sin(angle) * 5.6,
      };
    });

    return (
      <span
        aria-hidden
        className="inline-flex h-4 w-5 shrink-0 overflow-hidden rounded-[3px] border border-stone-200 bg-[#1f4aa8] shadow-sm"
      >
        <svg viewBox="0 0 20 16" className="h-full w-full">
          {dots.map((dot, index) => (
            <circle
              key={index}
              cx={dot.cx}
              cy={dot.cy - 2}
              r="0.85"
              fill="#f8d24a"
            />
          ))}
        </svg>
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className="inline-flex h-4 w-5 shrink-0 overflow-hidden rounded-[3px] border border-stone-200 bg-white shadow-sm"
    >
      <span className="relative h-full w-[42%] bg-[#244b9b]">
        <span className="absolute left-[3px] top-[3px] h-1 w-1 rounded-full bg-white/95" />
        <span className="absolute left-[9px] top-[3px] h-1 w-1 rounded-full bg-white/95" />
        <span className="absolute left-[6px] top-[8px] h-1 w-1 rounded-full bg-white/95" />
      </span>
      <span className="flex flex-1 flex-col">
        {Array.from({ length: 7 }, (_, index) => (
          <span
            key={index}
            className={cn("flex-1", index % 2 === 0 ? "bg-red-600" : "bg-white")}
          />
        ))}
      </span>
    </span>
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

export function useRegionalCentsFormatter() {
  const [region] = useDisplayRegion();
  return (cents: number) => formatRegionalCents(cents, currencyForRegion(region));
}

export function useDisplayCurrency() {
  const [region] = useDisplayRegion();
  return currencyForRegion(region);
}

export function RegionalCentsText({
  cents,
  className,
}: {
  cents: number;
  className?: string;
}) {
  // Display-only: order totals still use the existing internal cents values.
  const formatCents = useRegionalCentsFormatter();

  return <span className={className}>{formatCents(cents)}</span>;
}

export function CatalogPriceText({
  priceKey,
  prefix,
  suffix,
  className,
}: {
  priceKey: PriceKey;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const currency = useDisplayCurrency();
  return (
    <span className={className}>
      {prefix ?? ""}
      {formatMoney(getCatalogPrice(priceKey, currency), currency)}
      {suffix ?? ""}
    </span>
  );
}
