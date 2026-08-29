import { Home, ImageIcon, Map, Plane } from "lucide-react";
import ServicePage from "@/components/pricing/ServicePage";
import { CatalogPriceText } from "@/components/pricing/currency-client";
import { spanishMetadata } from "../../seo";
import { spanishServicePageLabels } from "../labels";
import JsonLd from "@/components/seo/JsonLd";
import { serviceSchema, breadcrumbSchema } from "@/lib/structured-data";
import { absoluteUrl } from "@/lib/seo";
import { getCatalogPriceDecimal } from "@/lib/pricing/public";

export const metadata = spanishMetadata({
  title: "Edición aérea",
  description:
    "Mejora imágenes de dron con precios fijos para desvanecido de color, marcadores, resaltado de parcelas y marcado completo.",
  path: "/es/pricing/aerial-editing",
  englishPath: "/pricing/aerial-editing",
});

export default function SpanishAerialEditingPricingPage() {
  return (
    <>
      <JsonLd
        data={[
          serviceSchema({
            name: "Edición aérea",
            description:
              "Mejora imágenes de dron y vistas aéreas de propiedades para una presentación más limpia de terrenos, exteriores, barrios y anuncios.",
            url: absoluteUrl("/es/pricing/aerial-editing"),
            price: getCatalogPriceDecimal("aerial-colour-fade"),
            priceCurrency: "USD",
            offerNote: "Precio inicial por imagen",
          }),
          breadcrumbSchema([
            { name: "Inicio", item: absoluteUrl("/es") },
            { name: "Precios", item: absoluteUrl("/es/pricing") },
            {
              name: "Edición aérea",
              item: absoluteUrl("/es/pricing/aerial-editing"),
            },
          ]),
        ]}
      />
      <ServicePage
      serviceSlug="aerial-editing"
      portfolioViewerVariant="photo"
      placeholderVariant="aerial-editing"
      eyebrow="Edición aérea"
      title="Precios de Edición aérea"
      description="Mejora imágenes de dron y vistas aéreas de propiedades para una presentación más limpia de terrenos, exteriores, barrios y anuncios."
      priceLine={
        <CatalogPriceText
          priceKey="aerial-colour-fade"
          prefix="Desde "
          suffix=" / imagen"
        />
      }
      orderHref="/order/photo-editing"
      orderLabel="Pedir Edición aérea"
      whenToUseTitle="Cuándo usar Edición aérea"
      whenToUseDescription="La edición aérea se usa cuando las imágenes de dron o aéreas necesitan trabajo de color, cielo o limpieza antes de publicarse en anuncios o materiales de marketing."
      useCases={[
        {
          icon: Plane,
          title: "Fotos de dron de propiedades",
          description:
            "Mejora color, exposición y calidad del cielo en tomas exteriores de dron.",
        },
        {
          icon: Map,
          title: "Visuales de terrenos y parcelas",
          description:
            "Presenta terrenos, límites de parcela y contexto del emplazamiento con más claridad.",
        },
        {
          icon: Home,
          title: "Presentación exterior",
          description:
            "Haz que las imágenes aéreas exteriores se vean nítidas, equilibradas y listas para publicar.",
        },
        {
          icon: ImageIcon,
          title: "Paquetes de marketing",
          description:
            "Prepara visuales aéreos para folletos, webs y campañas digitales.",
        },
      ]}
      whatItIsTitle="Imágenes aéreas pulidas para marketing inmobiliario"
      whatItIsBody="Editamos imágenes aéreas y de dron para mejorar claridad, color, exposición y calidad de presentación, de modo que la propiedad y su entorno se lean con claridad en materiales de marketing."
      whatItIsBullets={[
        "Color, exposición y contraste equilibrados",
        "Tono y dirección del cielo ajustados",
        "Elementos que distraen eliminados cuando sea posible",
        "Bordes de propiedad más nítidos y reducción de neblina",
        "Revisiones ilimitadas durante 30 días desde la primera entrega",
        "Entrega en JPG de alta resolución en 24-48 h",
      ]}
      beforeYouOrderDescription="Envía tus imágenes de dron y cualquier nota sobre dirección del cielo, objetos a eliminar o correcciones concretas necesarias."
      uploadItems={[
        {
          label: "Foto de dron o aérea",
          required: true,
          hint: "JPG o DNG a resolución completa; el archivo de mayor calidad disponible",
        },
        {
          label: "Notas sobre dirección y tono del cielo",
          hint: "Nublado, golden hour, cielo azul, etc.; o déjalo abierto y decidiremos nosotros",
        },
        {
          label: "Objetos a eliminar",
          hint: "Coches, cables, contenedores u otras distracciones que limpiar",
        },
        {
          label: "Referencia o notas de ambiente",
          hint: "Opcional; cualquier acabado objetivo o imágenes de referencia",
        },
      ]}
      uploadFootnote="Los campos obligatorios están marcados con *. Se aceptan archivos DNG para máxima calidad de edición."
      pricingTitle="Precios de Edición aérea"
      pricingDescription="Elige la operación aérea de precio fijo que necesita cada imagen. Puedes combinar varias operaciones cuando sea necesario."
      pricingCards={[
        {
          label: "Desvanecido de color",
          price: <CatalogPriceText priceKey="aerial-colour-fade" />,
          unit: "por imagen",
          note: "Atenúa el color del entorno para destacar la propiedad o parcela.",
          isBase: true,
        },
        {
          label: "Marcador de ubicación",
          price: <CatalogPriceText priceKey="aerial-drop-pin" />,
          unit: "por imagen",
          note: "Añade un marcador claro para identificar la propiedad.",
        },
        {
          label: "Resaltado de una parcela",
          price: <CatalogPriceText priceKey="aerial-single-lot-highlight" />,
          unit: "por imagen",
          note: "Delimita y resalta una parcela o propiedad.",
        },
        {
          label: "Resaltado de varias parcelas",
          price: <CatalogPriceText priceKey="aerial-multiple-lot-highlight" />,
          unit: "por imagen",
          note: "Resalta varias parcelas en una imagen aérea.",
        },
        {
          label: "Marcado completo",
          price: <CatalogPriceText priceKey="aerial-full-markup" />,
          unit: "por imagen",
          note: "Combina resaltado, desvanecido de color y marcador de ubicación.",
        },
      ]}
      pricingFootnote="Cada operación seleccionada usa el precio del catálogo actual. El retoque personalizado fuera de estas operaciones puede requerir revisión."
      faqTitle="Preguntas sobre Edición aérea"
      faqItems={[
        {
          question: "¿Qué tipos de imágenes aéreas editáis?",
          answer:
            "Editamos imágenes exteriores de dron, tomas aéreas de parcelas y terrenos, e imágenes del entorno de la propiedad desde cualquier plataforma aérea o dron.",
        },
        {
          question: "¿Podéis sustituir un cielo gris o nublado?",
          answer:
            "Sí. La sustitución de cielo está disponible como parte de la edición aérea; indícanos el tono y la dirección que prefieres.",
        },
        {
          question: "¿Podéis eliminar coches u otros objetos en tomas aéreas?",
          answer:
            "Sí. Objetos como coches aparcados, contenedores, andamios y cables pueden eliminarse si la escena inferior es recuperable.",
        },
        {
          question: "¿Qué formato debo enviar?",
          answer:
            "JPG o DNG con la máxima resolución disponible. DNG ofrece más flexibilidad de edición.",
        },
        {
          question: "¿Cómo se fija el precio?",
          answer:
            "Las operaciones aéreas indicadas tienen precios fijos por imagen. Elige Desvanecido de color, Marcador, Resaltado de parcela o Marcado completo en el pedido de Retoque fotográfico.",
        },
        {
          question: "¿Cuánto tarda?",
          answer:
            "La entrega estándar es de 24-48 horas después de recibir tus archivos y confirmar el alcance.",
        },
        {
          question: "¿Se incluyen revisiones?",
          answer: "Sí. Se incluyen revisiones ilimitadas durante 30 días naturales desde la primera entrega, siempre que los cambios se mantengan dentro del encargo original, el estilo general y la línea de diseño acordada.",
        },
        {
          question: "¿Las imágenes pueden usarse para MLS y marketing?",
          answer:
            "Sí. Los archivos entregados se preparan para anuncios, folletos impresos, webs y paquetes de marketing.",
        },
      ]}
      ctaTitle="Haz que cada toma de dron esté lista para publicar."
      ctaSubtitle="Sube tus imágenes aéreas y selecciona las operaciones de marcado de precio fijo que necesita cada una."
      labels={{
        ...spanishServicePageLabels,
        heroAriaLabel: "Ejemplos antes y después de Edición aérea",
      }}
    />
    </>
  );
}
