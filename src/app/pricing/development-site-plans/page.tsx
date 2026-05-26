import type { Metadata } from "next";
import SimplePricingPage from "@/components/pricing/SimplePricingPage";

export const metadata: Metadata = {
  title: "Development Site Plans Pricing",
  description:
    "Top-down site layouts that show plot boundaries, units, and amenities for development marketing. Quote-based — send your plans for a fixed price.",
};

export default function DevelopmentSitePlansPricingPage() {
  return (
    <SimplePricingPage
      eyebrow="Real Estate Photo Editing"
      title="Development Site Plans"
      description="Top-down site layouts that show plot boundaries, units, and amenities — built from your sketches, CAD plans, or aerial references for development marketing."
      priceLine="Request a quote"
      variant="site-plans"
      visualCaption="Sketch / site-plan preview. Real project examples will replace this placeholder."
      whatsIncluded={[
        "Clean top-down rendering of the development site",
        "Plot boundaries, building footprints, and unit numbers labelled",
        "Amenities highlighted (pools, gardens, parking, common areas)",
        "Optional north arrow, scale bar, and legend",
        "One round of revisions on the layout",
        "High-resolution JPG and PDF delivery",
      ]}
      whatToSend={[
        "CAD, PDF, or sketch of the site layout",
        "An aerial photograph of the plot if available",
        "Brand guidelines, colours, and any logo to include",
        "Names and numbering convention for units and amenities",
      ]}
      primaryHref="/order/photo-editing"
      primaryLabel="Order Online"
      ctaTitle="A clear site plan does the heavy lifting in development marketing."
      ctaSubtitle="Send your source files — we'll quote in writing within 24 hours."
      portfolioSlug="development-site-plans"
    />
  );
}
