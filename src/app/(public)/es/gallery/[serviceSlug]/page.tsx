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
  getFeaturedHomeItems,
  getPortfolioPublicUrl,
  getPortfolioService,
  isPortfolioServiceSlug,
} from "@/lib/portfolio";
import {
  GALLERY_SERVICE_INTROS_ES,
  GALLERY_LABELS_ES,
  galleryServiceMetaDescriptionEs,
} from "@/lib/gallery";
import { absoluteUrl } from "@/lib/seo";
import { getSpanishPath } from "@/lib/localized-routes";

// ============================================================
// /es/gallery/[serviceSlug]  —  Service gallery detail page (ES)
//
// Mirror of /gallery/[serviceSlug] with Spanish copy throughout.
// Same data source (portfolio_items), same slug list.
// Pricing CTA links to the localised ES pricing page.
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

  const labelEs = GALLERY_LABELS_ES[serviceSlug];
  const enUrl = absoluteUrl(`/gallery/${serviceSlug}`);
  const esUrl = absoluteUrl(`/es/gallery/${serviceSlug}`);
  return {
    title: `${labelEs} — Galería`,
    description: galleryServiceMetaDescriptionEs(labelEs),
    alternates: {
      canonical: esUrl,
      languages: {
        en: enUrl,
        "en-US": enUrl,
        es: esUrl,
        "es-ES": esUrl,
        "x-default": enUrl,
      },
    },
    openGraph: {
      title: `${labelEs} — Galería`,
      description: galleryServiceMetaDescriptionEs(labelEs),
      url: esUrl,
      locale: "es_ES",
      alternateLocale: ["en_US"],
    },
  };
}

export default async function SpanishGalleryServicePage({
  params,
}: {
  params: Promise<{ serviceSlug: string }>;
}) {
  const { serviceSlug } = await params;
  if (!isPortfolioServiceSlug(serviceSlug)) notFound();

  const service = getPortfolioService(serviceSlug);
  const labelEs = GALLERY_LABELS_ES[serviceSlug];
  const [items, featuredItems] = await Promise.all([
    getPublishedItemsForService(serviceSlug),
    getFeaturedHomeItems(),
  ]);

  // Resolve ES pricing href (fall back to EN href if not mapped)
  const esPricingHref =
    getSpanishPath(service.pricingHref as never) ?? service.pricingHref;

  // BreadcrumbList JSON-LD (Spanish labels, canonical ES URLs)
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: absoluteUrl("/es") },
      { "@type": "ListItem", position: 2, name: "Galería", item: absoluteUrl("/es/gallery") },
      { "@type": "ListItem", position: 3, name: labelEs, item: absoluteUrl(`/es/gallery/${serviceSlug}`) },
    ],
  };

  // Service nav — only published services, plus always include current service.
  const navServices = PORTFOLIO_SERVICES.filter(
    (svc) => featuredItems.has(svc.slug) || svc.slug === serviceSlug,
  ).map((svc) => ({
    slug: svc.slug,
    label: GALLERY_LABELS_ES[svc.slug],
    href: `/es/gallery/${svc.slug}`,
  }));

  // Only pairs where both images are available
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
            aria-label="Ruta de navegación"
            className="flex items-center gap-1.5 text-xs text-muted flex-wrap"
          >
            <Link
              href="/es/gallery"
              className="hover:text-primary transition-colors font-medium"
            >
              Galería
            </Link>
            <ChevronRight className="w-3 h-3 flex-shrink-0" aria-hidden />
            <span className="text-foreground font-semibold" aria-current="page">
              {labelEs}
            </span>
          </nav>
        </Container>
      </div>

      {/* ── Service intro ─────────────────────────────────── */}
      <section className="bg-white border-b border-border">
        <Container className="py-10 lg:py-14">
          <div className="max-w-3xl mb-8">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
              Galería
            </p>
            <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-primary tracking-tight leading-[1.05] mb-4">
              Galería de {labelEs}
            </h1>
            <p className="text-base lg:text-lg text-muted leading-relaxed">
              {GALLERY_SERVICE_INTROS_ES[serviceSlug]}
            </p>
          </div>
          <GalleryServiceNav
            services={navServices}
            currentSlug={serviceSlug}
            eyebrow="Ver servicios"
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
                  beforeAlt={item.before_alt ?? `${item.title} — antes`}
                  afterAlt={item.after_alt ?? `${item.title} — después`}
                  title={item.title}
                  description={item.description}
                  beforeLabel="Antes"
                  afterLabel="Después"
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
                Los ejemplos de {labelEs} aparecerán aquí cuando se publiquen.
                Contacta con nosotros para solicitar muestras o pedir un
                presupuesto.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href={esPricingHref}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary-light transition-colors text-sm"
                >
                  Ver precios
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </Link>
                <Link
                  href="/es/contact"
                  className="inline-flex items-center gap-2 px-6 py-3 border border-border text-primary font-bold rounded-lg hover:border-primary/40 hover:bg-surface transition-colors text-sm"
                >
                  Contactar
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
                ¿Listo para pedir {labelEs}?
              </h2>
              <p className="text-base text-white/75 leading-relaxed">
                Sube tus fotos y recibe resultados listos para publicar en
                24–48 horas.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:flex-shrink-0">
              <Link
                href={esPricingHref}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary font-bold rounded-lg hover:bg-stone-50 transition-colors text-sm shadow-sm"
              >
                Ver precios
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <Link
                href="/order"
                className="inline-flex items-center px-6 py-3 border border-white/30 text-white font-bold rounded-lg hover:border-white/60 hover:bg-white/10 transition-colors text-sm"
              >
                Pedir online
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
