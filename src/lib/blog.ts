import type { ComponentType } from "react";

export type BlogArticleStatus = "draft" | "published";

export interface BlogArticleImage {
  src: `/${string}`;
  alt: string;
  width: number;
  height: number;
}

export interface BlogArticle {
  slug: string;
  title: string;
  description: string;
  publishedDate: string;
  updatedDate?: string;
  category: string;
  readingTimeMinutes: number;
  author: string;
  primaryService: {
    name: string;
    href: string;
  };
  canonicalPath: `/blog/${string}`;
  image?: BlogArticleImage;
  status: BlogArticleStatus;
  Content: ComponentType;
}

// Keep article metadata and publication state in one place. A future post
// becomes public only after its content component is registered here with
// status: "published"; drafts never reach the index, sitemap, or static params.
const blogArticles: readonly BlogArticle[] = [];

export function getPublishedBlogArticles(): BlogArticle[] {
  return blogArticles
    .filter((article) => article.status === "published")
    .toSorted((a, b) => b.publishedDate.localeCompare(a.publishedDate));
}

export function getPublishedBlogArticle(
  slug: string,
): BlogArticle | undefined {
  return getPublishedBlogArticles().find((article) => article.slug === slug);
}
