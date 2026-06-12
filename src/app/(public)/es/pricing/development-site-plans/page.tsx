import { Building, FileText, LayoutGrid, Map } from "lucide-react";
import ServicePage from "@/components/pricing/ServicePage";
import { spanishMetadata } from "../../seo";
import { spanishServicePageLabels } from "../labels";

export const metadata = spanishMetadata({
  title: "Planos de emplazamiento para promociones",
  description:
    "Planos visuales claros para terrenos, promociones, subdivisiones, proyectos multiunidad o presentaciones de proyecto. Bajo presupuesto.",
  path: "/es/pricing/development-site-plans",
  englishPath: "/pricing/development-site-plans",
});

export default function SpanishDevelopmentSitePlansPricingPage() {
  return (
    <ServicePage
      serviceSlug="development-site-plans"
      placeholderVariant="site-plans"
      eyebrow="Planos de emplazamiento para promociones"
      title="Precios de Planos de emplazamiento para promociones"
      description="Crea planos visuales claros para terrenos, promociones, subdivisiones, proyectos multiunidad o presentaciones de proyecto."
      priceLine="Solicitar presupuesto"
      orderHref="/order/photo-editing"
      orderLabel="Pedir plano de emplazamiento"
      whenToUseTitle="Cuándo usar Planos de emplazamiento para promociones"
      whenToUseDescription="Los planos de emplazamiento ayudan a compradores, inversores y audiencias de planificación a entender de un vistazo la distribución, escala y alcance de una promoción o proyecto de terreno."
      useCases={[
        {
          icon: Map,
          title: "Anuncios de terrenos",
          description:
            "Presenta límites de parcela, accesos y contexto del entorno de forma clara para compradores de suelo.",
        },
        {
          icon: Building,
          title: "Proyectos de promoción",
          description:
            "Muestra fases de desarrollo, distribuciones de unidades y amenities para ventas sobre plano.",
        },
        {
          icon: LayoutGrid,
          title: "Emplazamientos multiunidad",
          description:
            "Presenta distribuciones multiunidad con números de unidad, espacios comunes y aparcamiento.",
        },
        {
          icon: FileText,
          title: "Presentaciones de proyecto",
          description:
            "Aporta visuales claros de apoyo para solicitudes de planificación y dosieres de inversión.",
        },
      ]}
      whatItIsTitle="Planos visuales claros para desarrollo y presentación de terrenos"
      whatItIsBody="Preparamos planos de emplazamiento que ayudan a presentar terrenos, distribuciones, lotes, amenities, accesos y conceptos de desarrollo de una forma más limpia y comprensible."
      whatItIsBullets={[
        "Plano superior a partir de tu boceto, PDF o archivos CAD",
        "Límites de parcela, huellas de edificios y etiquetas de unidades",
        "Amenities y rutas de acceso destacadas",
        "Flecha norte, escala y leyenda incluidas bajo petición",
        "1 revisión incluida",
        "Entrega en JPG y PDF de alta resolución",
      ]}
      beforeYouOrderDescription="Envía tus archivos fuente y un brief claro; cuanto más detalle aportes, más preciso será el plano final."
      uploadItems={[
        {
          label: "Boceto, plano o archivo CAD del emplazamiento",
          required: true,
          hint: "PDF, DWG, DXF, JPG o PNG; cualquier formato que tengas",
        },
        {
          label: "Foto aérea si está disponible",
          hint: "Nos ayuda a alinear el plano con el emplazamiento real",
        },
        {
          label: "Etiquetas de unidades y amenities",
          required: true,
          hint: "Nombres, números y referencias de distribución para todas las zonas",
        },
        {
          label: "Medidas o escala",
          hint: "Si están disponibles; mejoran mucho la precisión",
        },
        {
          label: "Guías de marca o color",
          hint: "Opcional; para salidas de presentación con marca",
        },
        {
          label: "Notas del proyecto",
          hint: "Cualquier contexto adicional, fases o preferencias de distribución",
        },
      ]}
      uploadFootnote="Los campos obligatorios están marcados con *. Cuanto más detalle aportes, más preciso será el resultado. Presupuestaremos por escrito antes de empezar."
      pricingTitle="Precios de Planos de emplazamiento"
      pricingDescription="El precio depende de la complejidad del proyecto y del nivel de detalle. Envía tus archivos fuente y presupuestaremos por escrito en 24 horas."
      pricingCards={[
        {
          label: "Plano de emplazamiento básico",
          price: "Solicitar presupuesto",
          unit: "por plano",
          note: "Distribución superior con límites, unidades y etiquetas de amenities.",
          isBase: true,
        },
        {
          label: "Plano de emplazamiento detallado",
          price: "Solicitar presupuesto",
          unit: "por plano",
          note: "Distribución completa de desarrollo con fases, escala y leyenda.",
        },
        {
          label: "Plano de presentación con marca",
          price: "Solicitar presupuesto",
          unit: "por plano",
          note: "Diseñado para marketing, folletos y materiales para inversores.",
        },
      ]}
      pricingFootnote="Todo el precio es por proyecto. Contacta con nosotros con tus archivos fuente para un presupuesto preciso."
      faqTitle="Preguntas sobre Planos de emplazamiento"
      faqItems={[
        {
          question: "¿Qué archivos fuente necesitáis?",
          answer:
            "Sirve cualquier formato que tengas: CAD (DWG, DXF), PDF o incluso una foto de un boceto a mano. Cuanto más detalle, más precisa será la salida.",
        },
        {
          question: "¿Necesitáis medidas exactas?",
          answer:
            "Las medidas mejoran la precisión, pero no siempre son obligatorias. Si las tienes, inclúyelas. Trabajaremos con lo que tengas.",
        },
        {
          question: "¿Podéis incluir branding y logotipos?",
          answer:
            "Sí. Si tienes colores de marca, logo y directrices tipográficas, podemos incorporarlos para un plano de presentación con marca.",
        },
        {
          question: "¿Y si el emplazamiento es complejo o por fases?",
          answer:
            "Trabajamos con desarrollos complejos y multifase. Incluye tus notas de fases en el brief y presupuestaremos en consecuencia.",
        },
        {
          question: "¿Cómo se determina el precio?",
          answer:
            "El precio depende de la complejidad, el nivel de detalle y el número de versiones necesarias. Siempre presupuestamos por escrito antes de empezar.",
        },
        {
          question: "¿En qué formato recibiré el archivo?",
          answer:
            "JPG y PDF son los formatos estándar de entrega. Otros formatos pueden acordarse bajo petición.",
        },
        {
          question: "¿Cuánto tarda?",
          answer:
            "El plazo se comenta en la fase de presupuesto según la complejidad. Los planos sencillos pueden estar listos en 48 horas una vez confirmados los archivos fuente.",
        },
        {
          question: "¿Incluye una revisión?",
          answer: "Sí. Se incluye una ronda de revisión en el precio presupuestado.",
        },
      ]}
      ctaTitle="Un plano claro hace gran parte del trabajo en marketing de promociones."
      ctaSubtitle="Envía tus archivos fuente; presupuestaremos por escrito en 24 horas."
      labels={{
        ...spanishServicePageLabels,
        heroAriaLabel:
          "Ejemplos antes y después de Planos de emplazamiento para promociones",
      }}
    />
  );
}
