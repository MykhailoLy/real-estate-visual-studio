import type { MetadataRoute } from "next";
import {
  absoluteUrl,
  localizedLanguages,
} from "@/lib/seo";
import { localizedRoutes } from "@/lib/localized-routes";
import { getPublishedBlogArticles } from "@/lib/blog";
import { getGalleryServiceSlugsWithExamples } from "@/lib/portfolio";
import { PORTFOLIO_SERVICE_SLUGS } from "@/lib/portfolio-service-meta";
import { gallerySitemapSlugs } from "@/lib/gallery-sitemap";

const englishMarketingRoutes = [
  // /portfolio is intentionally omitted: the obsolete public
  // /portfolio route now permanently redirects (308) to /gallery,
  // so it must not appear in the sitemap.
  { path: "/local", priority: 0.7, changeFrequency: "monthly" },
  { path: "/renders", priority: 0.7, changeFrequency: "monthly" },
  { path: "/online-retail", priority: 0.6, changeFrequency: "monthly" },
  { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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

  // Gallery detail routes are listed only while the service has a published,
  // gallery-eligible example with a resolvable image pair. A failed portfolio
  // read keeps all of them (see gallerySitemapSlugs).
  const galleryEntries: MetadataRoute.Sitemap = gallerySitemapSlugs(
    await getGalleryServiceSlugsWithExamples(),
    PORTFOLIO_SERVICE_SLUGS,
  ).flatMap((slug) => [
    {
      url: absoluteUrl(`/gallery/${slug}`),
      changeFrequency: "weekly",
      priority: 0.7,
      alternates: {
        languages: localizedLanguages(`/gallery/${slug}`, `/es/gallery/${slug}`),
      },
    },
    {
      url: absoluteUrl(`/es/gallery/${slug}`),
      changeFrequency: "weekly",
      priority: 0.7,
      alternates: {
        languages: localizedLanguages(`/gallery/${slug}`, `/es/gallery/${slug}`),
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

  return [
    ...localizedEntries,
    ...galleryEntries,
    ...marketingEntries,
    ...blogArticleEntries,
  ];
}
