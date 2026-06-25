import Link from "next/link";
import Container from "@/components/layout/Container";
import { TERMS_VERSION } from "@/components/order/OrderTermsBlock";
import { spanishMetadata } from "../seo";

export const metadata = spanishMetadata({
  title: "Términos y condiciones",
  description:
    "Términos y condiciones de PicchuSpot: alcance de servicios, responsabilidades del cliente, revisiones, plazos, precios, entrega de archivos, derechos de autor, responsabilidad, reembolsos y funcionamiento de los servicios locales.",
  path: "/es/terms",
  englishPath: "/terms",
});

interface Section {
  id: string;
  title: string;
  body: React.ReactNode;
}

const sections: Section[] = [
  {
    id: "overview",
    title: "1. Resumen",
    body: (
      <>
        <p>
          Estos términos cubren los pedidos realizados a PicchuSpot para
          servicios de marketing visual como Virtual Staging, renovación
          virtual, planos y edición fotográfica, así como servicios
          presenciales donde estén disponibles. Al enviar un pedido, aceptas
          los términos siguientes en tu propio nombre y en nombre de cualquier
          empresa que representes.
        </p>
        <p>
          Usamos un lenguaje claro y práctico para que sepas exactamente cómo
          trabajamos. Si algo no queda claro, contacta con nosotros antes de
          hacer un pedido.
        </p>
      </>
    ),
  },
  {
    id: "scope",
    title: "2. Alcance de los servicios",
    body: (
      <>
        <p>
          Ofrecemos servicios digitales remotos en todo el mundo, incluyendo
          Virtual Staging, renovación virtual, planos 2D y 3D y edición
          fotográfica inmobiliaria. También ofrecemos servicios de media
          presenciales (fotografía, vídeo, tours 360 y dron donde esté
          permitido) en zonas seleccionadas como Alicante y Costa Blanca.
        </p>
        <p>
          El alcance exacto de cualquier pedido se define por lo que
          selecciones en el formulario de pedido, los archivos e instrucciones
          que envíes y cualquier confirmación escrita que proporcionemos.
        </p>
      </>
    ),
  },
  {
    id: "responsibilities",
    title: "3. Responsabilidades del cliente",
    body: (
      <>
        <p>Al enviar un pedido, confirmas que:</p>
        <ul>
          <li>
            Tienes el derecho o permiso para enviarnos las fotos, planos,
            bocetos, dibujos, logotipos, referencias y cualquier otro material
            que subas.
          </li>
          <li>
            Tienes derecho a solicitar las ediciones y a usar los archivos
            resultantes para tu finalidad prevista de marketing o anuncio.
          </li>
          <li>
            Eres responsable de cómo se usan los archivos finales en anuncios,
            MLS, marketing, publicidad, redes sociales o cualquier divulgación
            legal.
          </li>
          <li>
            Cualquier información que proporciones (nombres de estancias,
            direcciones, avisos, branding, etc.) es correcta.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "source-files",
    title: "4. Archivos originales e instrucciones",
    body: (
      <>
        <p>
          Nuestro trabajo depende de la calidad de lo que envíes. Fotos claras
          y bien iluminadas, medidas precisas e instrucciones específicas
          producen los mejores resultados. Las instrucciones vagas o
          incompletas pueden causar retrasos, revisiones adicionales o
          interpretaciones distintas de lo que tenías en mente.
        </p>
        <p>
          Si necesitamos hacer preguntas de seguimiento, lo haremos antes de
          empezar o pausaremos el pedido hasta recibir lo necesario.
        </p>
      </>
    ),
  },
  {
    id: "revisions",
    title: "5. Revisiones y trabajo adicional",
    body: (
      <>
        <p>
          Se incluye una revisión por elemento salvo que se indique lo
          contrario. Una revisión significa pequeñas correcciones que siguen
          las instrucciones originales, como ajustar un color que ya elegimos o
          corregir un error claramente identificado.
        </p>
        <p>
          Nuevas solicitudes, cambios de dirección o añadidos que vayan más
          allá de las instrucciones originales cuentan como trabajo adicional y
          pueden requerir un presupuesto aparte. El retrabajo significativo
          causado por instrucciones ausentes, poco claras o modificadas también
          puede cobrarse adicionalmente. Siempre confirmamos cualquier coste
          extra por escrito antes de continuar.
        </p>
      </>
    ),
  },
  {
    id: "turnaround",
    title: "6. Plazos de entrega",
    body: (
      <>
        <p>
          El plazo estándar para servicios digitales es de 24-48 horas desde
          que tenemos todo lo necesario. Los pedidos complejos, lotes grandes y
          ciertas combinaciones de opciones pueden tardar más. Si necesitas un
          plazo más ajustado, dínoslo antes de hacer el pedido para que podamos
          confirmar si es posible.
        </p>
        <p>
          El tiempo de espera por archivos, instrucciones o aprobaciones no
          cuenta dentro de la estimación de entrega.
        </p>
      </>
    ),
  },
  {
    id: "pricing",
    title: "7. Precios y facturas",
    body: (
      <>
        <p>
          Los precios mostrados en el formulario de pedido y en las páginas
          públicas de precios se muestran en la moneda compatible seleccionada.
          Los precios no incluyen los impuestos aplicables. Los impuestos se
          calculan por separado cuando corresponda. El total estimado al enviar
          se basa en lo que seleccionaste. Las facturas finales pueden variar si
          se aprueba trabajo adicional o si una solicitud compleja requiere un
          presupuesto aparte.
        </p>
        <p>
          Enviar un pedido no carga tu tarjeta. Confirmamos el alcance y te
          facturamos por separado. Cualquier condición de pago acordada por
          escrito prevalece sobre los valores predeterminados siguientes.
        </p>
      </>
    ),
  },
  {
    id: "delivery",
    title: "8. Entrega y almacenamiento de archivos",
    body: (
      <>
        <p>
          Los archivos finales se entregan como JPG de alta resolución salvo
          que acordemos otro formato. Cuando seleccionas un tamaño máximo de
          entrega para un elemento, buscamos ese objetivo preservando la calidad
          de imagen.
        </p>
        <p>
          Conservamos los archivos del pedido durante un periodo razonable para
          dar soporte a revisiones y solicitudes de reenvío, pero no
          garantizamos almacenamiento a largo plazo. Descarga y guarda tus
          archivos cuanto antes.
        </p>
      </>
    ),
  },
  {
    id: "ownership",
    title: "9. Derechos de autor y propiedad",
    body: (
      <>
        <p>
          Eres propietario de los archivos finales entregados para tu pedido
          una vez completado el pago. Puedes usarlos para el marketing de la
          propiedad para la que fueron creados, incluyendo anuncios, redes
          sociales, folletos, webs y canales de marketing similares.
        </p>
        <p>
          Conservas la propiedad de cualquier material que nos hayas subido. No
          reclamamos la propiedad de tus fotos, planos o referencias. Los
          recursos de base que usamos para producir el trabajo (modelos 3D,
          texturas, bibliotecas de decoración, software) siguen siendo nuestros
          o de nuestros licenciantes.
        </p>
      </>
    ),
  },
  {
    id: "portfolio",
    title: "10. Uso en portfolio y permiso de marketing",
    body: (
      <>
        <p>
          Podemos incluir ejemplos antes/después de pedidos entregados en
          nuestro portfolio, web o materiales de marketing, pero solo cuando nos
          hayas dado permiso explícito para hacerlo. El formulario de pedido
          incluye una casilla opcional para esto; por defecto está desactivada.
        </p>
        <p>
          Cuando se concede permiso, anonimizamos los detalles de la propiedad
          cuando sea posible y nunca mostramos información privada de contacto.
          Puedes retirar el permiso para uso futuro en cualquier momento
          escribiéndonos.
        </p>
      </>
    ),
  },
  {
    id: "accuracy",
    title: "11. Aviso sobre precisión en marketing inmobiliario",
    body: (
      <>
        <p>
          Virtual Staging, renovación virtual, edición fotográfica y planos son
          herramientas visuales para ayudar a los compradores a imaginar una
          propiedad. Muestran cómo podría verse un espacio, no cómo se ve
          actualmente. Las imágenes y planos entregados no sustituyen una
          inspección, tasación, medición topográfica o documentación formal de
          construcción.
        </p>
        <p>
          Eres responsable de divulgar claramente imágenes virtualmente
          amuebladas o editadas cuando lo exijan tus normas locales, tu MLS y
          tus obligaciones profesionales. Seguimos tus instrucciones de cerca,
          pero no podemos garantizar que cada plataforma externa, MLS,
          comprador, vendedor u organismo legal interprete las imágenes
          editadas de la misma forma.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    title: "12. Limitación de responsabilidad",
    body: (
      <>
        <p>
          Prestamos servicios con el máximo esfuerzo razonable y respaldamos la
          calidad de nuestro trabajo. En la máxima medida permitida por la ley,
          nuestra responsabilidad total por cualquier reclamación derivada de un
          pedido se limita al importe que pagaste por ese pedido.
        </p>
        <p>
          No somos responsables de pérdidas indirectas, incidentales o
          consecuentes, incluyendo anuncios perdidos, comisiones perdidas,
          ventas perdidas o reclamaciones de terceros, salvo cuando la ley
          aplicable no permita dicha limitación.
        </p>
      </>
    ),
  },
  {
    id: "refunds",
    title: "13. Reembolsos y cancelaciones",
    body: (
      <>
        <p>
          Puedes cancelar un pedido sin coste antes de que empecemos a trabajar.
          Una vez iniciado el trabajo, las cancelaciones se revisan caso por
          caso y pueden estar sujetas a una tarifa que refleje el tiempo ya
          invertido.
        </p>
        <p>
          Si un archivo entregado no coincide con el alcance acordado, avísanos
          y lo corregiremos. No ofrecemos reembolsos por cambios de opinión,
          preferencias de gusto no especificadas al hacer el pedido o requisitos
          de plataformas externas que no se compartieron con nosotros de
          antemano.
        </p>
      </>
    ),
  },
  {
    id: "local",
    title: "14. Nota sobre servicios locales",
    body: (
      <>
        <p>
          Los precios indicados para servicios presenciales en Alicante y Costa
          Blanca son solo puntos de partida. El presupuesto final depende de la
          ubicación, tamaño de la propiedad, alcance, disponibilidad de agenda,
          permisos necesarios y entregables concretos que necesites. Confirmamos
          el presupuesto por escrito antes de reservar la sesión o el tour.
        </p>
        <p>
          El trabajo con dron y aéreo se ofrece mediante un especialista
          autorizado cuando la normativa lo permite. Cuando los vuelos con dron
          no sean legalmente posibles en una ubicación concreta, propondremos
          una alternativa o rechazaremos esa parte del encargo.
        </p>
      </>
    ),
  },
  {
    id: "updates",
    title: "15. Actualizaciones de estos términos",
    body: (
      <>
        <p>
          Podemos actualizar estos términos de vez en cuando a medida que
          evolucionen nuestros servicios. La versión aplicable a tu pedido es
          la registrada contra tu pedido en el momento de envío. Los cambios
          importantes se reflejarán aquí con una etiqueta de versión
          actualizada.
        </p>
        <p>
          La versión actual de estos términos es{" "}
          <strong className="font-semibold text-foreground">
            {TERMS_VERSION}
          </strong>
          .
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "16. Contacto",
    body: (
      <p>
        ¿Tienes preguntas sobre estos términos o sobre un pedido concreto?{" "}
        <Link
          href="/es/contact"
          className="text-primary underline underline-offset-2 hover:text-primary-light"
        >
          Contacta con nosotros
        </Link>{" "}
        y te responderemos.
      </p>
    ),
  },
];

export default function SpanishTermsPage() {
  return (
    <section className="py-16 lg:py-24 bg-stone-50">
      <Container>
        <div className="max-w-3xl mx-auto">
          <header className="mb-12 lg:mb-16">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
              Legal
            </p>
            <h1 className="text-3xl lg:text-5xl font-bold text-primary mb-4 tracking-tight leading-[1.1]">
              Términos y condiciones
            </h1>
            <p className="text-base lg:text-lg text-muted leading-relaxed">
              Estos términos se aplican a cualquier pedido realizado a
              PicchuSpot. Están redactados para ser claros y prácticos, no
              cargados de jerga legal. Léelos antes de enviar un pedido.
            </p>
            <p className="text-xs text-muted mt-4">
              Versión actual:{" "}
              <span className="font-semibold text-foreground">
                {TERMS_VERSION}
              </span>
            </p>
          </header>

          <nav
            aria-label="Contenido de términos"
            className="bg-white border border-stone-200 rounded-2xl p-5 lg:p-6 shadow-sm mb-12 lg:mb-16"
          >
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted mb-3">
              Contenido
            </p>
            <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-sm text-foreground hover:text-primary transition-colors"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="space-y-12 lg:space-y-14">
            {sections.map((section) => (
              <article key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="text-xl lg:text-2xl font-bold text-primary mb-4 tracking-tight">
                  {section.title}
                </h2>
                <div className="text-sm lg:text-base text-foreground leading-relaxed space-y-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_p]:text-muted [&_li]:text-muted [&_strong]:text-foreground">
                  {section.body}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-16 lg:mt-20 pt-8 border-t border-stone-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <p className="text-xs text-muted">
              Última versión de términos{" "}
              <span className="font-semibold text-foreground">
                {TERMS_VERSION}
              </span>
            </p>
            <Link
              href="/es/contact"
              className="inline-flex items-center justify-center px-5 py-2.5 border border-primary/25 text-primary text-sm font-semibold rounded-lg hover:bg-primary hover:text-white hover:border-primary transition-all"
            >
              Contacta con nosotros
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
