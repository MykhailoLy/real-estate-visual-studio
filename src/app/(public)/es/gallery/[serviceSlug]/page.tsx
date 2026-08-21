import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
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
  GALLERY_SERVICE_INTROS_ES,
  GALLERY_LABELS_ES,
  GALLERY_FILTER_ALL_LABEL,
  galleryServiceMetaDescriptionEs,
  getGalleryPairLabels,
  getGalleryFilterOptions,
} from "@/lib/gallery";
import { absoluteUrl } from "@/lib/seo";
import { getSpanishPath } from "@/lib/localized-routes";
import { getBeforeAfterAlt } from "@/lib/before-after-alt";

// ============================================================
// /es/gallery/[serviceSlug]  —  Service gallery detail page (ES)
//
// Mirror of /gallery/[serviceSlug] with Spanish copy throughout.
// Same data source, same layout (one full-width example per row,
// optional client-side filter). Pricing CTA links to the ES page.
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
    // Canonical is the clean ES gallery URL — filter query never
    // produces a separate canonical.
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
  const items = await getGalleryItemsForService(serviceSlug);

  // Resolve ES pricing href (fall back to EN href if not mapped).
  const esPricingHref =
    getSpanishPath(service.pricingHref as never) ?? service.pricingHref;

  // BreadcrumbList JSON-LD (Spanish labels, canonical ES URLs).
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: absoluteUrl("/es") },
      { "@type": "ListItem", position: 2, name: "Galería", item: absoluteUrl("/es/gallery") },
      { "@type": "ListItem", position: 3, name: labelEs, item: absoluteUrl(`/es/gallery/${serviceSlug}`) },
    ],
  };

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
        serviceLabel: labelEs,
        serviceSlug,
        locale: "es",
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

  const pairLabels = getGalleryPairLabels(serviceSlug, "es");
  const filterOptions = (getGalleryFilterOptions(serviceSlug) ?? []).map(
    (o) => ({ value: o.value, label: o.labelEs }),
  );

  const hasItems = resultItems.length > 0;

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />

      {/* ── Main content — wide container ─────────────────── */}
      <section className="bg-white py-8 lg:py-12">
        <div className="mx-auto max-w-[1720px] px-4 sm:px-6 lg:px-10">
          {/* Volver a la galería (arriba) */}
          <Link
            href="/es/gallery"
            className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-primary-light transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded mb-6 lg:mb-8"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden />
            Volver a la galería
          </Link>

          {hasItems ? (
            <>
              <FilteredGalleryResults
                serviceSlug={serviceSlug}
                language="es"
                items={resultItems}
                eyebrow="Galería"
                title={`Galería de ${labelEs}`}
                intro={GALLERY_SERVICE_INTROS_ES[serviceSlug]}
                beforeLabel={pairLabels.before}
                afterLabel={pairLabels.after}
                filterOptions={filterOptions}
                allLabel={GALLERY_FILTER_ALL_LABEL.es}
                filterLabel="Filtrar"
              />

              {/* Volver a la galería (tras el último ejemplo) */}
              <div className="mt-12 lg:mt-16">
                <Link
                  href="/es/gallery"
                  className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-primary-light transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                >
                  <ArrowLeft className="w-4 h-4" aria-hidden />
                  Volver a la galería
                </Link>
              </div>
            </>
          ) : (
            /* ── Empty state ─────────────────────────────── */
            <div className="max-w-3xl">
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
                Galería
              </p>
              <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-primary tracking-tight leading-[1.05] mb-4">
                Galería de {labelEs}
              </h1>
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
          )}
        </div>
      </section>

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
