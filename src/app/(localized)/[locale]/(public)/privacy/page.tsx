import LegalPage from "@/components/legal/LegalPage";
import { privacySectionsEs } from "@/content/legal-pages";
import { LEGAL_UPDATED } from "@/lib/legal";
import { spanishMetadata } from "../seo";

export const metadata = spanishMetadata({
  title: "Política de privacidad",
  description:
    "Cómo PicchuSpot trata datos de cuenta, pedido, pago, media inmobiliaria, soporte, analítica y datos técnicos, incluidos proveedores y derechos.",
  path: "/es/privacy",
  englishPath: "/privacy",
});

export default function SpanishPrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacidad"
      title="Política de privacidad"
      intro="Cómo PicchuSpot utiliza información personal para prestar servicios visuales, proteger cuentas y archivos, procesar pagos elegibles y operar el soporte."
      updatedLabel="Vigente desde:"
      updatedValue={LEGAL_UPDATED.es}
      versionLabel="Versión:"
      contentsLabel="En esta página"
      sections={privacySectionsEs}
      contact={{
        prompt: "Para consultas de privacidad o ejercicio de derechos, contacta con PicchuSpot.",
        href: "/es/contact",
        label: "Contacto de privacidad",
      }}
    />
  );
}
