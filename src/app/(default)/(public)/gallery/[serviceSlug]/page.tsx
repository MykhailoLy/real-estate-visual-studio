import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import ClientPortalLink from "@/components/dashboard/ClientPortalLink";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Container from "@/components/layout/Container";
import JsonLd from "@/components/seo/JsonLd";
import FilteredGalleryResults, {
  type GalleryResultItem,
} from "@/components/gallery/FilteredGalleryResults";
import {
  PORTFOLIO_SERVICE_SLUGS,
  getGalleryItemsForService,
  getPortfolioPublicUrl,
  getPortfolioService,
  isPortfolioServiceSlug,
} from "@/lib/portfolio";
import {
  GALLERY_SERVICE_INTROS,
  GALLERY_FILTER_ALL_LABEL,
  galleryServiceMetaDescription,
  getGalleryPairLabels,
  getGalleryFilterOptions,
} from "@/lib/gallery";
import { absoluteUrl } from "@/lib/seo";
import { getBeforeAfterAlt } from "@/lib/before-after-alt";

// ============================================================
// /gallery/[serviceSlug]  —  Service gallery detail page (EN)
//
// One Before/After example per row, each pair spanning nearly the
// full viewport width inside a wide container. Optional client-
// side category filter for services that support it. No service
// pills, no captions — focus is the visual comparison.
//
// All 10 valid slugs are pre-rendered (generateStaticParams).
// Invalid slugs return notFound(). When Supabase is unconfigured
// (sandbox build) the page renders a clean empty state.
// ============================================================

export function generateStaticParams() {
  return PORTFOLIO_SERVICE_SLUGS.map((slug) => ({ serviceSlug: slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ serviceSlug: string }>;
}): Promise<Metadata> {
  const { serviceSlug } = await params;
  if (!isPortfolioServiceSlug(serviceSlug)) return {};
  const service = getPortfolioService(serviceSlug);
  const enUrl = absoluteUrl(`/gallery/${serviceSlug}`);
  const esUrl = absoluteUrl(`/es/gallery/${serviceSlug}`);
  return {
    title: `${service.label} Gallery`,
    description: galleryServiceMetaDescription(service.label),
    // Canonical is the clean gallery URL — filter query params never
    // produce a separate canonical.
    alternates: {
      canonical: enUrl,
      languages: {
        en: enUrl,
        "en-US": enUrl,
        es: esUrl,
        "es-ES": esUrl,
        "x-default": enUrl,
      },
    },
  };
}

export default async function GalleryServicePage({
  params,
}: {
  params: Promise<{ serviceSlug: string }>;
}) {
  const { serviceSlug } = await params;
  if (!isPortfolioServiceSlug(serviceSlug)) notFound();

  const service = getPortfolioService(serviceSlug);
  const items = await getGalleryItemsForService(serviceSlug);

  // BreadcrumbList JSON-LD (kept for SEO; visible nav is the
  // prominent "Back to Gallery" control below).
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Gallery", item: absoluteUrl("/gallery") },
      { "@type": "ListItem", position: 3, name: service.label, item: absoluteUrl(`/gallery/${serviceSlug}`) },
    ],
  };

  // Build serializable result items (both images must resolve).
  const resultItems: GalleryResultItem[] = items
    .map<GalleryResultItem | null>((item) => {
      const beforeUrl = getPortfolioPublicUrl(item.before_image_path);
      const afterUrl = getPortfolioPublicUrl(item.after_image_path);
      if (!beforeUrl || !afterUrl) return null;
      const alt = getBeforeAfterAlt({
        beforeAlt: item.before_alt,
        afterAlt: item.after_alt,
        title: item.title,
        description: item.description,
        serviceLabel: service.label,
        serviceSlug,
      });
      return {
        id: item.id,
        beforeUrl,
        afterUrl,
        beforeAlt: alt.beforeAlt,
        afterAlt: alt.afterAlt,
        galleryFilter: item.gallery_filter,
      };
    })
    .filter((x): x is GalleryResultItem => x !== null);

  const pairLabels = getGalleryPairLabels(serviceSlug, "en");
  const filterOptions = (getGalleryFilterOptions(serviceSlug) ?? []).map(
    (o) => ({ value: o.value, label: o.labelEn }),
  );

  const hasItems = resultItems.length > 0;

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />

      {/* ── Main content — wide container ─────────────────── */}
      <section className="bg-white py-8 lg:py-12">
        <div className="mx-auto max-w-[1720px] px-4 sm:px-6 lg:px-10">
          {/* Back to Gallery (top) */}
          <Link
            href="/gallery"
            className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-primary-light transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded mb-6 lg:mb-8"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden />
            Back to Gallery
          </Link>

          {hasItems ? (
            <>
              <FilteredGalleryResults
                serviceSlug={serviceSlug}
                language="en"
                items={resultItems}
                eyebrow="Gallery"
                title={`${service.label} Gallery`}
                intro={GALLERY_SERVICE_INTROS[serviceSlug]}
                beforeLabel={pairLabels.before}
                afterLabel={pairLabels.after}
                filterOptions={filterOptions}
                allLabel={GALLERY_FILTER_ALL_LABEL.en}
                filterLabel="Filter"
              />

              {/* Back to Gallery (after the last example) */}
              <div className="mt-12 lg:mt-16">
                <Link
                  href="/gallery"
                  className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-primary-light transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                >
                  <ArrowLeft className="w-4 h-4" aria-hidden />
                  Back to Gallery
                </Link>
              </div>
            </>
          ) : (
            /* ── Empty state ─────────────────────────────── */
            <div className="max-w-3xl">
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
                Gallery
              </p>
              <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-primary tracking-tight leading-[1.05] mb-4">
                {service.label} Gallery
              </h1>
              <p className="text-base lg:text-lg text-muted leading-relaxed mb-8">
                {service.label} gallery examples will appear here once
                published. Contact us to request samples or get a quote.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href={service.pricingHref}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary-light transition-colors text-sm"
                >
                  View Pricing
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 px-6 py-3 border border-border text-primary font-bold rounded-lg hover:border-primary/40 hover:bg-surface transition-colors text-sm"
                >
                  Contact Us
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────── */}
      <section className="bg-primary text-white">
        <Container className="py-12 lg:py-16">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 lg:gap-10">
            <div className="lg:max-w-2xl">
              <h2 className="text-2xl lg:text-3xl font-bold leading-tight mb-2">
                Ready to order {service.label}?
              </h2>
              <p className="text-base text-white/75 leading-relaxed">
                Upload your photos and receive market-ready results in 24–48
                hours.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:flex-shrink-0">
              <Link
                href={service.pricingHref}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary font-bold rounded-lg hover:bg-stone-50 transition-colors text-sm shadow-sm"
              >
                View Pricing
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <ClientPortalLink
                href="/dashboard/orders/new"
                className="inline-flex items-center px-6 py-3 border border-white/30 text-white font-bold rounded-lg hover:border-white/60 hover:bg-white/10 transition-colors text-sm"
              >
                Order Online
              </ClientPortalLink>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
