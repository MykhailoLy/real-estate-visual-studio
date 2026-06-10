import type { Metadata } from "next";

type SpanishMetadataInput = {
  title: string;
  description: string;
  path: "/es" | "/es/services" | "/es/pricing" | "/es/contact";
  englishPath: "/" | "/services" | "/pricing" | "/contact";
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
      canonical: path,
      languages: {
        en: englishPath,
        "en-US": englishPath,
        es: path,
        "es-ES": path,
      },
    },
    openGraph: {
      title,
      description,
      url: path,
      locale: "es_ES",
      alternateLocale: ["en_US"],
    },
  };
}
