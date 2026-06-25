export const SUPPORTED_REGIONS = ["US", "CA", "EU"] as const;
export const SUPPORTED_CURRENCIES = ["USD", "CAD", "EUR"] as const;

export type RegionCode = (typeof SUPPORTED_REGIONS)[number];
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export interface RegionalPrice {
  usd: string;
  cad: string;
  eur: string;
}

export interface RegionOption {
  code: RegionCode;
  label: string;
  currency: CurrencyCode;
}

export const DEFAULT_CURRENCY: CurrencyCode = "USD";
export const DEFAULT_REGION: RegionCode = "US";
export const CURRENCY_STORAGE_KEY = "picchuspot-currency";
export const CURRENCY_COOKIE_NAME = "picchuspot_currency";
export const REGION_STORAGE_KEY = "picchuspot-region";
export const REGION_COOKIE_NAME = "picchuspot_region";

export const REGION_OPTIONS: RegionOption[] = [
  {
    code: "US",
    label: "United States",
    currency: "USD",
  },
  {
    code: "CA",
    label: "Canada",
    currency: "CAD",
  },
  {
    code: "EU",
    label: "Europe",
    currency: "EUR",
  },
];

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return (
    typeof value === "string" &&
    (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
  );
}

export function isRegionCode(value: unknown): value is RegionCode {
  return (
    typeof value === "string" &&
    (SUPPORTED_REGIONS as readonly string[]).includes(value)
  );
}

export function currencyForRegion(region: RegionCode): CurrencyCode {
  return (
    REGION_OPTIONS.find((option) => option.code === region)?.currency ??
    DEFAULT_CURRENCY
  );
}

function cadFromUsd(usd: string): string {
  return usd.replace(/\$/g, "C$");
}

export function regionalPrice(
  usd: string,
  eur: string,
  cad = cadFromUsd(usd)
): RegionalPrice {
  return { usd, cad, eur };
}

export function resolveRegionalPrice(
  price: RegionalPrice,
  currency: CurrencyCode
): string {
  if (currency === "CAD") return price.cad;
  if (currency === "EUR") return price.eur;
  return price.usd;
}

export function formatRegionalCents(
  cents: number,
  currency: CurrencyCode
): string {
  const amount = (cents / 100).toFixed(2);
  if (currency === "CAD") return `C$${amount}`;
  if (currency === "EUR") return `€${amount}`;
  return `$${amount}`;
}

export function readBrowserCurrency(): CurrencyCode {
  if (typeof window === "undefined") return DEFAULT_CURRENCY;
  try {
    const storedRegion = window.localStorage.getItem(REGION_STORAGE_KEY);
    if (isRegionCode(storedRegion)) return currencyForRegion(storedRegion);
    const storedCurrency = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (isCurrencyCode(storedCurrency)) return storedCurrency;
  } catch {
    // Storage may be unavailable; the transactional default remains USD.
  }
  return DEFAULT_CURRENCY;
}
