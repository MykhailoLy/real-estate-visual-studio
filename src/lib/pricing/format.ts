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
  currency: TransactionalCurrency,
  options?: {
    /** Presentation-only option for compact displays such as the homepage hero. */
    trimWholeCents?: boolean;
  },
): string {
  const fractionDigits = options?.trimWholeCents && cents % 100 === 0 ? 0 : 2;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
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
