import type { Metadata } from "next";
import {
  absoluteUrl,
  localizedLanguages,
  type EnglishLocalizedPath,
  type SpanishLocalizedPath,
} from "@/lib/seo";

type SpanishMetadataInput = {
  title: string;
  description: string;
  path: SpanishLocalizedPath;
  englishPath: EnglishLocalizedPath;
};

export function spanishMetadata({
  title,
  description,
  path,
  englishPath,
}: SpanishMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: absoluteUrl(path),
      languages: localizedLanguages(englishPath, path),
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl(path),
      locale: "es_ES",
      alternateLocale: ["en_US"],
    },
  };
}
