import LegalPage from "@/components/legal/LegalPage";
import { cookieSectionsEs } from "@/content/legal-pages";
import { LEGAL_UPDATED } from "@/lib/legal";
import { spanishMetadata } from "../seo";

export const metadata = spanishMetadata({
  title: "Política de cookies",
  description:
    "Inventario de cookies y almacenamiento de PicchuSpot: autenticación, preferencias, soporte, consentimiento de Google Analytics y controles.",
  path: "/es/cookies",
  englishPath: "/cookies",
});

export default function SpanishCookiePolicyPage() {
  return (
    <LegalPage
      eyebrow="Privacidad"
      title="Política de cookies"
      intro="Inventario actual de cookies, almacenamiento local y de sesión, tecnología de proveedores, condiciones de activación y controles disponibles."
      updatedLabel="Vigente desde:"
      updatedValue={LEGAL_UPDATED.es}
      versionLabel="Versión:"
      contentsLabel="En esta página"
      sections={cookieSectionsEs}
      contact={{
        prompt: "¿Tienes preguntas sobre cookies o almacenamiento?",
        href: "/es/contact",
        label: "Contactar con PicchuSpot",
      }}
    />
  );
}
