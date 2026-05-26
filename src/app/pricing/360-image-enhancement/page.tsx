import type { Metadata } from "next";
import SimplePricingPage from "@/components/pricing/SimplePricingPage";

export const metadata: Metadata = {
  title: "360° Image Enhancement Pricing",
  description:
    "Enhance equirectangular panoramas so every direction reads as listing-quality. Quote-based — send a sample for an exact price.",
};

export default function ThreeSixtyImageEnhancementPricingPage() {
  return (
    <SimplePricingPage
      eyebrow="Real Estate Photo Editing"
      title="360° Image Enhancement"
      description="Enhance equirectangular panoramas so every angle in your virtual tour reads as listing-quality — clean stitches, balanced light, and natural color."
      priceLine="Request a quote"
      variant="panorama-enhancement"
      visualCaption="Before / after preview. Real 360 examples will replace this placeholder."
      whatsIncluded={[
        "Color, exposure, and white-balance correction across the full panorama",
        "Stitch line clean-up and ceiling / nadir patches",
        "Window view recovery where possible",
        "Final delivery as equirectangular JPG ready for any 360 platform",
        "One round of revisions per panorama",
      ]}
      whatToSend={[
        "Equirectangular panorama (typically 6000x3000 or 8000x4000)",
        "Notes on platform and any specific zones to focus on (ceiling, floor, etc.)",
        "Optional logo or nadir patch if you want it baked into the file",
      ]}
      primaryHref="/order/photo-editing"
      primaryLabel="Order Online"
      ctaTitle="Send a sample 360 — we'll quote in 24 hours."
      ctaSubtitle="Pricing depends on resolution and the amount of cleanup needed."
      portfolioSlug="360-image-enhancement"
    />
  );
}
