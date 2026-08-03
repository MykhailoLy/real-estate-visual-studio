import type {
  LocalizedText,
  PropertyFact,
  PropertyFactKey,
  PropertyLanguageCode,
} from "./types";

const CURRENCY_PATTERNS = [
  { symbol: "\u20ac", pattern: /(?:\u20ac|\bEUR\b|\beuro\b)/i },
  { symbol: "$", pattern: /(?:\$|\bUSD\b|\bdollar\b)/i },
  { symbol: "\u00a3", pattern: /(?:\u00a3|\bGBP\b|\bpound\b)/i },
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

export function descriptionParagraphsFromLanguageTexts(
  values: Partial<Record<PropertyLanguageCode, string>>,
  primaryLanguage: PropertyLanguageCode,
): LocalizedText[] {
  const paragraphMap = new Map<PropertyLanguageCode, string[]>();
  const count = Object.entries(values).reduce((max, [language, value]) => {
    const paragraphs = splitParagraphText(value);
    if (paragraphs.length > 0) {
      paragraphMap.set(language as PropertyLanguageCode, paragraphs);
    }
    return Math.max(max, paragraphs.length);
  }, 0);

  const primaryParagraphs = paragraphMap.get(primaryLanguage) ?? [];
  const englishParagraphs = paragraphMap.get("en") ?? [];

  return Array.from({ length: count }, (_, index) => {
    const primary = primaryParagraphs[index] ?? englishParagraphs[index] ?? "";
    const en = englishParagraphs[index] ?? primary;
    const paragraph: LocalizedText = { en };

    for (const [language, paragraphs] of paragraphMap) {
      const value = paragraphs[index];
      if (value) paragraph[language] = value;
    }

    if (!paragraph.en) paragraph.en = primary;
    return paragraph;
  }).filter((paragraph) => paragraph.en.trim());
}

export function descriptionTextForAdmin(
  description: readonly LocalizedText[] | undefined,
  locale: string,
): string {
  return (description ?? [])
    .map((paragraph) => paragraph[locale] ?? (locale === "en" ? "" : paragraph.en))
    .filter(Boolean)
    .join("\n\n");
}

function detectCurrencySymbol(value: string): string | null {
  return CURRENCY_PATTERNS.find((currency) => currency.pattern.test(value))
    ?.symbol ?? null;
}

function digitsFromNumberishText(value: string): string | null {
  const withoutCurrency = value
    .replace(/[\u20ac$\u00a3]/g, "")
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

  const currency = detectCurrencySymbol(trimmed);
  return currency ? `${currency}${formatInteger(amount)}` : formatInteger(amount);
}

function normalizeAreaUnit(rawUnit: string): string {
  const unit = rawUnit.trim().replace(/\s+/g, " ");
  if (/^(m2|m\u00b2|sqm|sq m)$/i.test(unit)) return "m\u00b2";
  if (/^(ft2|ft\u00b2|sqft|sq ft)$/i.test(unit)) return "sq ft";
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

  const unit = normalizeAreaUnit(match[2] ?? "");
  return unit
    ? `${formatMeasurementNumber(amount)} ${unit}`
    : formatMeasurementNumber(amount);
}

export function formatPropertyFactValue(fact: PropertyFact): string {
  if (fact.key === "price") return formatPriceLabel(fact.value);
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
