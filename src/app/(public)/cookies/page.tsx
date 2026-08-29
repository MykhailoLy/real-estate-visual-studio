import LegalPage from "@/components/legal/LegalPage";
import { cookieSectionsEn } from "@/content/legal-pages";
import { LEGAL_UPDATED } from "@/lib/legal";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata({
  title: "Cookie Policy",
  description:
    "PicchuSpot cookie and browser-storage inventory, including necessary authentication, preferences, support technology, Google Analytics consent, and controls.",
  canonicalPath: "/cookies",
  spanishPath: "/es/cookies",
});

export default function CookiePolicyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Cookie Policy"
      intro="A current inventory of PicchuSpot cookies, local and session storage, provider technology, activation conditions, and the controls available to you."
      updatedLabel="Effective:"
      updatedValue={LEGAL_UPDATED.en}
      versionLabel="Version:"
      contentsLabel="On this page"
      sections={cookieSectionsEn}
      contact={{
        prompt: "Questions about cookies or browser storage?",
        href: "/contact",
        label: "Contact PicchuSpot",
      }}
    />
  );
}
