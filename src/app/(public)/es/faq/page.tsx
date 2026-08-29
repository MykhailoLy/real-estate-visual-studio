import Link from "next/link";
import { ArrowRight, HelpCircle } from "lucide-react";
import Container from "@/components/layout/Container";
import { spanishMetadata } from "../seo";
import JsonLd from "@/components/seo/JsonLd";
import { faqPageSchema } from "@/lib/structured-data";

export const metadata = spanishMetadata({
  title: "Preguntas frecuentes",
  description:
    "Respuestas sobre pedidos de PicchuSpot, tiempos de entrega, revisiones, formatos de archivo, entregas, resúmenes de facturación y servicios visuales inmobiliarios personalizados.",
  path: "/es/faq",
  englishPath: "/faq",
});

const faqs = [
  {
    question: "¿Qué servicios ofrecéis?",
    answer:
      "PicchuSpot ofrece servicios visuales inmobiliarios, incluyendo Virtual Staging, renovación virtual, planos 2D y 3D, edición fotográfica, eliminación de objetos, mejora de imagen, edición Day to Dusk, edición aérea y algunos servicios personalizados o media local.",
  },
  {
    question: "¿Cómo hago un pedido?",
    answer:
      "Empieza en la página de pedido, elige el servicio que encaja con tu proyecto, sube tus archivos originales, añade instrucciones, revisa el total estimado y envía el pedido. Confirmamos el alcance y seguimos desde ahí.",
  },
  {
    question: "¿Qué tipos de archivo puedo subir?",
    answer:
      "Para la mayoría de pedidos visuales, sube JPG, PNG, HEIC, PDF claros o archivos habituales de planos/referencias cuando el formulario los acepte. Si tienes archivos poco comunes, contacta con nosotros antes de pedir para confirmar la mejor forma de enviarlos.",
  },
  {
    question: "¿Cuánto tarda la entrega?",
    answer:
      "Muchos pedidos digitales estándar se entregan en 24-48 horas después de tener los archivos e instrucciones necesarios para empezar. Lotes grandes, solicitudes complejas de renovación, información incompleta o trabajos personalizados pueden tardar más.",
  },
  {
    question: "¿Cómo funcionan las revisiones?",
    answer:
      "Una revisión cubre correcciones o ajustes razonables basados en las instrucciones originales. Nuevas direcciones, habitaciones extra, nuevas solicitudes de estilo o cambios fuera del alcance original pueden requerir un presupuesto aparte. En el dashboard, algunos estados de revisión pueden usar la palabra rework para mostrar la fase de producción.",
  },
  {
    question: "¿Puedo adjuntar imágenes de referencia para revisiones?",
    answer:
      "Sí. Cuando las referencias de revisión estén disponibles en el flujo del dashboard, adjunta imágenes o notas que muestren claramente el cambio solicitado. Las referencias específicas nos ayudan a hacer el ajuste correcto más rápido.",
  },
  {
    question: "¿Dónde puedo descargar los archivos entregados?",
    answer:
      "Los archivos entregados están disponibles en el dashboard del cliente. Abre tu pedido o la página Files para previsualizar y descargar los archivos terminados cuando la entrega esté lista.",
  },
  {
    question: "¿Proporcionáis facturas?",
    answer:
      "El dashboard muestra resúmenes de facturación y totales estimados de los pedidos. Las facturas oficiales descargables están previstas para una versión posterior, por lo que los documentos de facturación pueden proporcionarse por separado cuando sea necesario.",
  },
  {
    question: "¿Ofrecéis solo edición fotográfica inmobiliaria?",
    answer:
      "Sí. Puedes pedir servicios de edición fotográfica sin Virtual Staging ni planos. La edición fotográfica puede incluir mejora, eliminación de objetos, limpieza virtual, sustitución de cielo, Day to Dusk y mejoras relacionadas para imágenes de anuncios.",
  },
  {
    question: "¿Ofrecéis servicios personalizados o locales?",
    answer:
      "Sí. Contacta con nosotros para solicitudes visuales personalizadas, lotes grandes, sesiones locales o necesidades de media inmobiliaria que no encajen en los formularios de pedido estándar.",
  },
  {
    question: "¿Ofrecéis descuentos por volumen?",
    answer:
      "Sí. Los descuentos se aplican automáticamente al subtotal del servicio base: 1–4 unidades elegibles mantienen el precio estándar, 5–9 reciben un 5%, 10–19 un 10%, 20–49 un 15% y 50+ requieren un presupuesto personalizado. Los extras no reciben descuento por volumen. Para los pedidos online elegibles con precio fijo, el importe que muestra Stripe Checkout incluye los impuestos cuando corresponda, y Stripe identifica el impuesto incluido. Los presupuestos personalizados o los servicios facturados manualmente pueden indicar su propio tratamiento fiscal.",
  },
  {
    question: "¿Cómo contacto con soporte?",
    answer:
      "Escribe a hello@picchuspot.com con tu pregunta. Para pedidos existentes, incluye la referencia del pedido y una explicación breve para que podamos ayudarte rápido.",
  },
];

export default function SpanishFaqPage() {
  return (
    <>
      <JsonLd data={faqPageSchema(faqs)} />
      <section className="py-16 lg:py-24 bg-white">
      <Container>
        <div className="max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-4">
            Preguntas frecuentes
          </p>
          <h1 className="text-3xl lg:text-5xl font-bold text-primary tracking-tight leading-[1.05] mb-5">
            Respuestas antes de pedir
          </h1>
          <p className="text-base lg:text-lg text-muted leading-relaxed">
            Respuestas prácticas sobre los servicios de PicchuSpot, pedidos,
            entregas, revisiones, archivos, resúmenes de facturación y soporte.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8 lg:gap-12">
          <div className="space-y-4">
            {faqs.map((item) => (
              <article
                key={item.question}
                className="bg-surface border border-border rounded-2xl p-6 lg:p-7"
              >
                <div className="flex gap-4">
                  <div className="w-9 h-9 rounded-xl bg-white border border-border flex items-center justify-center flex-shrink-0">
                    <HelpCircle
                      className="w-4 h-4 text-secondary-dark"
                      aria-hidden
                    />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-primary mb-2">
                      {item.question}
                    </h2>
                    <p className="text-sm lg:text-base text-muted leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <aside className="lg:sticky lg:top-24 h-fit bg-white border border-border rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-primary mb-3">
              ¿Necesitas una respuesta directa?
            </h2>
            <p className="text-sm text-muted leading-relaxed mb-5">
              Envíanos los detalles del proyecto, tu plazo y cualquier archivo
              o referencia que ya tengas.
            </p>
            <Link
              href="/es/contact"
              className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-light transition-colors"
            >
              Contactar con soporte
              <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
            <Link
              href="/order"
              className="mt-3 inline-flex items-center justify-center gap-2 w-full px-5 py-3 border border-border rounded-xl text-sm font-bold text-primary hover:border-primary/40 hover:bg-surface transition-colors"
            >
              Empezar un pedido
            </Link>
          </aside>
        </div>
      </Container>
    </section>
    </>
  );
}
