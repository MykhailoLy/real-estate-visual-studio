import type {
  LocalizedText,
  PropertyFact,
  PropertyFactKey,
} from "./types";

const DEFAULT_CURRENCY_SYMBOL = "€";

const CURRENCY_PATTERNS = [
  { symbol: "€", pattern: /(?:€|\bEUR\b|\beuro\b)/i },
  { symbol: "$", pattern: /(?:\$|\bUSD\b|\bdollar\b)/i },
  { symbol: "£", pattern: /(?:£|\bGBP\b|\bpound\b)/i },
] as const;

export function generatePropertyPageSlug(
  title: string | undefined,
  fallback: string | undefined,
): string {
  const source = title?.trim() || fallback?.trim() || "property-showcase";
  const slug = source
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "property-showcase";
}

function splitParagraphText(value: string | undefined): string[] {
  return (value ?? "")
    .split(/\r?\n\s*\r?\n/g)
    .map((paragraph) => paragraph.replace(/\s*\r?\n\s*/g, " ").trim())
    .filter(Boolean);
}

export function descriptionParagraphsFromText(
  english: string,
  spanish: string,
): LocalizedText[] {
  const en = splitParagraphText(english);
  const es = splitParagraphText(spanish);
  const count = Math.max(en.length, es.length);

  return Array.from({ length: count }, (_, index) => {
    const enText = en[index] ?? es[index] ?? "";
    const esText = es[index];
    return {
      en: enText,
      ...(esText ? { es: esText } : {}),
    };
  }).filter((paragraph) => paragraph.en.trim());
}

export function descriptionTextForAdmin(
  description: readonly LocalizedText[] | undefined,
  locale: keyof LocalizedText,
): string {
  return (description ?? [])
    .map((paragraph) => paragraph[locale] ?? (locale === "en" ? "" : paragraph.en))
    .filter(Boolean)
    .join("\n\n");
}

function detectCurrencySymbol(value: string): string {
  return (
    CURRENCY_PATTERNS.find((currency) => currency.pattern.test(value))?.symbol ??
    DEFAULT_CURRENCY_SYMBOL
  );
}

function digitsFromNumberishText(value: string): string | null {
  const withoutCurrency = value
    .replace(/[€$£]/g, "")
    .replace(/\b(EUR|USD|GBP|euro|euros|dollar|dollars|pound|pounds)\b/gi, "")
    .trim();

  if (!/^[\d\s.,]+$/.test(withoutCurrency)) return null;
  const digits = withoutCurrency.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMeasurementNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPriceLabel(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";

  const digits = digitsFromNumberishText(trimmed);
  if (!digits) return trimmed;

  const amount = Number(digits);
  if (!Number.isSafeInteger(amount)) return trimmed;

  return `${detectCurrencySymbol(trimmed)}${formatInteger(amount)}`;
}

function normalizeAreaUnit(rawUnit: string): string {
  const unit = rawUnit.trim().replace(/\s+/g, " ");
  if (/^(m2|m²|sqm|sq m)$/i.test(unit)) return "m²";
  if (/^(ft2|ft²|sqft|sq ft)$/i.test(unit)) return "sq ft";
  return unit;
}

export function formatAreaLabel(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";

  const match = trimmed.match(/^([\d\s.,]+)\s*([^\d\s].*)?$/);
  if (!match) return trimmed;

  const numberText = match[1]?.trim() ?? "";
  const amount = parseMeasurementAmount(numberText);
  if (amount === null) return trimmed;

  const unit = normalizeAreaUnit(match[2] ?? "m²");
  return `${formatMeasurementNumber(amount)} ${unit}`;
}

export function formatPropertyFactValue(fact: PropertyFact): string {
  if (isAreaFactKey(fact.key)) return formatAreaLabel(fact.value);
  return fact.value;
}

function isAreaFactKey(key: PropertyFactKey): boolean {
  return key === "built-area" || key === "plot-area";
}

function parseMeasurementAmount(value: string): number | null {
  const compact = value.replace(/\s+/g, "");
  if (!/^\d[\d.,]*$/.test(compact)) return null;

  const lastDot = compact.lastIndexOf(".");
  const lastComma = compact.lastIndexOf(",");
  const lastSeparator = Math.max(lastDot, lastComma);

  if (lastSeparator >= 0) {
    const trailingDigits = compact.length - lastSeparator - 1;
    if (trailingDigits > 0 && trailingDigits <= 2) {
      const decimalSeparator = compact[lastSeparator];
      const normalized = compact
        .replace(decimalSeparator === "." ? /,/g : /\./g, "")
        .replace(decimalSeparator, ".");
      const amount = Number(normalized);
      return Number.isFinite(amount) ? amount : null;
    }
  }

  const amount = Number(compact.replace(/\D/g, ""));
  return Number.isFinite(amount) ? amount : null;
}
