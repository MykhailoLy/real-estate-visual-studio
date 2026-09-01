import Link from "next/link";
import { ArrowRight } from "lucide-react";
import BeforeAfterShowcase, {
  type ShowcaseSlide,
} from "@/components/home/BeforeAfterShowcase";
import BenefitsRow, {
  type BenefitsRowCopy,
} from "@/components/home/BenefitsRow";
import ServiceGrid, {
  type ServiceGridCopy,
} from "@/components/home/ServiceGrid";
import HowItWorksDetailed, {
  type HowItWorksDetailedCopy,
} from "@/components/home/HowItWorksDetailed";
import AboutPicchuSpot, {
  type AboutCollageTile,
  type AboutPicchuSpotCopy,
} from "@/components/home/AboutPicchuSpot";
import Testimonials, {
  type TestimonialsCopy,
} from "@/components/home/Testimonials";
import CtaSection from "@/components/sections/CtaSection";
import {
  getAboutCollageItems,
  getHomepageSliderItems,
  getSiteMediaPublicUrl,
} from "@/lib/site-media";
import { WELCOME_OFFER_PUBLIC_COPY } from "@/lib/welcome-offer";
import { spanishMetadata } from "./seo";
import { getBeforeAfterAlt } from "@/lib/before-after-alt";

export const metadata = spanishMetadata({
  title: "PicchuSpot - Visuales inmobiliarios",
  description:
    "Visuales inmobiliarios que hacen destacar los anuncios. Virtual Staging, renovación virtual, planos, edición fotográfica y media inmobiliaria local.",
  path: "/es",
  englishPath: "/",
});

const benefitsCopy: BenefitsRowCopy = {
  ariaLabel: "Beneficios de PicchuSpot",
  benefits: [
    {
      title: "Entrega rápida",
      body: "Entrega estándar en 24-48 horas desde el momento en que tenemos todo lo necesario.",
    },
    {
      title: "Sin suscripciones",
      body: "Paga por imagen o por proyecto. Sin cuotas mensuales ni compromisos mínimos.",
    },
    {
      title: "Revisiones incluidas",
      body: "Se incluyen revisiones ilimitadas durante 30 días naturales desde la primera entrega, dentro del encargo y la línea de diseño acordados.",
    },
    {
      title: "Revisión humana real",
      body: "Cada pedido lo revisa un editor para comprobar realismo y presentación de calidad para anuncios.",
    },
    {
      title: "Subidas seguras",
      body: "Los archivos van directamente a almacenamiento privado mediante URL firmadas. Tus fotos siguen siendo tuyas.",
    },
    {
      title: WELCOME_OFFER_PUBLIC_COPY.es.title,
      body: WELCOME_OFFER_PUBLIC_COPY.es.benefitSummary,
    },
  ],
};

const serviceGridCopy: ServiceGridCopy = {
  eyebrow: "Qué hacemos",
  title: "Servicios digitales remotos para anuncios inmobiliarios.",
  description:
    "Toca cualquier servicio para ver precios, explorar estilos y empezar un pedido.",
  requestQuoteLabel: "Solicitar presupuesto",
  beforeLabel: "Antes",
  afterLabel: "Después",
  services: {
    "image-enhancement": {
      name: "Mejora de imagen",
      description:
        "Corrección de color, exposición y ventanas para que las fotos del anuncio se vean luminosas, nítidas y naturales.",
      pricePrefix: "Desde ",
      priceSuffix: " / imagen",
    },
    "day-to-dusk": {
      name: "Day to Dusk",
      description:
        "Convierte un exterior diurno en una imagen cálida al atardecer, perfecta como foto principal de un anuncio.",
      pricePrefix: "Desde ",
      priceSuffix: " / imagen",
    },
    "virtual-staging": {
      name: "Virtual Staging",
      description:
        "Amuebla habitaciones vacías con un estilo realista y orientado al mercado para que los compradores visualicen el espacio.",
      pricePrefix: "Desde ",
      priceSuffix: " / imagen",
    },
    "item-removal": {
      name: "Eliminación de objetos y limpieza virtual",
      description:
        "Elimina desorden, objetos personales o elementos que distraen para que la habitación sea la protagonista.",
      pricePrefix: "Desde ",
      priceSuffix: " / imagen",
    },
    "floor-plans": {
      name: "Planos",
      description:
        "Bocetos, planos existentes o fotos convertidos en planos 2D y 3D limpios para marketing.",
      pricePrefix: "Desde ",
      priceSuffix: " / plano",
    },
    "virtual-renovation": {
      name: "Renovación virtual",
      description:
        "Muestra cómo podría verse una cocina, baño o fachada tras una reforma, sin levantar un martillo.",
      customPriceLabel: "Precio por opciones",
    },
    "360-image-enhancement": {
      name: "Mejora de imagen 360°",
      description:
        "Mejora panoramas equirectangulares para que cada dirección tenga calidad de anuncio.",
      pricePrefix: "Desde ",
      priceSuffix: " / panorama",
    },
    "360-virtual-staging": {
      name: "Virtual Staging 360°",
      description:
        "Añade mobiliario dentro de un panorama 360 para que los tours virtuales muestren espacios amueblados y habitables.",
      pricePrefix: "Desde ",
      priceSuffix: " / panorama",
    },
    "aerial-editing": {
      name: "Edición aérea",
      description:
        "Cielos más limpios, mayor detalle y color equilibrado para exteriores con dron e imágenes aéreas de anuncios.",
      pricePrefix: "Desde ",
      priceSuffix: " / imagen",
    },
    "development-site-plans": {
      name: "Planos de desarrollo",
      description:
        "Planos cenitales que muestran límites de parcela, unidades y servicios para marketing de promociones.",
    },
  },
};

const processCopy: HowItWorksDetailedCopy = {
  eyebrow: "Proceso",
  title: "Cómo funciona",
  description: "Desde la subida hasta la entrega en cuatro pasos sencillos.",
  stepLabel: "Paso",
  steps: [
    {
      title: "Sube",
      body: "Sube tus fotos o archivos de proyecto desde cualquier dispositivo. Los archivos van directamente a almacenamiento privado.",
    },
    {
      title: "Editamos",
      body: "Preparamos tus visuales según el servicio seleccionado y las instrucciones que enviaste.",
    },
    {
      title: "Revisión de calidad",
      body: "Cada pedido se revisa para comprobar realismo, claridad y calidad de presentación antes de la entrega.",
    },
    {
      title: "Listo",
      body: "Recibes archivos listos para el mercado para tu anuncio, MLS, web o paquete de marketing.",
    },
  ],
};

const aboutCopy: AboutPicchuSpotCopy = {
  eyebrow: "Sobre PicchuSpot",
  title:
    "Visuales listos para anuncios, creados por personas que entienden el sector inmobiliario.",
  paragraphs: [
    "PicchuSpot crea visuales listos para anuncios inmobiliarios. Con formación arquitectónica y experiencia práctica en visualización 3D, edición fotográfica y Virtual Staging, nos centramos en resultados realistas que ayudan a presentar mejor las propiedades online.",
    "Ofrecemos servicios digitales remotos en todo el mundo y media inmobiliaria local en Alicante y Costa Blanca. Ya sea una sola imagen editada o un paquete completo de media para una propiedad, el objetivo es siempre el mismo: visuales claros y pulidos que ayuden a destacar los anuncios.",
  ],
};

const testimonialsCopy: TestimonialsCopy = {
  eyebrow: "Testimonios",
  title: "Qué dicen nuestros clientes",
  previousLabel: "Testimonio anterior",
  nextLabel: "Testimonio siguiente",
  chooseLabel: "Elegir testimonio",
  slideLabel: "Testimonio",
  showLabel: "Mostrar testimonio",
  testimonials: [
    {
      name: "Sarah Mitchell",
      role: "Agente inmobiliaria",
      initials: "SM",
      quote:
        "PicchuSpot nos ayudó a presentar los anuncios de una forma más limpia y cuidada. Las ediciones se veían realistas, la comunicación fue clara y la entrega rápida.",
    },
    {
      name: "Daniel Foster",
      role: "Marketing inmobiliario",
      initials: "DF",
      quote:
        "Los visuales quedaron naturales y listos para publicar. Nos gustó especialmente la atención al detalle y la consistencia entre varias imágenes.",
    },
    {
      name: "Elena Ruiz",
      role: "Broker Associate",
      initials: "ER",
      quote:
        "El proceso fue sencillo y las imágenes finales se veían profesionales sin parecer demasiado retocadas.",
    },
  ],
};

export default async function SpanishHomePage() {
  const [sliderRows, collageRows] = await Promise.all([
    getHomepageSliderItems(),
    getAboutCollageItems(),
  ]);

  const sliderSlides: ShowcaseSlide[] = sliderRows
    .map<ShowcaseSlide | null>((row) => {
      const beforeUrl = getSiteMediaPublicUrl(row.before_image_path);
      const afterUrl = getSiteMediaPublicUrl(row.after_image_path);
      if (!beforeUrl || !afterUrl) return null;
      const alt = getBeforeAfterAlt({
        sharedAlt: row.alt_text,
        title: row.title,
        description: row.description,
        serviceSlug: row.service_slug,
        locale: "es",
      });
      return {
        kind: "image",
        id: row.id,
        beforeUrl,
        afterUrl,
        beforeAlt: alt.beforeAlt,
        afterAlt: alt.afterAlt,
      };
    })
    .filter((slide): slide is ShowcaseSlide => slide !== null);

  const collageTiles: AboutCollageTile[] = collageRows
    .map<AboutCollageTile | null>((row) => {
      const pairAlt = getBeforeAfterAlt({
        sharedAlt: row.alt_text,
        title: row.title,
        description: row.description,
        serviceSlug: row.service_slug,
        locale: "es",
      });
      const singleAlt = row.alt_text || row.title || "Sobre PicchuSpot";
      const selected = [
        { url: getSiteMediaPublicUrl(row.image_path), alt: singleAlt },
        { url: getSiteMediaPublicUrl(row.after_image_path), alt: pairAlt.afterAlt },
        { url: getSiteMediaPublicUrl(row.before_image_path), alt: pairAlt.beforeAlt },
        { url: getSiteMediaPublicUrl(row.poster_image_path), alt: singleAlt },
        { url: getSiteMediaPublicUrl(row.panorama_image_path), alt: singleAlt },
      ].find((candidate) => candidate.url);
      if (!selected?.url) return null;
      return {
        kind: "image",
        id: row.id,
        url: selected.url,
        alt: selected.alt,
      };
    })
    .filter((tile): tile is AboutCollageTile => tile !== null);

  return (
    <>
      <section className="bg-white overflow-hidden">
        <div className="px-3 sm:px-4 lg:px-2 pt-3 lg:pt-4 pb-2 lg:pb-3">
          <BeforeAfterShowcase slides={sliderSlides} />
        </div>
      </section>

      <section className="bg-white border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 py-6 lg:py-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary leading-tight tracking-tight">
            Edición fotográfica inmobiliaria, Virtual Staging y planos
          </h1>
          <p className="mt-3 text-sm sm:text-base lg:text-lg text-muted leading-relaxed max-w-4xl">
            Crea visuales listos para tus anuncios con mejora de imagen,
            edición Day to Dusk, Virtual Staging, eliminación de objetos,
            renovación virtual, planos y mejora de imagen 360°. Pensado para
            agentes inmobiliarios, fotógrafos, gestores de propiedades y
            equipos de marketing.
          </p>
        </div>
      </section>

      <BenefitsRow copy={benefitsCopy} />

      <ServiceGrid copy={serviceGridCopy} locale="es" />

      <HowItWorksDetailed copy={processCopy} />

      <section className="bg-white border-y border-border">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 py-8 lg:py-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 lg:gap-10">
            <div className="lg:max-w-2xl">
              <p className="text-secondary-dark text-[11px] sm:text-xs font-semibold tracking-[0.2em] uppercase mb-2">
                Servicios digitales remotos
              </p>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary leading-tight tracking-tight">
                Ayuda a que tus anuncios destaquen y vendan más rápido
              </h2>
              <p className="mt-2 text-sm sm:text-base lg:text-lg text-muted leading-snug">
                Virtual Staging, edición fotográfica, planos, visuales 360 y
                media inmobiliaria local para anuncios de propiedades listos
                para el mercado.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:flex-shrink-0">
              <Link
                href="/order"
                className="inline-flex items-center gap-2 px-6 lg:px-7 py-3 lg:py-3.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-light transition-colors text-sm shadow-sm"
              >
                Pedir online
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <Link
                href="/es/services"
                className="inline-flex items-center px-6 lg:px-7 py-3 lg:py-3.5 border border-stone-300 text-foreground font-bold rounded-lg hover:border-primary hover:text-primary transition-colors text-sm"
              >
                Ver servicios
              </Link>
            </div>
          </div>
        </div>
      </section>

      <AboutPicchuSpot
        tiles={collageTiles}
        copy={aboutCopy}
        placeholderLabels={{ left: "Antes", right: "Después" }}
      />

      <Testimonials copy={testimonialsCopy} />

      <CtaSection
        title="Empieza tu próximo anuncio con los visuales ya resueltos."
        subtitle="Sube tus fotos y nosotros nos encargamos del resto."
        primaryLabel="Pedir online"
        primaryHref="/order"
        secondaryLabel="Habla con nosotros"
        secondaryHref="/es/contact"
      />
    </>
  );
}
