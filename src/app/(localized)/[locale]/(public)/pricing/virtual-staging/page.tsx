import Link from "next/link";
import ClientPortalLink from "@/components/dashboard/ClientPortalLink";
import {
  ArrowRight,
  Building2,
  Check,
  Home,
  ImagePlus,
  Sparkles,
} from "lucide-react";
import BeforeAfterFrame from "@/components/portfolio/BeforeAfterFrame";
import FaqAccordion, { type FaqItem } from "@/components/pricing/FaqAccordion";
import { CatalogPriceText } from "@/components/pricing/currency-client";
import SectionLead from "@/components/pricing/SectionLead";
import ServiceCTA from "@/components/pricing/ServiceCTA";
import ServicePageSlider, {
  type ServicePageSlide,
} from "@/components/pricing/ServicePageSlider";
import StyleGallerySection, {
  type StyleGalleryCopy,
  type StyleGalleryImageOverride,
} from "@/components/pricing/StyleGallerySection";
import UploadRequirementsBlock from "@/components/pricing/UploadRequirementsBlock";
import Wide from "@/components/pricing/Wide";
import {
  getPortfolioPublicUrl,
  getServicePageItemsForService,
} from "@/lib/portfolio";
import {
  getServiceOptionsImages,
  getSiteMediaPublicUrl,
} from "@/lib/site-media";
import { spanishMetadata } from "../../seo";
import {
  translatePricingExampleTitle,
  translatePricingExampleDescription,
  translatePricingExampleAlt,
} from "../labels";
import JsonLd from "@/components/seo/JsonLd";
import { serviceSchema, breadcrumbSchema } from "@/lib/structured-data";
import { absoluteUrl } from "@/lib/seo";
import { getCatalogPriceDecimal } from "@/lib/pricing/public";
import type { PriceKey } from "@/lib/pricing/types";
import { getBeforeAfterAlt } from "@/lib/before-after-alt";

export const metadata = spanishMetadata({
  title: "Precios de Virtual Staging",
  description:
    "Transforma habitaciones vacías o anticuadas en espacios amueblados y listos para el mercado. 9 estilos interiores, revisiones ilimitadas durante 30 días desde la primera entrega y entrega en 24-48 horas.",
  path: "/es/pricing/virtual-staging",
  englishPath: "/pricing/virtual-staging",
});

const USE_CASES = [
  {
    icon: Home,
    title: "Anuncios vacíos",
    description:
      "Muestra a los compradores cómo pueden verse las habitaciones vacías una vez amuebladas y listas para vivir.",
  },
  {
    icon: Sparkles,
    title: "Interiores anticuados",
    description:
      "Sustituye mobiliario cansado por un estilo moderno y comercial, sin reformar.",
  },
  {
    icon: Building2,
    title: "Espacios comerciales",
    description:
      "Amuebla oficinas, tiendas e interiores comerciales para ayudar a visualizar su uso.",
  },
  {
    icon: ImagePlus,
    title: "Obra nueva y venta sobre plano",
    description:
      "Da vida a renders y espacios sin terminar con un estilismo realista.",
  },
] as const;

const WHAT_IT_IS_BULLETS = [
  "Mobiliario y decoración fotorrealistas",
  "Varios estilos interiores para elegir",
  "Revisiones ilimitadas durante 30 días desde la primera entrega",
  "Entrega en JPG de alta resolución en 24-48 h",
] as const;

const PRICING_CARDS: Array<{
  label: string;
  priceKey: PriceKey;
  prefix?: string;
  unit: string;
  note: string;
  isBase: boolean;
}> = [
  {
    label: "Virtual Staging base",
    priceKey: "virtual-staging",
    unit: "por imagen",
    note: "Mobiliario, decoración y estilismo para una habitación.",
    isBase: true,
  },
  {
    label: "Mejora de imagen",
    priceKey: "image-enhancement",
    prefix: "+",
    unit: "por imagen",
    note: "Corrección de color, exposición y ventanas.",
    isBase: false,
  },
  {
    label: "De día a atardecer",
    priceKey: "day-to-dusk",
    prefix: "+",
    unit: "por imagen",
    note: "Convierte un exterior diurno en una toma cálida al atardecer.",
    isBase: false,
  },
  {
    label: "Eliminación de objetos y limpieza virtual",
    priceKey: "item-removal-virtual-cleaning",
    prefix: "+",
    unit: "por imagen",
    note: "Elimina desorden antes de amueblar virtualmente la habitación.",
    isBase: false,
  },
  {
    label: "Encender luces",
    priceKey: "turn-on-lights",
    prefix: "+",
    unit: "por imagen",
    note: "Hace que las fuentes de luz visibles parezcan encendidas.",
    isBase: false,
  },
  {
    label: "Cambio de color",
    priceKey: "colour-change",
    prefix: "+",
    unit: "por imagen",
    note: "Cambia colores de paredes, techos o puertas.",
    isBase: false,
  },
] as const;

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "¿Qué nivel de realismo tendrá el Virtual Staging?",
    answer:
      "Ajustamos perspectiva, escala, iluminación, sombras y dirección de estilo para que la imagen final se sienta natural y lista para publicar.",
  },
  {
    question: "¿Qué habitaciones podéis amueblar?",
    answer:
      "Podemos amueblar dormitorios, salones, comedores, cocinas, oficinas, zonas exteriores y determinados espacios comerciales.",
  },
  {
    question: "¿Puedo elegir el estilo de mobiliario?",
    answer:
      "Sí. Puedes elegir uno de los estilos disponibles o enviar una imagen o enlace de referencia para acercarnos más al aspecto que buscas.",
  },
  {
    question: "¿Podéis amueblar una habitación que ya tiene muebles?",
    answer:
      "Sí, pero si primero hay que retirar muebles existentes o desorden, añade Eliminación de objetos y limpieza virtual al pedido.",
  },
  {
    question: "¿Cuánto tarda?",
    answer:
      "La entrega estándar suele ser de 24-48 horas una vez tenemos la foto original y las instrucciones.",
  },
  {
    question: "¿Qué archivos debo subir?",
    answer:
      "Sube una foto JPG o PNG clara de la habitación, idealmente bien iluminada y tomada desde un ángulo recto y natural.",
  },
  {
    question: "¿Incluye revisiones?",
    answer:
      "Sí. Se incluyen revisiones ilimitadas durante 30 días naturales desde la primera entrega, siempre que los cambios se mantengan dentro del encargo original, el estilo general y la línea de diseño acordada.",
  },
  {
    question: "¿Puedo usar las imágenes para MLS y marketing?",
    answer:
      "Sí. Las imágenes finales se preparan para anuncios inmobiliarios, webs, redes sociales y paquetes de marketing.",
  },
];

const STYLE_COPY: StyleGalleryCopy = {
  modern: {
    label: "Moderno",
    description: "Líneas limpias, paletas neutras y maderas claras.",
  },
  urban: {
    label: "Urbano",
    description: "Texturas industriales, acentos oscuros y materiales crudos.",
  },
  scandinavian: {
    label: "Escandinavo",
    description: "Luz nórdica suave, maderas claras y calidez minimalista.",
  },
  "mid-century": {
    label: "Moderno de mediados de siglo",
    description: "Tonos nogal, siluetas escultóricas y carácter retro.",
  },
  farmhouse: {
    label: "Rústico",
    description: "Blancos cálidos, texturas naturales y confort vivido.",
  },
  hamptons: {
    label: "Hamptons",
    description: "Calma costera, crema y azul marino, textiles refinados.",
  },
  contemporary: {
    label: "Contemporáneo",
    description: "Mezcla actual de siluetas modernas y decoración cuidada.",
  },
  traditional: {
    label: "Tradicional",
    description: "Mobiliario clásico, texturas superpuestas y sensación atemporal.",
  },
  commercial: {
    label: "Comercial",
    description: "Oficinas, tiendas, espacios de hostelería y zonas compartidas.",
  },
};

async function buildSliderSlides(
  items: Awaited<ReturnType<typeof getServicePageItemsForService>>,
): Promise<ServicePageSlide[]> {
  const usable = items
    .filter((it) => it.before_image_path && it.after_image_path)
    .slice(0, 5);

  if (usable.length === 0) {
    return [{ kind: "placeholder", id: "vs-fallback", variant: "virtual-staging" }];
  }

  return usable.map((item) => {
    const title = translatePricingExampleTitle(item.title);
    const alt = getBeforeAfterAlt({
      beforeAlt: item.before_alt
        ? translatePricingExampleAlt(item.before_alt)
        : item.before_alt,
      afterAlt: item.after_alt
        ? translatePricingExampleAlt(item.after_alt)
        : item.after_alt,
      title,
      description: item.description
        ? translatePricingExampleDescription(item.description)
        : item.description,
      serviceLabel: "Virtual Staging",
      serviceSlug: item.service_slug,
      locale: "es",
    });
    return {
      kind: "image" as const,
      id: item.id,
      beforeUrl: getPortfolioPublicUrl(item.before_image_path) ?? "",
      afterUrl: getPortfolioPublicUrl(item.after_image_path) ?? "",
      beforeAlt: alt.beforeAlt,
      afterAlt: alt.afterAlt,
      title,
    };
  });
}

export default async function SpanishVirtualStagingPage() {
  const [allItems, optionImages] = await Promise.all([
    getServicePageItemsForService("virtual-staging"),
    getServiceOptionsImages("virtual-staging"),
  ]);
  const sliderSlides = await buildSliderSlides(allItems);
  const hasItems = allItems.length > 0;
  const styleImageOverrides: StyleGalleryImageOverride[] = optionImages
    .filter((item) => item.title && item.image_path)
    .map((item) => {
      const src = getSiteMediaPublicUrl(item.image_path);
      if (!src) return null;
      return {
        title: item.title!,
        src,
        alt:
          (item.alt_text != null ? translatePricingExampleAlt(item.alt_text) : null) ??
          item.title ??
          `Ejemplo de estilo ${item.sort_order} de Virtual Staging`,
      };
    })
    .filter((item): item is StyleGalleryImageOverride => item !== null);

  return (
    <>
      <JsonLd
        data={[
          serviceSchema({
            name: "Virtual Staging",
            description:
              "Transforma habitaciones vacías o anticuadas en espacios amueblados y listos para el mercado. 9 estilos interiores, revisiones ilimitadas durante 30 días desde la primera entrega, entrega en 24-48 horas.",
            url: absoluteUrl("/es/pricing/virtual-staging"),
            price: getCatalogPriceDecimal("virtual-staging"),
            priceCurrency: "USD",
            offerNote: "Precio inicial por imagen",
          }),
          breadcrumbSchema([
            { name: "Inicio", item: absoluteUrl("/es") },
            { name: "Precios", item: absoluteUrl("/es/pricing") },
            {
              name: "Virtual Staging",
              item: absoluteUrl("/es/pricing/virtual-staging"),
            },
          ]),
        ]}
      />
      <section className="bg-white overflow-hidden">
        <div className="px-3 sm:px-4 lg:px-2 pt-3 lg:pt-4 pb-0">
          <ServicePageSlider
            slides={sliderSlides}
            serviceSlug="virtual-staging"
            locale="es"
            orderHref="/dashboard/orders/new/virtual-staging"
            orderLabel="Pedir Virtual Staging"
            ariaLabel="Ejemplos antes y después de Virtual Staging"
          />
        </div>
      </section>

      <section className="pt-8 lg:pt-10 pb-14 lg:pb-20 bg-stone-50">
        <Wide>
          <SectionLead
            eyebrow="Ideal para"
            title="Cuándo usar Virtual Staging"
            description="Virtual Staging funciona para casi cualquier anuncio en el que las habitaciones vacías o anticuadas dificultan que los compradores visualicen el espacio."
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
                Virtual Staging
              </p>
              <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-primary leading-[1.05] tracking-tight">
                Precios de Virtual Staging
              </h1>
              <p className="mt-3 text-base lg:text-lg text-muted leading-relaxed">
                Transforma habitaciones vacías en espacios amueblados y
                realistas. Elige entre 9 estilos interiores y combínalo con
                servicios adicionales opcionales para resultados listos para el mercado.
              </p>
              <p className="mt-2 text-lg lg:text-xl font-semibold text-foreground">
                <CatalogPriceText
                  priceKey="virtual-staging"
                  prefix="Desde "
                  suffix=" / imagen"
                />
              </p>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-secondary-dark">
                Oferta de bienvenida — 50 % de descuento en tu primera imagen
                de Virtual Staging. Cada ventaja puede utilizarse una sola vez
                por cuenta y no se acumula con un descuento por volumen en la
                misma imagen.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:flex-shrink-0">
              <ClientPortalLink
                href="/dashboard/orders/new/virtual-staging"
                className="inline-flex items-center gap-2 px-6 lg:px-7 py-3 lg:py-3.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-light transition-colors text-sm shadow-sm"
              >
                Pedir Virtual Staging
                <ArrowRight className="w-4 h-4" aria-hidden />
              </ClientPortalLink>
              <Link
                href="/es/pricing"
                className="inline-flex items-center px-6 lg:px-7 py-3 lg:py-3.5 border border-stone-300 text-foreground font-semibold rounded-lg hover:border-primary hover:text-primary transition-colors text-sm"
              >
                Volver a precios
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
              Imágenes amuebladas y listas para vender a partir de habitaciones vacías
            </h2>
            <p className="text-base lg:text-lg text-muted leading-relaxed mb-6">
              Sustituimos espacios vacíos por mobiliario, decoración e
              iluminación realistas. Cada imagen se estiliza para encajar con
              tu comprador objetivo y el posicionamiento del anuncio, tanto
              residencial como comercial.
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

          {hasItems ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              {allItems.map((item) => {
                const beforeUrl = getPortfolioPublicUrl(item.before_image_path);
                const afterUrl = getPortfolioPublicUrl(item.after_image_path);
                const title = translatePricingExampleTitle(item.title);
                const alt = getBeforeAfterAlt({
                  beforeAlt: item.before_alt
        ? translatePricingExampleAlt(item.before_alt)
        : item.before_alt,
                  afterAlt: item.after_alt
        ? translatePricingExampleAlt(item.after_alt)
        : item.after_alt,
                  title,
                  description: item.description
        ? translatePricingExampleDescription(item.description)
        : item.description,
                  serviceLabel: "Virtual Staging",
                  serviceSlug: item.service_slug,
                  locale: "es",
                });
                return (
                  <article
                    key={item.id}
                    className="group bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
                  >
                    <div className="aspect-[5/2] relative overflow-hidden bg-stone-100">
                      <BeforeAfterFrame
                        beforeUrl={beforeUrl}
                        afterUrl={afterUrl}
                        beforeAlt={alt.beforeAlt}
                        afterAlt={alt.afterAlt}
                        placeholderVariant="virtual-staging"
                        beforeLabel="Antes"
                        afterLabel="Después"
                        placeholderLabels={{
                          left: "Antes",
                          right: "Después",
                          ariaLabel: `${title}: antes y después`,
                        }}
                      />
                    </div>
                    <div className="p-5 lg:p-6">
                      <h3 className="text-base lg:text-lg font-bold text-primary tracking-tight">
                        {title}
                      </h3>
                      {item.description && (
                        <p className="mt-1.5 text-sm text-muted leading-relaxed line-clamp-3">
                          {translatePricingExampleDescription(item.description)}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="relative aspect-[5/2] w-full overflow-hidden rounded-2xl shadow-sm ring-1 ring-stone-200 bg-stone-100">
              <BeforeAfterFrame
                beforeUrl={null}
                afterUrl={null}
                beforeAlt="Habitación vacía antes de Virtual Staging"
                afterAlt="Habitación amueblada después de Virtual Staging"
                placeholderVariant="virtual-staging"
                beforeLabel="Antes"
                afterLabel="Después"
                placeholderLabels={{
                  left: "Antes",
                  right: "Después",
                  ariaLabel: "Habitación antes y después de Virtual Staging",
                }}
              />
            </div>
          )}
        </Wide>
      </section>

      <section className="py-14 lg:py-20 bg-white">
        <Wide>
          <SectionLead
            eyebrow="Antes de pedir"
            title="Qué necesitamos de ti"
            description="Envíanos una foto limpia de la habitación vacía y algunos detalles; nosotros nos encargamos del resto."
          />
          <UploadRequirementsBlock
            title="Qué archivos subir"
            items={[
              {
                label: "Foto original de la habitación",
                required: true,
                hint: "JPG o PNG, bien iluminada y con ángulo recto si es posible",
              },
              {
                label: "Nombre de la habitación / zona",
                required: true,
                hint: "Salón, dormitorio, cocina, exterior, etc.",
              },
              {
                label: "Estilo de mobiliario preferido",
                required: true,
                hint: "Elige entre los 9 estilos siguientes",
              },
              {
                label: "Imagen o enlace de referencia",
                hint: "Opcional; nos ayuda a igualar un aspecto concreto",
              },
              {
                label: "Notas o instrucciones",
                hint: "Solicitudes especiales, puntos focales, elementos a conservar o eliminar",
              },
            ]}
            footnote="Los campos obligatorios están marcados con *. Los servicios adicionales estándar de edición pueden añadirse durante el pedido y aplicarse a la misma imagen."
          />
        </Wide>
      </section>

      <section className="py-14 lg:py-20 bg-stone-50">
        <Wide>
          <SectionLead
            eyebrow="Opciones de estilo"
            title="Elige el aspecto adecuado para tu comprador"
            description="Escoge un solo estilo por imagen o déjanos igualar una referencia. Adaptamos mobiliario, materiales y paleta a la dirección elegida. Toca una tarjeta para ver varios ejemplos por estilo."
          />
          <StyleGallerySection
            locale="es"
            imageOverrides={styleImageOverrides}
            copy={STYLE_COPY}
            examplesLabel="ejemplos"
            helperText="Toca cualquier estilo para ver varios ejemplos amueblados. También puedes enviar una imagen o enlace de referencia, o pedirnos que igualemos el estilo de un anuncio o marca concreta."
            openGalleryPrefix="Abrir galería de estilo "
            openGallerySuffix=""
          />
        </Wide>
      </section>

      <section className="py-14 lg:py-20 bg-white">
        <Wide>
          <SectionLead
            eyebrow="Precios"
            title="Precio base + servicios adicionales opcionales"
            description="Empieza con el precio base de Virtual Staging por imagen. Combina los servicios adicionales que necesites para la misma imagen; se suman al precio base."
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
                    Precio base
                  </span>
                )}
                <div>
                  <p
                    className={`text-2xl lg:text-3xl font-bold tracking-tight ${
                      card.isBase ? "text-white" : "text-primary"
                    }`}
                  >
                    <CatalogPriceText
                      priceKey={card.priceKey}
                      prefix={card.prefix}
                    />
                  </p>
                  <p
                    className={`text-xs font-medium mt-0.5 ${
                      card.isBase ? "text-white/70" : "text-muted"
                    }`}
                  >
                    {card.unit}
                  </p>
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
            Los servicios adicionales son por imagen y se suman al precio base de Virtual
            Staging. Se pueden combinar varios servicios adicionales en la misma imagen.
          </p>

          <div className="mt-8">
            <ClientPortalLink
              href="/dashboard/orders/new/virtual-staging"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary-light transition-colors text-sm"
            >
              Pedir Virtual Staging
              <ArrowRight className="w-4 h-4" aria-hidden />
            </ClientPortalLink>
          </div>
        </Wide>
      </section>

      <section className="py-14 lg:py-20 bg-stone-50">
        <Wide>
          <SectionLead eyebrow="Preguntas frecuentes" title="Preguntas sobre Virtual Staging" />
          <div className="max-w-3xl">
            <FaqAccordion items={FAQ_ITEMS} />
          </div>
        </Wide>
      </section>

      <ServiceCTA
        eyebrow="Empieza ahora"
        title="¿Listo para amueblar tu anuncio?"
        subtitle="Sube tus fotos, elige un estilo y recibe imágenes listas para publicar en 24-48 horas."
        primaryHref="/dashboard/orders/new/virtual-staging"
        primaryLabel="Pedir Virtual Staging"
        secondaryHref="/es/contact"
        secondaryLabel="Hacer una pregunta"
      />
    </>
  );
}
