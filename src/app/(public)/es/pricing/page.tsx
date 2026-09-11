import { ArrowRight, Check } from "lucide-react";
import TrackedLink from "@/components/analytics/TrackedLink";
import Container from "@/components/layout/Container";
import CtaSection from "@/components/sections/CtaSection";
import { CatalogPriceText } from "@/components/pricing/currency-client";
import { spanishMetadata } from "../seo";
import {
  PUBLIC_TAX_NOTICE_ES,
  PUBLIC_VOLUME_DISCOUNTS_ES,
} from "@/lib/pricing/public";
import {
  formatLocalPricingRow,
  getLocalPricingPresentation,
  type LocalPricingServiceId,
} from "@/lib/pricing/local-catalog";
import type { SpanishLocalizedPath } from "@/lib/seo";
import type { PriceKey } from "@/lib/pricing/types";
import { WELCOME_OFFER_PUBLIC_COPY } from "@/lib/welcome-offer";

export const metadata = spanishMetadata({
  title: "Precios de servicios visuales inmobiliarios",
  description:
    "Precios claros para home staging virtual, renovación virtual, planos 2D/3D, retoque fotográfico y servicios locales en Alicante y Costa Blanca.",
  path: "/es/pricing",
  englishPath: "/pricing",
});

type PricingRow = {
  label: string;
  priceKey?: PriceKey;
  price?: string;
  unit?: string;
};

type ServiceLink = {
  label: string;
  href: SpanishLocalizedPath;
};

const digitalSections: Array<{
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  rows: PricingRow[];
  serviceLinks: ServiceLink[];
}> = [
  {
    id: "home-staging-virtual",
    title: "Home staging virtual",
    subtitle: "Precio base por imagen, con extras opcionales.",
    cta: "Pedir home staging",
    href: "/dashboard/orders/new/virtual-staging",
    serviceLinks: [
      {
        label: "Home staging virtual",
        href: "/es/pricing/virtual-staging",
      },
      {
        label: "Virtual Staging 360°",
        href: "/es/pricing/360-virtual-staging",
      },
    ],
    rows: [
      {
        label: "Home staging virtual",
        priceKey: "virtual-staging",
        unit: "por imagen",
      },
      {
        label: "Mejora de imagen",
        priceKey: "image-enhancement",
        unit: "extra opcional",
      },
      {
        label: "Día a atardecer",
        priceKey: "day-to-dusk",
        unit: "extra opcional",
      },
      {
        label: "Eliminación de objetos y limpieza virtual",
        priceKey: "item-removal-virtual-cleaning",
        unit: "extra opcional",
      },
    ],
  },
  {
    id: "renovacion-virtual",
    title: "Renovación virtual",
    subtitle: "Selecciona solo las opciones necesarias para cada imagen.",
    cta: "Pedir renovación virtual",
    href: "/dashboard/orders/new/virtual-renovation",
    serviceLinks: [
      {
        label: "Renovación virtual",
        href: "/es/pricing/virtual-renovation",
      },
    ],
    rows: [
      {
        label: "Cambiar suelo",
        priceKey: "renovation-replace-flooring",
      },
      {
        label: "Cambiar paredes o techo",
        priceKey: "renovation-replace-walls",
      },
      {
        label: "Añadir o completar cocina",
        priceKey: "renovation-kitchen-fit-out",
      },
      {
        label: "Añadir piscina",
        priceKey: "renovation-add-pool",
      },
    ],
  },
  {
    id: "planos",
    title: "Planos 2D y 3D",
    subtitle: "Precio por planta según el tipo de plano.",
    cta: "Pedir planos",
    href: "/dashboard/orders/new/3d-floor-plans",
    serviceLinks: [
      {
        label: "Planos 2D y 3D",
        href: "/es/pricing/floor-plans",
      },
      {
        label: "Planos de emplazamiento para promociones",
        href: "/es/pricing/development-site-plans",
      },
    ],
    rows: [
      {
        label: "Plano 2D en blanco y negro",
        priceKey: "floor-plan-2d-bw",
        unit: "por planta",
      },
      {
        label: "Plano 2D en color",
        priceKey: "floor-plan-2d-colour",
        unit: "por planta",
      },
      {
        label: "Plano 3D",
        priceKey: "floor-plan-3d",
        unit: "por planta",
      },
      {
        label: "Pack 2D + 3D",
        priceKey: "floor-plan-2d-3d-bundle",
        unit: "por planta",
      },
    ],
  },
  {
    id: "retoque-fotografico",
    title: "Retoque fotográfico",
    subtitle: "Combina opciones según lo que necesite cada foto.",
    cta: "Pedir retoque",
    href: "/dashboard/orders/new/photo-editing",
    serviceLinks: [
      {
        label: "Edición de fotos inmobiliarias",
        href: "/es/pricing/photo-editing",
      },
      {
        label: "Eliminación de objetos y limpieza virtual",
        href: "/es/pricing/item-removal-virtual-cleaning",
      },
      {
        label: "Mejora de imagen",
        href: "/es/pricing/image-enhancement",
      },
      {
        label: "Edición Day to Dusk",
        href: "/es/pricing/day-to-dusk",
      },
      {
        label: "Mejora de imagen 360°",
        href: "/es/pricing/360-image-enhancement",
      },
      {
        label: "Edición aérea",
        href: "/es/pricing/aerial-editing",
      },
    ],
    rows: [
      {
        label: "Mejora de imagen inmobiliaria",
        priceKey: "image-enhancement",
      },
      {
        label: "Eliminación de objetos y limpieza virtual",
        priceKey: "item-removal-virtual-cleaning",
      },
      {
        label: "Cambio de fondo",
        priceKey: "background-change",
      },
      {
        label: "Encender luces",
        priceKey: "turn-on-lights",
      },
    ],
  },
];

const LOCAL_PRICING_ORDER: readonly LocalPricingServiceId[] = [
  "photography",
  "360-tours",
  "video-tours",
  "drone-photography",
  "floor-plan-2d",
];

const localRows: PricingRow[] = LOCAL_PRICING_ORDER.flatMap((serviceId) => {
  const presentation = getLocalPricingPresentation(serviceId, "es");

  return presentation.rows.map((row) => {
    if (row.packageLabel) {
      return {
        label: `${presentation.serviceLabel} — ${row.packageLabel}`,
        price: `${row.priceLabel}${row.detailLabel ? ` / ${row.detailLabel}` : ""}`,
      };
    }

    if (presentation.rows.length > 1 && row.detailLabel) {
      return {
        label: `${presentation.serviceLabel} — ${row.detailLabel}`,
        price: row.priceLabel,
      };
    }

    return {
      label: presentation.serviceLabel,
      price: formatLocalPricingRow(row),
    };
  });
});

const inclusions = [
  "Revisiones ilimitadas durante 30 días desde la primera entrega",
  "Entrega en alta resolución según el servicio contratado",
  "Derechos de uso comercial para marketing inmobiliario",
  "Sin suscripción mensual",
];

function PricingTable({ rows }: { rows: PricingRow[] }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.label} className={index % 2 === 0 ? "bg-white" : "bg-surface"}>
              <td className="px-4 py-3 text-foreground">{row.label}</td>
              <td className="px-4 py-3 text-right font-semibold text-primary whitespace-nowrap">
                {row.priceKey ? (
                  <CatalogPriceText priceKey={row.priceKey} />
                ) : (
                  row.price
                )}
                {row.unit && (
                  <span className="text-xs text-muted font-normal ml-1">
                    {row.unit}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SpanishPricingPage() {
  return (
    <>
      <section className="bg-primary py-16 lg:py-24">
        <Container>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary mb-4">
              Precios
            </p>
            <h1 className="text-4xl lg:text-5xl font-bold text-white tracking-tight mb-5">
              Precios claros, sin suscripciones
            </h1>
            <p className="text-lg text-white/75 leading-relaxed">
              Paga por imagen, por planta o por opción. Los precios de
              checkout se mantienen en el flujo de pedido existente; esta página
              resume las tarifas públicas principales.
            </p>
          </div>
        </Container>
      </section>

      <section className="py-16 lg:py-24 bg-white">
        <Container>
          <div className="mb-10 rounded-2xl border border-secondary/30 bg-secondary/5 p-5 sm:p-6">
            <h2 className="text-lg font-bold text-primary">Oferta de bienvenida</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              {WELCOME_OFFER_PUBLIC_COPY.es.short}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {WELCOME_OFFER_PUBLIC_COPY.es.rules}
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-10 lg:gap-14 items-start">
            <div className="space-y-8">
              {digitalSections.map((section) => (
                <article
                  key={section.id}
                  id={section.id}
                  className="bg-white border border-border rounded-2xl p-6 lg:p-8 shadow-sm scroll-mt-32"
                >
                  <h2 className="text-2xl lg:text-3xl font-bold text-primary mb-2">
                    {section.title}
                  </h2>
                  <p className="text-sm lg:text-base text-muted leading-relaxed mb-6">
                    {section.subtitle}
                  </p>
                  <PricingTable rows={section.rows} />
                  <div className="mt-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                      Ver servicios en detalle
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                      {section.serviceLinks.map((serviceLink) => (
                        <TrackedLink
                          key={serviceLink.href}
                          href={serviceLink.href}
                          analyticsLabel={`Ver servicio: ${serviceLink.label}`}
                          analyticsLocation="pricing_card"
                          className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline decoration-primary/25 underline-offset-4 transition-colors hover:text-secondary-dark hover:decoration-secondary-dark"
                        >
                          {serviceLink.label}
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </TrackedLink>
                      ))}
                    </div>
                  </div>
                  <TrackedLink
                    href={section.href}
                    analyticsLabel={section.cta}
                    analyticsLocation="pricing_card"
                    analyticsEvent="pricing_cta"
                    className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-light transition-colors"
                  >
                    {section.cta}
                    <ArrowRight className="w-4 h-4" aria-hidden />
                  </TrackedLink>
                </article>
              ))}
            </div>

            <aside className="bg-surface border border-border rounded-2xl p-6 lg:p-8 lg:sticky lg:top-32">
              <h2 className="text-xl font-bold text-primary mb-4">
                Incluido en los pedidos digitales
              </h2>
              <ul className="space-y-3">
                {inclusions.map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-foreground">
                    <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted leading-relaxed mt-5">
                Los descuentos se aplican automáticamente al subtotal del
                servicio base. Los extras no reciben descuento por volumen.{" "}
                {PUBLIC_TAX_NOTICE_ES}
              </p>
              <div className="mt-5 space-y-2 border-t border-border pt-5">
                {PUBLIC_VOLUME_DISCOUNTS_ES.map((tier) => (
                  <div
                    key={tier.range}
                    className="flex items-center justify-between gap-4 text-xs"
                  >
                    <span className="text-foreground">{tier.range}</span>
                    <span className="font-bold text-primary">
                      {tier.discount}
                    </span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </Container>
      </section>

      <section className="py-16 lg:py-24 bg-surface">
        <Container>
          <div className="max-w-4xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
              Servicios locales
            </p>
            <h2 className="text-3xl lg:text-4xl font-bold text-primary tracking-tight mb-4">
              Alicante y Costa Blanca
            </h2>
            <p className="text-base text-muted leading-relaxed mb-6">
              Los precios son puntos de partida. Confirmamos el presupuesto
              final después de revisar ubicación, tamaño, entregables y
              disponibilidad.
            </p>
            <div className="bg-white border border-border rounded-2xl p-6 lg:p-8 shadow-sm">
              <PricingTable rows={localRows} />
              <TrackedLink
                href="/es/contact"
                analyticsLabel="Solicitar presupuesto"
                analyticsLocation="pricing_card"
                className="mt-6 inline-flex items-center gap-2 px-6 py-3 border border-primary text-primary text-sm font-semibold rounded-lg hover:bg-primary hover:text-white transition-colors"
              >
                Solicitar presupuesto
                <ArrowRight className="w-4 h-4" aria-hidden />
              </TrackedLink>
            </div>
          </div>
        </Container>
      </section>

      <CtaSection
        title="¿Listo para preparar tus visuales?"
        subtitle="Elige un servicio digital o escríbenos para trabajos locales y encargos a medida."
        primaryLabel="Pedir online"
        primaryHref="/dashboard/orders/new"
        primaryAnalyticsEvent="pricing_cta"
        secondaryLabel="Contactar"
        secondaryHref="/es/contact"
      />
    </>
  );
}
