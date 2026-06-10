import Link from "next/link";
import { ArrowRight, Check, Clock, Home, ImagePlus, MapPin } from "lucide-react";
import Container from "@/components/layout/Container";
import CtaSection from "@/components/sections/CtaSection";
import { spanishMetadata } from "./seo";

export const metadata = spanishMetadata({
  title: "Visuales inmobiliarios para vender mejor",
  description:
    "PicchuSpot crea home staging virtual, retoque fotográfico, planos 2D/3D y contenido inmobiliario local para agencias, fotógrafos y equipos comerciales.",
  path: "/es",
  englishPath: "/",
});

const highlights = [
  "Servicios digitales remotos para clientes internacionales",
  "Fotografía y tours locales en Alicante y Costa Blanca",
  "Entrega estándar en 24-48 horas para la mayoría de encargos digitales",
];

const services = [
  {
    icon: ImagePlus,
    title: "Home staging virtual",
    text: "Amuebla espacios vacíos con un estilo realista y comercial, listo para portales inmobiliarios.",
  },
  {
    icon: Home,
    title: "Renovación virtual",
    text: "Muestra el potencial de una vivienda cambiando suelos, paredes, cocinas, baños, exteriores y más.",
  },
  {
    icon: Check,
    title: "Retoque y limpieza visual",
    text: "Mejora imágenes, elimina objetos, corrige distracciones y prepara fotos más claras para vender.",
  },
  {
    icon: MapPin,
    title: "Media local",
    text: "Fotografía, vídeo y tours 360 para propiedades en Alicante y la Costa Blanca.",
  },
];

const steps = [
  "Sube tus fotos o cuéntanos qué necesita la propiedad.",
  "Elige el servicio, el estilo y las indicaciones principales.",
  "Recibe visuales editados, revisables y listos para publicar.",
];

export default function SpanishHomePage() {
  return (
    <>
      <section className="bg-stone-50 py-16 lg:py-24">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-10 lg:gap-16 items-center">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-4">
                PicchuSpot en español
              </p>
              <h1 className="text-4xl lg:text-6xl font-bold text-primary leading-[1.05] tracking-tight mb-6">
                Visuales inmobiliarios que ayudan a vender más rápido
              </h1>
              <p className="text-base lg:text-xl text-muted leading-relaxed max-w-3xl mb-8">
                Creamos imágenes, planos y contenido visual para que tus
                anuncios destaquen: home staging virtual, renovación virtual,
                retoque fotográfico y servicios locales en Alicante y Costa
                Blanca.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/order"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary-light transition-colors text-sm shadow-sm"
                >
                  Pedir online
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </Link>
                <Link
                  href="/es/services"
                  className="inline-flex items-center justify-center px-7 py-3.5 border border-primary/25 text-primary font-semibold rounded-lg hover:bg-primary hover:text-white hover:border-primary transition-all text-sm"
                >
                  Ver servicios
                </Link>
              </div>
            </div>

            <aside className="bg-white border border-border rounded-2xl p-6 lg:p-8 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center mb-5">
                <Clock className="w-5 h-5" aria-hidden />
              </div>
              <h2 className="text-xl font-bold text-primary mb-4">
                Un flujo sencillo para equipos inmobiliarios
              </h2>
              <ul className="space-y-3">
                {highlights.map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-foreground">
                    <Check className="w-4 h-4 text-secondary-dark mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </Container>
      </section>

      <section className="py-16 lg:py-24 bg-white">
        <Container>
          <div className="max-w-3xl mb-10 lg:mb-14">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
              Servicios principales
            </p>
            <h2 className="text-3xl lg:text-5xl font-bold text-primary tracking-tight mb-4">
              Todo lo necesario para presentar mejor una propiedad
            </h2>
            <p className="text-base lg:text-lg text-muted leading-relaxed">
              Trabajamos con agentes, fotógrafos inmobiliarios, promotoras y
              equipos de alquiler que necesitan resultados claros, consistentes
              y fáciles de pedir.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-6">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <article
                  key={service.title}
                  className="bg-white border border-border rounded-2xl p-6 shadow-sm"
                >
                  <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center mb-5">
                    <Icon className="w-5 h-5 text-secondary-dark" aria-hidden />
                  </div>
                  <h3 className="text-lg font-bold text-primary mb-2">
                    {service.title}
                  </h3>
                  <p className="text-sm text-muted leading-relaxed">
                    {service.text}
                  </p>
                </article>
              );
            })}
          </div>
        </Container>
      </section>

      <section className="py-16 lg:py-24 bg-surface">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-10 lg:gap-16">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
                Cómo funciona
              </p>
              <h2 className="text-3xl lg:text-4xl font-bold text-primary tracking-tight mb-4">
                De tus archivos a visuales listos para publicar
              </h2>
              <p className="text-muted leading-relaxed">
                Para encargos digitales, el pedido online actual sigue en
                inglés en esta fase. Si prefieres explicarlo en español,
                escríbenos y te orientamos.
              </p>
            </div>

            <ol className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {steps.map((step, index) => (
                <li
                  key={step}
                  className="bg-white border border-border rounded-2xl p-6 shadow-sm"
                >
                  <span className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold mb-5">
                    {index + 1}
                  </span>
                  <p className="text-sm lg:text-base text-foreground leading-relaxed">
                    {step}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      <CtaSection
        title="Prepara tu próxima propiedad con mejores visuales."
        subtitle="Pide online los servicios digitales o escríbenos para trabajos locales y presupuestos a medida."
        primaryLabel="Pedir online"
        primaryHref="/order"
        secondaryLabel="Contactar"
        secondaryHref="/es/contact"
      />
    </>
  );
}
