import Link from "next/link";
import {
  ArrowRight,
  BedDouble,
  Building,
  Check,
  Home,
  Wrench,
} from "lucide-react";
import FaqAccordion, { type FaqItem } from "@/components/pricing/FaqAccordion";
import { RegionalPriceText } from "@/components/pricing/currency-client";
import SectionLead from "@/components/pricing/SectionLead";
import ServiceCTA from "@/components/pricing/ServiceCTA";
import ServicePageSlider, {
  type ServicePageSlide,
} from "@/components/pricing/ServicePageSlider";
import UploadRequirementsBlock from "@/components/pricing/UploadRequirementsBlock";
import Wide from "@/components/pricing/Wide";
import {
  getPortfolioPublicUrl,
  getPublishedItemsForService,
} from "@/lib/portfolio";
import {
  getServiceHeroSliderItems,
  getServiceOptionsImages,
  getSiteMediaPublicUrl,
} from "@/lib/site-media";
import { regionalPrice } from "@/lib/currency";
import {
  PortfolioExamplesGrid,
  StyleOptionsGrid,
  type PortfolioExampleCard,
  type StyleOptionCard,
} from "@/app/(public)/pricing/floor-plans/FloorPlansInteractive";
import { spanishMetadata } from "../../seo";
import { translatePricingExampleTitle } from "../labels";

export const metadata = spanishMetadata({
  title: "Planos",
  description:
    "Planos 2D y 3D profesionales desde US$16 por planta. Envía un boceto, escaneo, PDF o medidas y recibe planos limpios y listos para anuncios en JPG y PDF.",
  path: "/es/pricing/floor-plans",
  englishPath: "/pricing/floor-plans",
});

const USE_CASES = [
  {
    icon: Home,
    title: "Anuncios inmobiliarios",
    description:
      "Ayuda a los compradores a entender la distribución y el flujo de habitaciones antes de visitar la propiedad.",
  },
  {
    icon: Building,
    title: "Obra nueva y promociones",
    description:
      "Presenta unidades sobre plano con distribuciones claras y pulidas para marketing y ventas.",
  },
  {
    icon: Wrench,
    title: "Planificación de reformas",
    description:
      "Comunica cambios espaciales con claridad a clientes, contratistas y revisores de permisos.",
  },
  {
    icon: BedDouble,
    title: "Alquileres de corta estancia",
    description:
      "Muestra a los huéspedes exactamente cómo se distribuye la propiedad y qué espacios hay disponibles.",
  },
] as const;

const WHAT_IT_IS_BULLETS = [
  "Redibujo limpio de planos 2D",
  "Opciones de planos 3D",
  "Etiquetas de habitaciones y dimensiones",
  "Entrega en JPG/PDF lista para anuncios",
] as const;

const FALLBACK_STYLE_OPTIONS: StyleOptionCard[] = [
  {
    sortOrder: 1,
    title: "Moderno",
    description:
      "Líneas limpias, tonos neutros y distribuciones abiertas para anuncios contemporáneos.",
    imageUrl: null,
    imageAlt: "Estilo moderno de plano",
    placeholderVariant: "modern",
  },
  {
    sortOrder: 2,
    title: "Escandinavo",
    description:
      "Blancos suaves, materiales naturales y estilismo mínimo para espacios nórdicos tranquilos.",
    imageUrl: null,
    imageAlt: "Estilo escandinavo de plano",
    placeholderVariant: "scandinavian",
  },
  {
    sortOrder: 3,
    title: "Minimal",
    description:
      "Plano depurado y muy legible, con máximo espacio en blanco y claridad.",
    imageUrl: null,
    imageAlt: "Estilo minimal de plano",
    placeholderVariant: "minimal",
  },
  {
    sortOrder: 4,
    title: "Clásico",
    description:
      "Tonos cálidos, proporciones medidas y una sensación de presentación atemporal.",
    imageUrl: null,
    imageAlt: "Estilo clásico de plano",
    placeholderVariant: "classic",
  },
  {
    sortOrder: 5,
    title: "Luxury",
    description:
      "Presentación oscura y premium con contraste marcado y detalle pulido.",
    imageUrl: null,
    imageAlt: "Estilo luxury de plano",
    placeholderVariant: "luxury",
  },
  {
    sortOrder: 6,
    title: "Editorial",
    description:
      "Pensado para folletos y marketing: tipográfico, por capas y refinado.",
    imageUrl: null,
    imageAlt: "Estilo editorial de plano",
    placeholderVariant: "editorial",
  },
  {
    sortOrder: 7,
    title: "B/N limpio",
    description:
      "Salida en blanco y negro de alto contraste, ideal para impresión y MLS.",
    imageUrl: null,
    imageAlt: "Estilo limpio en blanco y negro de plano",
    placeholderVariant: "clean-bw",
  },
  {
    sortOrder: 8,
    title: "Color suave",
    description:
      "Zonas de color pastel con un carácter residencial cálido y acogedor.",
    imageUrl: null,
    imageAlt: "Estilo de plano con color suave",
    placeholderVariant: "soft-color",
  },
  {
    sortOrder: 9,
    title: "Estilo presentación",
    description:
      "Diseñado para presentaciones a clientes, webs y paquetes de anuncio.",
    imageUrl: null,
    imageAlt: "Estilo de presentación de plano",
    placeholderVariant: "presentation",
  },
];

const PRICING_CARDS = [
  {
    label: "Redibujo de plano 2D",
    price: regionalPrice("Desde $16", "Desde €16"),
    unit: "por planta",
    note: "Blanco y negro o color, por nivel.",
    isBase: true,
  },
  {
    label: "Plano 3D",
    price: regionalPrice("Desde $39", "Desde €39"),
    unit: "por planta",
    note: "Vista superior 3D estilizada con mobiliario y acabados.",
    isBase: false,
  },
  {
    label: "Pack 2D + 3D",
    price: regionalPrice("Desde $49", "Desde €49"),
    unit: "por planta",
    note: "Plano 2D en color y plano 3D juntos: la mejor relación calidad-precio.",
    isBase: false,
  },
  {
    label: "Plano de emplazamiento / promoción",
    price: "Solicitar presupuesto",
    unit: "",
    note: "Distribuciones de terreno, multiunidad o promociones.",
    isBase: false,
  },
  {
    label: "Nivel adicional",
    price: "Tarifa por planta",
    unit: "",
    note: "Cada planta se presupuesta y produce por separado.",
    isBase: false,
  },
  {
    label: "Revisiones / actualizaciones",
    price: "Solicitar presupuesto",
    unit: "",
    note: "Actualización de un plano existente con nuevos cambios.",
    isBase: false,
  },
] as const;

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "¿Qué archivos puedo enviar para redibujar un plano?",
    answer:
      "Puedes enviar bocetos, escaneos, PDFs, planos antiguos o fotos claras de distribuciones medidas.",
  },
  {
    question: "¿Necesitáis medidas exactas?",
    answer:
      "Las medidas son recomendables para mayor precisión, pero también podemos redibujar desde un plano o boceto existente si ya muestra dimensiones.",
  },
  {
    question: "¿Podéis crear planos 3D?",
    answer:
      "Sí. Los planos 3D están disponibles para proyectos que necesitan una presentación más visual.",
  },
  {
    question: "¿Podéis añadir mobiliario al plano?",
    answer:
      "Sí. Se pueden añadir símbolos de mobiliario cuando quieras mostrar escala, distribución o función de las habitaciones.",
  },
  {
    question: "¿Podéis actualizar un plano existente?",
    answer: "Sí. Envía el plano actual y marca los cambios que necesitas.",
  },
  {
    question: "¿En qué formato recibiré el archivo?",
    answer:
      "Los archivos finales pueden prepararse como JPG, PNG o PDF según los requisitos del proyecto.",
  },
  {
    question: "¿Cuánto tarda?",
    answer:
      "El plazo estándar depende de la complejidad, pero los redibujos sencillos suelen prepararse rápido una vez se entregan todos los archivos fuente.",
  },
  {
    question: "¿Puedo usar el plano para MLS y marketing?",
    answer:
      "Sí. El plano final se prepara para presentaciones de anuncios, webs, folletos y paquetes de marketing.",
  },
];

async function buildSliderSlides(): Promise<ServicePageSlide[]> {
  const heroMedia = await getServiceHeroSliderItems("floor-plans");
  const usable = heroMedia.filter(
    (it) => it.before_image_path && it.after_image_path,
  );
  if (usable.length > 0) {
    return usable.map((item) => ({
      kind: "image" as const,
      id: item.id,
      beforeUrl: getSiteMediaPublicUrl(item.before_image_path) ?? "",
      afterUrl: getSiteMediaPublicUrl(item.after_image_path) ?? "",
      beforeAlt: item.alt_text ?? item.title ?? "Plano - antes",
      afterAlt: item.alt_text ?? item.title ?? "Plano - después",
      title: item.title ?? undefined,
    }));
  }
  return [{ kind: "placeholder", id: "fp-fallback", variant: "floor-plans" }];
}

export default async function SpanishFloorPlansPage() {
  const [allItems, optionImages, sliderSlides] = await Promise.all([
    getPublishedItemsForService("floor-plans"),
    getServiceOptionsImages("floor-plans"),
    buildSliderSlides(),
  ]);

  const portfolioCards: PortfolioExampleCard[] = allItems.map((item) => {
    const title = translatePricingExampleTitle(item.title);
    return {
      id: item.id,
      title,
      description: item.description,
      beforeUrl: getPortfolioPublicUrl(item.before_image_path),
      afterUrl: getPortfolioPublicUrl(item.after_image_path),
      beforeAlt: item.before_alt ?? `${title} - antes`,
      afterAlt: item.after_alt ?? `${title} - después`,
    };
  });

  const styleOptionCards: StyleOptionCard[] =
    optionImages.length > 0
      ? optionImages.map((item) => ({
          sortOrder: item.sort_order,
          title: item.title ?? `Estilo ${item.sort_order}`,
          description: item.description ?? "",
          imageUrl: getSiteMediaPublicUrl(item.image_path),
          imageAlt: item.alt_text ?? item.title ?? `Estilo de plano ${item.sort_order}`,
          placeholderVariant: "modern",
        }))
      : FALLBACK_STYLE_OPTIONS;

  return (
    <>
      <section className="bg-white overflow-hidden">
        <div className="px-3 sm:px-4 lg:px-2 pt-3 lg:pt-4 pb-0">
          <ServicePageSlider
            slides={sliderSlides}
            ariaLabel="Ejemplos antes y después de planos"
            imageFit="contain"
            imageBackground="bg-white"
            mobileAspect="aspect-[16/10]"
          />
        </div>
      </section>

      <section className="pt-8 lg:pt-10 pb-14 lg:pb-20 bg-stone-50">
        <Wide>
          <SectionLead
            eyebrow="Ideal para"
            title="Cuándo usar planos"
            description="Los planos ayudan a los compradores a entender la distribución, el flujo de habitaciones y las relaciones espaciales antes de visitar o reservar una visita."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
            {USE_CASES.map((u) => {
              const Icon = u.icon;
              return (
                <div
                  key={u.title}
                  className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-7 shadow-sm hover:shadow-md hover:border-primary/20 transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-primary" aria-hidden />
                  </div>
                  <h3 className="text-base lg:text-lg font-bold text-primary mb-2 tracking-tight">
                    {u.title}
                  </h3>
                  <p className="text-sm text-muted leading-relaxed">
                    {u.description}
                  </p>
                </div>
              );
            })}
          </div>
        </Wide>
      </section>

      <section className="bg-white border-y border-stone-200">
        <Wide className="py-10 lg:py-14">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 lg:gap-10">
            <div className="lg:max-w-2xl">
              <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-2">
                Planos
              </p>
              <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-primary leading-[1.05] tracking-tight">
                Redibujos de planos y planos 3D
              </h1>
              <p className="mt-3 text-base lg:text-lg text-muted leading-relaxed">
                Convierte bocetos, escaneos o distribuciones medidas en planos
                limpios y profesionales para anuncios, marketing, webs y
                presentaciones a clientes.
              </p>
              <p className="mt-2 text-lg lg:text-xl font-semibold text-foreground">
                <RegionalPriceText
                  price={regionalPrice("Desde $16 / planta", "Desde €16 / planta")}
                />
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:flex-shrink-0">
              <Link
                href="/order/3d-floor-plans"
                className="inline-flex items-center gap-2 px-6 lg:px-7 py-3 lg:py-3.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-light transition-colors text-sm shadow-sm"
              >
                Pedir plano
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <Link
                href="/es/services"
                className="inline-flex items-center px-6 lg:px-7 py-3 lg:py-3.5 border border-stone-300 text-foreground font-semibold rounded-lg hover:border-primary hover:text-primary transition-colors text-sm"
              >
                Volver a servicios
              </Link>
            </div>
          </div>
        </Wide>
      </section>

      <section className="py-14 lg:py-20 bg-stone-50">
        <Wide>
          <div className="max-w-3xl mb-10 lg:mb-14">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
              Qué es
            </p>
            <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-primary mb-4 tracking-tight leading-[1.1]">
              Planos limpios y legibles para marketing inmobiliario
            </h2>
            <p className="text-base lg:text-lg text-muted leading-relaxed mb-6">
              Redibujamos tus planos en distribuciones claras y pulidas que
              ayudan a los compradores a entender el espacio rápidamente. Los
              planos pueden prepararse como distribuciones 2D sencillas, planos
              de marketing estilizados o planos 3D según el proyecto.
            </p>
            <ul className="space-y-3">
              {WHAT_IT_IS_BULLETS.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 text-sm lg:text-base text-foreground"
                >
                  <span
                    aria-hidden
                    className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"
                  >
                    <Check className="w-3 h-3 text-primary" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <PortfolioExamplesGrid
            cards={portfolioCards}
            labels={{
              emptyExamples: "Ejemplos de planos",
              before: "Antes",
              after: "Después",
              viewExamplePrefix: "Ver ",
              viewExampleSuffix: ": antes y después",
            }}
          />
        </Wide>
      </section>

      <section className="py-14 lg:py-20 bg-white">
        <Wide>
          <SectionLead
            eyebrow="Antes de pedir"
            title="Qué necesitamos de ti"
            description="Envíanos tu boceto, escaneo, plano original o medidas. Cuanto más claro sea el archivo fuente, más preciso será el redibujo final."
          />
          <UploadRequirementsBlock
            items={[
              {
                label: "Boceto, escaneo o plano original",
                required: true,
                hint: "JPG, PNG, PDF, DWG/DXF o una foto de un boceto medido",
              },
              {
                label: "Nombres / etiquetas de habitaciones",
                required: true,
                hint: "Salón, dormitorio, cocina, baño, etc.",
              },
              {
                label: "Dimensiones si están disponibles",
                hint: "Mejoran la precisión; aceptamos sistema métrico o imperial",
              },
              {
                label: "Tipo de salida preferido",
                required: true,
                hint: "2D B/N, 2D color, 3D o pack 2D + 3D",
              },
              {
                label: "Notas o correcciones",
                hint: "Cambios respecto al archivo fuente, solicitudes especiales u orientación preferida",
              },
            ]}
            footnote="Los campos obligatorios están marcados con *. Formatos fuente aceptados: JPG, PNG, PDF, DWG, DXF. Entrega final: JPG y/o PDF."
          />
        </Wide>
      </section>

      <section className="py-14 lg:py-20 bg-stone-50">
        <Wide>
          <SectionLead
            eyebrow="Opciones de estilo"
            title="Elige el estilo de plano adecuado"
            description="Escoge un estilo visual para la presentación de tu plano o envía una referencia y la igualaremos. Toca cualquier tarjeta para ver un ejemplo ampliado."
          />
          <StyleOptionsGrid
            cards={styleOptionCards}
            labels={{
              viewExamplePrefix: "Ver ejemplo de ",
              viewExampleSuffix: "",
            }}
          />
        </Wide>
      </section>

      <section className="py-14 lg:py-20 bg-white">
        <Wide>
          <SectionLead
            eyebrow="Precios"
            title="Precios de planos"
            description="Elige el formato de plano que necesitas. Los planos más detallados o con varios niveles pueden presupuestarse según complejidad."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
            {PRICING_CARDS.map((card) => (
              <div
                key={card.label}
                className={`rounded-2xl border p-6 lg:p-7 flex flex-col gap-3 ${
                  card.isBase
                    ? "bg-primary border-primary text-white shadow-lg"
                    : "bg-white border-stone-200 shadow-sm hover:border-primary/25 hover:shadow-md transition-all"
                }`}
              >
                {card.isBase && (
                  <span className="self-start inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold tracking-[0.18em] uppercase">
                    Más popular
                  </span>
                )}
                <div>
                  <p
                    className={`text-2xl lg:text-3xl font-bold tracking-tight ${
                      card.isBase ? "text-white" : "text-primary"
                    }`}
                  >
                    {typeof card.price === "string" ? (
                      card.price
                    ) : (
                      <RegionalPriceText price={card.price} />
                    )}
                  </p>
                  {card.unit && (
                    <p
                      className={`text-xs font-medium mt-0.5 ${
                        card.isBase ? "text-white/70" : "text-muted"
                      }`}
                    >
                      {card.unit}
                    </p>
                  )}
                </div>
                <div>
                  <p
                    className={`text-sm lg:text-base font-semibold leading-tight ${
                      card.isBase ? "text-white" : "text-foreground"
                    }`}
                  >
                    {card.label}
                  </p>
                  <p
                    className={`text-xs lg:text-sm mt-1 leading-relaxed ${
                      card.isBase ? "text-white/75" : "text-muted"
                    }`}
                  >
                    {card.note}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-xs lg:text-sm text-muted leading-relaxed max-w-2xl">
            El precio es por planta. Una vivienda de dos plantas con sótano se
            cobra como 3 plantas. Contacta con nosotros para precios de
            multiunidad o promociones.
          </p>

          <div className="mt-8">
            <Link
              href="/order/3d-floor-plans"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary-light transition-colors text-sm"
            >
              Pedir plano
              <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
          </div>
        </Wide>
      </section>

      <section className="py-14 lg:py-20 bg-stone-50">
        <Wide>
          <SectionLead eyebrow="FAQ" title="Preguntas sobre planos" />
          <div className="max-w-3xl">
            <FaqAccordion items={FAQ_ITEMS} />
          </div>
        </Wide>
      </section>

      <ServiceCTA
        title="¿Listo para crear un plano claro?"
        subtitle="Sube tu boceto, escaneo o plano existente y prepararemos un plano limpio y listo para el anuncio de tu propiedad."
        primaryHref="/order/3d-floor-plans"
        primaryLabel="Pedir plano"
        secondaryHref="/es/contact"
        secondaryLabel="Hacer una pregunta"
      />
    </>
  );
}
