import { Compass, Globe, ImageIcon, SlidersHorizontal } from "lucide-react";
import ServicePage from "@/components/pricing/ServicePage";
import SyncedPanoramaCompareViewer from "@/components/pricing/SyncedPanoramaCompareViewer";
import {
  getServiceHeroBeforeAfterItem,
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
  title: "Mejora de imagen 360°",
  description:
    "Mejora panoramas equirectangulares para tours virtuales más limpios, con color equilibrado, exposición y limpieza de uniones.",
  path: "/es/pricing/360-image-enhancement",
  englishPath: "/pricing/360-image-enhancement",
});

export default async function SpanishThreeSixtyImageEnhancementPricingPage() {
  const heroBeforeAfter = await getServiceHeroBeforeAfterItem(
    "360-image-enhancement",
  );
  const beforePanoramaUrl = getSiteMediaPublicUrl(
    heroBeforeAfter?.before_image_path,
  );
  const afterPanoramaUrl = getSiteMediaPublicUrl(
    heroBeforeAfter?.after_image_path,
  );
  const heroAlt = getBeforeAfterAlt({
    sharedAlt: heroBeforeAfter?.alt_text,
    title: heroBeforeAfter?.title,
    description: heroBeforeAfter?.description,
    serviceLabel: "Mejora de imagen 360°",
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
        fallbackLabel="Placeholder del hero antes y después de Mejora de imagen 360"
      />
    ) : undefined;

  return (
    <>
      <JsonLd
        data={[
          serviceSchema({
            name: "Mejora de imagen 360°",
            description:
              "Mejora panoramas equirectangulares para tours virtuales más limpios. Color equilibrado, exposición y limpieza de uniones.",
            url: absoluteUrl("/es/pricing/360-image-enhancement"),
            price: getCatalogPriceDecimal("360-image-enhancement"),
            priceCurrency: "USD",
            offerNote: "Precio inicial por panorama",
          }),
          breadcrumbSchema([
            { name: "Inicio", item: absoluteUrl("/es") },
            { name: "Precios", item: absoluteUrl("/es/pricing") },
            {
              name: "Mejora de imagen 360°",
              item: absoluteUrl("/es/pricing/360-image-enhancement"),
            },
          ]),
        ]}
      />
      <ServicePage
      serviceSlug="360-image-enhancement"
      portfolioViewerVariant="photo"
      placeholderVariant="panorama-enhancement"
      eyebrow="Mejora de imagen 360°"
      title="Precios de Mejora de imagen 360°"
      description="Mejora imágenes 360° de propiedades con color, exposición y calidad de presentación más limpios para tours virtuales y medios interactivos de anuncios."
      priceLine={
        <CatalogPriceText
          priceKey="360-image-enhancement"
          prefix="Desde "
          suffix=" / panorama"
        />
      }
      orderHref="/order/photo-editing"
      heroContent={heroContent}
      orderLabel="Pedir Mejora 360°"
      whenToUseTitle="Cuándo usar Mejora de imagen 360°"
      whenToUseDescription="La mejora 360° es el paso esencial antes de publicar cualquier tour virtual, para que todas las direcciones del panorama se vean pulidas y listas para el anuncio."
      useCases={[
        {
          icon: Globe,
          title: "Tours virtuales 360",
          description:
            "Mejora panoramas antes de publicarlos en Matterport, Kuula o cualquier plataforma de tours.",
        },
        {
          icon: SlidersHorizontal,
          title: "Panoramas apagados u oscuros",
          description:
            "Corrige imágenes panorámicas subexpuestas o planas para que cada ángulo se vea claro.",
        },
        {
          icon: ImageIcon,
          title: "Limpieza de color y exposición",
          description:
            "Corrige luces mezcladas, dominantes de color y brillo irregular en todo el 360.",
        },
        {
          icon: Compass,
          title: "Presentación lista para tour",
          description:
            "Asegura que cada dirección se vea bien en un visor interactivo antes de publicar el tour.",
        },
      ]}
      whatItIsTitle="Visuales 360° más limpios para tours virtuales"
      whatItIsBody="Mejoramos imágenes 360° para una exposición más equilibrada, color más limpio y una presentación de tour más profesional, respetando la estructura de la imagen panorámica."
      whatItIsBullets={[
        "Color, exposición y balance de blancos equilibrados en todo el panorama",
        "Limpieza de líneas de unión cuando sean visibles",
        "Mejora de techo y nadir",
        "Recuperación de vistas por ventana cuando sea posible",
        "1 revisión incluida por panorama",
        "Entrega final como JPG equirectangular",
      ]}
      beforeYouOrderDescription="Envía tus archivos panorámicos y cualquier nota sobre la plataforma de tour; presupuestaremos y haremos la mejora."
      uploadItems={[
        {
          label: "Archivo panorámico equirectangular",
          required: true,
          hint: "Normalmente JPG de 6000x3000 u 8000x4000",
        },
        {
          label: "Plataforma de tour",
          hint: "Matterport, Kuula u otra; ayuda con la especificación de salida",
        },
        {
          label: "Zonas en las que centrarse",
          hint: "Opcional: techo, suelo o zonas concretas que preocupen",
        },
        {
          label: "Parche de nadir o logo",
          hint: "Opcional, si quieres integrarlo en el archivo",
        },
      ]}
      uploadFootnote="Los campos obligatorios están marcados con *. Envía un panorama de muestra para que podamos presupuestar con precisión."
      pricingTitle="Precios de Mejora 360°"
      pricingDescription="La mejora estándar tiene un precio fijo por panorama. Los parches personalizados o correcciones especialmente complejas pueden requerir presupuesto."
      pricingCards={[
        {
          label: "Mejora de panorama individual",
          price: <CatalogPriceText priceKey="360-image-enhancement" />,
          unit: "por panorama",
          note: "Limpieza completa de color, exposición y uniones para una imagen 360.",
          isBase: true,
        },
        {
          label: "Mejora por lote",
          price: "Solicitar presupuesto",
          unit: "por panorama",
          note: "Varios panoramas de la misma propiedad o sesión.",
        },
        {
          label: "Parche de nadir / techo",
          price: "Solicitar presupuesto",
          unit: "por panorama",
          note: "Parche personalizado de nadir o techo integrado en el archivo.",
        },
      ]}
      pricingFootnote="El precio fijo cubre la mejora estándar. Los parches de nadir, techo o restauraciones especialmente complejas siguen siendo bajo presupuesto."
      faqTitle="Preguntas sobre Mejora de imagen 360°"
      faqItems={[
        {
          question: "¿Qué es la Mejora de imagen 360°?",
          answer:
            "Cubre corrección de color, equilibrio de exposición, balance de blancos y limpieza de líneas de unión y zonas de nadir/techo para panoramas equirectangulares usados en tours virtuales.",
        },
        {
          question: "¿Qué formato de archivo debo enviar?",
          answer:
            "Envía archivos JPG o TIFF equirectangulares. Las resoluciones habituales son 6000x3000 u 8000x4000 píxeles.",
        },
        {
          question: "¿Funcionará con mi plataforma de tours?",
          answer:
            "Sí. Entregamos archivos JPG equirectangulares estándar compatibles con Matterport, Kuula y la mayoría de plataformas de tours virtuales.",
        },
        {
          question: "¿Podéis limpiar artefactos de unión?",
          answer:
            "Sí. Las líneas de unión visibles y artefactos habituales de stitching pueden reducirse como parte de la mejora.",
        },
        {
          question: "¿Añadís parches de nadir?",
          answer:
            "Sí. Si proporcionas un logo o gráfico de nadir, podemos integrarlo en el panorama. Consúltanos al contactarnos.",
        },
        {
          question: "¿Cómo se calcula el precio?",
          answer:
            "La mejora estándar usa el precio fijo por panorama mostrado arriba. Los parches personalizados o restauraciones especialmente complejas pueden presupuestarse aparte tras revisar una muestra.",
        },
        {
          question: "¿Cuánto tarda?",
          answer:
            "El plazo depende del número de panoramas y la complejidad. Las mejoras sencillas suelen entregarse en 24-48 horas.",
        },
        {
          question: "¿Incluye una revisión?",
          answer: "Sí. Se incluye una ronda de revisión por panorama.",
        },
      ]}
      ctaTitle="Envía una muestra 360°; presupuestaremos en 24 horas."
      ctaSubtitle="El precio depende de la resolución y la complejidad de corrección. Recibe un presupuesto preciso antes de comprometerte."
      labels={{
        ...spanishServicePageLabels,
        heroAriaLabel: "Ejemplos antes y después de Mejora de imagen 360",
      }}
    />
    </>
  );
}
