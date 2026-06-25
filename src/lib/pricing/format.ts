import {
  TRANSACTIONAL_CURRENCIES,
  type TransactionalCurrency,
} from "./types.ts";

export function isTransactionalCurrency(
  value: unknown
): value is TransactionalCurrency {
  return (
    typeof value === "string" &&
    (TRANSACTIONAL_CURRENCIES as readonly string[]).includes(value)
  );
}

export function formatMoney(
  cents: number,
  currency: TransactionalCurrency
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function normalizeTransactionalCurrency(
  value: unknown
): TransactionalCurrency {
  return isTransactionalCurrency(value) ? value : "USD";
}

export function formatStoredMoney(cents: number, currency: unknown): string {
  return formatMoney(cents, normalizeTransactionalCurrency(currency));
}
