import Link from "next/link";
import type { LegalSection } from "@/components/legal/LegalPage";

const contactEmail = "hello@picchuspot.com";

function PolicyTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: readonly string[];
  rows: readonly (readonly React.ReactNode[])[];
}) {
  return (
    <>
      <div
        className="divide-y divide-line border-y border-line sm:hidden"
        role="region"
        aria-label={caption}
      >
        {rows.map((row, rowIndex) => (
          <section key={rowIndex} className="py-5 first:pt-4 last:pb-4">
            <h3 className="font-bold text-primary">{row[0]}</h3>
            <dl className="mt-3 space-y-3">
              {row.slice(1).map((cell, cellIndex) => (
                <div key={cellIndex}>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary-dark">
                    {headers[cellIndex + 1]}
                  </dt>
                  <dd className="mt-1 text-sm leading-6 text-muted">{cell}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <div
        className="hidden max-w-full overflow-x-auto border-y border-line sm:block"
        tabIndex={0}
        role="region"
        aria-label={caption}
      >
        <table className="min-w-[46rem] border-collapse text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-line bg-surface">
              {headers.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="px-3 py-3 font-bold text-primary"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-line last:border-b-0">
                {row.map((cell, cellIndex) =>
                  cellIndex === 0 ? (
                    <th
                      key={cellIndex}
                      scope="row"
                      className="px-3 py-3 align-top font-semibold text-foreground"
                    >
                      {cell}
                    </th>
                  ) : (
                    <td key={cellIndex} className="px-3 py-3 align-top text-muted">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export const termsSectionsEn = [
  {
    id: "about",
    title: "1. About these Terms",
    body: (
      <>
        <p>
          These Terms govern visual services ordered from PicchuSpot, a service
          operating from Spain. They apply to consumers and business customers;
          mandatory consumer rights continue to apply where they cannot lawfully
          be excluded.
        </p>
        <p>
          The service can include remote virtual staging, virtual renovation,
          floor-plan work and photo editing, plus separately quoted on-location
          photography and media services where available. The order summary,
          an accepted written quote and any written scope confirmation form part
          of the agreement for the relevant order.
        </p>
      </>
    ),
  },
  {
    id: "order-process",
    title: "2. Order and contract process",
    body: (
      <>
        <p>
          To request a remote service, you sign in, select the service and
          options, provide instructions and files, review the summary, accept
          these Terms, and submit. You can correct the information shown before
          submission. The site creates a pending order record in your account
          and may send a transactional confirmation.
        </p>
        <p>
          For an eligible fixed-price order with an amount due, you can then
          continue to hosted Stripe Checkout. A valid zero-total order proceeds
          without Stripe Checkout. Other orders require a written scope, custom
          quote, manual payment or scheduling confirmation. The agreement
          becomes binding when PicchuSpot accepts the order by confirming the
          scope, confirming a no-payment-required order, or making the agreed
          fixed-price service available for payment, subject to any mandatory
          rule that applies to you. A pending order does not mean that
          production has begun.
        </p>
        <p>
          The ordering interface and these Terms are available in English and
          Spanish. You can save or print these Terms, and your account retains
          the operational order summary. Contact us promptly if a submitted
          detail needs correction.
        </p>
      </>
    ),
  },
  {
    id: "scope",
    title: "3. Scope, inputs and customer responsibilities",
    body: (
      <>
        <p>
          The agreed scope is defined by the selected service, quantity,
          options, uploaded materials, written instructions and any accepted
          quote. You must provide complete, accurate and usable inputs. We may
          pause work, ask questions, revise an estimate or decline a request if
          material information is missing or the requested result is not
          reasonably achievable.
        </p>
        <p>By supplying materials or instructions, you confirm that:</p>
        <ul>
          <li>
            you have the rights and permissions needed to provide the photos,
            plans, sketches, branding, references and other content;
          </li>
          <li>
            the property, project and contact information you provide is
            accurate, and your instructions are lawful;
          </li>
          <li>
            you will review the result and make the disclosures required by
            your listing platform, MLS, profession and local law; and
          </li>
          <li>
            you will not ask us to create deceptive content or to remove a
            material property fact that must be disclosed.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "pricing-payment",
    title: "4. Pricing, tax and payment",
    body: (
      <>
        <p>
          The order summary or written quote identifies the applicable price
          and currency. Supported online currencies are USD, CAD and EUR.
          Quantity, selected options and approved extra work can affect the
          total. Large or unusual requests may require a custom quote instead
          of immediate online payment.
        </p>
        <p>
          Eligible online payments use Stripe-hosted Checkout. Checkout shows
          the amount due and, where automatic tax applies, the displayed total
          is tax-inclusive and identifies the tax included. A manual quote or
          invoice will state its own tax treatment. PicchuSpot does not collect
          the full card number or CVC in its order form.
        </p>
        <p>
          Any required payment must be verified before production normally
          begins. A valid no-payment-required order may begin after order
          confirmation. If a required payment fails, is reversed, or remains
          outstanding, we may pause the order. We will obtain your agreement
          before charging for additional work outside the confirmed scope.
        </p>
      </>
    ),
  },
  {
    id: "turnaround-delivery",
    title: "5. Turnaround and delivery",
    body: (
      <>
        <p>
          A 24–48 hour turnaround is a usual estimate for many standard remote
          services, not a guaranteed deadline. It starts only when we have
          any required verified payment, complete usable files, clear
          instructions and any required approvals. Complex work, large batches, revisions, public
          holidays and events outside reasonable control can take longer.
        </p>
        <p>
          Local services depend on location, access, weather, permissions and
          scheduling. Any material deadline should be confirmed in writing
          before ordering.
        </p>
        <p>
          Deliverables are made available through the client workflow or an
          agreed delivery method. Download and back up completed files
          promptly; the service is not a permanent archive.
        </p>
      </>
    ),
  },
  {
    id: "revisions",
    title: "6. Revisions and additional work",
    body: (
      <>
        <p>
          Unlimited revisions are included for 30 calendar days from the first
          delivery of the completed work, provided the requested changes remain
          within the original brief, overall style and design direction and use
          the original source materials.
        </p>
        <p>
          Included revisions may cover specific adjustments such as changing
          colours, materials or textures, replacing or repositioning individual
          furniture or décor items, changing the size or appearance of
          individual objects, and correcting particular details needed to
          better match the original brief.
        </p>
        <p>
          A substantial redesign — including changing the overall style or
          design direction, replacing most or all of the furniture, supplying a
          new source image or angle, requesting additional images or
          deliverables or a different service, materially expanding the
          original brief, or otherwise requiring the work to be substantially
          recreated — is considered new work. A series of revision requests
          that collectively results in a substantial redesign may also be
          treated as new work.
        </p>
        <p>
          This included creative-revision policy is separate from correction of
          work that does not conform to the agreed scope and does not limit
          mandatory consumer rights or remedies. We will explain any separate
          price or timing for new work and seek approval before continuing.
        </p>
      </>
    ),
  },
  {
    id: "cancellations",
    title: "7. Cancellations, withdrawal and refunds",
    body: (
      <>
        <p>
          Cancellation and refund handling depends on whether work has begun,
          the payment route, the agreed scope and any mandatory consumer right.
          The dedicated{" "}
          <Link href="/refunds">Refunds &amp; Cancellations Policy</Link>{" "}
          forms part of these Terms.
        </p>
        <p>
          Consumers contracting at a distance may normally have a 14-day
          statutory withdrawal period. Where the customer expressly requests
          PicchuSpot to start during that period, work may begin after any
          required payment is confirmed or, where no payment is due, after order
          confirmation.
        </p>
        <p>
          If the consumer withdraws after work has started, a proportionate
          amount may be due for the service already supplied. The withdrawal
          right is lost once the service has been fully performed where the
          applicable statutory consent conditions are satisfied. Mandatory
          consumer rights remain unaffected.
        </p>
      </>
    ),
  },
  {
    id: "intellectual-property",
    title: "8. Intellectual property and permitted use",
    body: (
      <>
        <p>
          You keep your rights in the source materials you provide. Subject to
          full payment and any third-party licence restrictions stated in the
          order, you may use the final deliverables for the property and
          marketing purpose for which they were commissioned, including
          listings, websites, social media and brochures.
        </p>
        <p>
          PicchuSpot and its licensors retain rights in production methods,
          software, templates, 3D assets, textures, stock elements and other
          reusable materials. Unless agreed in writing, an order does not
          transfer source project files, software or reusable production
          assets.
        </p>
      </>
    ),
  },
  {
    id: "portfolio",
    title: "9. Portfolio permission",
    body: (
      <>
        <p>
          PicchuSpot may use ordered work in its public gallery, service pages,
          homepage or marketing only when the customer gives the separate
          optional permission presented in the order flow. That option is off
          by default and is not required to receive the service.
        </p>
        <p>
          You may withdraw permission for future promotional use by contacting
          us. Withdrawal does not make earlier lawful use retroactively
          unlawful, but we will act on future controlled publication within a
          reasonable operational period.
        </p>
      </>
    ),
  },
  {
    id: "property-accuracy",
    title: "10. Property accuracy and disclosure",
    body: (
      <>
        <p>
          Virtual staging, virtual renovation, image editing and illustrative
          plans show a possible presentation of a property. They are not a
          survey, appraisal, inspection, architectural plan, measurement
          certificate or promise that physical work can be completed as shown.
        </p>
        <p>
          You are responsible for checking the final files and clearly
          identifying virtual or material edits wherever required. Floor-plan
          and measurement outputs should be treated as marketing illustrations
          unless a written scope expressly says otherwise.
        </p>
      </>
    ),
  },
  {
    id: "availability",
    title: "11. Availability and third-party services",
    body: (
      <>
        <p>
          We may refuse or reschedule work that is unsafe, unlawful, outside
          service coverage, technically unsuitable or dependent on unavailable
          access, weather or permissions. On-location services are confirmed
          only after the location, scope and schedule are accepted in writing.
        </p>
        <p>
          The website relies on third-party infrastructure for authentication,
          storage, hosted payment and communications. Temporary interruption
          can occur. We will use reasonable efforts to restore service and
          protect active orders, without promising uninterrupted availability.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    title: "12. Responsibility and liability",
    body: (
      <>
        <p>
          PicchuSpot is responsible for providing the agreed service with
          reasonable care and skill. If a deliverable does not conform to the
          agreed scope, contact us promptly so we can investigate and provide
          an appropriate correction or other remedy.
        </p>
        <p>
          To the extent permitted by law, PicchuSpot is not responsible for
          indirect business losses, missed commissions or third-party platform
          decisions that were not reasonably caused by a breach of the agreed
          service. Any contractual limitation applies only where lawful and
          does not limit liability or consumer remedies that cannot be limited,
          including liability arising from fraud, wilful misconduct or other
          legally protected matters.
        </p>
      </>
    ),
  },
  {
    id: "law-disputes",
    title: "13. Governing law and disputes",
    body: (
      <>
        <p>
          These Terms are governed by Spanish law. If you are a consumer, this
          choice does not deprive you of mandatory protections of the country
          where you habitually reside. Courts and dispute routes are determined
          by the mandatory jurisdiction rules that apply to the parties.
        </p>
        <p>
          Please email us first so we can try to resolve a concern directly.
          This does not restrict a right to use a competent consumer authority,
          regulator or court.
        </p>
      </>
    ),
  },
  {
    id: "changes-contact",
    title: "14. Changes and contact",
    body: (
      <>
        <p>
          The version recorded for an accepted order continues to govern that
          order unless a lawful written amendment is agreed. We may update the
          website version for future orders and will show the new effective
          date and version.
        </p>
        <p>
          Questions, corrections or notices can be sent to{" "}
          <a href={"mailto:" + contactEmail}>{contactEmail}</a> or through the{" "}
          <Link href="/contact">contact page</Link>.
        </p>
      </>
    ),
  },
] as const satisfies readonly LegalSection[];

export const termsSectionsEs = [
  {
    id: "about",
    title: "1. Sobre estos Términos",
    body: (
      <>
        <p>
          Estos Términos regulan los servicios visuales contratados con
          PicchuSpot, un servicio que opera desde España. Se aplican tanto a
          consumidores como a clientes profesionales; los derechos imperativos
          de las personas consumidoras siguen siendo aplicables cuando no
          puedan excluirse legalmente.
        </p>
        <p>
          El servicio puede incluir Virtual Staging, renovación virtual,
          trabajos de planos y edición fotográfica a distancia, además de
          fotografía y servicios audiovisuales presenciales presupuestados por
          separado donde estén disponibles. El resumen del pedido, el
          presupuesto aceptado y cualquier confirmación escrita del alcance
          forman parte del acuerdo correspondiente.
        </p>
      </>
    ),
  },
  {
    id: "order-process",
    title: "2. Proceso de pedido y contratación",
    body: (
      <>
        <p>
          Para solicitar un servicio remoto, inicias sesión, eliges el servicio
          y las opciones, aportas instrucciones y archivos, revisas el resumen,
          aceptas estos Términos y envías el pedido. Puedes corregir los datos
          mostrados antes del envío. El sitio crea un pedido pendiente en tu
          cuenta y puede enviar una confirmación transaccional.
        </p>
        <p>
          En un pedido elegible de precio fijo con un importe pendiente,
          después puedes continuar al Checkout alojado por Stripe. Un pedido
          válido con total cero continúa sin Stripe Checkout. Otros pedidos
          requieren confirmar por escrito el alcance, un presupuesto
          personalizado, pago manual o la reserva de fecha. El acuerdo pasa a
          ser vinculante cuando PicchuSpot acepta el pedido confirmando el
          alcance, confirmando un pedido sin pago requerido o habilitando para
          pago el servicio de precio fijo acordado, sin perjuicio de cualquier
          norma imperativa aplicable. Un pedido pendiente no significa que la
          producción haya comenzado.
        </p>
        <p>
          La interfaz de pedido y estos Términos están disponibles en español e
          inglés. Puedes guardar o imprimir los Términos y tu cuenta conserva el
          resumen operativo. Contáctanos cuanto antes si necesitas corregir un
          dato después del envío.
        </p>
      </>
    ),
  },
  {
    id: "scope",
    title: "3. Alcance, materiales y responsabilidades",
    body: (
      <>
        <p>
          El alcance se define por el servicio, la cantidad y las opciones
          elegidas, los materiales subidos, las instrucciones escritas y el
          presupuesto aceptado. Debes aportar información completa, exacta y
          utilizable. Podemos pausar el trabajo, pedir aclaraciones, revisar una
          estimación o rechazar una solicitud si falta información relevante o
          el resultado solicitado no es razonablemente viable.
        </p>
        <p>Al aportar materiales o instrucciones confirmas que:</p>
        <ul>
          <li>
            dispones de los derechos y permisos necesarios sobre fotos, planos,
            bocetos, marcas, referencias y demás contenido;
          </li>
          <li>
            la información del inmueble, proyecto y contacto es exacta y tus
            instrucciones son lícitas;
          </li>
          <li>
            revisarás el resultado y realizarás las divulgaciones exigidas por
            tu plataforma, MLS, profesión y normativa local; y
          </li>
          <li>
            no solicitarás contenido engañoso ni la eliminación de un hecho
            material del inmueble que deba comunicarse.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "pricing-payment",
    title: "4. Precios, impuestos y pago",
    body: (
      <>
        <p>
          El resumen del pedido o presupuesto escrito identifica el precio y la
          moneda aplicables. Las monedas admitidas online son USD, CAD y EUR. La
          cantidad, las opciones y el trabajo adicional aprobado pueden afectar
          al total. Las solicitudes grandes o inusuales pueden requerir un
          presupuesto personalizado en lugar de pago online inmediato.
        </p>
        <p>
          Los pagos online elegibles usan Checkout alojado por Stripe. Checkout
          muestra el importe debido y, cuando se aplica el cálculo automático
          de impuestos, el total mostrado incluye el impuesto e identifica el
          importe incluido. Cada presupuesto o factura manual indicará su
          tratamiento fiscal. PicchuSpot no recopila el número completo de la
          tarjeta ni el CVC en su formulario de pedido.
        </p>
        <p>
          Cualquier pago exigible debe estar verificado antes de que
          normalmente comience la producción. Un pedido válido sin pago
          requerido puede comenzar después de la confirmación del pedido. Si un
          pago exigible falla, se revierte o queda pendiente, podemos pausar el
          pedido. Solicitaremos tu conformidad antes de cobrar trabajo
          adicional fuera del alcance confirmado.
        </p>
      </>
    ),
  },
  {
    id: "turnaround-delivery",
    title: "5. Plazos y entrega",
    body: (
      <>
        <p>
          El plazo de 24–48 horas es una estimación habitual para muchos
          servicios remotos estándar, no una fecha garantizada. Solo empieza
          cuando disponemos de cualquier pago exigible verificado, archivos completos y
          utilizables, instrucciones claras y las aprobaciones necesarias. Los
          trabajos complejos, lotes grandes, revisiones, festivos y sucesos
          fuera de un control razonable pueden ampliar el plazo.
        </p>
        <p>
          Los servicios locales dependen de ubicación, acceso, clima, permisos
          y agenda. Cualquier plazo esencial debe confirmarse por escrito antes
          de contratar.
        </p>
        <p>
          Los entregables se facilitan mediante el flujo del cliente o el medio
          acordado. Descarga y guarda los archivos terminados cuanto antes; el
          servicio no es un archivo permanente.
        </p>
      </>
    ),
  },
  {
    id: "revisions",
    title: "6. Revisiones y trabajo adicional",
    body: (
      <>
        <p>
          Se incluyen revisiones ilimitadas durante los 30 días naturales
          siguientes a la primera entrega del trabajo terminado, siempre que
          los cambios solicitados se mantengan dentro del encargo original, el
          estilo general y la línea de diseño acordada, y utilicen los
          materiales originales aportados.
        </p>
        <p>
          Las revisiones incluidas pueden abarcar ajustes concretos, como
          cambiar colores, materiales o texturas; sustituir o recolocar muebles
          o elementos decorativos concretos; modificar el tamaño o aspecto de
          objetos individuales; y corregir detalles específicos para ajustarse
          mejor al encargo original.
        </p>
        <p>
          Un rediseño sustancial —incluido cambiar el estilo general o la línea
          de diseño, sustituir la mayoría o la totalidad del mobiliario, aportar
          una nueva imagen o ángulo de origen, pedir imágenes o entregables
          adicionales o un servicio distinto, ampliar de forma material el
          encargo original o exigir que el trabajo se rehaga en gran medida— se
          considera trabajo nuevo. Una serie de solicitudes que, en conjunto,
          suponga un rediseño sustancial también puede tratarse como trabajo
          nuevo.
        </p>
        <p>
          Esta política de revisiones creativas incluidas es independiente de
          la corrección de un trabajo que no se ajuste al alcance acordado y no
          limita los derechos ni remedios imperativos de las personas
          consumidoras. Explicaremos cualquier precio o plazo separado del
          trabajo nuevo y pediremos aprobación antes de continuar.
        </p>
      </>
    ),
  },
  {
    id: "cancellations",
    title: "7. Cancelaciones, desistimiento y reembolsos",
    body: (
      <>
        <p>
          La gestión depende de si el trabajo ha comenzado, el medio de pago,
          el alcance acordado y cualquier derecho imperativo de consumo. La{" "}
          <Link href="/es/refunds">
            Política de reembolsos y cancelaciones
          </Link>{" "}
          forma parte de estos Términos.
        </p>
        <p>
          Las personas consumidoras que contratan a distancia normalmente
          pueden disponer de un plazo legal de desistimiento de 14 días. Cuando
          el cliente solicite expresamente que PicchuSpot comience durante ese
          plazo, el trabajo podrá comenzar una vez confirmado cualquier pago
          exigible o, si no se adeuda pago alguno, después de la confirmación del
          pedido.
        </p>
        <p>
          Si la persona consumidora desiste después de que haya comenzado el
          trabajo, puede corresponder un importe proporcional por el servicio ya
          prestado. El derecho de desistimiento se pierde una vez que el servicio
          se ha ejecutado íntegramente cuando se cumplen las condiciones de
          consentimiento exigidas por la ley aplicable. Los derechos imperativos
          de las personas consumidoras no se ven afectados.
        </p>
      </>
    ),
  },
  {
    id: "intellectual-property",
    title: "8. Propiedad intelectual y uso permitido",
    body: (
      <>
        <p>
          Conservas tus derechos sobre los materiales originales que aportas.
          Tras el pago completo y sujeto a las restricciones de licencias de
          terceros indicadas en el pedido, puedes usar los entregables finales
          para el inmueble y la finalidad de marketing para los que fueron
          encargados, incluidos anuncios, sitios web, redes sociales y folletos.
        </p>
        <p>
          PicchuSpot y sus licenciantes conservan los derechos sobre métodos de
          producción, software, plantillas, recursos 3D, texturas, elementos de
          stock y otros materiales reutilizables. Salvo acuerdo escrito, un
          pedido no transfiere proyectos fuente, software ni recursos de
          producción reutilizables.
        </p>
      </>
    ),
  },
  {
    id: "portfolio",
    title: "9. Permiso de portfolio",
    body: (
      <>
        <p>
          PicchuSpot solo puede usar el trabajo encargado en su galería,
          páginas de servicio, inicio o marketing cuando el cliente concede el
          permiso opcional y separado del flujo de pedido. La opción está
          desactivada por defecto y no es necesaria para recibir el servicio.
        </p>
        <p>
          Puedes retirar el permiso para usos promocionales futuros. La retirada
          no convierte en ilícito un uso anterior que fuera lícito, pero
          actuaremos sobre futuras publicaciones bajo nuestro control dentro de
          un plazo operativo razonable.
        </p>
      </>
    ),
  },
  {
    id: "property-accuracy",
    title: "10. Exactitud del inmueble y divulgación",
    body: (
      <>
        <p>
          El Virtual Staging, la renovación virtual, la edición de imagen y los
          planos ilustrativos muestran una posible presentación del inmueble.
          No son una inspección, tasación, peritaje, proyecto arquitectónico,
          certificado de medición ni promesa de que una obra física pueda
          ejecutarse tal como se muestra.
        </p>
        <p>
          Debes revisar los archivos finales e identificar claramente las
          ediciones virtuales o materiales cuando sea obligatorio. Los planos y
          mediciones se consideran ilustraciones de marketing salvo que el
          alcance escrito indique expresamente otra cosa.
        </p>
      </>
    ),
  },
  {
    id: "availability",
    title: "11. Disponibilidad y servicios de terceros",
    body: (
      <>
        <p>
          Podemos rechazar o reprogramar trabajos inseguros, ilícitos, fuera de
          cobertura, técnicamente inadecuados o dependientes de acceso, clima o
          permisos no disponibles. Los servicios presenciales solo quedan
          confirmados tras aceptar por escrito ubicación, alcance y agenda.
        </p>
        <p>
          El sitio depende de infraestructura externa para autenticación,
          almacenamiento, pago alojado y comunicaciones. Pueden producirse
          interrupciones temporales. Usaremos esfuerzos razonables para
          restaurar el servicio y proteger pedidos activos, sin prometer una
          disponibilidad ininterrumpida.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    title: "12. Responsabilidad",
    body: (
      <>
        <p>
          PicchuSpot es responsable de prestar el servicio acordado con la
          diligencia razonable. Si un entregable no se ajusta al alcance,
          contáctanos cuanto antes para que podamos investigarlo y ofrecer una
          corrección u otro remedio adecuado.
        </p>
        <p>
          En la medida permitida por la ley, PicchuSpot no responde de pérdidas
          empresariales indirectas, comisiones no obtenidas o decisiones de
          plataformas externas que no hayan sido causadas razonablemente por un
          incumplimiento del servicio. Cualquier limitación contractual se
          aplica solo cuando sea lícita y no limita responsabilidades o remedios
          de consumo que no puedan limitarse, incluidos fraude, conducta dolosa
          u otras materias legalmente protegidas.
        </p>
      </>
    ),
  },
  {
    id: "law-disputes",
    title: "13. Ley aplicable y controversias",
    body: (
      <>
        <p>
          Estos Términos se rigen por la ley española. Si eres consumidor, esta
          elección no te priva de la protección imperativa del país donde
          resides habitualmente. Los tribunales y vías de resolución se
          determinan conforme a las normas imperativas de competencia
          aplicables a las partes.
        </p>
        <p>
          Escríbenos primero para intentar resolver directamente cualquier
          incidencia. Esto no restringe el derecho a acudir a una autoridad de
          consumo, regulador o tribunal competente.
        </p>
      </>
    ),
  },
  {
    id: "changes-contact",
    title: "14. Cambios y contacto",
    body: (
      <>
        <p>
          La versión registrada para un pedido aceptado continúa rigiéndolo
          salvo modificación escrita y válida. Podemos actualizar la versión
          del sitio para pedidos futuros y mostraremos la nueva fecha de
          vigencia y versión.
        </p>
        <p>
          Puedes enviar preguntas, correcciones o notificaciones a{" "}
          <a href={"mailto:" + contactEmail}>{contactEmail}</a> o mediante la{" "}
          <Link href="/es/contact">página de contacto</Link>.
        </p>
      </>
    ),
  },
] as const satisfies readonly LegalSection[];

export const privacySectionsEn = [
  {
    id: "controller",
    title: "1. Controller and contact",
    body: (
      <>
        <p>
          For the processing described in this Policy, the controller operates
          from Spain under the trading name PicchuSpot. Privacy requests can be
          sent to{" "}
          <a href={"mailto:" + contactEmail}>{contactEmail}</a>. This Policy
          applies when you browse the public site, create an account, place or
          review an order, upload files, use support, or submit a property
          enquiry.
        </p>
        <p>
          If another organisation gives you access to PicchuSpot or places an
          order involving your information, that organisation may also be a
          controller for its own use. Contact it about processing it controls.
        </p>
      </>
    ),
  },
  {
    id: "data-categories",
    title: "2. Information we process",
    body: (
      <>
        <ul>
          <li>
            <strong>Account and contact data:</strong> name, email, telephone,
            company, locale and profile information.
          </li>
          <li>
            <strong>Order and commercial data:</strong> services, quantities,
            pricing snapshot, currency, tax/payment status, instructions,
            revisions, confirmations and transaction references.
          </li>
          <li>
            <strong>Project content:</strong> property photos, plans, sketches,
            references, filenames, notes, branding, review attachments and
            completed deliverables.
          </li>
          <li>
            <strong>Communications:</strong> contact requests, property
            enquiries, transactional email, support messages, review comments
            and recent context shared during a requested human-support handoff.
          </li>
          <li>
            <strong>Technical and preference data:</strong> authentication
            session, language, region, currency, cookie choice, browser/device
            information, security events, rate-limit identifiers and consented
            analytics events.
          </li>
        </ul>
        <p>
          Required account, order, payment and project fields are needed to
          provide the requested service. If they are not supplied, we may be
          unable to create or complete the order. Portfolio permission and
          analytics consent are optional.
        </p>
      </>
    ),
  },
  {
    id: "purposes-bases",
    title: "3. Purposes and legal bases",
    body: (
      <PolicyTable
        caption="Purposes and legal bases"
        headers={["Purpose", "Information", "Legal basis"]}
        rows={[
          [
            "Accounts, quotes and orders",
            "Account, contact, order, project and communication data",
            "Steps requested before a contract and performance of the service contract",
          ],
          [
            "Payments, tax and records",
            "Order totals, billing details, transaction references and status",
            "Contract performance and compliance with accounting, tax and legal obligations",
          ],
          [
            "Delivery, review and support",
            "Project files, deliverables, revisions and communications",
            "Contract performance and legitimate interests in responsive customer service",
          ],
          [
            "Security and abuse prevention",
            "Session, network/technical events, hashed rate-limit identifier and audit records",
            "Legitimate interests in protecting customers, systems and the service; legal obligations where applicable",
          ],
          [
            "Analytics",
            "Consented Google Analytics events and related technology",
            "Consent, which can be withdrawn through Cookie settings",
          ],
          [
            "Portfolio publication",
            "Selected project visuals and associated display information",
            "Separate optional permission/consent, withdrawable for future use",
          ],
          [
            "Legal claims and compliance",
            "Relevant account, transaction, communication and security records",
            "Legal obligation and legitimate interests in establishing, exercising or defending claims",
          ],
        ]}
      />
    ),
  },
  {
    id: "orders-files",
    title: "4. Orders, files and deliverables",
    body: (
      <>
        <p>
          Source uploads, visual references and review attachments are used to
          scope and produce the ordered work. Customer source files and
          deliverables are kept in private storage and made available through
          authenticated or time-limited access. Access is limited according to
          the customer/order relationship and authorised operational roles.
        </p>
        <p>
          Please avoid including unnecessary personal information in filenames,
          images or instructions. Real-estate media can reveal an address,
          occupancy, belongings or other sensitive context even when it does
          not identify a person by name.
        </p>
        <p>
          Promotional publication is separate from production. It occurs only
          when the order&apos;s optional portfolio permission is enabled and the
          work is independently approved for a public location.
        </p>
      </>
    ),
  },
  {
    id: "payments",
    title: "5. Payments",
    body: (
      <>
        <p>
          Eligible fixed-price orders use Stripe-hosted Checkout. Stripe
          receives the payment and billing details entered on its page and
          returns transaction, tax and status information needed to reconcile
          the order. PicchuSpot&apos;s order form does not receive the full card
          number or CVC.
        </p>
        <p>
          PicchuSpot retains order totals, currency, payment status, provider
          identifiers and refund state as needed for service, accounting,
          disputes and legal obligations. Custom-quote or local services may
          use a separately confirmed billing route.
        </p>
      </>
    ),
  },
  {
    id: "support-ai",
    title: "6. AI and human support",
    body: (
      <>
        <p>
          The support assistant sends the current question and limited recent
          conversation context to Google&apos;s Gemini service to generate a reply.
          Provider request storage is disabled in the application request, and
          PicchuSpot does not persist that AI transcript in its application
          database. Processing by the external provider is still necessary to
          generate the response.
        </p>
        <p>
          A limited completed transcript can remain in your browser session to
          keep the widget usable. For rate limiting, the server converts a
          trusted network address into an HMAC-hashed identifier before using
          Upstash; Upstash analytics is disabled.
        </p>
        <p>
          Crisp loads only after you explicitly request a human handoff in
          production. Crisp may then receive your submitted email, optional
          name, locale, current page path, limited recent AI context and the
          messages you send in its interface. The configured support cookie
          expires after 30 days. You can instead use the contact page.
        </p>
        <p>
          Do not place passwords, payment-card data, government identifiers or
          unrelated confidential information in support messages.
        </p>
      </>
    ),
  },
  {
    id: "analytics",
    title: "7. Analytics and browser storage",
    body: (
      <>
        <p>
          Google Analytics is configured with Consent Mode set to denied before
          a choice is made. PicchuSpot enables its page-view configuration and
          analytics events only after you accept analytics. Advertising storage,
          advertising user data and advertising personalisation remain denied.
          Admin and client-dashboard routes are excluded from application
          analytics.
        </p>
        <p>
          Published property pages also record a small set of first-party,
          aggregate content events. The application record contains the
          property/event identifiers and a timestamp, not a visitor identifier,
          email, telephone number or application-level IP field. Hosting and
          security infrastructure can still process transient request metadata.
        </p>
        <p>
          Necessary and functional storage supports authentication, consent
          choice, language, region, currency, form recovery and support-session
          continuity. See the <Link href="/cookies">Cookie Policy</Link> for the
          complete current browser-storage description and controls.
        </p>
      </>
    ),
  },
  {
    id: "recipients",
    title: "8. Service providers and recipients",
    body: (
      <PolicyTable
        caption="Service providers and their roles"
        headers={["Provider/category", "Role", "Information involved"]}
        rows={[
          [
            "Supabase",
            "Authentication, database and private file storage",
            "Account, order, communication, file and access-control data",
          ],
          [
            "Vercel",
            "Application hosting, delivery and operational logs",
            "Website requests and technical/operational data",
          ],
          [
            "Stripe",
            "Hosted Checkout, tax/payment processing and refund events",
            "Billing, transaction, tax and payment-status data",
          ],
          [
            "Resend",
            "Transactional email delivery",
            "Recipient, message and delivery metadata",
          ],
          [
            "Google",
            "Gemini support responses and consent-controlled Analytics",
            "Support prompt/context or consented analytics/technical data",
          ],
          [
            "Crisp",
            "On-demand human support",
            "Submitted contact data, page/locale, limited context and messages",
          ],
          [
            "Cloudflare",
            "Turnstile anti-abuse checks on relevant forms",
            "Security token and technical request data",
          ],
          [
            "Upstash",
            "Support rate limiting",
            "HMAC-hashed rate-limit identifier and counters",
          ],
        ]}
      />
    ),
  },
  {
    id: "disclosures",
    title: "9. Other disclosures",
    body: (
      <>
        <p>
          We may disclose relevant information to professional advisers,
          insurers, authorities, courts or counterparties where reasonably
          necessary to comply with law, protect rights and security, investigate
          misuse, complete a corporate transaction, or establish, exercise or
          defend a legal claim.
        </p>
        <p>
          Property-enquiry information is delivered to the intended business
          contact so the enquiry can be answered. We do not describe the
          providers above as independent advertisers and do not sell personal
          information as part of the current service.
        </p>
      </>
    ),
  },
  {
    id: "transfers",
    title: "10. International processing",
    body: (
      <>
        <p>
          PicchuSpot operates from Spain, but technology providers may process
          information in other countries. Where personal information is
          transferred outside the European Economic Area, PicchuSpot relies on
          the transfer basis and safeguards applicable to the relevant provider
          arrangement, such as an adequacy decision or approved contractual
          safeguards.
        </p>
        <p>
          You may ask us for further information about safeguards relevant to
          your information. Provider locations and sub-processors can change,
          so this Policy does not promise that all processing remains in one
          country.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "11. Retention",
    body: (
      <>
        <p>
          We retain information only for as long as reasonably needed for the
          purpose for which it was collected. Criteria include the life of the
          account or order, production and revision needs, customer support,
          file reissue, payment/accounting duties, security, limitation periods,
          disputes and legal preservation obligations.
        </p>
        <p>
          Browser session storage normally ends with the session; preference
          storage remains until it expires, is replaced or is cleared. Provider
          systems may keep operational backups and logs under their controlled
          schedules. PicchuSpot does not guarantee permanent storage of source
          files or deliverables, so customers should keep their own copies.
        </p>
        <p>
          When information is no longer required, we delete, anonymise or
          isolate it as appropriate, subject to technical backup cycles and
          lawful record-keeping needs.
        </p>
      </>
    ),
  },
  {
    id: "rights",
    title: "12. Your data-protection rights",
    body: (
      <>
        <p>
          Subject to the applicable conditions, you may request access,
          rectification, erasure, restriction, portability or objection. Where
          processing relies on consent, you may withdraw it for the future
          without affecting earlier lawful processing. You may also object to
          processing based on legitimate interests.
        </p>
        <p>
          Send the request to{" "}
          <a href={"mailto:" + contactEmail}>{contactEmail}</a> and describe
          what you need. We may request proportionate information to verify
          identity and protect the account. Requests are normally free, subject
          to the exceptions allowed by law.
        </p>
        <p>
          You can also complain to the{" "}
          <a href="https://www.aepd.es/" rel="noreferrer">
            Spanish Data Protection Agency (AEPD)
          </a>{" "}
          or another competent supervisory authority, especially in the country
          of your habitual residence, work or the alleged infringement.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "13. Security",
    body: (
      <>
        <p>
          PicchuSpot uses measures designed to protect information in light of
          the risk, including authenticated access, server-side ownership
          checks, private storage, time-limited file access, payment-webhook
          verification, anti-abuse controls and keeping privileged credentials
          on the server.
        </p>
        <p>
          No online service can guarantee absolute security. Customers should
          protect account credentials, use a secure email account and contact us
          promptly about suspected unauthorised access.
        </p>
      </>
    ),
  },
  {
    id: "automated-decisions",
    title: "14. Automated decisions and children",
    body: (
      <>
        <p>
          PicchuSpot does not intend to make decisions based solely on automated
          processing that produce legal or similarly significant effects. The
          support assistant provides guidance; it does not submit orders, make
          binding price decisions or authorise payments.
        </p>
        <p>
          The service is intended for adults and business users, not children.
          Please do not submit personal information about a child unless it is
          necessary, lawful and appropriate for a specific property project.
        </p>
      </>
    ),
  },
  {
    id: "updates",
    title: "15. Policy updates",
    body: (
      <>
        <p>
          We may update this Policy when the service, providers or legal
          requirements change. The current effective date and version appear at
          the top. Material changes will be presented through an appropriate
          website, account or direct notice according to their significance.
        </p>
        <p>
          For a privacy question or request, email{" "}
          <a href={"mailto:" + contactEmail}>{contactEmail}</a>.
        </p>
      </>
    ),
  },
] as const satisfies readonly LegalSection[];

export const privacySectionsEs = [
  {
    id: "controller",
    title: "1. Responsable y contacto",
    body: (
      <>
        <p>
          Para los tratamientos descritos en esta Política, el responsable
          opera desde España bajo el nombre comercial PicchuSpot. Puedes enviar
          solicitudes de privacidad a{" "}
          <a href={"mailto:" + contactEmail}>{contactEmail}</a>. Esta Política
          se aplica cuando navegas por el sitio público, creas una cuenta,
          realizas o revisas un pedido, subes archivos, usas soporte o envías una
          consulta sobre un inmueble.
        </p>
        <p>
          Si otra organización te facilita acceso a PicchuSpot o realiza un
          pedido con información sobre ti, también puede ser responsable de sus
          propios usos. Dirígete a ella respecto de los tratamientos que
          controle.
        </p>
      </>
    ),
  },
  {
    id: "data-categories",
    title: "2. Información que tratamos",
    body: (
      <>
        <ul>
          <li>
            <strong>Cuenta y contacto:</strong> nombre, correo electrónico,
            teléfono, empresa, idioma y datos del perfil.
          </li>
          <li>
            <strong>Pedido y datos comerciales:</strong> servicios, cantidades,
            copia de precios, moneda, estado fiscal y de pago, instrucciones,
            revisiones, confirmaciones y referencias de transacción.
          </li>
          <li>
            <strong>Contenido del proyecto:</strong> fotos del inmueble, planos,
            bocetos, referencias, nombres de archivo, notas, marcas, adjuntos de
            revisión y entregables terminados.
          </li>
          <li>
            <strong>Comunicaciones:</strong> formularios de contacto, consultas
            de inmuebles, email transaccional, soporte, comentarios de revisión
            y contexto reciente compartido al solicitar soporte humano.
          </li>
          <li>
            <strong>Datos técnicos y preferencias:</strong> sesión de
            autenticación, idioma, región, moneda, elección de cookies,
            navegador/dispositivo, eventos de seguridad, identificadores de
            limitación y eventos de analítica consentidos.
          </li>
        </ul>
        <p>
          Los campos obligatorios de cuenta, pedido, pago y proyecto son
          necesarios para prestar el servicio. Si no se aportan, es posible que
          no podamos crear o completar el pedido. El permiso de portfolio y el
          consentimiento de analítica son opcionales.
        </p>
      </>
    ),
  },
  {
    id: "purposes-bases",
    title: "3. Finalidades y bases jurídicas",
    body: (
      <PolicyTable
        caption="Finalidades y bases jurídicas"
        headers={["Finalidad", "Información", "Base jurídica"]}
        rows={[
          [
            "Cuentas, presupuestos y pedidos",
            "Datos de cuenta, contacto, pedido, proyecto y comunicación",
            "Medidas precontractuales solicitadas y ejecución del contrato de servicio",
          ],
          [
            "Pagos, impuestos y registros",
            "Totales, facturación, referencias y estado de transacción",
            "Ejecución contractual y obligaciones contables, fiscales y legales",
          ],
          [
            "Entrega, revisión y soporte",
            "Archivos, entregables, revisiones y comunicaciones",
            "Ejecución contractual e interés legítimo en un soporte eficaz",
          ],
          [
            "Seguridad y prevención del abuso",
            "Sesión, eventos técnicos/red, identificador hash de limitación y auditoría",
            "Interés legítimo en proteger clientes, sistemas y servicio; obligación legal cuando proceda",
          ],
          [
            "Analítica",
            "Eventos de Google Analytics consentidos y tecnología asociada",
            "Consentimiento, revocable en Configuración de cookies",
          ],
          [
            "Publicación en portfolio",
            "Imágenes seleccionadas e información de presentación",
            "Permiso/consentimiento opcional separado, revocable para usos futuros",
          ],
          [
            "Cumplimiento y reclamaciones",
            "Registros pertinentes de cuenta, transacción, comunicación y seguridad",
            "Obligación legal e interés legítimo en formular, ejercer o defender reclamaciones",
          ],
        ]}
      />
    ),
  },
  {
    id: "orders-files",
    title: "4. Pedidos, archivos y entregables",
    body: (
      <>
        <p>
          Los archivos originales, referencias y adjuntos de revisión se usan
          para definir y producir el trabajo. Los originales y entregables se
          guardan en almacenamiento privado y se facilitan mediante acceso
          autenticado o temporal. El acceso se limita según la relación entre
          cliente y pedido y los roles operativos autorizados.
        </p>
        <p>
          Evita incluir información personal innecesaria en nombres de archivo,
          imágenes o instrucciones. El material inmobiliario puede revelar una
          dirección, ocupación, pertenencias u otro contexto sensible aunque no
          identifique a una persona por su nombre.
        </p>
        <p>
          La publicación promocional es independiente de la producción. Solo se
          realiza cuando está habilitado el permiso opcional del pedido y el
          trabajo se aprueba de forma independiente para una ubicación pública.
        </p>
      </>
    ),
  },
  {
    id: "payments",
    title: "5. Pagos",
    body: (
      <>
        <p>
          Los pedidos elegibles de precio fijo usan Checkout alojado por
          Stripe. Stripe recibe los datos de pago y facturación introducidos en
          su página y devuelve la información de transacción, impuestos y estado
          necesaria para conciliar el pedido. El formulario de PicchuSpot no
          recibe el número completo de tarjeta ni el CVC.
        </p>
        <p>
          PicchuSpot conserva totales, moneda, estado de pago, identificadores
          del proveedor y estado de reembolso cuando es necesario para servicio,
          contabilidad, controversias y obligaciones legales. Los servicios con
          presupuesto o locales pueden usar un medio de facturación confirmado
          por separado.
        </p>
      </>
    ),
  },
  {
    id: "support-ai",
    title: "6. Soporte con IA y humano",
    body: (
      <>
        <p>
          El asistente envía la pregunta actual y contexto reciente limitado a
          Gemini de Google para generar una respuesta. El almacenamiento de la
          solicitud por el proveedor está desactivado en la petición de la
          aplicación y PicchuSpot no persiste esa conversación de IA en su base
          de datos. No obstante, el proveedor externo debe tratarla para generar
          la respuesta.
        </p>
        <p>
          Una conversación terminada y limitada puede permanecer durante la
          sesión del navegador. Para limitar abusos, el servidor convierte una
          dirección de red fiable en un identificador con hash HMAC antes de
          usar Upstash; la analítica de Upstash está desactivada.
        </p>
        <p>
          Crisp solo se carga cuando solicitas expresamente atención humana en
          producción. Puede recibir el email aportado, nombre opcional, idioma,
          ruta actual, contexto reciente limitado y mensajes enviados en su
          interfaz. La cookie de soporte configurada caduca a los 30 días.
          También puedes usar la página de contacto.
        </p>
        <p>
          No incluyas contraseñas, datos de tarjeta, identificadores oficiales
          ni información confidencial ajena en mensajes de soporte.
        </p>
      </>
    ),
  },
  {
    id: "analytics",
    title: "7. Analítica y almacenamiento del navegador",
    body: (
      <>
        <p>
          Google Analytics se configura con el modo de consentimiento denegado
          antes de elegir. PicchuSpot solo habilita su configuración de vistas y
          eventos de analítica después de aceptar. El almacenamiento
          publicitario, datos de usuario publicitarios y personalización
          publicitaria permanecen denegados. Las rutas de administración y del
          panel de cliente están excluidas de la analítica de la aplicación.
        </p>
        <p>
          Las páginas públicas de inmuebles también registran un conjunto
          reducido de eventos agregados y propios. El registro de aplicación
          contiene identificadores de inmueble/evento y fecha, no un
          identificador de visitante, email, teléfono ni un campo de IP. La
          infraestructura de hosting y seguridad puede tratar metadatos técnicos
          transitorios de la solicitud.
        </p>
        <p>
          El almacenamiento necesario y funcional admite autenticación,
          elección de consentimiento, idioma, región, moneda, recuperación de
          formularios y continuidad del soporte. Consulta la{" "}
          <Link href="/es/cookies">Política de cookies</Link> para ver la
          descripción y controles actuales.
        </p>
      </>
    ),
  },
  {
    id: "recipients",
    title: "8. Proveedores y destinatarios",
    body: (
      <PolicyTable
        caption="Proveedores y funciones"
        headers={["Proveedor/categoría", "Función", "Información implicada"]}
        rows={[
          [
            "Supabase",
            "Autenticación, base de datos y almacenamiento privado",
            "Cuenta, pedido, comunicaciones, archivos y control de acceso",
          ],
          [
            "Vercel",
            "Hosting, entrega y registros operativos",
            "Solicitudes web y datos técnicos/operativos",
          ],
          [
            "Stripe",
            "Checkout, impuestos/pagos y eventos de reembolso",
            "Facturación, transacción, impuestos y estado de pago",
          ],
          [
            "Resend",
            "Entrega de email transaccional",
            "Destinatario, mensaje y metadatos de entrega",
          ],
          [
            "Google",
            "Respuestas Gemini y Analytics sujeto a consentimiento",
            "Pregunta/contexto de soporte o datos técnicos/de analítica consentidos",
          ],
          [
            "Crisp",
            "Soporte humano bajo petición",
            "Contacto aportado, página/idioma, contexto limitado y mensajes",
          ],
          [
            "Cloudflare",
            "Comprobaciones antiabuso Turnstile",
            "Token de seguridad y datos técnicos de solicitud",
          ],
          [
            "Upstash",
            "Limitación del asistente",
            "Identificador con hash HMAC y contadores",
          ],
        ]}
      />
    ),
  },
  {
    id: "disclosures",
    title: "9. Otras comunicaciones",
    body: (
      <>
        <p>
          Podemos comunicar información pertinente a asesores, aseguradoras,
          autoridades, tribunales o contrapartes cuando sea razonablemente
          necesario para cumplir la ley, proteger derechos y seguridad,
          investigar usos indebidos, completar una operación societaria o
          formular, ejercer o defender una reclamación.
        </p>
        <p>
          La información de consultas de inmuebles se entrega al contacto
          empresarial previsto para responder. No describimos a los proveedores
          anteriores como anunciantes independientes ni vendemos información
          personal como parte del servicio actual.
        </p>
      </>
    ),
  },
  {
    id: "transfers",
    title: "10. Tratamiento internacional",
    body: (
      <>
        <p>
          PicchuSpot opera desde España, pero sus proveedores tecnológicos
          pueden tratar información en otros países. Cuando los datos personales
          se transfieren fuera del Espacio Económico Europeo, PicchuSpot se basa
          en el fundamento y las garantías aplicables al acuerdo con el
          proveedor, como una decisión de adecuación o garantías contractuales
          aprobadas.
        </p>
        <p>
          Puedes pedir información adicional sobre las garantías pertinentes.
          Las ubicaciones y subencargados pueden cambiar, por lo que esta
          Política no promete que todo el tratamiento permanezca en un único
          país.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "11. Conservación",
    body: (
      <>
        <p>
          Conservamos la información solo durante el tiempo razonablemente
          necesario para su finalidad. Los criterios incluyen la vida de la
          cuenta o pedido, producción y revisiones, soporte, reenvío de archivos,
          obligaciones de pago y contabilidad, seguridad, plazos de
          prescripción, controversias y deberes legales de conservación.
        </p>
        <p>
          El almacenamiento de sesión suele terminar con la sesión del
          navegador; las preferencias permanecen hasta que caducan, se
          sustituyen o borran. Los proveedores pueden conservar copias y
          registros operativos según sus plazos. PicchuSpot no garantiza el
          almacenamiento permanente de originales o entregables: conserva tus
          propias copias.
        </p>
        <p>
          Cuando la información deja de ser necesaria, la eliminamos,
          anonimizamos o aislamos según proceda, sujeto a ciclos técnicos de
          copia y necesidades legales de registro.
        </p>
      </>
    ),
  },
  {
    id: "rights",
    title: "12. Tus derechos de protección de datos",
    body: (
      <>
        <p>
          Sujeto a las condiciones aplicables, puedes solicitar acceso,
          rectificación, supresión, limitación, portabilidad u oposición. Cuando
          el tratamiento se base en consentimiento, puedes retirarlo para el
          futuro sin afectar al tratamiento lícito anterior. También puedes
          oponerte al tratamiento basado en intereses legítimos.
        </p>
        <p>
          Escribe a <a href={"mailto:" + contactEmail}>{contactEmail}</a> e
          indica qué necesitas. Podemos pedir información proporcionada para
          verificar tu identidad y proteger la cuenta. Las solicitudes son
          normalmente gratuitas, salvo las excepciones legales.
        </p>
        <p>
          También puedes reclamar ante la{" "}
          <a href="https://www.aepd.es/" rel="noreferrer">
            Agencia Española de Protección de Datos (AEPD)
          </a>{" "}
          u otra autoridad competente, en particular la de tu residencia
          habitual, lugar de trabajo o de la supuesta infracción.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "13. Seguridad",
    body: (
      <>
        <p>
          PicchuSpot utiliza medidas diseñadas según el riesgo, entre ellas
          acceso autenticado, comprobaciones de propiedad en servidor,
          almacenamiento privado, acceso temporal a archivos, verificación de
          webhooks de pago, controles antiabuso y credenciales privilegiadas
          limitadas al servidor.
        </p>
        <p>
          Ningún servicio online puede garantizar seguridad absoluta. Protege
          tus credenciales, usa una cuenta de email segura y avísanos cuanto
          antes si sospechas un acceso no autorizado.
        </p>
      </>
    ),
  },
  {
    id: "automated-decisions",
    title: "14. Decisiones automatizadas y menores",
    body: (
      <>
        <p>
          PicchuSpot no pretende adoptar decisiones basadas únicamente en
          tratamiento automatizado que produzcan efectos legales o similares
          significativos. El asistente ofrece orientación; no envía pedidos,
          fija precios vinculantes ni autoriza pagos.
        </p>
        <p>
          El servicio está dirigido a personas adultas y usuarios
          empresariales, no a menores. No aportes datos personales de menores
          salvo que sea necesario, lícito y apropiado para un proyecto concreto.
        </p>
      </>
    ),
  },
  {
    id: "updates",
    title: "15. Actualizaciones",
    body: (
      <>
        <p>
          Podemos actualizar esta Política si cambian el servicio, los
          proveedores o los requisitos legales. La fecha y versión actuales
          aparecen al inicio. Los cambios materiales se comunicarán por un medio
          adecuado en el sitio, la cuenta o directamente según su importancia.
        </p>
        <p>
          Para preguntas o solicitudes de privacidad, escribe a{" "}
          <a href={"mailto:" + contactEmail}>{contactEmail}</a>.
        </p>
      </>
    ),
  },
] as const satisfies readonly LegalSection[];

export const cookieSectionsEn = [
  {
    id: "scope",
    title: "1. What this Policy covers",
    body: (
      <>
        <p>
          This Policy explains cookies and similar browser technologies used by
          PicchuSpot. A cookie is a small value stored by the browser and sent
          with relevant requests. Local storage and session storage are
          browser-held values that are not automatically sent like cookies but
          can serve similar preference or continuity purposes.
        </p>
        <p>
          The current site uses necessary technology, user-requested functional
          preferences, on-demand support technology and optional analytics.
          This Policy should be read with the{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </>
    ),
  },
  {
    id: "choices",
    title: "2. Your analytics choice",
    body: (
      <>
        <p>
          The consent banner offers <strong>Reject</strong> and{" "}
          <strong>Accept analytics</strong>. Before a choice, Google Consent
          Mode defaults analytics and advertising-related consent to denied.
          PicchuSpot enables its Google Analytics page-view setup and analytics
          events only after acceptance. Advertising storage, advertising user
          data and advertising personalisation remain denied.
        </p>
        <p>
          The Google tag can initialise in denied mode. Depending on Google&apos;s
          consent-mode behaviour, limited cookieless consent and technical
          signals may be transmitted even though PicchuSpot has not enabled its
          page-view and event measurement. Rejecting prevents PicchuSpot from
          granting analytics storage.
        </p>
        <p>
          You can change the choice at any time using{" "}
          <strong>Cookie settings</strong> in the footer. Withdrawing consent
          affects future use and does not undo processing that was lawful before
          withdrawal.
        </p>
      </>
    ),
  },
  {
    id: "first-party-storage",
    title: "3. PicchuSpot cookies and browser storage",
    body: (
      <PolicyTable
        caption="PicchuSpot cookies and browser storage"
        headers={["Name/category", "Storage", "Purpose", "When used", "Duration"]}
        rows={[
          [
            "Authentication session",
            "Necessary first-party cookies managed through Supabase",
            "Sign-in, session continuity and server-side authentication",
            "When account/authentication features are used",
            "Session/security configuration; may be refreshed or removed at sign-out",
          ],
          [
            "picchuspot_cookie_consent",
            "Local storage",
            "Remember accepted or rejected analytics choice",
            "After a banner choice",
            "Until changed in Cookie settings or browser storage is cleared",
          ],
          [
            "picchuspot_language / picchuspot-language",
            "One-year first-party cookie / local storage",
            "Remember the language selected by the user",
            "After a language choice",
            "Cookie: one year; local storage: until replaced or cleared",
          ],
          [
            "picchuspot_region and picchuspot_currency",
            "One-year first-party cookies",
            "Remember selected region and display currency",
            "After a region/currency choice",
            "One year",
          ],
          [
            "picchuspot-region and picchuspot-currency",
            "Local storage",
            "Keep the selected region and currency consistent in the browser",
            "After a region/currency choice",
            "Until replaced or cleared",
          ],
          [
            "Order, draft and support-prefill recovery",
            "Session storage",
            "Recover limited form state or continue an order action during the browser session",
            "When the relevant form/action is used",
            "Browser session or earlier removal after completion",
          ],
          [
            "picchuspot_support_chat_session_v1",
            "Session storage",
            "Keep a capped recent support conversation available in the widget",
            "When the support assistant is used",
            "Browser session or earlier manual/automatic clearing",
          ],
        ]}
      />
    ),
  },
  {
    id: "provider-technology",
    title: "4. Provider technology",
    body: (
      <PolicyTable
        caption="Third-party cookies and similar technology"
        headers={["Provider", "Category and purpose", "Activation", "Consent/control", "Duration"]}
        rows={[
          [
            "Google Analytics",
            "Optional audience and conversion measurement",
            "Tag may initialise with consent denied; PicchuSpot measurement is enabled after acceptance",
            "Consent; Reject or Cookie settings",
            "Provider-controlled according to the Analytics configuration and browser controls",
          ],
          [
            "Crisp",
            "Requested live-support session and conversation continuity",
            "Only after an explicit request to speak with human support in production",
            "User-requested support action; you can use the contact page instead",
            "PicchuSpot configures the Crisp support cookie for 30 days",
          ],
          [
            "Cloudflare Turnstile",
            "Necessary security and automated-abuse detection on relevant forms",
            "When a protected authentication or property-enquiry form is shown",
            "Necessary for the protected form when configured",
            "Provider-controlled; PicchuSpot does not establish a fixed cookie name or period here",
          ],
          [
            "Stripe Checkout",
            "Necessary hosted payment, fraud prevention and transaction continuity",
            "When an eligible customer opens Stripe-hosted Checkout",
            "Necessary to complete the requested online payment; leave Checkout to avoid proceeding",
            "Controlled by Stripe on its hosted service",
          ],
        ]}
      />
    ),
  },
  {
    id: "necessary-functional",
    title: "5. Necessary and functional technology",
    body: (
      <>
        <p>
          Authentication and security storage is necessary to sign in, protect
          forms and keep the requested service secure. Disabling it can prevent
          account, checkout or protected-form functions from working.
        </p>
        <p>
          Language, region and currency values are set after a user makes the
          corresponding selection. They remember a requested preference rather
          than create an advertising profile. Session storage supports the
          action currently requested and normally ends with the browser
          session.
        </p>
        <p>
          First-party property content counters do not use an application
          visitor cookie or local-storage identifier. Their database record
          contains a property/event reference and time, not a visitor ID.
        </p>
      </>
    ),
  },
  {
    id: "manage",
    title: "6. How to manage storage",
    body: (
      <>
        <ol>
          <li>
            Use <strong>Cookie settings</strong> in the footer to accept or
            reject future Google Analytics use by PicchuSpot.
          </li>
          <li>
            Use your browser&apos;s privacy controls to inspect or delete cookies,
            local storage and session storage for <code>picchuspot.com</code>.
          </li>
          <li>
            Sign out to end the active account session, then clear site data if
            you also want to remove remembered local preferences.
          </li>
        </ol>
        <p>
          Blocking all cookies can stop authentication, security, payment or
          preference functions. Browser controls do not necessarily delete
          records that must be retained in provider or PicchuSpot systems for a
          contract, security or legal reason.
        </p>
      </>
    ),
  },
  {
    id: "changes-contact",
    title: "7. Changes and contact",
    body: (
      <>
        <p>
          This inventory reflects the current application. Providers may update
          their technology, and PicchuSpot may revise this Policy when features
          change. The effective date and version appear at the top.
        </p>
        <p>
          Questions about cookies or browser storage can be sent to{" "}
          <a href={"mailto:" + contactEmail}>{contactEmail}</a>.
        </p>
      </>
    ),
  },
] as const satisfies readonly LegalSection[];

export const cookieSectionsEs = [
  {
    id: "scope",
    title: "1. Qué cubre esta Política",
    body: (
      <>
        <p>
          Esta Política explica las cookies y tecnologías similares del
          navegador usadas por PicchuSpot. Una cookie es un pequeño valor
          almacenado por el navegador y enviado con las solicitudes
          correspondientes. El almacenamiento local y de sesión contiene
          valores en el navegador que no se envían automáticamente como una
          cookie, pero pueden cumplir funciones similares de preferencia o
          continuidad.
        </p>
        <p>
          El sitio actual utiliza tecnología necesaria, preferencias funcionales
          solicitadas, soporte bajo petición y analítica opcional. Lee esta
          Política junto con la{" "}
          <Link href="/es/privacy">Política de privacidad</Link>.
        </p>
      </>
    ),
  },
  {
    id: "choices",
    title: "2. Tu elección de analítica",
    body: (
      <>
        <p>
          El banner ofrece <strong>Rechazar</strong> y{" "}
          <strong>Aceptar analítica</strong>. Antes de elegir, el modo de
          consentimiento de Google establece como denegados el almacenamiento
          de analítica y las señales relacionadas con publicidad. PicchuSpot
          solo habilita su configuración de vistas y eventos de Google Analytics
          después de aceptar. El almacenamiento, los datos de usuario y la
          personalización publicitarios permanecen denegados.
        </p>
        <p>
          La etiqueta de Google puede inicializarse en modo denegado. Según el
          comportamiento del modo de consentimiento, pueden transmitirse señales
          técnicas y de consentimiento limitadas sin cookies, aunque PicchuSpot
          no haya habilitado su medición de vistas y eventos. Rechazar impide que
          PicchuSpot conceda el almacenamiento de analítica.
        </p>
        <p>
          Puedes cambiar la elección en cualquier momento mediante{" "}
          <strong>Configuración de cookies</strong> en el pie. La retirada afecta
          a usos futuros y no anula tratamientos anteriores que fueran lícitos.
        </p>
      </>
    ),
  },
  {
    id: "first-party-storage",
    title: "3. Cookies y almacenamiento de PicchuSpot",
    body: (
      <PolicyTable
        caption="Cookies y almacenamiento de PicchuSpot"
        headers={["Nombre/categoría", "Almacenamiento", "Finalidad", "Uso", "Duración"]}
        rows={[
          [
            "Sesión de autenticación",
            "Cookies propias necesarias gestionadas mediante Supabase",
            "Inicio de sesión, continuidad y autenticación en servidor",
            "Al usar funciones de cuenta/autenticación",
            "Configuración de sesión/seguridad; puede renovarse o eliminarse al salir",
          ],
          [
            "picchuspot_cookie_consent",
            "Almacenamiento local",
            "Recordar si se aceptó o rechazó la analítica",
            "Tras elegir en el banner",
            "Hasta cambiarlo en Configuración o borrar los datos del sitio",
          ],
          [
            "picchuspot_language / picchuspot-language",
            "Cookie propia de un año / almacenamiento local",
            "Recordar el idioma elegido",
            "Tras elegir idioma",
            "Cookie: un año; local: hasta sustituirlo o borrarlo",
          ],
          [
            "picchuspot_region y picchuspot_currency",
            "Cookies propias de un año",
            "Recordar región y moneda de visualización",
            "Tras elegir región/moneda",
            "Un año",
          ],
          [
            "picchuspot-region y picchuspot-currency",
            "Almacenamiento local",
            "Mantener región y moneda coherentes en el navegador",
            "Tras elegir región/moneda",
            "Hasta sustituirlos o borrarlos",
          ],
          [
            "Recuperación de pedido, borrador y precarga de soporte",
            "Almacenamiento de sesión",
            "Recuperar estado limitado o continuar una acción en la sesión",
            "Al usar el formulario o acción",
            "Sesión del navegador o eliminación anterior al completar",
          ],
          [
            "picchuspot_support_chat_session_v1",
            "Almacenamiento de sesión",
            "Mantener en el widget una conversación reciente limitada",
            "Al usar el asistente",
            "Sesión del navegador o borrado manual/automático anterior",
          ],
        ]}
      />
    ),
  },
  {
    id: "provider-technology",
    title: "4. Tecnología de proveedores",
    body: (
      <PolicyTable
        caption="Cookies y tecnologías de terceros"
        headers={["Proveedor", "Categoría y finalidad", "Activación", "Control", "Duración"]}
        rows={[
          [
            "Google Analytics",
            "Medición opcional de audiencia y conversión",
            "La etiqueta puede iniciarse con consentimiento denegado; la medición de PicchuSpot se habilita al aceptar",
            "Consentimiento; Rechazar o Configuración de cookies",
            "Controlada por el proveedor según configuración de Analytics y navegador",
          ],
          [
            "Crisp",
            "Sesión de soporte humano solicitada y continuidad",
            "Solo tras pedir expresamente hablar con una persona en producción",
            "Acción de soporte solicitada; puede usarse la página de contacto",
            "PicchuSpot configura la cookie de soporte durante 30 días",
          ],
          [
            "Cloudflare Turnstile",
            "Seguridad necesaria y detección automatizada de abuso",
            "Al mostrar un formulario protegido de autenticación o consulta",
            "Necesaria para el formulario protegido cuando está configurada",
            "Control del proveedor; PicchuSpot no establece aquí nombre o plazo fijo",
          ],
          [
            "Stripe Checkout",
            "Pago alojado, prevención del fraude y continuidad de transacción",
            "Al abrir Checkout para un pedido elegible",
            "Necesaria para completar el pago solicitado; sal de Checkout para no continuar",
            "Controlada por Stripe en su servicio alojado",
          ],
        ]}
      />
    ),
  },
  {
    id: "necessary-functional",
    title: "5. Tecnología necesaria y funcional",
    body: (
      <>
        <p>
          El almacenamiento de autenticación y seguridad es necesario para
          iniciar sesión, proteger formularios y mantener seguro el servicio.
          Desactivarlo puede impedir el funcionamiento de cuenta, pago o
          formularios protegidos.
        </p>
        <p>
          Los valores de idioma, región y moneda se guardan después de que el
          usuario elige. Recuerdan una preferencia solicitada, no crean un perfil
          publicitario. El almacenamiento de sesión respalda la acción en curso
          y normalmente termina con la sesión del navegador.
        </p>
        <p>
          Los contadores propios de contenido inmobiliario no usan una cookie o
          identificador local de visitante. Su registro contiene una referencia
          de inmueble/evento y fecha, no un ID de visitante.
        </p>
      </>
    ),
  },
  {
    id: "manage",
    title: "6. Cómo gestionar el almacenamiento",
    body: (
      <>
        <ol>
          <li>
            Usa <strong>Configuración de cookies</strong> en el pie para aceptar
            o rechazar el uso futuro de Google Analytics por PicchuSpot.
          </li>
          <li>
            Usa los controles de privacidad de tu navegador para revisar o
            eliminar cookies y almacenamiento local/de sesión de{" "}
            <code>picchuspot.com</code>.
          </li>
          <li>
            Cierra sesión para terminar la cuenta activa y borra los datos del
            sitio si también quieres eliminar preferencias locales.
          </li>
        </ol>
        <p>
          Bloquear todas las cookies puede impedir funciones de autenticación,
          seguridad, pago o preferencias. Los controles del navegador no
          eliminan necesariamente registros que un proveedor o PicchuSpot deba
          conservar por contrato, seguridad u obligación legal.
        </p>
      </>
    ),
  },
  {
    id: "changes-contact",
    title: "7. Cambios y contacto",
    body: (
      <>
        <p>
          Este inventario refleja la aplicación actual. Los proveedores pueden
          actualizar su tecnología y PicchuSpot puede revisar la Política cuando
          cambien las funciones. La fecha y versión figuran al inicio.
        </p>
        <p>
          Envía preguntas sobre cookies o almacenamiento a{" "}
          <a href={"mailto:" + contactEmail}>{contactEmail}</a>.
        </p>
      </>
    ),
  },
] as const satisfies readonly LegalSection[];

export const refundSectionsEn = [
  {
    id: "scope",
    title: "1. Scope of this Policy",
    body: (
      <>
        <p>
          This Policy explains cancellation, statutory withdrawal, service
          concerns and refunds for PicchuSpot services. It forms part of the{" "}
          <Link href="/terms">Terms &amp; Conditions</Link>. A written custom
          quote may add project-specific scheduling or cancellation terms, but
          it cannot remove a mandatory consumer right.
        </p>
        <p>
          The outcome depends on whether the customer is acting as a consumer or
          for business purposes, whether production has started, what has
          already been supplied, and the applicable law.
        </p>
      </>
    ),
  },
  {
    id: "before-work",
    title: "2. Cancellation before work begins",
    body: (
      <>
        <p>
          You may ask to cancel before PicchuSpot begins production. PicchuSpot
          does not charge for an unstarted service. If payment for that service
          has already been received, the paid service amount will be returned
          through the applicable payment route.
        </p>
        <p>
          Send the request promptly with the order number. A pending order,
          payment record or scheduled internal task is not by itself proof that
          creative production has begun. For a local appointment, tell us as
          early as possible so we can confirm whether any separately agreed,
          lawful third-party or scheduling cost applies.
        </p>
      </>
    ),
  },
  {
    id: "after-work",
    title: "3. Cancellation after work begins",
    body: (
      <>
        <p>
          If production has started, PicchuSpot will review the completed work,
          committed project resources and the reason for cancellation. For a
          business customer or a cancellation outside a statutory withdrawal
          right, any refund can be reduced by the reasonable value of work
          already performed and agreed non-recoverable project costs.
        </p>
        <p>
          PicchuSpot will not add an unannounced cancellation charge. We will
          explain the calculation and any remaining deliverable or refund. The
          special statutory rules for consumers during the withdrawal period
          are set out below and take priority where they apply.
        </p>
      </>
    ),
  },
  {
    id: "withdrawal",
    title: "4. Consumer right of withdrawal",
    body: (
      <>
        <p>
          If you are a consumer who concludes a service contract at a distance,
          you normally have 14 calendar days from conclusion of the service
          contract to withdraw without giving a reason, subject to the
          exceptions and conditions in applicable consumer law.
        </p>
        <p>
          If you expressly ask for the service to start within that period and
          then withdraw before it is complete, the law may require payment of an
          amount proportionate to the service supplied before withdrawal. The
          right is lost after a service has been fully performed only where the
          legally required prior express consent and acknowledgement were
          obtained. General acceptance of the Terms is not described here as a
          substitute for a separate express request where the law requires one.
        </p>
        <p>
          To withdraw, send any clear statement of your decision before the
          period expires. You may use this wording:
        </p>
        <blockquote className="border-l-2 border-secondary pl-4 text-foreground">
          I withdraw from the service contract for order [order number], ordered
          on [date]. Customer name: [name]. Date: [date].
        </blockquote>
        <p>
          Email the statement to{" "}
          <a href={"mailto:" + contactEmail}>{contactEmail}</a>. Keep a copy of
          the sent request. This route does not limit another legally valid,
          unequivocal withdrawal statement.
        </p>
      </>
    ),
  },
  {
    id: "service-concerns",
    title: "5. Service concerns and revisions",
    body: (
      <>
        <p>
          If a deliverable appears incomplete, defective or outside the agreed
          scope, report it promptly through the review workflow or by email and
          identify the affected item. PicchuSpot will investigate and will
          normally first offer an appropriate correction where that can bring
          the work into conformity. This correction is distinct from the
          included creative-revision policy in the Terms.
        </p>
        <p>
          A new creative direction, changed source file, taste preference not
          included in the brief, or an undisclosed third-party platform rule is
          not automatically a defect. Even so, mandatory consumer remedies for
          a non-conforming service—including correction, price reduction or
          termination where legally available—remain unaffected.
        </p>
      </>
    ),
  },
  {
    id: "request-review",
    title: "6. How to request a cancellation or refund",
    body: (
      <>
        <ol>
          <li>
            Email <a href={"mailto:" + contactEmail}>{contactEmail}</a> from the
            account email where possible.
          </li>
          <li>
            Include the order number, affected item/service, requested outcome
            and a concise explanation. Attach evidence only when relevant.
          </li>
          <li>
            Stop using or publishing a disputed deliverable if continued use
            would be inconsistent with cancellation, while preserving any copy
            reasonably needed as evidence.
          </li>
        </ol>
        <p>
          We may ask proportionate questions to verify the account, payment and
          work completed. A request is assessed under this Policy, the accepted
          order terms and mandatory law; submitting it does not predetermine the
          outcome.
        </p>
      </>
    ),
  },
  {
    id: "refund-processing",
    title: "7. Refund method and timing",
    body: (
      <>
        <p>
          An approved card refund is normally sent back through Stripe to the
          original payment method. A refund for another payment route will use
          that route unless the parties lawfully agree otherwise. Financial
          institutions control how quickly a processed refund appears.
        </p>
        <p>
          Where a statutory consumer withdrawal refund is due, PicchuSpot will
          issue it without undue delay and no later than 14 days after being
          informed of the withdrawal, subject to any deduction lawfully due for
          service already supplied. Other approved refunds are processed without
          undue delay after the review is complete.
        </p>
        <p>
          A partial refund, full refund or failed refund is reflected in the
          order payment status when the payment provider sends the relevant
          event.
        </p>
      </>
    ),
  },
  {
    id: "custom-local",
    title: "8. Custom quotes and local services",
    body: (
      <>
        <p>
          Custom-quote and local work can involve reserved production time,
          travel, access arrangements, permissions or third-party resources.
          Any project-specific cancellation term must be confirmed before
          booking. PicchuSpot will not rely on an undisclosed term.
        </p>
        <p>
          If weather, safety, access or legal restrictions prevent a local
          service, the parties may reschedule, adjust the scope or cancel the
          affected part. The written quote and mandatory law determine whether
          a refund or credit is due.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "9. Questions and unresolved concerns",
    body: (
      <>
        <p>
          Contact <a href={"mailto:" + contactEmail}>{contactEmail}</a> so the
          order record and payment can be reviewed. If you are a consumer,
          nothing in this process restricts your right to use a competent
          consumer authority, alternative dispute route or court.
        </p>
        <p>
          This Policy does not limit statutory chargeback, payment or
          data-protection rights, but contacting PicchuSpot first can allow a
          service issue or duplicate payment to be resolved more quickly.
        </p>
      </>
    ),
  },
] as const satisfies readonly LegalSection[];

export const refundSectionsEs = [
  {
    id: "scope",
    title: "1. Alcance de esta Política",
    body: (
      <>
        <p>
          Esta Política explica las cancelaciones, el desistimiento legal, las
          incidencias del servicio y los reembolsos de PicchuSpot. Forma parte de
          los <Link href="/es/terms">Términos y condiciones</Link>. Un
          presupuesto personalizado puede añadir condiciones específicas de
          agenda o cancelación, pero no eliminar un derecho imperativo de
          consumo.
        </p>
        <p>
          El resultado depende de si el cliente actúa como consumidor o
          profesional, de si la producción ha comenzado, de lo ya prestado y de
          la ley aplicable.
        </p>
      </>
    ),
  },
  {
    id: "before-work",
    title: "2. Cancelación antes de comenzar",
    body: (
      <>
        <p>
          Puedes solicitar la cancelación antes de que PicchuSpot empiece la
          producción. PicchuSpot no cobra un servicio no iniciado. Si ya recibió
          el pago de ese servicio, devolverá el importe pagado mediante el medio
          correspondiente.
        </p>
        <p>
          Envía la solicitud cuanto antes con el número de pedido. Un pedido
          pendiente, registro de pago o tarea interna programada no demuestra
          por sí solo que haya comenzado la producción creativa. Para una cita
          local, avísanos con la máxima antelación para confirmar si existe algún
          coste lícito, acordado por separado y no recuperable de agenda o de
          terceros.
        </p>
      </>
    ),
  },
  {
    id: "after-work",
    title: "3. Cancelación después de comenzar",
    body: (
      <>
        <p>
          Si la producción ha comenzado, PicchuSpot revisará el trabajo
          realizado, los recursos comprometidos y el motivo. Para un cliente
          profesional o una cancelación fuera de un derecho legal de
          desistimiento, el reembolso puede reducirse por el valor razonable del
          trabajo ya realizado y los costes de proyecto acordados y no
          recuperables.
        </p>
        <p>
          PicchuSpot no añadirá un cargo de cancelación no anunciado.
          Explicaremos el cálculo y cualquier entregable o devolución restante.
          Las reglas legales especiales para consumidores durante el plazo de
          desistimiento prevalecen cuando sean aplicables.
        </p>
      </>
    ),
  },
  {
    id: "withdrawal",
    title: "4. Derecho de desistimiento del consumidor",
    body: (
      <>
        <p>
          Si eres consumidor y celebras a distancia un contrato de servicios,
          normalmente dispones de 14 días naturales desde su celebración para
          desistir sin indicar motivo, sujeto a las excepciones y condiciones de
          la normativa aplicable.
        </p>
        <p>
          Si solicitas expresamente que el servicio empiece dentro de ese plazo
          y desistes antes de que termine, la ley puede exigir el pago de una
          cantidad proporcional a lo ya prestado. El derecho solo se pierde tras
          la ejecución completa cuando se hayan obtenido previamente el
          consentimiento expreso y el reconocimiento exigidos. La aceptación
          general de los Términos no se presenta aquí como sustituto de una
          solicitud expresa separada cuando la ley la exige.
        </p>
        <p>
          Para desistir, envía cualquier declaración inequívoca antes de que
          termine el plazo. Puedes usar este texto:
        </p>
        <blockquote className="border-l-2 border-secondary pl-4 text-foreground">
          Desisto del contrato de servicios del pedido [número], realizado el
          [fecha]. Nombre del cliente: [nombre]. Fecha: [fecha].
        </blockquote>
        <p>
          Envía la declaración a{" "}
          <a href={"mailto:" + contactEmail}>{contactEmail}</a> y guarda una
          copia. Esta vía no limita otra declaración inequívoca legalmente
          válida.
        </p>
      </>
    ),
  },
  {
    id: "service-concerns",
    title: "5. Incidencias y revisiones",
    body: (
      <>
        <p>
          Si un entregable parece incompleto, defectuoso o fuera del alcance,
          notifícalo cuanto antes mediante el flujo de revisión o por email e
          identifica el elemento. PicchuSpot lo investigará y normalmente
          ofrecerá primero una corrección adecuada cuando pueda poner el trabajo
          en conformidad. Esta corrección es distinta de la política de
          revisiones creativas incluidas en los Términos.
        </p>
        <p>
          Una nueva dirección creativa, un original modificado, una preferencia
          no incluida en el encargo o una regla no comunicada de una plataforma
          externa no son automáticamente un defecto. Aun así, permanecen
          intactos los remedios imperativos ante servicios no conformes,
          incluida corrección, reducción del precio o resolución cuando proceda.
        </p>
      </>
    ),
  },
  {
    id: "request-review",
    title: "6. Cómo solicitar cancelación o reembolso",
    body: (
      <>
        <ol>
          <li>
            Escribe a <a href={"mailto:" + contactEmail}>{contactEmail}</a>{" "}
            desde el email de la cuenta cuando sea posible.
          </li>
          <li>
            Incluye número de pedido, elemento o servicio afectado, resultado
            solicitado y explicación concisa. Adjunta pruebas solo si son
            pertinentes.
          </li>
          <li>
            Deja de usar o publicar un entregable controvertido si ese uso fuera
            incompatible con la cancelación, conservando la copia necesaria como
            prueba.
          </li>
        </ol>
        <p>
          Podemos realizar preguntas proporcionadas para verificar cuenta, pago
          y trabajo realizado. La solicitud se evalúa conforme a esta Política,
          los términos aceptados y la ley imperativa; presentarla no determina
          por adelantado el resultado.
        </p>
      </>
    ),
  },
  {
    id: "refund-processing",
    title: "7. Medio y plazo del reembolso",
    body: (
      <>
        <p>
          Un reembolso de tarjeta aprobado se envía normalmente mediante Stripe
          al medio de pago original. Otro medio de pago se reembolsa por esa vía
          salvo acuerdo lícito distinto. La entidad financiera controla cuándo
          aparece un reembolso ya procesado.
        </p>
        <p>
          Cuando proceda un reembolso por desistimiento legal, PicchuSpot lo
          emitirá sin demora indebida y, como máximo, 14 días después de ser
          informado, sujeto a la deducción legal que corresponda por el servicio
          ya prestado. Otros reembolsos aprobados se procesan sin demora
          indebida tras completar la revisión.
        </p>
        <p>
          Un reembolso parcial, completo o fallido se refleja en el estado de
          pago cuando el proveedor envía el evento correspondiente.
        </p>
      </>
    ),
  },
  {
    id: "custom-local",
    title: "8. Presupuestos y servicios locales",
    body: (
      <>
        <p>
          El trabajo personalizado o local puede implicar tiempo reservado,
          desplazamiento, acceso, permisos o recursos externos. Toda condición
          específica de cancelación debe confirmarse antes de reservar.
          PicchuSpot no aplicará una condición no comunicada.
        </p>
        <p>
          Si el clima, la seguridad, el acceso o una restricción legal impiden un
          servicio local, las partes pueden reprogramar, ajustar el alcance o
          cancelar la parte afectada. El presupuesto escrito y la ley imperativa
          determinan si procede reembolso o crédito.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "9. Preguntas e incidencias no resueltas",
    body: (
      <>
        <p>
          Contacta con{" "}
          <a href={"mailto:" + contactEmail}>{contactEmail}</a> para revisar el
          pedido y el pago. Si eres consumidor, este proceso no restringe tu
          derecho a acudir a una autoridad de consumo, vía alternativa o
          tribunal competente.
        </p>
        <p>
          Esta Política no limita derechos legales de retrocesión de cargo, pago
          o protección de datos, aunque contactar primero con PicchuSpot puede
          permitir resolver con mayor rapidez una incidencia o pago duplicado.
        </p>
      </>
    ),
  },
] as const satisfies readonly LegalSection[];
