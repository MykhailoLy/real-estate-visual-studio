import LegalPage from "@/components/legal/LegalPage";
import { refundSectionsEs } from "@/content/legal-pages";
import { LEGAL_UPDATED } from "@/lib/legal";
import { spanishMetadata } from "../seo";

export const metadata = spanishMetadata({
  title: "Reembolsos y cancelaciones",
  description:
    "Proceso de cancelación, desistimiento legal, incidencias y reembolsos de PicchuSpot para servicios de precio fijo, presupuesto y locales.",
  path: "/es/refunds",
  englishPath: "/refunds",
});

export default function SpanishRefundsPage() {
  return (
    <LegalPage
      eyebrow="Atención al cliente"
      title="Reembolsos y cancelaciones"
      intro="Cómo se gestionan cancelaciones, desistimiento de consumidores, correcciones del servicio y reembolsos antes y después de iniciar la producción."
      updatedLabel="Vigente desde:"
      updatedValue={LEGAL_UPDATED.es}
      versionLabel="Versión:"
      contentsLabel="En esta página"
      sections={refundSectionsEs}
      contact={{
        prompt: "Para cancelar, desistir o solicitar un reembolso, contacta con PicchuSpot e indica el número de pedido.",
        href: "/es/contact",
        label: "Solicitar revisión",
      }}
    />
  );
}
