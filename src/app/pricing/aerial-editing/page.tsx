import type { Metadata } from "next";
import { Plane, Home, Map, ImageIcon } from "lucide-react";
import ServicePage from "@/components/pricing/ServicePage";

export const metadata: Metadata = {
  title: "Aerial Editing",
  description:
    "Enhance drone and aerial property visuals for cleaner land, exterior, neighborhood, and listing presentation. Quote-based.",
};

export default function AerialEditingPricingPage() {
  return (
    <ServicePage
      serviceSlug="aerial-editing"
      placeholderVariant="aerial-editing"
      eyebrow="Aerial Editing"
      title="Aerial Editing Pricing"
      description="Enhance drone and aerial property visuals for cleaner land, exterior, neighborhood, and listing presentation."
      priceLine="Request a quote"
      orderHref="/order/photo-editing"
      orderLabel="Order Aerial Editing"
      whenToUseTitle="When to use Aerial Editing"
      whenToUseDescription="Aerial editing is used when drone or aerial images need color, sky, or cleanup work before being published in listings or marketing packages."
      useCases={[
        {
          icon: Plane,
          title: "Drone property photos",
          description: "Improve color, exposure, and sky quality on drone exterior shots.",
        },
        {
          icon: Map,
          title: "Land and lot visuals",
          description: "Present land, lot boundaries, and site context more clearly.",
        },
        {
          icon: Home,
          title: "Exterior presentation",
          description: "Make aerial exterior images look sharp, balanced, and listing-ready.",
        },
        {
          icon: ImageIcon,
          title: "Marketing packages",
          description: "Prepare aerial visuals for brochures, websites, and digital campaigns.",
        },
      ]}
      whatItIsTitle="Polished aerial images for property marketing"
      whatItIsBody="We edit aerial and drone images to improve clarity, color, exposure, and presentation quality so the property and surroundings read clearly in marketing materials."
      whatItIsBullets={[
        "Color, exposure, and contrast balanced",
        "Sky tone and direction adjusted",
        "Distracting elements removed where possible",
        "Property edges sharpened and de-hazed",
        "1 revision included per image",
        "High-resolution JPG delivery in 24–48h",
      ]}
      beforeYouOrderDescription="Send your drone images and any notes about sky direction, objects to remove, or specific corrections needed."
      uploadItems={[
        {
          label: "Drone or aerial photo",
          required: true,
          hint: "Full-resolution JPG or DNG — the highest quality file available",
        },
        {
          label: "Sky direction and tone notes",
          hint: "Overcast, golden hour, blue sky, etc. — or leave open and we'll decide",
        },
        {
          label: "Objects to remove",
          hint: "Cars, cables, bins, or other distractions to clean up",
        },
        {
          label: "Reference or mood notes",
          hint: "Optional — any target look or reference images",
        },
      ]}
      uploadFootnote="Required fields are marked *. DNG files are accepted for maximum editing quality."
      pricingTitle="Aerial Editing pricing"
      pricingDescription="Pricing is based on the image and the amount of correction needed. Send your images for a quote."
      pricingCards={[
        {
          label: "Aerial Photo Enhancement",
          price: "Request quote",
          unit: "per image",
          note: "Color, exposure, sky, and property clarity improvements.",
          isBase: true,
        },
        {
          label: "Sky Replacement",
          price: "Request quote",
          unit: "per image",
          note: "Replace overcast or flat skies with a more attractive alternative.",
        },
        {
          label: "Object / Distraction Removal",
          price: "Request quote",
          unit: "per image",
          note: "Remove cars, cables, signage, or other elements.",
        },
      ]}
      pricingFootnote="Contact us with sample images for an accurate per-image or batch quote."
      faqTitle="Aerial Editing questions"
      faqItems={[
        {
          question: "What types of aerial images do you edit?",
          answer: "We edit drone exterior images, aerial lot and land shots, and property surroundings images from any drone or aerial platform.",
        },
        {
          question: "Can you replace a grey or overcast sky?",
          answer: "Yes. Sky replacement is available as part of aerial editing — let us know the tone and direction you prefer.",
        },
        {
          question: "Can you remove cars or other objects from aerial shots?",
          answer: "Yes. Objects like parked cars, bins, scaffolding, and cables can be removed if the scene beneath is recoverable.",
        },
        {
          question: "What format should I send?",
          answer: "JPG or DNG at the highest resolution available. DNG gives more editing flexibility.",
        },
        {
          question: "How is the price set?",
          answer: "Pricing depends on the image resolution and the amount and type of correction needed. Send a sample file and we'll quote in writing.",
        },
        {
          question: "How long does it take?",
          answer: "Standard delivery is 24–48 hours after we receive your files and confirm the scope.",
        },
        {
          question: "Is a revision included?",
          answer: "Yes. One revision round is included per image.",
        },
        {
          question: "Can the images be used for MLS and marketing?",
          answer: "Yes. Delivered files are prepared for listings, print brochures, websites, and marketing packages.",
        },
      ]}
      ctaTitle="Make every drone shot listing-ready."
      ctaSubtitle="Send your aerial images and we'll quote the editing scope in writing within 24 hours."
    />
  );
}
