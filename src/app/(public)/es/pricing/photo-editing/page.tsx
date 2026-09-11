import { Building2, Camera, Layers3, Sparkles } from "lucide-react";
import ServicePage from "@/components/pricing/ServicePage";
import { CatalogPriceText } from "@/components/pricing/currency-client";
import JsonLd from "@/components/seo/JsonLd";
import { absoluteUrl } from "@/lib/seo";
import { breadcrumbSchema, serviceSchema } from "@/lib/structured-data";
import { getCatalogPriceDecimal } from "@/lib/pricing/public";
import { spanishMetadata } from "../../seo";
import { spanishServicePageLabels } from "../labels";

const description =
  "Edición profesional de fotos inmobiliarias para fotógrafos, agentes y especialistas en marketing. HDR natural, corrección de color, vistas de ventanas, mejora de imagen y resultados listos para publicar.";

export const metadata = spanishMetadata({
  title: "Servicios de edición de fotos inmobiliarias",
  description,
  path: "/es/pricing/photo-editing",
  englishPath: "/pricing/photo-editing",
});

export default function SpanishPhotoEditingPricingPage() {
  return (
    <>
      <JsonLd
        data={[
          serviceSchema({
            name: "Servicios de edición de fotos inmobiliarias",
            description,
            url: absoluteUrl("/es/pricing/photo-editing"),
            price: getCatalogPriceDecimal("image-enhancement"),
            priceCurrency: "USD",
            offerNote: "Precio inicial por imagen",
          }),
          breadcrumbSchema([
            { name: "Inicio", item: absoluteUrl("/es") },
            { name: "Precios", item: absoluteUrl("/es/pricing") },
            {
              name: "Edición de fotos inmobiliarias",
              item: absoluteUrl("/es/pricing/photo-editing"),
            },
          ]),
        ]}
      />
      <ServicePage
        serviceSlug="image-enhancement"
        portfolioViewerVariant="photo"
        placeholderVariant="image-enhancement"
        eyebrow="Edición de fotos inmobiliarias"
        title="Edición profesional de fotos inmobiliarias"
        description="Edición natural y consistente para fotógrafos inmobiliarios, agentes y especialistas en marketing: desde exposición y corrección de color hasta vistas de ventanas y acabados listos para publicar."
        priceLine={
          <CatalogPriceText
            priceKey="image-enhancement"
            prefix="Desde "
            suffix=" / imagen"
          />
        }
        orderHref="/dashboard/orders/new/photo-editing"
        orderLabel="Pedir edición fotográfica"
        whenToUseTitle="Cuándo marca la diferencia la edición profesional"
        whenToUseDescription="Utiliza nuestro servicio de edición inmobiliaria cuando una sesión necesita un acabado natural y pulido en todo el anuncio o correcciones concretas en imágenes individuales."
        useCases={[
          {
            icon: Camera,
            title: "Fotógrafos inmobiliarios",
            description:
              "Externaliza una posproducción fiable y mantén un estilo consistente entre sesiones y clientes.",
          },
          {
            icon: Building2,
            title: "Agentes y marketing inmobiliario",
            description:
              "Prepara imágenes limpias y equilibradas para portales, folletos, webs y campañas de anuncios.",
          },
          {
            icon: Layers3,
            title: "Equilibrio con aspecto HDR",
            description:
              "Consigue interiores naturales con altas luces controladas, sombras equilibradas y vistas claras por las ventanas.",
          },
          {
            icon: Sparkles,
            title: "Retoque específico",
            description:
              "Corrige color, iluminación, perspectiva, cielos, reflejos u otras distracciones imagen por imagen.",
          },
        ]}
        whatItIsTitle="Posproducción natural para anuncios inmobiliarios"
        whatItIsBody="Nuestro servicio de edición de fotos inmobiliarias mejora el acabado técnico sin hacer que los espacios parezcan artificiales. Selecciona las opciones que necesita cada foto y añade instrucciones claras para los detalles específicos de la propiedad."
        whatItIsBullets={[
          "Corrección natural de exposición, contraste y balance de blancos",
          "Recuperación de vistas por las ventanas y control de altas luces",
          "Corrección de color y acabado consistente por lotes",
          "Corrección de lente, perspectiva, sombras y reflejos",
          "Edición opcional de cielo, fondo, luces y objetos",
          "Entrega en alta resolución en 24–48 h",
        ]}
        beforeYouOrderDescription="Sube los originales con la máxima calidad disponible e indica qué opciones necesita cada imagen. Añade referencias si el anuncio requiere un acabado específico."
        uploadItems={[
          {
            label: "Fotos originales",
            required: true,
            hint: "JPG o PNG con la máxima resolución disponible",
          },
          {
            label: "Opciones de edición",
            required: true,
            hint: "Elige las correcciones necesarias para cada foto",
          },
          {
            label: "Estilo de referencia",
            hint: "Comparte un ejemplo si buscas un color o acabado tonal concreto",
          },
          {
            label: "Notas por fotografía",
            hint: "Señala vistas, dominantes de color, reflejos o detalles que deban conservarse",
          },
        ]}
        uploadFootnote="Cada imagen puede tener su propia combinación de opciones e instrucciones."
        pricingTitle="Precios de edición de fotos inmobiliarias"
        pricingDescription="Elige solo las ediciones que necesita cada foto. El precio se calcula por cada opción seleccionada."
        pricingCards={[
          {
            label: "Mejora de imagen",
            price: <CatalogPriceText priceKey="image-enhancement" />,
            unit: "por imagen",
            note: "Equilibrio de color, exposición, contraste, blancos y detalle.",
            isBase: true,
          },
          {
            label: "Day to Dusk",
            price: <CatalogPriceText priceKey="day-to-dusk" />,
            unit: "por imagen",
            note: "Convierte un exterior diurno en una presentación natural al atardecer.",
          },
          {
            label: "Eliminación de objetos y limpieza virtual",
            price: (
              <CatalogPriceText priceKey="item-removal-virtual-cleaning" />
            ),
            unit: "por imagen",
            note: "Elimina objetos, desorden y distracciones visuales indicadas.",
          },
        ]}
        pricingFootnote="También están disponibles la eliminación de sombras, cambios de fondo, encendido de luces, cambios de color, marcados aéreos y efectos de agua."
        faqTitle="Preguntas sobre edición de fotos inmobiliarias"
        faqItems={[
          {
            question: "¿Qué incluye la edición de fotos inmobiliarias?",
            answer:
              "Puedes seleccionar mejora, corrección de color y exposición, equilibrio de vistas por ventana, eliminación de sombras u objetos, cambios de fondo, edición de cielo e iluminación y otras correcciones para anuncios.",
          },
          {
            question: "¿Podéis igualar mi estilo de edición habitual?",
            answer:
              "Sí. Envía una imagen de referencia y describe el resultado que buscas para mantener el color, la luminosidad y el contraste coherentes con tu porfolio o marca.",
          },
          {
            question: "¿Editáis sesiones completas de propiedades?",
            answer:
              "Sí. Puedes subir varias imágenes y aplicar las mismas opciones a todo el conjunto, además de añadir instrucciones para fotos concretas.",
          },
          {
            question: "¿Las fotos terminadas seguirán pareciendo naturales?",
            answer:
              "Sí. Nuestro enfoque predeterminado es limpio y realista, con altas luces controladas, color neutro y detalle que favorece la propiedad sin llamar la atención sobre la edición.",
          },
          {
            question: "¿Cuándo recibiré las fotos editadas?",
            answer:
              "La entrega estándar es de 24–48 horas desde que recibimos los archivos originales y las instrucciones completas.",
          },
          {
            question: "¿Se incluyen revisiones?",
            answer:
              "Sí. Se incluyen revisiones ilimitadas durante 30 días naturales desde la primera entrega, siempre que los cambios se mantengan dentro del encargo original, el estilo general y la dirección acordada.",
          },
        ]}
        ctaTitle="¿Listo para conseguir fotos consistentes y listas para publicar?"
        ctaSubtitle="Sube las imágenes de la propiedad, elige las ediciones que necesitas y recibe resultados pulidos en 24–48 horas."
        labels={{
          ...spanishServicePageLabels,
          heroAriaLabel:
            "Ejemplos antes y después de edición de fotos inmobiliarias",
        }}
      />
    </>
  );
}
