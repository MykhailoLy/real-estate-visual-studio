import type { MetadataRoute } from "next";
import {
  absoluteUrl,
  localizedLanguages,
} from "@/lib/seo";
import { localizedRoutes } from "@/lib/localized-routes";

const englishMarketingRoutes = [
  { path: "/faq", priority: 0.6 },
  { path: "/portfolio", priority: 0.7 },
  { path: "/local", priority: 0.7 },
  { path: "/renders", priority: 0.7 },
  { path: "/online-retail", priority: 0.6 },
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

  return [...localizedEntries, ...marketingEntries];
}
