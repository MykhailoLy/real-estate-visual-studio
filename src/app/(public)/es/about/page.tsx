import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  Home,
  ImagePlus,
  Lock,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import Container from "@/components/layout/Container";
import { spanishMetadata } from "../seo";

export const metadata = spanishMetadata({
  title: "Sobre PicchuSpot",
  description:
    "PicchuSpot ofrece servicios visuales inmobiliarios para agentes, fotógrafos, property managers, propietarios y promotores.",
  path: "/es/about",
  englishPath: "/about",
});

const audiences = [
  "Agentes inmobiliarios",
  "Fotógrafos",
  "Property managers",
  "Propietarios vendedores",
  "Promotores",
];

const strengths = [
  {
    icon: ImagePlus,
    title: "Visuales realistas",
    description:
      "Imágenes, planos y ediciones se preparan para que los anuncios se vean pulidos sin dejar de ser útiles para el marketing inmobiliario real.",
  },
  {
    icon: FileCheck2,
    title: "Flujo de pedido claro",
    description:
      "Los clientes pueden enviar archivos, instrucciones, opciones de servicio y preferencias de entrega mediante un proceso de pedido estructurado.",
  },
  {
    icon: RefreshCw,
    title: "Soporte de revisiones",
    description:
      "Las solicitudes de revisión se gestionan dentro del flujo del cliente para que el feedback quede conectado con el pedido y archivo correctos.",
  },
  {
    icon: Lock,
    title: "Entrega privada de archivos",
    description:
      "Las subidas de archivos fuente y los entregables se gestionan mediante flujos privados de dashboard diseñados para trabajo por proyecto.",
  },
];

export default function SpanishAboutPage() {
  return (
    <section className="py-16 lg:py-24 bg-white">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-10 lg:gap-16 items-center">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-4">
              Sobre PicchuSpot
            </p>
            <h1 className="text-3xl lg:text-5xl font-bold text-primary tracking-tight leading-[1.05] mb-5">
              Visuales inmobiliarios creados para anuncios más claros
            </h1>
            <p className="text-base lg:text-lg text-muted leading-relaxed max-w-3xl">
              PicchuSpot se centra en servicios visuales prácticos para real
              estate: Virtual Staging, renovación virtual, planos, retoque,
              mejora de imagen y trabajos locales o personalizados
              seleccionados.
            </p>
            <p className="mt-5 text-base lg:text-lg text-muted leading-relaxed max-w-3xl">
              El servicio nace de experiencia profesional en arquitectura,
              diseño, visualización 3D y retoque de imagen, con un objetivo
              sencillo: ayudar a profesionales inmobiliarios a presentar
              espacios de forma clara, realista y eficiente.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                href="/order"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-light transition-colors shadow-sm"
              >
                Iniciar un pedido
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <Link
                href="/es/pricing"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-xl text-sm font-bold text-primary hover:border-primary/40 hover:bg-surface transition-colors"
              >
                Ver servicios
              </Link>
              <Link
                href="/es/contact"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-xl text-sm font-bold text-primary hover:border-primary/40 hover:bg-surface transition-colors"
              >
                Contacto
              </Link>
            </div>
          </div>

          <aside className="bg-surface border border-border rounded-2xl p-6 lg:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center">
                <Home className="w-5 h-5" aria-hidden />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-secondary-dark">
                  A quién ayudamos
                </p>
                <h2 className="text-xl font-bold text-primary">
                  Equipos de marketing inmobiliario
                </h2>
              </div>
            </div>
            <div className="space-y-3">
              {audiences.map((audience) => (
                <div
                  key={audience}
                  className="flex items-center gap-3 bg-white border border-border rounded-xl px-4 py-3"
                >
                  <CheckCircle2 className="w-4 h-4 text-secondary-dark" aria-hidden />
                  <span className="text-sm font-semibold text-primary">
                    {audience}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-6">
          {strengths.map((item) => (
            <article
              key={item.title}
              className="bg-white border border-border rounded-2xl p-6 shadow-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center mb-5">
                <item.icon className="w-5 h-5 text-secondary-dark" aria-hidden />
              </div>
              <h2 className="text-lg font-bold text-primary mb-2">
                {item.title}
              </h2>
              <p className="text-sm text-muted leading-relaxed">
                {item.description}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-12 bg-primary rounded-2xl p-6 lg:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-secondary text-xs font-bold uppercase tracking-[0.18em] mb-2">
              <Sparkles className="w-4 h-4" aria-hidden />
              Cuando lo necesites
            </div>
            <h2 className="text-xl lg:text-2xl font-bold text-white">
              Sube archivos, añade instrucciones y trabaja con un flujo visual claro.
            </h2>
          </div>
          <Link
            href="/order"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-primary-dark rounded-xl text-sm font-bold hover:bg-secondary-light transition-colors"
          >
            Iniciar un pedido
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </Container>
    </section>
  );
}
