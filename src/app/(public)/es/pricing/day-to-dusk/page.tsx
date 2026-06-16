import { Home, ImageIcon, Star, Sunset } from "lucide-react";
import ServicePage from "@/components/pricing/ServicePage";
import { RegionalPriceText } from "@/components/pricing/currency-client";
import { regionalPrice } from "@/lib/currency";
import { spanishMetadata } from "../../seo";
import { spanishServicePageLabels } from "../labels";
import JsonLd from "@/components/seo/JsonLd";
import { serviceSchema, breadcrumbSchema } from "@/lib/structured-data";
import { absoluteUrl } from "@/lib/seo";

export const metadata = spanishMetadata({
  title: "Edición Day to Dusk desde $5",
  description:
    "Transforma fotos exteriores diurnas en imágenes cálidas de estilo atardecer para anuncios inmobiliarios más potentes. Desde US$5 por imagen.",
  path: "/es/pricing/day-to-dusk",
  englishPath: "/pricing/day-to-dusk",
});

export default function SpanishDayToDuskPricingPage() {
  return (
    <>
      <JsonLd
        data={[
          serviceSchema({
            name: "Day to Dusk",
            description:
              "Transforma fotos exteriores diurnas en imágenes cálidas de estilo atardecer para hero shots más potentes y presentación premium.",
            url: absoluteUrl("/es/pricing/day-to-dusk"),
            price: "5.00",
            priceCurrency: "USD",
            offerNote: "Precio inicial por imagen",
          }),
          breadcrumbSchema([
            { name: "Inicio", item: absoluteUrl("/es") },
            { name: "Precios", item: absoluteUrl("/es/pricing") },
            {
              name: "Day to Dusk",
              item: absoluteUrl("/es/pricing/day-to-dusk"),
            },
          ]),
        ]}
      />
      <ServicePage
      serviceSlug="day-to-dusk"
      placeholderVariant="day-to-dusk"
      eyebrow="Day to Dusk"
      title="Precios de Day to Dusk"
      description="Transforma fotos exteriores diurnas en imágenes cálidas de estilo atardecer para hero shots más potentes y una presentación premium."
      priceLine={
        <RegionalPriceText
          price={regionalPrice("Desde $5 / imagen", "Desde €5 / imagen")}
        />
      }
      orderHref="/order/day-to-dusk"
      orderLabel="Pedir Day to Dusk"
      whenToUseTitle="Cuándo usar Day to Dusk"
      whenToUseDescription="Day to Dusk funciona mejor en fotos exteriores donde el cielo y la iluminación de la propiedad pueden transformarse para lograr una sensación premium en el anuncio."
      useCases={[
        {
          icon: Home,
          title: "Fotos exteriores principales",
          description:
            "Da a la foto exterior principal del anuncio una atmósfera cálida y atractiva de atardecer.",
        },
        {
          icon: Star,
          title: "Presentación de propiedades premium",
          description:
            "Un exterior al atardecer transmite calidad premium y eleva la percepción del anuncio.",
        },
        {
          icon: Sunset,
          title: "Ambiente de tarde",
          description:
            "Crea escenas cálidas de golden hour y atardecer sin esperar a la puesta de sol.",
        },
        {
          icon: ImageIcon,
          title: "Miniaturas online más fuertes",
          description:
            "Las imágenes al atardecer destacan en las parrillas de anuncios y atraen más clics.",
        },
      ]}
      whatItIsTitle="Imágenes cálidas de atardecer a partir de exteriores diurnos"
      whatItIsBody="Convertimos fotos exteriores diurnas adecuadas en imágenes de estilo atardecer con un cielo más cálido, iluminación equilibrada y un acabado inmobiliario pulido, manteniendo la propiedad natural y creíble."
      whatItIsBullets={[
        "Sustitución realista del cielo al atardecer",
        "Brillo interior cálido añadido",
        "Luces encendidas automáticamente",
        "Color y contraste equilibrados para la nueva iluminación",
        "1 revisión incluida por imagen",
        "Entrega en JPG de alta resolución en 24-48 h",
      ]}
      beforeYouOrderDescription="Envíanos una foto exterior limpia y cualquier nota sobre el ambiente o la dirección del cielo; nosotros nos encargamos de la transformación."
      uploadItems={[
        {
          label: "Foto exterior diurna",
          required: true,
          hint: "Una toma exterior clara con la máxima resolución disponible",
        },
        {
          label: "Notas sobre el brillo de ventanas",
          hint: "Qué ventanas deben iluminarse, o déjalo en blanco y decidiremos nosotros",
        },
        {
          label: "Tono de cielo de referencia",
          hint: "Opcional: azul profundo, naranja cálido, violeta suave, etc.",
        },
      ]}
      uploadFootnote="Los campos obligatorios están marcados con *. Funciona mejor en fotos exteriores frontales con una zona de cielo clara."
      pricingTitle="Precios de Day to Dusk"
      pricingDescription="Precio por imagen. Puede combinarse con otras opciones de edición en la misma foto."
      pricingCards={[
        {
          label: "Day to Dusk",
          price: <RegionalPriceText price={regionalPrice("$5.00", "€5.00")} />,
          unit: "por imagen",
          note: "Sustitución de cielo, brillo interior y atmósfera de atardecer.",
          isBase: true,
        },
        {
          label: "Mejora de imagen",
          price: <RegionalPriceText price={regionalPrice("+$2.00", "+€2.00")} />,
          unit: "por imagen",
          note: "Refinamiento de color y exposición sobre la edición de atardecer.",
        },
        {
          label: "Eliminación de objetos",
          price: <RegionalPriceText price={regionalPrice("+$8.00", "+€8.00")} />,
          unit: "por imagen",
          note: "Eliminación de coches, contenedores u otras distracciones antes de la conversión.",
        },
      ]}
      pricingFootnote="Combina Day to Dusk con Mejora de imagen o Eliminación de objetos en la misma imagen para un resultado completo."
      faqTitle="Preguntas sobre Day to Dusk"
      faqItems={[
        {
          question: "¿Qué fotos funcionan mejor para Day to Dusk?",
          answer:
            "Funcionan mejor las tomas exteriores frontales hechas de día con una zona de cielo clara. Las imágenes muy nubladas o con poco cielo pueden tener resultados más limitados.",
        },
        {
          question: "¿El resultado parecerá realista?",
          answer:
            "Sí. Ajustamos la iluminación a la escena, añadimos brillo realista a las ventanas y mantenemos la propiedad natural para que parezca una foto real al atardecer.",
        },
        {
          question: "¿Puedo elegir el color del cielo y el ambiente?",
          answer:
            "Sí. Puedes pedir un tono o ambiente específico, como azul profundo, naranja cálido o violeta suave. Si lo dejas abierto, elegiremos un aspecto natural para la propiedad.",
        },
        {
          question: "¿Qué pasa con las luces interiores? ¿Se encienden automáticamente?",
          answer:
            "Sí. Las fuentes de luz visibles se encienden como parte de la edición estándar Day to Dusk para completar la atmósfera.",
        },
        {
          question: "¿Puedo añadir Eliminación de objetos en la misma imagen?",
          answer:
            "Sí. Puedes combinar Day to Dusk con Eliminación de objetos, Mejora de imagen u otras opciones de edición en el mismo pedido.",
        },
        {
          question: "¿Cuánto tarda?",
          answer:
            "La entrega estándar es de 24-48 horas desde que recibimos tu imagen y las notas necesarias.",
        },
        {
          question: "¿Incluye una revisión?",
          answer: "Sí. Se incluye una ronda de revisión por imagen.",
        },
        {
          question: "¿Puedo usar la imagen para MLS y marketing?",
          answer:
            "Sí. Las imágenes entregadas se preparan para anuncios inmobiliarios, webs y paquetes de marketing.",
        },
      ]}
      ctaTitle="Haz que la foto principal sea imposible de ignorar."
      ctaSubtitle="Una sola imagen al atardecer puede cambiar cómo se percibe un anuncio online. Sube tu exterior y nosotros nos encargamos del resto."
      labels={{
        ...spanishServicePageLabels,
        heroAriaLabel: "Ejemplos antes y después de Day to Dusk",
      }}
    />
    </>
  );
}
