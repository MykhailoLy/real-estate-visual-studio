import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Check,
  Home,
  ImagePlus,
  LayoutGrid,
  Paintbrush,
  SlidersHorizontal,
  View,
  Video,
} from "lucide-react";
import Container from "@/components/layout/Container";
import { CatalogPriceText } from "@/components/pricing/currency-client";
import { spanishMetadata } from "../seo";
import {
  formatLocalPricingRow,
  getLocalPricingPresentation,
  type LocalPricingServiceId,
} from "@/lib/pricing/local-catalog";
import type { PriceKey } from "@/lib/pricing/types";

export const metadata = spanishMetadata({
  title: "Servicios inmobiliarios visuales en español",
  description:
    "Servicios de home staging virtual, renovación virtual, retoque fotográfico, planos 2D/3D, fotografía inmobiliaria, tours 360 y vídeo para propiedades.",
  path: "/es/services",
  englishPath: "/services",
});

type Service = {
  icon: typeof ImagePlus;
  title: string;
  priceKey?: PriceKey;
  priceLabel?: string;
  pricePrefix?: string;
  priceSuffix?: string;
  description: string;
  bullets: string[];
  pricingHref: string;
  orderHref?: string;
};

const digitalServices: Service[] = [
  {
    icon: ImagePlus,
    title: "Home staging virtual",
    priceKey: "virtual-staging",
    pricePrefix: "Desde ",
    priceSuffix: " / imagen",
    description:
      "Transformamos habitaciones vacías en espacios amueblados, realistas y atractivos para compradores o inquilinos.",
    bullets: [
      "Estilos residenciales y comerciales",
      "Ideal para obra nueva, venta y alquiler",
      "Opciones de mejora de imagen y limpieza visual",
    ],
    pricingHref: "/es/pricing/virtual-staging",
    orderHref: "/order/virtual-staging",
  },
  {
    icon: Paintbrush,
    title: "Renovación virtual",
    priceLabel: "Precio por opciones",
    description:
      "Muestra posibilidades de reforma sin obra: suelos, paredes, cocinas, baños, exteriores, piscinas y paisajismo.",
    bullets: [
      "Cambios interiores y exteriores",
      "Eliminación de objetos y limpieza virtual",
      "Instrucciones específicas por imagen",
    ],
    pricingHref: "/es/pricing/virtual-renovation",
    orderHref: "/order/virtual-renovation",
  },
  {
    icon: LayoutGrid,
    title: "Planos 2D y 3D",
    priceKey: "floor-plan-2d-bw",
    pricePrefix: "Desde ",
    priceSuffix: " / planta",
    description:
      "Convertimos bocetos, planos existentes, fotos o mediciones en planos claros para marketing inmobiliario.",
    bullets: [
      "Planos 2D en blanco y negro o color",
      "Planos 3D para explicar mejor la distribución",
      "Paquetes 2D + 3D",
    ],
    pricingHref: "/es/pricing/floor-plans",
    orderHref: "/order/3d-floor-plans",
  },
  {
    icon: SlidersHorizontal,
    title: "Retoque fotográfico",
    priceKey: "turn-on-lights",
    pricePrefix: "Desde ",
    priceSuffix: " / opción",
    description:
      "Mejoramos fotos de anuncios, corregimos distracciones y limpiamos visualmente espacios para una presentación más cuidada.",
    bullets: [
      "Mejora de imagen y luz",
      "Día a atardecer",
      "Eliminación de objetos y cambios de color",
    ],
    pricingHref: "/es/pricing/photo-editing",
    orderHref: "/order/photo-editing",
  },
];

function getLocalServicePriceLines(serviceId: LocalPricingServiceId) {
  const rows = getLocalPricingPresentation(serviceId, "es").rows;
  const [first, ...additional] = rows;

  return {
    price: formatLocalPricingRow(first),
    additionalPricing:
      additional.length > 0 ? additional.map(formatLocalPricingRow) : null,
  };
}

const localServices = [
  {
    icon: Camera,
    title: "Fotografía inmobiliaria",
    ...getLocalServicePriceLines("photography"),
    description:
      "Fotografía profesional para pisos, villas, alquileres y propiedades que necesitan una presentación sólida.",
  },
  {
    icon: View,
    title: "Tours virtuales 360",
    ...getLocalServicePriceLines("360-tours"),
    description:
      "Recorridos interactivos para compradores remotos, alquiler vacacional y visitas previas más eficientes.",
  },
  {
    icon: Video,
    title: "Vídeo de propiedad",
    ...getLocalServicePriceLines("video-tours"),
    description:
      "Vídeos limpios para portales, redes sociales, agencias y campañas inmobiliarias.",
  },
  {
    icon: Home,
    title: "Media aérea y encargos a medida",
    ...getLocalServicePriceLines("drone-photography"),
    description:
      "Dron mediante especialista autorizado cuando la normativa y la ubicación lo permiten.",
  },
];

export default function SpanishServicesPage() {
  return (
    <>
      <section className="bg-stone-50 py-16 lg:py-24">
        <Container>
          <div className="max-w-4xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-4">
              Servicios
            </p>
            <h1 className="text-4xl lg:text-6xl font-bold text-primary tracking-tight leading-[1.05] mb-6">
              Servicios visuales para marketing inmobiliario
            </h1>
            <p className="text-base lg:text-xl text-muted leading-relaxed mb-8">
              Edición digital remota para clientes de cualquier país y servicios
              presenciales en Alicante y Costa Blanca. Pensado para agencias,
              fotógrafos, promotoras y equipos comerciales.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/order"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary-light transition-colors text-sm shadow-sm"
              >
                Pedir servicios digitales
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <Link
                href="/es/contact"
                className="inline-flex items-center justify-center px-7 py-3.5 border border-primary/25 text-primary font-semibold rounded-lg hover:bg-primary hover:text-white hover:border-primary transition-all text-sm"
              >
                Solicitar presupuesto local
              </Link>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-16 lg:py-24 bg-white">
        <Container>
          <div className="max-w-3xl mb-12">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
              Digital y remoto
            </p>
            <h2 className="text-3xl lg:text-5xl font-bold text-primary tracking-tight mb-4">
              Sube archivos online y recibe resultados listos para publicar
            </h2>
            <p className="text-base lg:text-lg text-muted leading-relaxed">
              Estos servicios se pueden pedir a distancia. En esta primera fase,
              el formulario de pedido se mantiene en inglés.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {digitalServices.map((service) => {
              const Icon = service.icon;
              return (
                <article
                  key={service.title}
                  className="bg-white border border-border rounded-2xl p-6 lg:p-8 shadow-sm flex flex-col"
                >
                  <div className="w-11 h-11 rounded-xl bg-surface flex items-center justify-center mb-5">
                    <Icon className="w-5 h-5 text-secondary-dark" aria-hidden />
                  </div>
                  <h3 className="text-2xl font-bold text-primary mb-2">
                    {service.title}
                  </h3>
                  <p className="text-base font-semibold text-secondary-dark mb-4">
                    {service.priceKey ? (
                      <CatalogPriceText
                        priceKey={service.priceKey}
                        prefix={service.pricePrefix}
                        suffix={service.priceSuffix}
                      />
                    ) : (
                      service.priceLabel
                    )}
                  </p>
                  <p className="text-sm lg:text-base text-muted leading-relaxed mb-5">
                    {service.description}
                  </p>
                  <ul className="space-y-2.5 mb-7">
                    {service.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-2.5 text-sm text-foreground">
                        <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-col sm:flex-row gap-3 pt-5 border-t border-border mt-auto">
                    <Link
                      href={service.pricingHref}
                      className="flex-1 inline-flex items-center justify-center px-5 py-3 border border-stone-300 text-foreground text-sm font-semibold rounded-lg hover:border-primary hover:text-primary transition-colors"
                    >
                      Ver servicio
                    </Link>
                    {service.orderHref && (
                      <Link
                        href={service.orderHref}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-5 py-3 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-light transition-colors"
                      >
                        Pedir online
                        <ArrowRight className="w-4 h-4" aria-hidden />
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </Container>
      </section>

      <section className="py-16 lg:py-24 bg-surface">
        <Container>
          <div className="max-w-3xl mb-12">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
              Alicante y Costa Blanca
            </p>
            <h2 className="text-3xl lg:text-5xl font-bold text-primary tracking-tight mb-4">
              Servicios locales para propiedades en la zona
            </h2>
            <p className="text-base lg:text-lg text-muted leading-relaxed">
              Los precios finales dependen del tamaño de la propiedad, la
              ubicación, el alcance y los entregables necesarios.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-6">
            {localServices.map((service) => {
              const Icon = service.icon;
              return (
                <article
                  key={service.title}
                  className="bg-white border border-border rounded-2xl p-6 shadow-sm"
                >
                  <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center mb-5">
                    <Icon className="w-5 h-5 text-secondary-dark" aria-hidden />
                  </div>
                  <h3 className="text-lg font-bold text-primary mb-2">
                    {service.title}
                  </h3>
                  <p className="text-sm font-semibold text-secondary-dark mb-3">
                    {service.price}
                  </p>
                  {service.additionalPricing && (
                    <ul className="mb-4 space-y-1.5 border-t border-border pt-3">
                      {service.additionalPricing.map((line) => (
                        <li
                          key={line}
                          className="text-xs leading-relaxed text-foreground"
                        >
                          {line}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-sm text-muted leading-relaxed">
                    {service.description}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="mt-10">
            <Link
              href="/es/contact"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-light transition-colors"
            >
              Pedir presupuesto local
              <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
