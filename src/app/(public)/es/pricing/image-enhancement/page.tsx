import {
  Aperture,
  CheckCircle,
  ImageIcon,
  SlidersHorizontal,
} from "lucide-react";
import ServicePage from "@/components/pricing/ServicePage";
import { RegionalPriceText } from "@/components/pricing/currency-client";
import { regionalPrice } from "@/lib/currency";
import { spanishMetadata } from "../../seo";
import { spanishServicePageLabels } from "../labels";

export const metadata = spanishMetadata({
  title: "Mejora de imagen",
  description:
    "Mejora de imagen para fotografía inmobiliaria: equilibrio de exposición, balance de blancos, corrección de lente y recuperación de vistas por ventana. Desde US$2 por imagen.",
  path: "/es/pricing/image-enhancement",
  englishPath: "/pricing/image-enhancement",
});

export default function SpanishImageEnhancementPricingPage() {
  return (
    <ServicePage
      serviceSlug="image-enhancement"
      placeholderVariant="image-enhancement"
      eyebrow="Mejora de imagen"
      title="Precios de Mejora de imagen"
      description="Mejora el color, la exposición, la nitidez y la calidad de presentación para que las fotos del anuncio se vean limpias, naturales y listas para publicar."
      priceLine={
        <RegionalPriceText
          price={regionalPrice("Desde $2 / imagen", "Desde €2 / imagen")}
        />
      }
      orderHref="/order/photo-editing"
      orderLabel="Pedir Mejora de imagen"
      whenToUseTitle="Cuándo usar Mejora de imagen"
      whenToUseDescription="La mejora de imagen es la edición base que hace que cada foto del anuncio parezca tomada de forma profesional y lista para publicar."
      useCases={[
        {
          icon: SlidersHorizontal,
          title: "Fotos oscuras o planas",
          description:
            "Recupera detalle y luminosidad en interiores subexpuestos o con poco contraste.",
        },
        {
          icon: ImageIcon,
          title: "Corrección de color",
          description:
            "Corrige luces mezcladas, tonos amarillentos y balances de blancos poco naturales.",
        },
        {
          icon: Aperture,
          title: "Equilibrio de ventanas y exposición",
          description:
            "Recupera ventanas quemadas y equilibra exposición interior/exterior en una sola imagen.",
        },
        {
          icon: CheckCircle,
          title: "Pulido para anuncios",
          description:
            "Haz que todas las fotos del anuncio se vean consistentes, nítidas y profesionales.",
        },
      ]}
      whatItIsTitle="Imágenes inmobiliarias limpias y equilibradas"
      whatItIsBody="Refinamos fotos inmobiliarias con corrección de color natural, equilibrio de exposición, limpieza respetuosa con la perspectiva y edición centrada en el detalle, para que las imágenes se vean pulidas sin parecer artificiales."
      whatItIsBullets={[
        "Exposición y contraste equilibrados",
        "Balance de blancos y color corregidos",
        "Vistas por ventana recuperadas cuando sea posible",
        "Distorsión de lente corregida",
        "1 revisión incluida por imagen",
        "Entrega en JPG de alta resolución en 24-48 h",
      ]}
      beforeYouOrderDescription="Envíanos tus imágenes originales y cualquier nota específica; nosotros nos encargamos del resto."
      uploadItems={[
        {
          label: "Fotos originales",
          required: true,
          hint: "JPG o PNG con la máxima resolución disponible",
        },
        {
          label: "Notas sobre correcciones necesarias",
          hint: "Cualquier detalle concreto que haya que iluminar, corregir o suavizar por imagen",
        },
        {
          label: "Imagen o enlace de referencia",
          hint: "Opcional; útil si tienes un acabado objetivo en mente",
        },
      ]}
      uploadFootnote="Los campos obligatorios están marcados con *. Se pueden incluir varias imágenes en un solo pedido."
      pricingTitle="Precios de Mejora de imagen"
      pricingDescription="Precio sencillo por imagen. Cuantas más imágenes haya en tu lote, más ágil será la entrega de cada una."
      pricingCards={[
        {
          label: "Mejora de imagen",
          price: <RegionalPriceText price={regionalPrice("$2.00", "€2.00")} />,
          unit: "por imagen",
          note: "Color, exposición, balance de blancos y corrección de ventanas.",
          isBase: true,
        },
        {
          label: "Encender luces",
          price: <RegionalPriceText price={regionalPrice("+$1.00", "+€1.00")} />,
          unit: "por imagen",
          note: "Hace que las fuentes de luz visibles parezcan encendidas.",
        },
        {
          label: "Cambio de color",
          price: <RegionalPriceText price={regionalPrice("+$3.00", "+€3.00")} />,
          unit: "por imagen",
          note: "Cambia colores de paredes, techos o puertas.",
        },
      ]}
      pricingFootnote="Los add-ons son por imagen y pueden combinarse con Mejora de imagen en la misma foto."
      faqTitle="Preguntas sobre Mejora de imagen"
      faqItems={[
        {
          question: "¿Qué incluye la Mejora de imagen?",
          answer:
            "Incluye corrección de color, equilibrio de exposición y contraste, balance de blancos, limpieza de lente y recuperación de vistas por ventana cuando sea posible.",
        },
        {
          question: "¿Las imágenes se verán naturales o demasiado procesadas?",
          answer:
            "Editamos para lograr un aspecto limpio y natural, acorde con la fotografía inmobiliaria, no un resultado excesivamente filtrado o artificialmente luminoso.",
        },
        {
          question:
            "¿Puedo combinar Mejora de imagen con otras ediciones en la misma foto?",
          answer:
            "Sí. Puedes añadir Encender luces, Cambio de color, Day to Dusk y otras opciones en la misma imagen; cada una se cobra por separado.",
        },
        {
          question: "¿Qué formato debo subir?",
          answer:
            "JPG o PNG con la mayor resolución que tengas. Los archivos RAW se aceptan bajo petición.",
        },
        {
          question: "¿Cuánto tarda?",
          answer:
            "La entrega estándar es de 24-48 horas desde que recibimos tus imágenes y las notas necesarias.",
        },
        {
          question: "¿Incluye una revisión?",
          answer:
            "Sí. Se incluye una ronda de revisión por cada imagen para que el resultado final se ajuste mejor a tu brief.",
        },
        {
          question: "¿Puedo pedir mejora para un set completo de anuncio?",
          answer:
            "Sí. Puedes subir varias imágenes en un solo pedido. Cada imagen se presupuesta y edita individualmente.",
        },
        {
          question: "¿Puedo usar las imágenes mejoradas para MLS y marketing?",
          answer:
            "Sí. Las imágenes entregadas se preparan para MLS, webs, impresión y paquetes de marketing.",
        },
      ]}
      ctaTitle="¿Listo para iluminar las fotos de tu anuncio?"
      ctaSubtitle="Sube tus imágenes y devolveremos archivos listos para publicar en 24-48 horas."
      labels={{
        ...spanishServicePageLabels,
        heroAriaLabel: "Ejemplos antes y después de Mejora de imagen",
      }}
    />
  );
}
