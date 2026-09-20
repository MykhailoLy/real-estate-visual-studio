import LegalPage from "@/components/legal/LegalPage";
import { legalNoticeSectionsEn } from "@/content/legal-pages";
import { LEGAL_UPDATED } from "@/lib/legal";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata({
  title: "Legal Notice",
  description:
    "Operator identification, contact details, website use, contracting, privacy, and cookies for PicchuSpot.",
  canonicalPath: "/legal",
  spanishPath: "/es/legal",
});

export default function LegalNoticePage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Legal Notice"
      intro="Identification and legal information for PicchuSpot, the trading name used for the real-estate visual services offered through this website."
      updatedLabel="Effective:"
      updatedValue={LEGAL_UPDATED.en}
      versionLabel="Version:"
      contentsLabel="On this page"
      sections={legalNoticeSectionsEn}
      contact={{
        prompt: "Questions about the website or its legal information?",
        href: "/contact",
        label: "Contact PicchuSpot",
      }}
    />
  );
}
