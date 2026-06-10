import type { MetadataRoute } from "next";
import {
  absoluteUrl,
  localizedLanguages,
  type EnglishLocalizedPath,
  type SpanishLocalizedPath,
} from "@/lib/seo";

const localizedRoutes = [
  { englishPath: "/", spanishPath: "/es", priority: 1 },
  { englishPath: "/services", spanishPath: "/es/services", priority: 0.9 },
  { englishPath: "/pricing", spanishPath: "/es/pricing", priority: 0.9 },
  { englishPath: "/contact", spanishPath: "/es/contact", priority: 0.8 },
] as const satisfies ReadonlyArray<{
  englishPath: EnglishLocalizedPath;
  spanishPath: SpanishLocalizedPath;
  priority: number;
}>;

const englishMarketingRoutes = [
  { path: "/about", priority: 0.7 },
  { path: "/faq", priority: 0.6 },
  { path: "/portfolio", priority: 0.7 },
  { path: "/local", priority: 0.7 },
  { path: "/renders", priority: 0.7 },
  { path: "/online-retail", priority: 0.6 },
] as const;

const pricingServiceRoutes = [
  "/pricing/virtual-staging",
  "/pricing/virtual-renovation",
  "/pricing/photo-editing",
  "/pricing/floor-plans",
  "/pricing/image-enhancement",
  "/pricing/day-to-dusk",
  "/pricing/360-image-enhancement",
  "/pricing/360-virtual-staging",
  "/pricing/aerial-editing",
  "/pricing/development-site-plans",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const localizedEntries: MetadataRoute.Sitemap = localizedRoutes.flatMap(
    ({ englishPath, spanishPath, priority }) => [
      {
        url: absoluteUrl(englishPath),
        changeFrequency: "weekly",
        priority,
        alternates: {
          languages: localizedLanguages(englishPath, spanishPath),
        },
      },
      {
        url: absoluteUrl(spanishPath),
        changeFrequency: "weekly",
        priority,
        alternates: {
          languages: localizedLanguages(englishPath, spanishPath),
        },
      },
    ],
  );

  const marketingEntries: MetadataRoute.Sitemap = englishMarketingRoutes.map(
    ({ path, priority }) => ({
      url: absoluteUrl(path),
      changeFrequency: "monthly",
      priority,
    }),
  );

  const pricingEntries: MetadataRoute.Sitemap = pricingServiceRoutes.map(
    (path) => ({
      url: absoluteUrl(path),
      changeFrequency: "monthly",
      priority: 0.7,
    }),
  );

  return [...localizedEntries, ...marketingEntries, ...pricingEntries];
}
