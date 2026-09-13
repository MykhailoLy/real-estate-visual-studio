import type { ComponentType } from "react";
import VirtualStagingCostArticle from "@/components/blog/VirtualStagingCostArticle";

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
  metadataTitle?: string;
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
const blogArticles: readonly BlogArticle[] = [
  {
    slug: "virtual-staging-cost",
    title: "How Much Does Virtual Staging Cost in 2026?",
    metadataTitle: "How Much Does Virtual Staging Cost in 2026? | PicchuSpot",
    description:
      "Compare 2026 virtual staging prices, AI billing models, listing budgets and extra fees—with verified sources and clear PicchuSpot cost examples.",
    publishedDate: "2026-09-13",
    category: "Virtual Staging",
    readingTimeMinutes: 12,
    author: "Mykhailo Lykin",
    primaryService: {
      name: "Virtual Staging",
      href: "/pricing/virtual-staging",
    },
    canonicalPath: "/blog/virtual-staging-cost",
    status: "published",
    Content: VirtualStagingCostArticle,
  },
];

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
