import type { Metadata } from "next";
import SimplePricingPage from "@/components/pricing/SimplePricingPage";

export const metadata: Metadata = {
  title: "Day to Dusk Pricing",
  description:
    "Convert daytime exterior photos into warm dusk scenes — glowing windows, soft sky tones, and inviting twilight ambience. From US$5.00 / image.",
};

export default function DayToDuskPricingPage() {
  return (
    <SimplePricingPage
      eyebrow="Real Estate Photo Editing"
      title="Day to Dusk"
      description="Turn a daytime exterior into a warm dusk shot — perfect for the hero photo of a listing. Realistic sky, glowing windows, soft interior light."
      priceLine="From US$5.00 / image"
      variant="day-to-dusk"
      visualCaption="Before / after preview. Real portfolio examples will replace this placeholder."
      whatsIncluded={[
        "Realistic dusk sky replacement",
        "Warm interior glow added",
        "Lights turned on automatically",
        "Color and contrast balanced for the new lighting",
        "One round of revisions per image",
        "High-resolution JPG delivery in 24-48 hours",
      ]}
      whatToSend={[
        "A clean daytime exterior photo of the property",
        "Notes on which windows should glow (or skip if all)",
        "Optional reference for the sky tone you prefer",
      ]}
      primaryHref="/order/photo-editing"
      primaryLabel="Order Online"
      ctaTitle="Make the hero photo unmissable."
      ctaSubtitle="A single dusk shot can change the way a listing reads online."
    />
  );
}
