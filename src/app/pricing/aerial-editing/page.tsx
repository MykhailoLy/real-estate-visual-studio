import type { Metadata } from "next";
import SimplePricingPage from "@/components/pricing/SimplePricingPage";

export const metadata: Metadata = {
  title: "Aerial Editing Pricing",
  description:
    "Cleaner skies, sharper detail, and balanced color for drone exteriors and listing aerials. Quote-based — send a sample for an exact price.",
};

export default function AerialEditingPricingPage() {
  return (
    <SimplePricingPage
      eyebrow="Real Estate Photo Editing"
      title="Aerial Editing"
      description="Cleaner skies, sharper detail, and balanced color for drone exteriors and listing aerials — so the property anchors the frame instead of the weather."
      priceLine="Request a quote"
      variant="aerial-editing"
      visualCaption="Before / after preview. Real aerial examples will replace this placeholder."
      whatsIncluded={[
        "Sky replacement or sky tone adjustment",
        "Color, exposure, and contrast balanced across the frame",
        "Distractions removed (cars, cables, scaffolding, etc.) where possible",
        "Property edges sharpened and de-hazed",
        "One round of revisions per image",
        "High-resolution JPG delivery in 24-48 hours",
      ]}
      whatToSend={[
        "The original drone photo, full-resolution JPG or DNG",
        "Notes on the sky direction and tone you want (overcast, golden hour, etc.)",
        "Marked-up reference if there are specific objects to remove",
      ]}
      primaryHref="/order/photo-editing"
      primaryLabel="Order Online"
      ctaTitle="Make every drone shot listing-ready."
      ctaSubtitle="Most aerial edits ship in 24-48 hours from when we have the source file."
    />
  );
}
