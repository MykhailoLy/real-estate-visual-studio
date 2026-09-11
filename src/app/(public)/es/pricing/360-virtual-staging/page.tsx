import { Compass, Globe, Home, Sparkles } from "lucide-react";
import PanoramaHeroViewer from "@/components/pricing/PanoramaHeroViewer";
import ServicePage from "@/components/pricing/ServicePage";
import SyncedPanoramaCompareViewer from "@/components/pricing/SyncedPanoramaCompareViewer";
import {
  getServiceHeroBeforeAfterItem,
  getServiceHeroPanoramaItems,
  getSiteMediaPublicUrl,
} from "@/lib/site-media";
import { spanishMetadata } from "../../seo";
import { spanishServicePageLabels } from "../labels";
import JsonLd from "@/components/seo/JsonLd";
import { serviceSchema, breadcrumbSchema } from "@/lib/structured-data";
import { absoluteUrl } from "@/lib/seo";
import { CatalogPriceText } from "@/components/pricing/currency-client";
import { getCatalogPriceDecimal } from "@/lib/pricing/public";
import { getBeforeAfterAlt } from "@/lib/before-after-alt";

export const metadata = spanishMetadata({
  title: "Precios de Virtual Staging 360°",
  description:
    "Amuebla un panorama 360 para que los tours virtuales muestren espacios amueblados y habitados.",
  path: "/es/pricing/360-virtual-staging",
  englishPath: "/pricing/360-virtual-staging",
});

export default async function SpanishThreeSixtyVirtualStagingPricingPage() {
  const [heroBeforeAfter, heroPanoramas] = await Promise.all([
    getServiceHeroBeforeAfterItem("360-virtual-staging"),
    getServiceHeroPanoramaItems("360-virtual-staging"),
  ]);
  const beforePanoramaUrl = getSiteMediaPublicUrl(
    heroBeforeAfter?.before_image_path,
  );
  const afterPanoramaUrl = getSiteMediaPublicUrl(
    heroBeforeAfter?.after_image_path,
  );
  const heroPanorama = heroPanoramas.find((item) => item.panorama_image_path);
  const heroPanoramaUrl = getSiteMediaPublicUrl(
    heroPanorama?.panorama_image_path,
  );
  const heroAlt = getBeforeAfterAlt({
    sharedAlt: heroBeforeAfter?.alt_text,
    title: heroBeforeAfter?.title,
    description: heroBeforeAfter?.description,
    serviceLabel: "Virtual Staging 360°",
    serviceSlug: heroBeforeAfter?.service_slug,
    locale: "es",
  });
  const heroContent =
    beforePanoramaUrl && afterPanoramaUrl ? (
      <SyncedPanoramaCompareViewer
        beforeImageUrl={beforePanoramaUrl}
        afterImageUrl={afterPanoramaUrl}
        beforeTitle={heroAlt.beforeAlt}
        afterTitle={heroAlt.afterAlt}
        fallbackLabel="Placeholder del hero antes y después de Virtual Staging 360"
        serviceSlug="360-virtual-staging"
        locale="es"
        orderHref="/dashboard/orders/new/photo-editing"
        orderLabel="Pedir online"
      />
    ) : (
      <PanoramaHeroViewer
        imageUrl={heroPanoramaUrl}
        title={
          heroPanorama?.alt_text ??
          heroPanorama?.title ??
          "Panorama interactivo de Virtual Staging 360"
        }
        fallbackLabel="Placeholder del hero de Virtual Staging 360"
        serviceSlug="360-virtual-staging"
        locale="es"
        orderHref="/dashboard/orders/new/photo-editing"
        orderLabel="Pedir online"
      />
    );

  return (
    <>
      <JsonLd
        data={[
          serviceSchema({
            name: "Virtual Staging 360°",
            description:
              "Amuebla un panorama 360 para que los tours virtuales muestren espacios amueblados y habitados, sin el coste ni la coordinación del staging físico.",
            url: absoluteUrl("/es/pricing/360-virtual-staging"),
            price: getCatalogPriceDecimal("360-virtual-staging"),
            priceCurrency: "USD",
            offerNote: "Precio inicial por panorama",
          }),
          breadcrumbSchema([
            { name: "Inicio", item: absoluteUrl("/es") },
            { name: "Precios", item: absoluteUrl("/es/pricing") },
            {
              name: "Virtual Staging 360°",
              item: absoluteUrl("/es/pricing/360-virtual-staging"),
            },
          ]),
        ]}
      />
      <ServicePage
      serviceSlug="360-virtual-staging"
      portfolioViewerVariant="photo"
      placeholderVariant="panorama-staging"
      eyebrow="Virtual Staging 360°"
      title="Precios de Virtual Staging 360°"
      description="Amuebla un panorama 360 para que los tours virtuales muestren espacios amueblados y habitados, sin el coste ni la coordinación del staging físico."
      priceLine={
        <CatalogPriceText
          priceKey="360-virtual-staging"
          prefix="Desde "
          suffix=" / panorama"
        />
      }
      orderHref="/dashboard/orders/new/photo-editing"
      orderLabel="Pedir online"
      heroContent={heroContent}
      whenToUseTitle="Cuándo usar Virtual Staging 360°"
      whenToUseDescription="Usa Virtual Staging 360° cuando un panorama vacío necesita sentirse amueblado, estilizado y listo para tour antes de que los compradores exploren la estancia."
      useCases={[
        {
          icon: Globe,
          title: "Tours virtuales",
          description:
            "Amuebla panoramas equirectangulares vacíos antes de publicarlos en plataformas de tours.",
        },
        {
          icon: Home,
          title: "Habitaciones vacías",
          description:
            "Muestra escala, fluidez y uso sin organizar staging físico.",
        },
        {
          icon: Sparkles,
          title: "Marketing guiado por estilo",
          description:
            "Ajusta el estilo de mobiliario al perfil del comprador, nivel del anuncio y tipo de habitación.",
        },
        {
          icon: Compass,
          title: "Entrega lista para tour",
          description:
            "Recibe un panorama amueblado listo para la mayoría de visores 360° estándar.",
        },
      ]}
      whatItIsTitle="Mobiliario realista para habitaciones 360° inmersivas"
      whatItIsBody="Amueblamos directamente imágenes panorámicas de habitaciones para que los compradores puedan mirar alrededor de un espacio terminado dentro de un tour virtual interactivo."
      whatItIsBullets={[
        "Colocación realista de muebles respetando escala y perspectiva",
        "Estilo ajustado a moderno, escandinavo, costero, clásico y más",
        "Integración de iluminación y sombras en todo el panorama",
        "Entrega final como JPG equirectangular listo para cualquier plataforma 360",
        "Revisiones ilimitadas durante 30 días desde la primera entrega",
      ]}
      beforeYouOrderDescription="Envía el panorama 360° vacío de la habitación y un breve brief de estilo para que podamos presupuestar con precisión antes de producir."
      uploadItems={[
        {
          label: "Panorama equirectangular vacío",
          required: true,
          hint: "Un panorama JPG o TIFF 2:1, normalmente de 6000x3000 o superior",
        },
        {
          label: "Estilo de mobiliario preferido",
          required: true,
          hint: "Moderno, escandinavo, costero, tradicional o tu propia referencia",
        },
        {
          label: "Notas de la habitación",
          hint: "Muebles a incluir, evitar o dejar despejados para recorridos",
        },
        {
          label: "Plataforma de tour",
          hint: "Matterport, Kuula u otro visor si importan las especificaciones de salida",
        },
      ]}
      uploadFootnote="Los campos obligatorios están marcados con *. Envía al menos un panorama de muestra para que podamos confirmar el presupuesto."
      pricingTitle="Precios de Virtual Staging 360°"
      pricingDescription="El staging estándar de un panorama tiene un precio inicial fijo. Los tours multiestancia y la dirección de estilo personalizada pueden presupuestarse aparte."
      pricingCards={[
        {
          label: "Staging de panorama individual",
          price: <CatalogPriceText priceKey="360-virtual-staging" />,
          unit: "por panorama",
          note: "Una habitación 360° vacía amueblada con mobiliario y estilismo realistas.",
          isBase: true,
        },
        {
          label: "Tour multiestancia",
          price: "Solicitar presupuesto",
          unit: "por panorama",
          note: "Estilo consistente en varios panoramas de la misma propiedad.",
        },
        {
          label: "Dirección de estilo personalizada",
          price: "Solicitar presupuesto",
          unit: "por habitación",
          note: "Perfil de comprador, referencias de mobiliario o requisitos de marca concretos.",
        },
      ]}
      pricingFootnote="El precio fijo cubre el staging estándar de un panorama. Los tours multiestancia y requisitos personalizados siguen siendo bajo presupuesto."
      faqTitle="Preguntas sobre Virtual Staging 360°"
      faqItems={[
        {
          question: "¿Qué es Virtual Staging 360°?",
          answer:
            "Es mobiliario virtual creado dentro de un panorama equirectangular 360° para que la habitación terminada pueda verse de forma interactiva en un tour virtual.",
        },
        {
          question: "¿Qué archivo debo enviar?",
          answer:
            "Envía la habitación vacía como panorama equirectangular JPG o TIFF 2:1. Los archivos de mayor resolución suelen producir resultados finales más limpios.",
        },
        {
          question: "¿Puedo elegir el estilo de mobiliario?",
          answer:
            "Sí. Envía un estilo preferido, como moderno, escandinavo, costero o tradicional, o imágenes de referencia para el acabado que quieres.",
        },
        {
          question: "¿La imagen final funcionará en mi plataforma de tours 360°?",
          answer:
            "Sí. Entregamos una imagen equirectangular estándar adecuada para la mayoría de visores 360° y plataformas de tours virtuales.",
        },
        {
          question: "¿Cómo se calcula el precio?",
          answer:
            "El staging estándar de un panorama usa el precio fijo mostrado arriba. Los tours multiestancia, habitaciones especialmente complejas o la dirección de estilo personalizada pueden presupuestarse aparte.",
        },
        {
          question: "¿Se incluyen revisiones?",
          answer:
            "Sí. Se incluyen revisiones ilimitadas durante 30 días naturales desde la primera entrega, siempre que los cambios se mantengan dentro del encargo original, el estilo general y la línea de diseño acordada.",
        },
      ]}
      ctaTitle="Amuebla un 360 sin mover un sofá."
      ctaSubtitle="El precio depende de la complejidad de la habitación y del número de elementos de mobiliario."
      labels={{
        ...spanishServicePageLabels,
        heroAriaLabel: "Ejemplos antes y después de Virtual Staging 360",
      }}
    />
    </>
  );
}
