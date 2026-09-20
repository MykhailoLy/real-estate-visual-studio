import LegalPage from "@/components/legal/LegalPage";
import { refundSectionsEn } from "@/content/legal-pages";
import { LEGAL_UPDATED } from "@/lib/legal";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata({
  title: "Refunds & Cancellations",
  description:
    "PicchuSpot cancellation, statutory consumer withdrawal, service-concern, and refund process for fixed-price, custom-quote, and local services.",
  canonicalPath: "/refunds",
  spanishPath: "/es/refunds",
});

export default function RefundsPage() {
  return (
    <LegalPage
      eyebrow="Customer care"
      title="Refunds & Cancellations"
      intro="How cancellation, consumer withdrawal, service corrections, and refunds are handled before and after production begins."
      updatedLabel="Effective:"
      updatedValue={LEGAL_UPDATED.en}
      versionLabel="Version:"
      contentsLabel="On this page"
      sections={refundSectionsEn}
      contact={{
        prompt: "For an order cancellation, withdrawal, or refund request, contact PicchuSpot with the order number.",
        href: "/contact",
        label: "Request a review",
      }}
    />
  );
}
