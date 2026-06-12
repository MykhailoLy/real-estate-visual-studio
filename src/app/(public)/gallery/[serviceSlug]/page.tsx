import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import Container from "@/components/layout/Container";
import JsonLd from "@/components/seo/JsonLd";
import GalleryBeforeAfterPair from "@/components/gallery/GalleryBeforeAfterPair";
import GalleryServiceNav from "@/components/gallery/GalleryServiceNav";
import {
  PORTFOLIO_SERVICES,
  PORTFOLIO_SERVICE_SLUGS,
  getPublishedItemsForService,
  getPortfolioPublicUrl,
  getPortfolioService,
  isPortfolioServiceSlug,
} from "@/lib/portfolio";
import {
  GALLERY_SERVICE_INTROS,
  galleryServiceMetaDescription,
} from "@/lib/gallery";
import { absoluteUrl } from "@/lib/seo";

// ============================================================
// /gallery/[serviceSlug]  —  Service gallery detail page (EN)
//
// All 10 valid portfolio service slugs are pre-rendered at
// build time via generateStaticParams. Invalid slugs return
// notFound(). Items are fetched from Supabase; if Supabase is
// not configured (build/sandbox) the page renders an empty
// state rather than crashing.
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
  const items = await getPublishedItemsForService(serviceSlug);

  // BreadcrumbList JSON-LD
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Gallery", item: absoluteUrl("/gallery") },
      { "@type": "ListItem", position: 3, name: service.label, item: absoluteUrl(`/gallery/${serviceSlug}`) },
    ],
  };

  // Service nav items — all services link to their EN gallery page
  const navServices = PORTFOLIO_SERVICES.map((svc) => ({
    slug: svc.slug,
    label: svc.label,
    href: `/gallery/${svc.slug}`,
  }));

  // Pairs where both images are resolvable
  const renderablePairs = items.filter((item) => {
    const before = getPortfolioPublicUrl(item.before_image_path);
    const after = getPortfolioPublicUrl(item.after_image_path);
    return before !== null && after !== null;
  });

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />

      {/* ── Breadcrumb strip ──────────────────────────────── */}
      <div className="bg-stone-50 border-b border-border">
        <Container className="py-3">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-xs text-muted flex-wrap"
          >
            <Link
              href="/gallery"
              className="hover:text-primary transition-colors font-medium"
            >
              Gallery
            </Link>
            <ChevronRight className="w-3 h-3 flex-shrink-0" aria-hidden />
            <span className="text-foreground font-semibold" aria-current="page">
              {service.label}
            </span>
          </nav>
        </Container>
      </div>

      {/* ── Service intro ─────────────────────────────────── */}
      <section className="bg-white border-b border-border">
        <Container className="py-10 lg:py-14">
          <div className="max-w-3xl mb-8">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
              Gallery
            </p>
            <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-primary tracking-tight leading-[1.05] mb-4">
              {service.label} Gallery
            </h1>
            <p className="text-base lg:text-lg text-muted leading-relaxed">
              {GALLERY_SERVICE_INTROS[serviceSlug]}
            </p>
          </div>
          <GalleryServiceNav
            services={navServices}
            currentSlug={serviceSlug}
            eyebrow="Browse services"
          />
        </Container>
      </section>

      {/* ── Portfolio items ───────────────────────────────── */}
      {renderablePairs.length > 0 ? (
        <section className="bg-stone-50 py-12 lg:py-16">
          <Container>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 xl:gap-12">
              {renderablePairs.map((item, index) => (
                <GalleryBeforeAfterPair
                  key={item.id}
                  beforeUrl={getPortfolioPublicUrl(item.before_image_path)}
                  afterUrl={getPortfolioPublicUrl(item.after_image_path)}
                  beforeAlt={item.before_alt ?? `${item.title} — before`}
                  afterAlt={item.after_alt ?? `${item.title} — after`}
                  title={item.title}
                  description={item.description}
                  loading={index === 0 ? "eager" : "lazy"}
                />
              ))}
            </div>
          </Container>
        </section>
      ) : (
        /* ── Empty state ─────────────────────────────────── */
        <section className="bg-white py-16 lg:py-24">
          <Container>
            <div className="max-w-2xl">
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
          </Container>
        </section>
      )}

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
              <Link
                href="/order"
                className="inline-flex items-center px-6 py-3 border border-white/30 text-white font-bold rounded-lg hover:border-white/60 hover:bg-white/10 transition-colors text-sm"
              >
                Order Online
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
