import type { ComponentType } from "react";
import WhatIsVirtualStagingArticle from "@/components/blog/WhatIsVirtualStagingArticle";
import VirtualStagingCostArticle from "@/components/blog/VirtualStagingCostArticle";
import OutsourceRealEstatePhotoEditingArticle from "@/components/blog/OutsourceRealEstatePhotoEditingArticle";

export type BlogArticleStatus = "draft" | "published";

export interface BlogArticleImage {
  src: `/${string}`;
  alt: string;
  width: number;
  height: number;
  showInArticleHeader?: boolean;
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
    slug: "outsource-real-estate-photo-editing",
    title: "Outsourcing Real Estate Photo Editing: How to Test an Editor",
    metadataTitle: "Outsource Real Estate Photo Editing: A Test Checklist",
    description:
      "Choosing a real estate photo editor? Use a test brief and quality checklist to compare results, handle revisions, and see how much time you save.",
    publishedDate: "2026-09-21",
    category: "Photo Editing",
    readingTimeMinutes: 8,
    author: "Mykhailo Lykin",
    primaryService: {
      name: "Photo Editing",
      href: "/pricing/photo-editing",
    },
    canonicalPath: "/blog/outsource-real-estate-photo-editing",
    status: "published",
    Content: OutsourceRealEstatePhotoEditingArticle,
  },
  {
    slug: "what-is-virtual-staging",
    title: "What Is Virtual Staging? A Practical Guide for Real Estate Agents",
    metadataTitle: "What Is Virtual Staging? A Guide for Agents | PicchuSpot",
    description:
      "Learn what virtual staging changes, how it works, when to use it, and how to review realistic listing photos and check disclosure requirements.",
    publishedDate: "2026-09-15",
    category: "Virtual Staging",
    // 2,515 visible approved words / 200 wpm, rounded up; visual instructions excluded.
    readingTimeMinutes: 13,
    author: "Mykhailo Lykin",
    primaryService: {
      name: "Virtual Staging",
      href: "/pricing/virtual-staging",
    },
    canonicalPath: "/blog/what-is-virtual-staging",
    image: {
      src: "/images/blog/what-is-virtual-staging-office-after.jpg",
      alt: "Home office virtually staged with a desk, chairs, shelving and decor",
      width: 2400,
      height: 1600,
      showInArticleHeader: false,
    },
    status: "published",
    Content: WhatIsVirtualStagingArticle,
  },
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
    image: {
      src: "/brand/picchuspot-email-before-after-1200x450.jpg",
      alt: "Empty living room before virtual staging and the furnished result after virtual staging",
      width: 1200,
      height: 450,
      showInArticleHeader: false,
    },
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
