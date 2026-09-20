import type { Metadata } from "next";
import Link from "next/link";
import ClientPortalLink from "@/components/dashboard/ClientPortalLink";
import { ArrowRight } from "lucide-react";
import Container from "@/components/layout/Container";
import GalleryCategoryCard from "@/components/gallery/GalleryCategoryCard";
import {
  PORTFOLIO_SERVICES,
  getGalleryCoverItems,
  getPortfolioPublicUrl,
} from "@/lib/portfolio";
import {
  GALLERY_CARD_DESCRIPTIONS_ES,
  GALLERY_LABELS_ES,
} from "@/lib/gallery";
import { spanishMetadata } from "../seo";
import { getBeforeAfterAlt } from "@/lib/before-after-alt";

// ============================================================
// /es/gallery  —  Gallery landing page (ES)
//
// Same structure as /gallery. Spanish copy throughout.
// Uses gallery-enabled items (published AND show_in_gallery)
// per service to populate category cards.
// ============================================================

export const metadata: Metadata = spanishMetadata({
  title: "Galería",
  description:
    "Explora ejemplos reales de trabajos de visualización inmobiliaria de PicchuSpot: Virtual Staging, renovación virtual, planos, edición fotográfica y más.",
  path: "/es/gallery",
  englishPath: "/gallery",
});

export default async function SpanishGalleryPage() {
  const featuredItems = await getGalleryCoverItems();

  const visibleServices = PORTFOLIO_SERVICES.filter((svc) =>
    featuredItems.has(svc.slug)
  );

  return (
    <>
      {/* ── Hero / intro ──────────────────────────────────── */}
      <section className="bg-white border-b border-border">
        <Container className="py-14 lg:py-20">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-4">
              Galería
            </p>
            <h1 className="text-4xl lg:text-5xl font-bold text-primary tracking-tight leading-[1.05] mb-5">
              Galería
            </h1>
            <p className="text-base lg:text-lg text-muted leading-relaxed max-w-2xl">
              Ejemplos reales antes y después del trabajo visual inmobiliario
              de PicchuSpot. Selecciona una categoría de servicio para ver los
              ejemplos publicados.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Category grid ─────────────────────────────────── */}
      {visibleServices.length > 0 ? (
        <section className="bg-stone-50 py-12 lg:py-16">
          <Container>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
              {visibleServices.map((svc) => {
                const item = featuredItems.get(svc.slug)!;
                const imageUrl = getPortfolioPublicUrl(item.after_image_path);
                const alt = getBeforeAfterAlt({
                  beforeAlt: item.before_alt,
                  afterAlt: item.after_alt,
                  title: item.title,
                  description: item.description,
                  serviceLabel: GALLERY_LABELS_ES[svc.slug],
                  serviceSlug: svc.slug,
                  locale: "es",
                });
                return (
                  <GalleryCategoryCard
                    key={svc.slug}
                    href={`/es/gallery/${svc.slug}`}
                    imageUrl={imageUrl}
                    imageAlt={alt.afterAlt}
                    title={GALLERY_LABELS_ES[svc.slug]}
                    description={GALLERY_CARD_DESCRIPTIONS_ES[svc.slug]}
                  />
                );
              })}
            </div>
          </Container>
        </section>
      ) : (
        /* ── Empty state ─────────────────────────────────── */
        <section className="bg-white py-16 lg:py-24">
          <Container>
            <div className="max-w-2xl">
              <p className="text-base lg:text-lg text-muted leading-relaxed mb-8">
                Los ejemplos de la galería se publican a través del flujo de
                trabajo del administrador de PicchuSpot y aparecerán aquí
                cuando estén disponibles. Mientras tanto, explora nuestros
                servicios o contacta con nosotros para solicitar muestras.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/es/pricing"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary-light transition-colors text-sm"
                >
                  Ver servicios
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

      {/* ── Bottom CTA ────────────────────────────────────── */}
      <section className="bg-primary text-white">
        <Container className="py-12 lg:py-16">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 lg:gap-10">
            <div className="lg:max-w-2xl">
              <h2 className="text-2xl lg:text-3xl font-bold leading-tight mb-2">
                ¿Listo para preparar los visuales de tu anuncio?
              </h2>
              <p className="text-base text-white/75 leading-relaxed">
                Haz tu pedido online en minutos. Sube tus fotos y elige el
                servicio — entregamos en 24–48 horas.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:flex-shrink-0">
              <ClientPortalLink
                href="/dashboard/orders/new"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary font-bold rounded-lg hover:bg-stone-50 transition-colors text-sm shadow-sm"
              >
                Pedir online
                <ArrowRight className="w-4 h-4" aria-hidden />
              </ClientPortalLink>
              <Link
                href="/es/contact"
                className="inline-flex items-center px-6 py-3 border border-white/30 text-white font-bold rounded-lg hover:border-white/60 hover:bg-white/10 transition-colors text-sm"
              >
                Contactar
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
