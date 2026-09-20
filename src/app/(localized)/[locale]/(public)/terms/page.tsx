import LegalPage from "@/components/legal/LegalPage";
import { termsSectionsEs } from "@/content/legal-pages";
import { LEGAL_UPDATED } from "@/lib/legal";
import { spanishMetadata } from "../seo";

export const metadata = spanishMetadata({
  title: "Términos y condiciones",
  description:
    "Términos de pedidos, pagos alojados, revisiones, entrega, cancelaciones, propiedad intelectual, divulgación inmobiliaria y derechos del cliente.",
  path: "/es/terms",
  englishPath: "/terms",
});

export default function SpanishTermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Términos y condiciones"
      intro="Las reglas de los pedidos de PicchuSpot, diferenciando el trabajo online de precio fijo, los presupuestos, los servicios locales y los derechos imperativos de consumo."
      updatedLabel="Vigente desde:"
      updatedValue={LEGAL_UPDATED.es}
      versionLabel="Versión:"
      contentsLabel="En esta página"
      sections={termsSectionsEs}
      contact={{
        prompt: "¿Tienes preguntas sobre estos Términos o un pedido?",
        href: "/es/contact",
        label: "Contactar con PicchuSpot",
      }}
    />
  );
}
