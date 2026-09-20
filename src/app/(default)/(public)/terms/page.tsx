import LegalPage from "@/components/legal/LegalPage";
import { termsSectionsEn } from "@/content/legal-pages";
import { LEGAL_UPDATED } from "@/lib/legal";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata({
  title: "Terms & Conditions",
  description:
    "Terms for PicchuSpot orders, hosted payments, revisions, delivery, cancellations, intellectual property, property-media disclosures, and customer rights.",
  canonicalPath: "/terms",
  spanishPath: "/es/terms",
});

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms & Conditions"
      intro="The service rules for PicchuSpot orders, written to distinguish fixed-price online work, custom quotes, local services, and mandatory consumer rights."
      updatedLabel="Effective:"
      updatedValue={LEGAL_UPDATED.en}
      versionLabel="Version:"
      contentsLabel="On this page"
      sections={termsSectionsEn}
      contact={{
        prompt: "Questions about these Terms or a specific order?",
        href: "/contact",
        label: "Contact PicchuSpot",
      }}
    />
  );
}
