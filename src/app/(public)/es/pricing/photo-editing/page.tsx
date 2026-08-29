import { Eraser, Home, ImageIcon, Star } from "lucide-react";
import ServicePage from "@/components/pricing/ServicePage";
import { CatalogPriceText } from "@/components/pricing/currency-client";
import { spanishMetadata } from "../../seo";
import { spanishServicePageLabels } from "../labels";
import JsonLd from "@/components/seo/JsonLd";
import { serviceSchema, breadcrumbSchema } from "@/lib/structured-data";
import { absoluteUrl } from "@/lib/seo";
import { getCatalogPriceDecimal } from "@/lib/pricing/public";

export const metadata = spanishMetadata({
  title: "Eliminación de objetos y limpieza virtual",
  description:
    "Elimina objetos que distraen, desorden e imperfecciones de fotos inmobiliarias para imágenes más limpias y listas para publicar.",
  path: "/es/pricing/photo-editing",
  englishPath: "/pricing/photo-editing",
});

export default function SpanishPhotoEditingPricingPage() {
  return (
    <>
      <JsonLd
        data={[
          serviceSchema({
            name: "Eliminación de objetos y limpieza virtual",
            description:
              "Elimina objetos que distraen, desorden e imperfecciones de fotos inmobiliarias para imágenes más limpias y listas para publicar.",
            url: absoluteUrl("/es/pricing/photo-editing"),
            price: getCatalogPriceDecimal("item-removal-virtual-cleaning"),
            priceCurrency: "USD",
            offerNote: "Precio inicial por imagen",
          }),
          breadcrumbSchema([
            { name: "Inicio", item: absoluteUrl("/es") },
            { name: "Precios", item: absoluteUrl("/es/pricing") },
            {
              name: "Eliminación de objetos",
              item: absoluteUrl("/es/pricing/photo-editing"),
            },
          ]),
        ]}
      />
      <ServicePage
      serviceSlug="item-removal-virtual-cleaning"
      portfolioViewerVariant="photo"
      placeholderVariant="item-removal"
      eyebrow="Eliminación de objetos y limpieza virtual"
      title="Precios de Eliminación de objetos y limpieza virtual"
      description="Elimina objetos que distraen, desorden, pequeñas imperfecciones y elementos visuales que restan calidad para que las fotos de la propiedad se vean más limpias y listas para publicar."
      priceLine={
        <CatalogPriceText
          priceKey="item-removal-virtual-cleaning"
          prefix="Desde "
          suffix=" / imagen"
        />
      }
      orderHref="/order/photo-editing"
      orderLabel="Pedir Eliminación de objetos"
      whenToUseTitle="Cuándo usar Eliminación de objetos y limpieza virtual"
      whenToUseDescription="La eliminación de objetos y limpieza virtual es el primer paso práctico antes de amueblar virtualmente, publicar o mejorar fotos de un anuncio."
      useCases={[
        {
          icon: Home,
          title: "Habitaciones con desorden",
          description:
            "Elimina muebles, objetos personales y desorden de habitaciones que no pudieron despejarse antes de la sesión.",
        },
        {
          icon: Eraser,
          title: "Eliminación de objetos pequeños",
          description:
            "Quita contenedores, cables, carteles, reflejos y otras pequeñas distracciones de forma limpia.",
        },
        {
          icon: Star,
          title: "Presentación más limpia del anuncio",
          description:
            "Muestra una habitación más limpia y espaciosa sin repetir la sesión fotográfica.",
        },
        {
          icon: ImageIcon,
          title: "Limpieza previa a la venta",
          description:
            "Limpia rápidamente fotos de anuncio antes de publicarlas para que cada imagen se vea pulida.",
        },
      ]}
      whatItIsTitle="Fotos inmobiliarias más limpias sin distracciones visuales"
      whatItIsBody="Limpiamos fotos de anuncios eliminando objetos no deseados, desorden, cables, pequeñas marcas o detalles que distraen, manteniendo el espacio realista y natural."
      whatItIsBullets={[
        "Objetos, desorden y elementos personales eliminados",
        "Relleno de fondo integrado de forma natural",
        "Cables, carteles y reflejos limpiados",
        "Compatible con Virtual Staging en la misma imagen",
        "Revisiones ilimitadas durante 30 días desde la primera entrega",
        "Entrega en JPG de alta resolución en 24-48 h",
      ]}
      beforeYouOrderDescription="Envíanos la imagen original con notas claras sobre lo que debe eliminarse; cuanto más específico seas, más limpio será el resultado."
      uploadItems={[
        {
          label: "Foto original",
          required: true,
          hint: "JPG o PNG con la máxima resolución disponible",
        },
        {
          label: "Objetos a eliminar",
          required: true,
          hint: "Describe o marca cada elemento que debe eliminarse",
        },
        {
          label: "Zonas que deben mantenerse sin cambios",
          hint: "Especifica cualquier elemento que deba quedar exactamente igual",
        },
        {
          label: "Notas o instrucciones",
          hint: "Cualquier contexto adicional o solicitud especial",
        },
      ]}
      uploadFootnote="Los campos obligatorios están marcados con *. Cuanto más claras sean tus notas de eliminación, más preciso será el resultado."
      pricingTitle="Precios de Eliminación de objetos"
      pricingDescription="Precio por imagen. Se pueden combinar varias opciones de edición en la misma imagen."
      pricingCards={[
        {
          label: "Eliminación de objetos y limpieza virtual",
          price: (
            <CatalogPriceText priceKey="item-removal-virtual-cleaning" />
          ),
          unit: "por imagen",
          note: "Elimina objetos, desorden y detalles que distraen de forma limpia.",
          isBase: true,
        },
        {
          label: "Mejora de imagen",
          price: <CatalogPriceText priceKey="image-enhancement" prefix="+" />,
          unit: "por imagen",
          note: "Corrección de color y exposición aplicada después de la limpieza.",
        },
        {
          label: "Virtual Staging",
          price: (
            <CatalogPriceText priceKey="virtual-staging" prefix="+" />
          ),
          unit: "por imagen",
          note: "Añade mobiliario después de limpiar virtualmente la habitación.",
        },
      ]}
      pricingFootnote="Eliminación de objetos puede combinarse con Mejora de imagen, Virtual Staging y otras opciones de edición en el mismo pedido."
      faqTitle="Preguntas sobre Eliminación de objetos y limpieza virtual"
      faqItems={[
        {
          question: "¿Qué tipos de objetos se pueden eliminar?",
          answer:
            "Podemos eliminar objetos personales, muebles, desorden, cables, contenedores, carteles, reflejos, pequeñas marcas y otras distracciones visibles en la mayoría de escenas.",
        },
        {
          question: "¿Qué ocurre si el fondo detrás de un objeto es complejo?",
          answer:
            "Integramos el relleno de forma natural. Si una pared, suelo o fondo es visible detrás del elemento eliminado, lo reconstruimos para que coincida con el entorno.",
        },
        {
          question:
            "¿Puedo combinar Eliminación de objetos con Virtual Staging en la misma imagen?",
          answer:
            "Sí. Un flujo habitual es limpiar primero la habitación con Eliminación de objetos y después añadir mobiliario con Virtual Staging. Ambos se cobran por imagen y pueden estar en el mismo pedido.",
        },
        {
          question: "¿Necesito marcar lo que debe eliminarse?",
          answer:
            "Sí. Las descripciones escritas sirven, pero marcar una imagen de referencia acelera el trabajo y mejora la precisión.",
        },
        {
          question: "¿Podéis eliminar objetos en fotos exteriores?",
          answer:
            "Sí. Coches, contenedores, cables, andamios y otras distracciones exteriores pueden eliminarse si la escena inferior es recuperable.",
        },
        {
          question: "¿Cuánto tarda?",
          answer:
            "La entrega estándar es de 24-48 horas desde que recibimos tu imagen y las notas de eliminación.",
        },
        {
          question: "¿Se incluyen revisiones?",
          answer: "Sí. Se incluyen revisiones ilimitadas durante 30 días naturales desde la primera entrega, siempre que los cambios se mantengan dentro del encargo original, el estilo general y la línea de diseño acordada.",
        },
        {
          question: "¿Puedo usar el resultado para MLS y marketing?",
          answer:
            "Sí. Las imágenes entregadas son adecuadas para anuncios inmobiliarios, webs y marketing.",
        },
      ]}
      ctaTitle="¿Listo para limpiar las fotos de tu anuncio?"
      ctaSubtitle="Sube tus imágenes, marca lo que hay que eliminar y recibe fotos más limpias en 24-48 horas."
      labels={{
        ...spanishServicePageLabels,
        heroAriaLabel:
          "Ejemplos antes y después de Eliminación de objetos y limpieza virtual",
      }}
    />
    </>
  );
}
