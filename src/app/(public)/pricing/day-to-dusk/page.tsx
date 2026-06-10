import type { Metadata } from "next";
import { Home, Star, Sunset, ImageIcon } from "lucide-react";
import ServicePage from "@/components/pricing/ServicePage";
import { RegionalPriceText } from "@/components/pricing/currency-client";
import { regionalPrice } from "@/lib/currency";

export const metadata: Metadata = {
  title: "Day to Dusk",
  description:
    "Transform daytime exterior photos into warm twilight-style listing images for stronger hero shots. From US$5 / image.",
};

export default function DayToDuskPricingPage() {
  return (
    <ServicePage
      serviceSlug="day-to-dusk"
      placeholderVariant="day-to-dusk"
      eyebrow="Day to Dusk"
      title="Day to Dusk Pricing"
      description="Transform daytime exterior photos into warm twilight-style listing images for stronger hero shots and premium presentation."
      priceLine={
        <RegionalPriceText
          price={regionalPrice("From $5 / image", "From €5 / image")}
        />
      }
      orderHref="/order/photo-editing"
      orderLabel="Order Day to Dusk"
      whenToUseTitle="When to use Day to Dusk"
      whenToUseDescription="Day to Dusk is most effective on exterior shots where the sky and property lighting can be transformed for a premium listing feel."
      useCases={[
        {
          icon: Home,
          title: "Exterior hero photos",
          description: "Give the primary exterior listing shot a warm, inviting twilight atmosphere.",
        },
        {
          icon: Star,
          title: "Luxury listing presentation",
          description: "A dusk exterior signals premium quality and elevates listing perception.",
        },
        {
          icon: Sunset,
          title: "Evening mood",
          description: "Create warm golden-hour and twilight scenes without waiting for sunset.",
        },
        {
          icon: ImageIcon,
          title: "Stronger online thumbnails",
          description: "Dusk images stand out in listing grids and attract more clicks.",
        },
      ]}
      whatItIsTitle="Warm twilight images from daytime exteriors"
      whatItIsBody="We convert suitable daytime exterior photos into dusk-style images with a warmer sky, balanced lighting, and a polished real estate look while keeping the property natural and believable."
      whatItIsBullets={[
        "Realistic dusk sky replacement",
        "Warm interior glow added",
        "Lights turned on automatically",
        "Color and contrast balanced for the new lighting",
        "1 revision included per image",
        "High-resolution JPG delivery in 24–48h",
      ]}
      beforeYouOrderDescription="Send us a clean exterior photo and any notes about mood or sky direction — we handle the transformation."
      uploadItems={[
        {
          label: "Daytime exterior photo",
          required: true,
          hint: "A clear exterior shot at the highest resolution available",
        },
        {
          label: "Window glow notes",
          hint: "Which windows should glow, or leave blank and we'll decide",
        },
        {
          label: "Reference sky tone",
          hint: "Optional — deep blue, warm orange, soft purple, etc.",
        },
      ]}
      uploadFootnote="Required fields are marked *. Works best on front-facing exterior photos with clear sky area."
      pricingTitle="Day to Dusk pricing"
      pricingDescription="Per-image pricing. Can be combined with other editing options on the same photo."
      pricingCards={[
        {
          label: "Day to Dusk",
          price: <RegionalPriceText price={regionalPrice("$5.00", "€5.00")} />,
          unit: "per image",
          note: "Sky replacement, interior glow, and dusk atmosphere.",
          isBase: true,
        },
        {
          label: "Image Enhancement",
          price: <RegionalPriceText price={regionalPrice("+$2.00", "+€2.00")} />,
          unit: "per image",
          note: "Color and exposure refinement on top of the dusk edit.",
        },
        {
          label: "Item Removal",
          price: <RegionalPriceText price={regionalPrice("+$8.00", "+€8.00")} />,
          unit: "per image",
          note: "Remove cars, bins, or other distractions before the dusk conversion.",
        },
      ]}
      pricingFootnote="Combine Day to Dusk with Image Enhancement or Item Removal on the same image for a complete result."
      faqTitle="Day to Dusk questions"
      faqItems={[
        {
          question: "What photos work best for Day to Dusk?",
          answer: "Front-facing exterior shots taken in daylight with clear sky area work best. Images with heavy overcast or minimal sky area may have limited results.",
        },
        {
          question: "Will the result look realistic?",
          answer: "Yes. We match the lighting to the scene, add realistic glow to windows, and keep the property itself natural so the result looks like a real dusk photo.",
        },
        {
          question: "Can I choose the sky color and mood?",
          answer: "Yes. You can request a specific sky tone or mood (deep blue hour, warm orange, soft purple). If you leave it open, we'll choose a natural look for the property.",
        },
        {
          question: "What about interior lights — will they turn on automatically?",
          answer: "Yes. Visible light sources are turned on as part of the standard Day to Dusk edit to complete the dusk atmosphere.",
        },
        {
          question: "Can I add Item Removal on the same image?",
          answer: "Yes. You can combine Day to Dusk with Item Removal, Image Enhancement, or other editing options in the same order.",
        },
        {
          question: "How long does it take?",
          answer: "Standard delivery is 24–48 hours from when we receive your image and any notes.",
        },
        {
          question: "Is one revision included?",
          answer: "Yes. One revision round is included per image.",
        },
        {
          question: "Can I use the image for MLS and marketing?",
          answer: "Yes. Delivered images are prepared for real estate listings, websites, and marketing packages.",
        },
      ]}
      ctaTitle="Make the hero photo unmissable."
      ctaSubtitle="A single dusk shot can change how a listing reads online. Upload your exterior and we'll handle the rest."
    />
  );
}
