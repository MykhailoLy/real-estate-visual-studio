import Link from "next/link";
import TrackedOutboundLink from "@/components/analytics/TrackedOutboundLink";
import Container from "@/components/layout/Container";
import { spanishMetadata } from "../seo";

export const metadata = spanishMetadata({
  title: "Política de privacidad",
  description:
    "Cómo PicchuSpot recopila, usa, protege y conserva información de cuentas de cliente, pedidos, comunicaciones y media inmobiliaria subida.",
  path: "/es/privacy",
  englishPath: "/privacy",
});

const contactEmail = "hello@picchuspot.com";

const sections = [
  {
    title: "Introducción",
    body: (
      <>
        <p>
          Esta Política de privacidad explica cómo PicchuSpot gestiona
          información cuando visitas nuestro sitio web, creas una cuenta, haces
          un pedido, subes archivos o contactas con nosotros sobre servicios
          visuales inmobiliarios.
        </p>
        <p>
          Este es un texto práctico de lanzamiento destinado a explicar nuestro
          tratamiento actual de la información. No es una garantía legal y
          podemos actualizarlo a medida que cambien el servicio, las
          herramientas o los requisitos legales.
        </p>
      </>
    ),
  },
  {
    title: "Información que recopilamos",
    body: (
      <>
        <p>Podemos recopilar los siguientes tipos de información:</p>
        <ul>
          <li>
            Información de cuenta y contacto, como tu nombre, correo
            electrónico, teléfono, empresa y detalles de perfil.
          </li>
          <li>
            Detalles de pedidos, incluyendo servicios seleccionados,
            cantidades, notas de propiedad o proyecto, preferencias de entrega,
            totales estimados e instrucciones de revisión.
          </li>
          <li>
            Archivos e imágenes subidos, incluyendo fotos originales, bocetos,
            referencias de planos, referencias visuales y adjuntos de revisión.
          </li>
          <li>
            Datos de comunicación, como emails, solicitudes de soporte,
            preguntas de proyecto, feedback y comentarios de revisión.
          </li>
          <li>
            Datos técnicos básicos, como tipo de navegador, información del
            dispositivo, registros derivados de IP, eventos de seguridad y datos
            de uso del sitio necesarios para operar y proteger el servicio.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Cómo usamos la información",
    body: (
      <>
        <p>Usamos información para:</p>
        <ul>
          <li>Prestar servicios visuales inmobiliarios y gestionar cuentas de cliente.</li>
          <li>Procesar pedidos, confirmar alcance y coordinar producción.</li>
          <li>Comunicarnos con clientes sobre preguntas, estado y entrega.</li>
          <li>Entregar archivos, dar soporte a revisiones y mantener historial de pedidos.</li>
          <li>Mejorar el sitio web, el portal de clientes y la calidad del servicio.</li>
          <li>
            Proteger el servicio, investigar incidencias, aplicar términos y
            cumplir requisitos legales o de seguridad.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Subidas de archivos y media inmobiliaria",
    body: (
      <>
        <p>
          Las fotos inmobiliarias, planos, referencias y archivos terminados
          que se suben se usan para completar los servicios que solicitas.
          Pueden incluir interiores, exteriores, direcciones mostradas en
          nombres de archivo o notas, branding u otros detalles específicos del
          proyecto que decidas proporcionar.
        </p>
        <p>
          No reclamamos la propiedad de tus archivos subidos. Los usamos para
          producir, entregar, revisar y dar soporte a tu pedido. El uso en
          portfolio o marketing se gestiona por separado y solo cuando das
          permiso explícito.
        </p>
      </>
    ),
  },
  {
    title: "Servicios de terceros",
    body: (
      <>
        <p>
          PicchuSpot puede usar proveedores de confianza para operar el sitio
          web, el portal de clientes, almacenamiento de archivos, hosting y
          comunicaciones. Estos pueden incluir Supabase para autenticación, base
          de datos y almacenamiento; Vercel para hosting y despliegue; y Resend
          u otro proveedor de email para correos de servicio. Crisp se usa para
          atención en vivo cuando una persona visitante solicita explícitamente
          ayuda humana, y Google Analytics se usa para analítica cuando la
          persona visitante acepta las cookies de analítica.
        </p>
        <p>
          Google Analytics nos ayuda a entender el uso básico del sitio web y la
          medición de conversiones solo después de aceptar las cookies de
          analítica. Las cookies de analítica pueden rechazarse mediante los
          controles de cookies.
        </p>
        <p>
          La atención en vivo de Crisp se carga solo cuando solicitas
          explícitamente hablar con una persona. Si continúas con la atención en
          vivo, Crisp puede recibir tu nombre, correo electrónico, ruta de la
          página actual, contexto reciente del chat de IA y los mensajes que
          escribas en el chat nativo de Crisp. Crisp puede establecer una cookie
          de sesión de soporte para mantener conectada la conversación;
          PicchuSpot configura esta cookie con una caducidad de 30 días.
        </p>
        <p>
          Puedes rechazar la atención en vivo y seguir usando el asistente de IA
          o la página de contacto. La elección de cookies de analítica permanece
          separada de la acción de atención en vivo.
        </p>
      </>
    ),
  },
  {
    title: "Conservación de datos",
    body: (
      <>
        <p>
          Conservamos información de cuenta, pedidos, comunicaciones y archivos
          durante el tiempo razonablemente necesario para prestar el servicio,
          apoyar revisiones, mantener registros de negocio, resolver disputas y
          cumplir necesidades legales o de seguridad.
        </p>
        <p>
          Las comunicaciones de soporte, incluidos los mensajes gestionados a
          través de Crisp, pueden conservarse durante el tiempo razonablemente
          necesario para responder, mantener registros de negocio, resolver
          disputas y cumplir necesidades legales o de seguridad.
        </p>
        <p>
          No garantizamos almacenamiento permanente de archivos entregados o
          subidos. Los clientes deben descargar y guardar copias de seguridad de
          los archivos terminados cuanto antes.
        </p>
      </>
    ),
  },
  {
    title: "Opciones del usuario y contacto",
    body: (
      <>
        <p>
          Puedes contactarnos para preguntar sobre tu información, solicitar
          actualizaciones de datos de cuenta o preguntar si ciertos archivos
          pueden eliminarse del almacenamiento activo cuando sea práctico y
          legalmente apropiado.
        </p>
        <p>
          Para preguntas de privacidad, escribe a{" "}
          <TrackedOutboundLink
            href={`mailto:${contactEmail}?subject=Privacy%20question`}
            analyticsLocation="contact_page"
            className="font-semibold text-primary hover:text-primary-light"
          >
            {contactEmail}
          </TrackedOutboundLink>
          .
        </p>
      </>
    ),
  },
  {
    title: "Seguridad",
    body: (
      <p>
        Usamos medidas técnicas y organizativas prácticas diseñadas para
        proteger datos de cuenta, registros de pedidos y archivos subidos.
        Ningún sitio web, sistema de almacenamiento o método de transmisión es
        perfectamente seguro, pero trabajamos para limitar el acceso, usar
        flujos protegidos y mantener las credenciales sensibles del servicio en
        el servidor.
      </p>
    ),
  },
  {
    title: "Procesamiento internacional",
    body: (
      <p>
        PicchuSpot puede procesar información usando proveedores e
        infraestructura ubicados en países distintos de donde vives o trabajas.
        Al usar el servicio, entiendes que la información puede gestionarse a
        través de fronteras según sea necesario para operar el sitio web y
        entregar tu pedido.
      </p>
    ),
  },
];

export default function SpanishPrivacyPage() {
  return (
    <section className="py-16 lg:py-24 bg-white">
      <Container>
        <div className="max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-4">
            Política de privacidad
          </p>
          <h1 className="text-3xl lg:text-5xl font-bold text-primary tracking-tight leading-[1.05] mb-5">
            Cómo gestionamos la información de clientes y proyectos
          </h1>
          <p className="text-base lg:text-lg text-muted leading-relaxed">
            Recopilamos solo la información necesaria para operar PicchuSpot,
            completar pedidos visuales inmobiliarios, comunicarnos con claridad
            y proteger el servicio.
          </p>
          <p className="mt-5 text-sm text-muted">
            Última actualización: 30 de junio de 2026
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-8 lg:gap-12">
          <div className="space-y-6">
            {sections.map((section) => (
              <section
                key={section.title}
                className="bg-surface border border-border rounded-2xl p-6 lg:p-8"
              >
                <h2 className="text-xl font-bold text-primary mb-4">
                  {section.title}
                </h2>
                <div className="prose prose-sm max-w-none text-muted leading-relaxed [&_p]:mb-4 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-2">
                  {section.body}
                </div>
              </section>
            ))}
          </div>

          <aside className="lg:sticky lg:top-24 h-fit bg-white border border-border rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-primary mb-3">
              Preguntas de privacidad
            </h2>
            <p className="text-sm text-muted leading-relaxed mb-5">
              Para preguntas sobre esta política o tu cuenta de PicchuSpot,
              contacta con nosotros por email.
            </p>
            <TrackedOutboundLink
              href={`mailto:${contactEmail}?subject=Privacy%20question`}
              analyticsLocation="contact_page"
              className="inline-flex items-center justify-center w-full px-5 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-light transition-colors"
            >
              Enviar email a PicchuSpot
            </TrackedOutboundLink>
            <Link
              href="/es/terms"
              className="mt-3 inline-flex items-center justify-center w-full px-5 py-3 border border-border rounded-xl text-sm font-bold text-primary hover:border-primary/40 hover:bg-surface transition-colors"
            >
              Ver términos
            </Link>
          </aside>
        </div>
      </Container>
    </section>
  );
}
