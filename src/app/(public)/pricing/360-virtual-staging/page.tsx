import type { Metadata } from "next";
import SimplePricingPage from "@/components/pricing/SimplePricingPage";

export const metadata: Metadata = {
  title: "360° Virtual Staging Pricing",
  description:
    "Stage furniture inside a 360 panorama so virtual tours show furnished, lived-in spaces. Quote-based — send a sample for an exact price.",
};

export default function ThreeSixtyVirtualStagingPricingPage() {
  return (
    <SimplePricingPage
      eyebrow="Real Estate Photo Editing"
      title="360° Virtual Staging"
      description="Stage furniture inside a 360 panorama so virtual tours show furnished, lived-in spaces — without the cost or scheduling of physical staging."
      priceLine="Request a quote"
      variant="panorama-staging"
      visualCaption="Before / after preview. Real 360 staging examples will replace this placeholder."
      whatsIncluded={[
        "Realistic furniture placement that respects scale and perspective",
        "Style match — Modern, Scandinavian, Coastal, Classic, and more",
        "Lighting and shadow blending across the full panorama",
        "Final delivery as equirectangular JPG ready for any 360 platform",
        "One round of revisions per panorama",
      ]}
      whatToSend={[
        "Equirectangular panorama of the empty room",
        "Preferred furniture style and any reference images",
        "Notes on which furniture pieces to include or avoid",
      ]}
      primaryHref="/order/photo-editing"
      primaryLabel="Order Online"
      ctaTitle="Furnish a 360 without lifting a sofa."
      ctaSubtitle="Pricing depends on room complexity and the number of furniture items."
      portfolioSlug="360-virtual-staging"
    />
  );
}
