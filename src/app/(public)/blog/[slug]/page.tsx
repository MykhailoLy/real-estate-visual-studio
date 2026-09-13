import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { notFound } from "next/navigation";
import Container from "@/components/layout/Container";
import JsonLd from "@/components/seo/JsonLd";
import {
  getPublishedBlogArticle,
  getPublishedBlogArticles,
} from "@/lib/blog";
import { absoluteUrl, SITE_NAME, SOCIAL_IMAGE } from "@/lib/seo";
import {
  blogPostingSchema,
  breadcrumbSchema,
} from "@/lib/structured-data";

export const dynamicParams = false;

export function generateStaticParams() {
  return getPublishedBlogArticles().map((article) => ({
    slug: article.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getPublishedBlogArticle(slug);
  if (!article) return {};

  const url = absoluteUrl(article.canonicalPath);
  const image = article.image
    ? {
        url: absoluteUrl(article.image.src),
        width: article.image.width,
        height: article.image.height,
        alt: article.image.alt,
      }
    : SOCIAL_IMAGE;

  return {
    title: article.title,
    description: article.description,
    authors: [{ name: article.author }],
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "article",
      url,
      siteName: SITE_NAME,
      title: article.title,
      description: article.description,
      publishedTime: article.publishedDate,
      modifiedTime: article.updatedDate ?? article.publishedDate,
      authors: [article.author],
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
      images: [image.url],
    },
  };
}

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "long",
  timeZone: "UTC",
});

function formatDate(date: string): string {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getPublishedBlogArticle(slug);
  if (!article) notFound();

  const canonicalUrl = absoluteUrl(article.canonicalPath);
  const Content = article.Content;

  return (
    <>
      <JsonLd
        data={[
          blogPostingSchema({
            headline: article.title,
            description: article.description,
            url: canonicalUrl,
            datePublished: article.publishedDate,
            dateModified: article.updatedDate,
            author: article.author,
            image: article.image
              ? {
                  url: absoluteUrl(article.image.src),
                  width: article.image.width,
                  height: article.image.height,
                  alt: article.image.alt,
                }
              : undefined,
          }),
          breadcrumbSchema([
            { name: "Home", item: absoluteUrl("/") },
            { name: "Blog", item: absoluteUrl("/blog") },
            { name: article.title },
          ]),
        ]}
      />

      <article className="bg-white">
        <Container className="py-10 lg:py-16">
          <div className="mx-auto max-w-4xl">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 rounded-sm text-sm font-bold text-primary hover:text-primary-light focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to Blog
            </Link>

            <header className="mt-8">
              <p className="text-public-kicker font-bold uppercase text-secondary-dark">
                {article.category}
              </p>
              <h1 className="mt-4 text-4xl font-bold leading-[1.05] tracking-tight text-primary lg:text-5xl">
                {article.title}
              </h1>
              <p className="mt-5 text-public-lead text-muted">
                {article.description}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-border py-4 text-sm font-semibold text-muted">
                <span>By {article.author}</span>
                <time dateTime={article.publishedDate}>
                  Published {formatDate(article.publishedDate)}
                </time>
                {article.updatedDate ? (
                  <time dateTime={article.updatedDate}>
                    Updated {formatDate(article.updatedDate)}
                  </time>
                ) : null}
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" aria-hidden />
                  {article.readingTimeMinutes} min read
                </span>
              </div>
            </header>

            {article.image ? (
              <Image
                src={article.image.src}
                alt={article.image.alt}
                width={article.image.width}
                height={article.image.height}
                className="mt-10 h-auto w-full rounded-2xl border border-border"
              />
            ) : null}

            <div className="mt-10 space-y-6 text-base leading-8 text-foreground/80 lg:text-lg">
              <Content />
            </div>

            <aside className="mt-12 rounded-2xl bg-primary p-6 text-white sm:p-8">
              <p className="text-public-kicker font-bold uppercase text-secondary">
                Related service
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                {article.primaryService.name}
              </h2>
              <Link
                href={article.primaryService.href}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-secondary px-5 py-3 text-sm font-bold text-primary transition-colors hover:bg-secondary-light focus-visible:ring-2 focus-visible:ring-white"
              >
                Explore this service
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </aside>
          </div>
        </Container>
      </article>
    </>
  );
}
