import type { Metadata } from "next";
import SimplePricingPage from "@/components/pricing/SimplePricingPage";

export const metadata: Metadata = {
  title: "Image Enhancement Pricing",
  description:
    "Real-estate-grade image enhancement: exposure balance, white balance, lens correction, and recovered window views. From US$2.00 / image.",
};

export default function ImageEnhancementPricingPage() {
  return (
    <SimplePricingPage
      eyebrow="Real Estate Photo Editing"
      title="Image Enhancement"
      description="Color, exposure, and window correction so listing photos look bright, crisp, and natural — without the over-processed look."
      priceLine="From US$2.00 / image"
      variant="image-enhancement"
      visualCaption="Before / after preview. Real portfolio examples will replace this placeholder."
      whatsIncluded={[
        "Exposure and contrast balanced",
        "White balance corrected",
        "Lens distortion cleaned up",
        "Window views recovered where possible",
        "One round of revisions per image",
        "High-resolution JPG delivery in 24-48 hours",
      ]}
      whatToSend={[
        "The original photo, as a JPG or PNG at the highest resolution you have",
        "A short note about anything specific to keep, brighten, or tone down",
        "Optional reference image or link if you have a target look in mind",
      ]}
      primaryHref="/order/photo-editing"
      primaryLabel="Order Online"
      ctaTitle="Ready to brighten your listing photos?"
      ctaSubtitle="Upload your images and we'll return market-ready files in 24-48 hours."
    />
  );
}
