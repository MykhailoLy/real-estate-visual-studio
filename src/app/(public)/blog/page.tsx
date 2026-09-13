import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock } from "lucide-react";
import Container from "@/components/layout/Container";
import JsonLd from "@/components/seo/JsonLd";
import { getPublishedBlogArticles } from "@/lib/blog";
import { absoluteUrl, SITE_NAME, SOCIAL_IMAGE } from "@/lib/seo";
import {
  breadcrumbSchema,
  collectionPageSchema,
} from "@/lib/structured-data";

const BLOG_TITLE = "Real Estate Visual Marketing Blog | PicchuSpot";
const BLOG_DESCRIPTION =
  "Practical insights on virtual staging, real estate photo editing, floor plans, property marketing visuals, and presenting listings more effectively.";
const BLOG_URL = absoluteUrl("/blog");

export const metadata: Metadata = {
  title: { absolute: BLOG_TITLE },
  description: BLOG_DESCRIPTION,
  alternates: {
    canonical: BLOG_URL,
  },
  openGraph: {
    type: "website",
    url: BLOG_URL,
    siteName: SITE_NAME,
    title: BLOG_TITLE,
    description: BLOG_DESCRIPTION,
    locale: "en_US",
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: BLOG_TITLE,
    description: BLOG_DESCRIPTION,
    images: [SOCIAL_IMAGE.url],
  },
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "long",
  timeZone: "UTC",
});

function formatDate(date: string): string {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}

export default function BlogPage() {
  const articles = getPublishedBlogArticles();
  const [featuredArticle, ...remainingArticles] = articles;

  return (
    <>
      <JsonLd
        data={[
          collectionPageSchema({
            name: BLOG_TITLE,
            description: BLOG_DESCRIPTION,
            url: BLOG_URL,
          }),
          breadcrumbSchema([
            { name: "Home", item: absoluteUrl("/") },
            { name: "Blog" },
          ]),
        ]}
      />

      <section className="border-b border-border bg-white">
        <Container className="py-8">
          <div className="max-w-4xl">
            <p className="mb-4 text-public-kicker font-bold uppercase text-secondary-dark">
              PicchuSpot Blog
            </p>
            <h1 className="mb-5 text-4xl font-bold leading-[1.05] tracking-tight text-primary lg:text-5xl">
              Real Estate Visual Marketing Insights
            </h1>
            <p className="max-w-3xl text-base leading-relaxed text-muted lg:text-public-lead">
              Practical guidance on virtual staging, real estate photography
              and editing, floor plans, property marketing visuals, and the
              decisions that help listings present more effectively.
            </p>
          </div>
        </Container>
      </section>

      <section
        className="bg-dashboard-canvas py-8"
        aria-labelledby="latest-insights"
      >
        <Container>
          <h2
            id="latest-insights"
            className="mb-6 text-2xl font-bold tracking-tight text-primary lg:text-3xl"
          >
            Latest insights
          </h2>

          {featuredArticle ? (
            <>
              <article className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
                <div
                  className={
                    featuredArticle.image
                      ? "grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.78fr)]"
                      : undefined
                  }
                >
                  {featuredArticle.image ? (
                    <div className="flex min-w-0 items-center overflow-hidden bg-surface lg:order-2 lg:border-l lg:border-secondary/70">
                      <Image
                        src={featuredArticle.image.src}
                        alt={featuredArticle.image.alt}
                        width={featuredArticle.image.width}
                        height={featuredArticle.image.height}
                        sizes="(max-width: 1023px) calc(100vw - 2rem), 64vw"
                        preload
                        className="h-auto w-full"
                      />
                    </div>
                  ) : null}

                  <div className="flex flex-col justify-center p-6 sm:p-7 lg:order-1 xl:p-8">
                    <div>
                      <span className="inline-flex rounded-full bg-secondary/20 px-3 py-1 text-xs font-bold text-secondary-dark">
                        {featuredArticle.category}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-muted">
                      <time dateTime={featuredArticle.publishedDate}>
                        {formatDate(featuredArticle.publishedDate)}
                      </time>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-4 w-4" aria-hidden />
                        {featuredArticle.readingTimeMinutes} min read
                      </span>
                    </div>
                    <h3 className="mt-4 text-2xl font-bold leading-tight tracking-tight text-primary lg:text-[1.75rem]">
                      <Link
                        href={featuredArticle.canonicalPath}
                        className="rounded-sm hover:text-primary-light focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {featuredArticle.title}
                      </Link>
                    </h3>
                    <p className="mt-3 text-base leading-relaxed text-muted">
                      {featuredArticle.description}
                    </p>
                    <Link
                      href={featuredArticle.canonicalPath}
                      className="group mt-5 inline-flex w-fit items-center gap-2 rounded-sm text-sm font-bold text-secondary-dark hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      Read article
                      <ArrowRight
                        className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </Link>
                  </div>
                </div>
              </article>

              {remainingArticles.length > 0 ? (
                <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
                  {remainingArticles.map((article) => (
                    <article
                      key={article.slug}
                      className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm"
                    >
                      {article.image ? (
                        <div className="relative aspect-[16/9] overflow-hidden bg-surface">
                          <Image
                            src={article.image.src}
                            alt={article.image.alt}
                            width={article.image.width}
                            height={article.image.height}
                            sizes="(max-width: 767px) calc(100vw - 2rem), 50vw"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : null}
                      <div className="flex flex-1 flex-col p-6">
                        <div>
                          <span className="inline-flex rounded-full bg-secondary/20 px-3 py-1 text-xs font-bold text-secondary-dark">
                            {article.category}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-muted">
                          <time dateTime={article.publishedDate}>
                            {formatDate(article.publishedDate)}
                          </time>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-4 w-4" aria-hidden />
                            {article.readingTimeMinutes} min read
                          </span>
                        </div>
                        <h3 className="mt-4 text-xl font-bold leading-snug text-primary">
                          <Link
                            href={article.canonicalPath}
                            className="rounded-sm hover:text-primary-light focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            {article.title}
                          </Link>
                        </h3>
                        <p className="mt-3 flex-1 text-base leading-relaxed text-muted">
                          {article.description}
                        </p>
                        <Link
                          href={article.canonicalPath}
                          className="group mt-6 inline-flex w-fit items-center gap-2 rounded-sm text-sm font-bold text-secondary-dark hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          Read article
                          <ArrowRight
                            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                            aria-hidden
                          />
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="max-w-3xl rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8 lg:p-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white">
                <BookOpen className="h-6 w-6" aria-hidden />
              </div>
              <h3 className="mt-6 text-2xl font-bold text-primary">
                Insights coming soon
              </h3>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
                We are preparing carefully researched, practical resources for
                real estate professionals. Until then, explore our services and
                real project examples.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-light focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  Explore services
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/gallery"
                  className="inline-flex items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-bold text-primary transition-colors hover:border-primary/40 hover:bg-surface focus-visible:ring-2 focus-visible:ring-primary"
                >
                  View gallery
                </Link>
              </div>
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
