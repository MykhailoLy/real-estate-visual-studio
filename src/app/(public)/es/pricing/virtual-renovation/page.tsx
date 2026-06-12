import { Layers, Paintbrush, Trees, Wrench } from "lucide-react";
import ServicePage from "@/components/pricing/ServicePage";
import { RegionalPriceText } from "@/components/pricing/currency-client";
import { regionalPrice } from "@/lib/currency";
import { spanishMetadata } from "../../seo";
import { spanishServicePageLabels } from "../labels";

export const metadata = spanishMetadata({
  title: "Renovación virtual",
  description:
    "Muestra el potencial de renovación con actualizaciones visuales realistas de acabados, instalaciones, distribuciones, materiales y presentación de la propiedad. Precio por opciones.",
  path: "/es/pricing/virtual-renovation",
  englishPath: "/pricing/virtual-renovation",
});

const INTERNAL = [
  { label: "Sustituir suelos", price: regionalPrice("$20.00", "€20.00") },
  { label: "Sustituir paredes", price: regionalPrice("$14.00", "€14.00") },
  { label: "Sustituir techo", price: regionalPrice("$14.00", "€14.00") },
  {
    label: "Eliminación de objetos y limpieza virtual",
    price: regionalPrice("$8.00", "€8.00"),
  },
  { label: "Añadir / eliminar paredes", price: regionalPrice("$35.00", "€35.00") },
  {
    label: "Añadir o completar equipamiento de cocina",
    price: regionalPrice("$55.00", "€55.00"),
  },
  {
    label: "Añadir o completar equipamiento de baño",
    price: regionalPrice("$55.00", "€55.00"),
  },
  { label: "Añadir accesorios", price: regionalPrice("$20.00", "€20.00") },
  {
    label: "Virtual Staging - residencial",
    price: regionalPrice("$19.00", "€19.00"),
  },
  {
    label: "Cambio de color - paredes / techo / puertas",
    price: regionalPrice("$3.00", "€3.00"),
  },
];

const EXTERNAL = [
  { label: "Añadir solo piscina", price: regionalPrice("$35.00", "€35.00") },
  { label: "Añadir entorno de piscina", price: regionalPrice("$28.00", "€28.00") },
  { label: "Añadir paisajismo básico", price: regionalPrice("$20.00", "€20.00") },
  { label: "Añadir paisajismo completo", price: regionalPrice("$55.00", "€55.00") },
  {
    label: "Cambio de estación con paisajismo completo",
    price: regionalPrice("$55.00", "€55.00"),
  },
  { label: "Sustituir entrada", price: regionalPrice("$20.00", "€20.00") },
  { label: "Sustituir cubierta", price: regionalPrice("$20.00", "€20.00") },
  {
    label: "Sustituir paredes exteriores",
    price: regionalPrice("$40.00", "€40.00"),
  },
  {
    label: "Eliminación de objetos y limpieza virtual",
    price: regionalPrice("$8.00", "€8.00"),
  },
];

export default function SpanishVirtualRenovationPricingPage() {
  return (
    <ServicePage
      serviceSlug="virtual-renovation"
      placeholderVariant="virtual-renovation"
      eyebrow="Renovación virtual"
      title="Precios de Renovación virtual"
      description="Muestra el potencial de renovación con actualizaciones visuales realistas de acabados, instalaciones, distribuciones, materiales y presentación de la propiedad."
      priceLine="Precio por opciones"
      orderHref="/order/virtual-renovation"
      orderLabel="Pedir Renovación virtual"
      whenToUseTitle="Cuándo usar Renovación virtual"
      whenToUseDescription="La renovación virtual ayuda a compradores y vendedores a ver el potencial de una propiedad sin obra, convirtiendo espacios anticuados o vacíos en visuales seguros para el anuncio."
      useCases={[
        {
          icon: Paintbrush,
          title: "Interiores anticuados",
          description:
            "Actualiza acabados, suelos e instalaciones cansadas para mostrar un estilo moderno sin trabajo físico.",
        },
        {
          icon: Wrench,
          title: "Conceptos de reforma",
          description:
            "Muestra conceptos de reforma de cocina, baño o estructura para atraer compradores interesados en renovar.",
        },
        {
          icon: Trees,
          title: "Visualización para compradores",
          description:
            "Ayuda a los compradores a imaginar cómo podría verse la propiedad con sus materiales y estilo preferidos.",
        },
        {
          icon: Layers,
          title: "Ideas de mejora antes de vender",
          description:
            "Demuestra el ROI potencial de una reforma a los vendedores antes de que se comprometan a hacer cambios físicos.",
        },
      ]}
      whatItIsTitle="Conceptos de renovación visual para presentación inmobiliaria"
      whatItIsBody="Creamos visuales de renovación realistas que ayudan a los compradores a entender cómo podría verse un espacio con acabados, materiales, instalaciones o dirección de diseño actualizados."
      whatItIsBullets={[
        "Opciones de renovación interior y exterior disponibles",
        "Suelos, paredes, cocinas, baños, instalaciones y más",
        "Piscinas, paisajismo y mejoras exteriores",
        "Combina varias opciones en una misma imagen",
        "1 revisión incluida por imagen",
        "Entrega en JPG de alta resolución en 24-48 h",
      ]}
      beforeYouOrderDescription="Envía la foto original con instrucciones claras sobre qué cambiar, qué conservar y materiales de referencia si los tienes."
      uploadItems={[
        {
          label: "Foto original",
          required: true,
          hint: "JPG o PNG, bien iluminada y con ángulo recto si es posible",
        },
        {
          label: "Instrucciones de renovación",
          required: true,
          hint: "Describe la transformación que quieres para cada imagen",
        },
        {
          label: "Elementos a conservar",
          hint: "Cualquier cosa que deba mantenerse exactamente igual",
        },
        {
          label: "Elementos a sustituir o eliminar",
          hint: "Objetos, paredes, instalaciones o acabados concretos que cambiar",
        },
        {
          label: "Materiales o estilo preferido",
          hint: "Madera, mármol, moderno, Hamptons, etc.",
        },
        {
          label: "Imagen o enlace de referencia",
          hint: "Muy recomendable para cocinas y baños",
        },
      ]}
      uploadFootnote="Los campos obligatorios están marcados con *. Las instrucciones detalladas por imagen siempre producen los mejores resultados."
      pricingTitle="Precios de Renovación virtual"
      pricingDescription="Selecciona solo las opciones que necesitas. El precio es por opción y por imagen; combina tantas como hagan falta."
      pricingCards={[
        ...INTERNAL.slice(0, 6).map((row, i) => ({
          label: row.label,
          price: <RegionalPriceText price={row.price} />,
          unit: "por imagen",
          note:
            i === 0
              ? "Sustituye el suelo existente por un nuevo acabado."
              : i === 1
                ? "Cambia acabados, textura o color de paredes."
                : i === 2
                  ? "Actualiza el acabado del techo o añade detalle."
                  : i === 3
                    ? "Elimina objetos antes de aplicar opciones de renovación."
                    : i === 4
                      ? "Añade o elimina paredes para reconfigurar la distribución."
                      : "Completa o rediseña mobiliario y distribución de cocina.",
          isBase: i === 0,
        })),
      ]}
      pricingFootnote={`La lista completa de opciones interiores también incluye: ${INTERNAL.slice(6).map((r) => r.label).join(", ")}. Las opciones exteriores incluyen: ${EXTERNAL.map((r) => r.label).join(", ")}. Todo se cobra por imagen; visita el formulario de pedido para crear tu combinación exacta.`}
      faqTitle="Preguntas sobre Renovación virtual"
      faqItems={[
        {
          question: "¿Cómo funciona el precio por opciones?",
          answer:
            "Cada opción de renovación tiene un precio fijo por imagen. El total es la suma de las opciones que selecciones para cada imagen. Puedes añadir más imágenes y opciones según lo necesites.",
        },
        {
          question: "¿Puedo combinar varias opciones en una imagen?",
          answer:
            "Sí. Muchos pedidos combinan varias opciones, por ejemplo Sustituir suelos + Sustituir paredes + Añadir o completar equipamiento de cocina en una sola imagen.",
        },
        {
          question: "¿Necesito una imagen de referencia para el estilo?",
          answer:
            "Especialmente para cocinas y baños, una imagen o enlace de referencia ayuda a que nuestros editores ajusten mejor la dirección de acabados. Para cambios sencillos, como color de suelo, una descripción puede bastar.",
        },
        {
          question: "¿Las opciones exteriores son distintas de las interiores?",
          answer:
            "Sí. Las opciones interiores cubren habitaciones y espacios interiores. Las exteriores cubren piscinas, paisajismo, entradas, cubiertas y paredes exteriores. Ambas pueden combinarse en imágenes exteriores.",
        },
        {
          question: "¿Podéis añadir una piscina a una imagen exterior?",
          answer:
            "Sí. Están disponibles piscina sola, piscina con entorno y eliminación de cubierta de piscina como opciones exteriores.",
        },
        {
          question: "¿Qué debo enviar en el brief?",
          answer:
            "La foto original, una lista de opciones, qué conservar, qué cambiar, materiales preferidos y cualquier imagen de referencia. Los briefs detallados por imagen siempre dan mejores resultados.",
        },
        {
          question: "¿Cuánto tarda?",
          answer:
            "La entrega estándar es de 24-48 horas desde que recibimos tus fotos e instrucciones. Las renovaciones complejas de habitaciones completas pueden tardar algo más; lo confirmaremos al pedir.",
        },
        {
          question: "¿Incluye una revisión?",
          answer:
            "Sí. Se incluye una ronda de revisión por imagen para que el resultado final se ajuste a tu brief.",
        },
      ]}
      ctaTitle="¿Listo para renovar digitalmente?"
      ctaSubtitle="Sube tus fotos, describe la renovación y recibe imágenes listas para publicar en 24-48 horas."
      labels={{
        ...spanishServicePageLabels,
        heroAriaLabel: "Ejemplos antes y después de Renovación virtual",
      }}
    />
  );
}
