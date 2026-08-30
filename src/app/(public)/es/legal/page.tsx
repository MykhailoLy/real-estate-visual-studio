import LegalPage from "@/components/legal/LegalPage";
import { legalNoticeSectionsEs } from "@/content/legal-pages";
import { LEGAL_UPDATED } from "@/lib/legal";
import { spanishMetadata } from "../seo";

export const metadata = spanishMetadata({
  title: "Aviso legal",
  description:
    "Identificación del titular, datos de contacto, uso del sitio, contratación, privacidad y cookies de PicchuSpot.",
  path: "/es/legal",
  englishPath: "/legal",
});

export default function SpanishLegalNoticePage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Aviso legal"
      intro="Información de identificación y datos legales de PicchuSpot, nombre comercial utilizado para los servicios visuales inmobiliarios ofrecidos a través de este sitio web."
      updatedLabel="Vigente desde:"
      updatedValue={LEGAL_UPDATED.es}
      versionLabel="Versión:"
      contentsLabel="En esta página"
      sections={legalNoticeSectionsEs}
      contact={{
        prompt: "¿Tienes preguntas sobre el sitio o su información legal?",
        href: "/es/contact",
        label: "Contactar con PicchuSpot",
      }}
    />
  );
}
