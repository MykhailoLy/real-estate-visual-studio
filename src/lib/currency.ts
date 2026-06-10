export const SUPPORTED_CURRENCIES = ["USD", "EUR"] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export interface RegionalPrice {
  usd: string;
  eur: string;
}

export const DEFAULT_CURRENCY: CurrencyCode = "USD";
export const CURRENCY_STORAGE_KEY = "picchuspot-currency";
export const CURRENCY_COOKIE_NAME = "picchuspot_currency";

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return (
    typeof value === "string" &&
    (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
  );
}

export function regionalPrice(usd: string, eur: string): RegionalPrice {
  return { usd, eur };
}

export function resolveRegionalPrice(
  price: RegionalPrice,
  currency: CurrencyCode
): string {
  return currency === "EUR" ? price.eur : price.usd;
}

