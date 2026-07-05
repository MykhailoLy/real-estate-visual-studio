import type { Metadata } from "next";
import type {
  EnglishLocalizedPath,
  SpanishLocalizedPath,
} from "@/lib/localized-routes";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://picchuspot.com";

export const SITE_NAME = "PicchuSpot";

export const SOCIAL_IMAGE = {
  url: absoluteUrl("/brand/picchuspot-mark-1200.png"),
  width: 1200,
  height: 600,
  alt: "PicchuSpot brand mark",
};

export type { EnglishLocalizedPath, SpanishLocalizedPath };

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

export function publicPageMetadata({
  title,
  description,
  canonicalPath,
  spanishPath,
}: {
  title: string;
  description: string;
  canonicalPath: EnglishLocalizedPath;
  spanishPath: SpanishLocalizedPath;
}): Metadata {
  const url = absoluteUrl(canonicalPath);

  return {
    title,
    description,
    alternates: localizedAlternates({
      canonicalPath,
      englishPath: canonicalPath,
      spanishPath,
    }),
    openGraph: {
      type: "website",
      url,
      siteName: SITE_NAME,
      title,
      description,
      locale: "en_US",
      images: [SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [SOCIAL_IMAGE.url],
    },
  };
}
