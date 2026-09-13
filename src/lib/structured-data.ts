// structured-data.ts — helpers for building schema.org JSON-LD objects.
//
// All functions return plain objects ready to be passed to <JsonLd data={...} />.
// Only facts that are visible on the site are included; no invented data.
//
// Usage:
//   import { serviceSchema, breadcrumbSchema } from "@/lib/structured-data";

import { SITE_URL } from "@/lib/seo";

const ORGANIZATION_LOGO_URL = `${SITE_URL}/brand/picchuspot-logo-800.png`;

// ── Shared provider reference ────────────────────────────────────────────────

const PROVIDER = {
  "@type": "Organization" as const,
  name: "PicchuSpot",
  url: SITE_URL,
};

// ── Site-level schemas ───────────────────────────────────────────────────────

/** Schema.org Organization — site-level, placed on the homepage. */
export function organizationSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "PicchuSpot",
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: ORGANIZATION_LOGO_URL,
      contentUrl: ORGANIZATION_LOGO_URL,
      width: 800,
      height: 600,
      caption: "PicchuSpot",
    },
    description:
      "Real estate visual services including virtual staging, virtual renovation, floor plans, photo editing, day-to-dusk, 360° image enhancement, aerial editing, and development site plans.",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "hello@picchuspot.com",
    },
  };
}

/** Schema.org WebSite — site-level, placed on the homepage. */
export function webSiteSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "PicchuSpot",
    url: SITE_URL,
    description:
      "Real estate visual services for agents, photographers, and property marketers.",
  };
}

interface CollectionPageSchemaInput {
  name: string;
  description: string;
  url: string;
}

/** Schema.org CollectionPage — used for editorial or resource hubs. */
export function collectionPageSchema({
  name,
  description,
  url,
}: CollectionPageSchemaInput): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url,
    isPartOf: {
      "@type": "WebSite",
      name: "PicchuSpot",
      url: SITE_URL,
    },
    publisher: PROVIDER,
  };
}

interface BlogPostingSchemaInput {
  headline: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  author: string;
  image?: {
    url: string;
    width: number;
    height: number;
    alt: string;
  };
}

/**
 * Schema.org BlogPosting — prepared for registered, published articles only.
 * Author data is limited to the name explicitly supplied by the article.
 */
export function blogPostingSchema({
  headline,
  description,
  url,
  datePublished,
  dateModified,
  author,
  image,
}: BlogPostingSchemaInput): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline,
    description,
    url,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    datePublished,
    dateModified: dateModified ?? datePublished,
    author: {
      "@type": "Person",
      name: author,
    },
    publisher: {
      ...PROVIDER,
      logo: {
        "@type": "ImageObject",
        url: ORGANIZATION_LOGO_URL,
      },
    },
    isPartOf: {
      "@type": "Blog",
      name: "PicchuSpot Blog",
      url: `${SITE_URL}/blog`,
    },
    ...(image
      ? {
          image: {
            "@type": "ImageObject",
            url: image.url,
            width: image.width,
            height: image.height,
            caption: image.alt,
          },
        }
      : {}),
  };
}

// ── Service schema ───────────────────────────────────────────────────────────

interface ServiceSchemaInput {
  name: string;
  description: string;
  /** Canonical URL for this service page */
  url: string;
  /** Fixed starting price (omit for quote-based services) */
  price?: string;
  /** ISO 4217 currency code — defaults to "USD" */
  priceCurrency?: string;
  /** Human-readable note for the offer (e.g. "Starting price per image") */
  offerNote?: string;
}

/**
 * Schema.org Service — used on each pricing detail page.
 * Only includes an `offers` node when a specific visible price exists.
 */
export function serviceSchema({
  name,
  description,
  url,
  price,
  priceCurrency = "USD",
  offerNote,
}: ServiceSchemaInput): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    description,
    url,
    provider: PROVIDER,
  };

  if (price !== undefined) {
    schema.offers = {
      "@type": "Offer",
      price,
      priceCurrency,
      ...(offerNote ? { description: offerNote } : {}),
    };
  }

  return schema;
}

// ── BreadcrumbList schema ────────────────────────────────────────────────────

interface BreadcrumbItem {
  name: string;
  /** Absolute URL for this crumb level (omit for the current/last crumb) */
  item?: string;
}

/**
 * Schema.org BreadcrumbList — used on pricing detail pages.
 *
 * Example EN:  Home → Pricing → Virtual Staging
 * Example ES:  Inicio → Precios → Virtual Staging
 */
export function breadcrumbSchema(
  items: BreadcrumbItem[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      ...(crumb.item ? { item: crumb.item } : {}),
    })),
  };
}

// ── FAQPage schema ───────────────────────────────────────────────────────────

interface FaqEntry {
  question: string;
  answer: string;
}

/**
 * Schema.org FAQPage — questions and answers must match the visible page content.
 */
export function faqPageSchema(faqs: FaqEntry[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}
