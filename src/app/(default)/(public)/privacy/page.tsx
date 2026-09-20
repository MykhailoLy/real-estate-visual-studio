import LegalPage from "@/components/legal/LegalPage";
import { privacySectionsEn } from "@/content/legal-pages";
import { LEGAL_UPDATED } from "@/lib/legal";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata({
  title: "Privacy Policy",
  description:
    "How PicchuSpot processes account, order, payment, property-media, support, analytics, and technical information, including providers and data rights.",
  canonicalPath: "/privacy",
  spanishPath: "/es/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Privacy Policy"
      intro="How PicchuSpot uses personal information to provide visual services, protect customer accounts and files, process eligible payments, and operate support."
      updatedLabel="Effective:"
      updatedValue={LEGAL_UPDATED.en}
      versionLabel="Version:"
      contentsLabel="On this page"
      sections={privacySectionsEn}
      contact={{
        prompt: "For a privacy question or data-rights request, contact PicchuSpot.",
        href: "/contact",
        label: "Privacy contact",
      }}
    />
  );
}
