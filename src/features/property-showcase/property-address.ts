import { localizedText } from "./localization.ts";
import type {
  PropertyLanguageCode,
  PropertyLocation,
} from "./types.ts";

export interface PropertyAddressView {
  primaryLine: string;
  secondaryLine: string;
  socialText: string;
}

type StructuredAddress = Pick<
  PropertyLocation,
  "streetAddress" | "city" | "region" | "postalCode" | "country"
>;

function cleanText(value: string | undefined): string {
  return value?.trim() ?? "";
}

function uniqueText(values: readonly string[], excluded: readonly string[] = []): string[] {
  const seen = new Set(
    excluded.filter(Boolean).map((value) => value.toLocaleLowerCase()),
  );

  return values.filter((value) => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    const key = trimmed.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function formatStructuredPropertyAddress(location: StructuredAddress): string {
  return uniqueText([
    cleanText(location.streetAddress),
    cleanText(location.city),
    cleanText(location.region),
    cleanText(location.postalCode),
    cleanText(location.country),
  ]).join(", ");
}

export function getPropertyAddressView(
  location: PropertyLocation,
  language: PropertyLanguageCode,
  primaryLanguage: PropertyLanguageCode,
): PropertyAddressView {
  if (location.privacyMode === "hidden") {
    return { primaryLine: "", secondaryLine: "", socialText: "" };
  }

  if (location.privacyMode === "approximate") {
    const label = localizedText(
      location.approximateLabel,
      language,
      primaryLanguage,
    );
    return { primaryLine: label, secondaryLine: "", socialText: label };
  }

  const fallback = localizedText(
    location.displayAddress,
    language,
    primaryLanguage,
  );
  const streetAddress = cleanText(location.streetAddress);
  const primaryLine = streetAddress || fallback;
  const secondaryParts = uniqueText(
    [
      cleanText(location.city),
      cleanText(location.region),
      cleanText(location.postalCode),
    ],
    [primaryLine],
  );
  const structuredText = formatStructuredPropertyAddress(location);

  return {
    primaryLine,
    secondaryLine: secondaryParts.join(" \u00b7 "),
    socialText: structuredText || fallback,
  };
}
