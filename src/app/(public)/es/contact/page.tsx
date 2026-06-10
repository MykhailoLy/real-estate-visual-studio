import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  FolderOpen,
  LifeBuoy,
  Mail,
  MapPin,
} from "lucide-react";
import Container from "@/components/layout/Container";
import { spanishMetadata } from "../seo";

export const metadata: Metadata = spanishMetadata({
  title: "Contactar con PicchuSpot",
  description:
    "Contacta con PicchuSpot en español para presupuestos de servicios visuales inmobiliarios, soporte de pedidos existentes o trabajos locales.",
  path: "/es/contact",
  englishPath: "/contact",
});

const contactEmail = "hello@picchuspot.com";

const contactCards = [
  {
    icon: Building2,
    title: "Nuevo proyecto o presupuesto",
    description:
      "Envíanos el servicio, cantidades, plazos, ubicación si aplica y cualquier referencia que ya tengas.",
    subject: "Solicitud de presupuesto",
    body: "Hola PicchuSpot,%0D%0A%0D%0AMe gustaría recibir un presupuesto para:%0D%0AServicio:%0D%0ACantidad:%0D%0APlazo:%0D%0ANotas del proyecto:%0D%0A",
  },
  {
    icon: LifeBuoy,
    title: "Soporte de un pedido existente",
    description:
      "Incluye tu referencia de pedido y una nota breve para que podamos localizarlo rápido.",
    subject: "Soporte de pedido existente",
    body: "Hola PicchuSpot,%0D%0A%0D%0ANecesito ayuda con un pedido existente.%0D%0AReferencia del pedido:%0D%0AConsulta:%0D%0A",
  },
  {
    icon: MapPin,
    title: "Servicios locales o a medida",
    description:
      "Cuéntanos la ubicación, el tipo de propiedad y los entregables que necesitas.",
    subject: "Servicio local o a medida",
    body: "Hola PicchuSpot,%0D%0A%0D%0AMe gustaría comentar un servicio local o a medida.%0D%0AUbicación:%0D%0AServicio necesario:%0D%0APlazo:%0D%0A",
  },
];

export default function SpanishContactPage() {
  return (
    <section className="py-16 lg:py-24 bg-white">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-10 lg:gap-16 items-start">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-4">
              Contacto
            </p>
            <h1 className="text-3xl lg:text-5xl font-bold text-primary tracking-tight leading-[1.05] mb-5">
              Cuéntanos qué necesita tu propiedad o tu próximo anuncio
            </h1>
            <p className="text-base lg:text-lg text-muted leading-relaxed max-w-3xl">
              Contacta con PicchuSpot para presupuestos, dudas sobre servicios
              digitales, soporte de pedidos existentes o trabajos locales en
              Alicante y Costa Blanca. Solemos responder en 1 día laborable.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                href="/order"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-light transition-colors shadow-sm"
              >
                Iniciar pedido
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <Link
                href="/es/pricing"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-xl text-sm font-bold text-primary hover:border-primary/40 hover:bg-surface transition-colors"
              >
                Ver precios
              </Link>
              <Link
                href="/dashboard/jobs"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-xl text-sm font-bold text-primary hover:border-primary/40 hover:bg-surface transition-colors"
              >
                Área de cliente
              </Link>
            </div>
          </div>

          <aside className="bg-surface border border-border rounded-2xl p-6 lg:p-8">
            <div className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center mb-5">
              <Mail className="w-5 h-5" aria-hidden />
            </div>
            <h2 className="text-xl font-bold text-primary mb-3">
              Escribe a PicchuSpot
            </h2>
            <a
              href={`mailto:${contactEmail}?subject=Consulta%20PicchuSpot`}
              className="text-lg font-bold text-primary hover:text-primary-light break-all"
            >
              {contactEmail}
            </a>
            <p className="mt-4 text-sm text-muted leading-relaxed">
              Indica el servicio, número de imágenes o planos, plazo y notas
              del proyecto. Para soporte, incluye la referencia del pedido.
            </p>
          </aside>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
          {contactCards.map((card) => (
            <article
              key={card.title}
              className="bg-white border border-border rounded-2xl p-6 shadow-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center mb-5">
                <card.icon className="w-5 h-5 text-secondary-dark" aria-hidden />
              </div>
              <h2 className="text-lg font-bold text-primary mb-2">
                {card.title}
              </h2>
              <p className="text-sm text-muted leading-relaxed mb-5">
                {card.description}
              </p>
              <a
                href={`mailto:${contactEmail}?subject=${encodeURIComponent(
                  card.subject
                )}&body=${card.body}`}
                className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-primary-light transition-colors"
              >
                Enviar email
                <ArrowRight className="w-4 h-4" aria-hidden />
              </a>
            </article>
          ))}
        </div>

        <div className="mt-10 bg-primary rounded-2xl p-6 lg:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-secondary text-xs font-bold uppercase tracking-[0.18em] mb-2">
              <FolderOpen className="w-4 h-4" aria-hidden />
              Clientes existentes
            </div>
            <h2 className="text-xl lg:text-2xl font-bold text-white">
              ¿Buscas archivos entregados o el estado de un pedido?
            </h2>
          </div>
          <Link
            href="/dashboard/jobs"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-primary-dark rounded-xl text-sm font-bold hover:bg-secondary-light transition-colors"
          >
            Abrir área de cliente
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </Container>
    </section>
  );
}
