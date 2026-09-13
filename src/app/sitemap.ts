import type { MetadataRoute } from "next";
import {
  absoluteUrl,
  localizedLanguages,
} from "@/lib/seo";
import { localizedRoutes } from "@/lib/localized-routes";
import { getPublishedBlogArticles } from "@/lib/blog";

const englishMarketingRoutes = [
  // /portfolio is intentionally omitted: the obsolete public
  // /portfolio route now permanently redirects (308) to /gallery,
  // so it must not appear in the sitemap.
  { path: "/local", priority: 0.7, changeFrequency: "monthly" },
  { path: "/renders", priority: 0.7, changeFrequency: "monthly" },
  { path: "/online-retail", priority: 0.6, changeFrequency: "monthly" },
  { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const localizedEntries: MetadataRoute.Sitemap = localizedRoutes
    .filter(
      (route) =>
        !("includeInSitemap" in route) || route.includeInSitemap !== false,
    )
    .flatMap(({ englishPath, spanishPath, priority }) => [
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
    ]);

  const marketingEntries: MetadataRoute.Sitemap = englishMarketingRoutes.map(
    ({ path, priority, changeFrequency }) => ({
      url: absoluteUrl(path),
      changeFrequency,
      priority,
    }),
  );

  const blogArticleEntries: MetadataRoute.Sitemap =
    getPublishedBlogArticles().map((article) => ({
      url: absoluteUrl(article.canonicalPath),
      lastModified: article.updatedDate ?? article.publishedDate,
      changeFrequency: "monthly",
      priority: 0.6,
    }));

  return [...localizedEntries, ...marketingEntries, ...blogArticleEntries];
}
