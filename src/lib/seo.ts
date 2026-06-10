import type { Metadata } from "next";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://picchuspot.com";

export type EnglishLocalizedPath = "/" | "/services" | "/pricing" | "/contact";
export type SpanishLocalizedPath =
  | "/es"
  | "/es/services"
  | "/es/pricing"
  | "/es/contact";

export function absoluteUrl(path: string): string {
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}

export function localizedLanguages(
  englishPath: EnglishLocalizedPath,
  spanishPath: SpanishLocalizedPath,
): Record<string, string> {
  return {
    en: absoluteUrl(englishPath),
    "en-US": absoluteUrl(englishPath),
    es: absoluteUrl(spanishPath),
    "es-ES": absoluteUrl(spanishPath),
    "x-default": absoluteUrl(englishPath),
  };
}

export function localizedAlternates({
  canonicalPath,
  englishPath,
  spanishPath,
}: {
  canonicalPath: EnglishLocalizedPath | SpanishLocalizedPath;
  englishPath: EnglishLocalizedPath;
  spanishPath: SpanishLocalizedPath;
}): Metadata["alternates"] {
  return {
    canonical: absoluteUrl(canonicalPath),
    languages: localizedLanguages(englishPath, spanishPath),
  };
}
