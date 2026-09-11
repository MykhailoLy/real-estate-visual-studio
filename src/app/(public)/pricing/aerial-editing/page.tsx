import type { Metadata } from "next";
import { Plane, Home, Map, ImageIcon } from "lucide-react";
import ServicePage from "@/components/pricing/ServicePage";
import { CatalogPriceText } from "@/components/pricing/currency-client";
import { localizedAlternates } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import { serviceSchema, breadcrumbSchema } from "@/lib/structured-data";
import { absoluteUrl } from "@/lib/seo";
import { getCatalogPriceDecimal } from "@/lib/pricing/public";

export const metadata: Metadata = {
  title: "Aerial Editing",
  description:
    "Enhance drone and aerial property visuals with fixed-price colour fade, map pins, lot highlights, and full markup.",
  alternates: localizedAlternates({
    canonicalPath: "/pricing/aerial-editing",
    englishPath: "/pricing/aerial-editing",
    spanishPath: "/es/pricing/aerial-editing",
  }),
};

export default function AerialEditingPricingPage() {
  return (
    <>
      <JsonLd
        data={[
          serviceSchema({
            name: "Aerial Editing",
            description:
              "Enhance drone and aerial property visuals for cleaner land, exterior, neighborhood, and listing presentation.",
            url: absoluteUrl("/pricing/aerial-editing"),
            price: getCatalogPriceDecimal("aerial-colour-fade"),
            priceCurrency: "USD",
            offerNote: "Starting price per image",
          }),
          breadcrumbSchema([
            { name: "Home", item: absoluteUrl("/") },
            { name: "Pricing", item: absoluteUrl("/pricing") },
            {
              name: "Aerial Editing",
              item: absoluteUrl("/pricing/aerial-editing"),
            },
          ]),
        ]}
      />
      <ServicePage
      serviceSlug="aerial-editing"
      portfolioViewerVariant="photo"
      placeholderVariant="aerial-editing"
      eyebrow="Aerial Editing"
      title="Aerial Editing Pricing"
      description="Enhance drone and aerial property visuals for cleaner land, exterior, neighborhood, and listing presentation."
      priceLine={
        <CatalogPriceText
          priceKey="aerial-colour-fade"
          prefix="From "
          suffix=" / image"
        />
      }
      orderHref="/dashboard/orders/new/photo-editing"
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
        "Unlimited revisions for 30 days from first delivery",
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
      pricingDescription="Choose the fixed-price aerial operation required for each image. Multiple operations can be combined where needed."
      pricingCards={[
        {
          label: "Colour Fade",
          price: <CatalogPriceText priceKey="aerial-colour-fade" />,
          unit: "per image",
          note: "Fade surrounding colour to make the property or site stand out.",
          isBase: true,
        },
        {
          label: "Drop Pin",
          price: <CatalogPriceText priceKey="aerial-drop-pin" />,
          unit: "per image",
          note: "Add a clear location pin to identify the subject property.",
        },
        {
          label: "Single Lot Highlight",
          price: <CatalogPriceText priceKey="aerial-single-lot-highlight" />,
          unit: "per image",
          note: "Outline and highlight one lot or property boundary.",
        },
        {
          label: "Multiple Lot Highlight",
          price: <CatalogPriceText priceKey="aerial-multiple-lot-highlight" />,
          unit: "per image",
          note: "Highlight multiple lots in one aerial image.",
        },
        {
          label: "Full Markup",
          price: <CatalogPriceText priceKey="aerial-full-markup" />,
          unit: "per image",
          note: "Combine highlight, colour fade, and location pin markup.",
        },
      ]}
      pricingFootnote="Each selected operation is priced from the current catalog. Complex custom retouching outside these operations may require review."
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
          answer: "The listed aerial operations have fixed per-image prices. Choose Colour Fade, Drop Pin, a lot highlight, or Full Markup in the Photo Editing order flow.",
        },
        {
          question: "How long does it take?",
          answer: "Standard delivery is 24–48 hours after we receive your files and confirm the scope.",
        },
        {
          question: "Are revisions included?",
          answer: "Yes. Unlimited revisions are included for 30 calendar days from first delivery, provided the changes stay within the original brief, overall style, and design direction.",
        },
        {
          question: "Can the images be used for MLS and marketing?",
          answer: "Yes. Delivered files are prepared for listings, print brochures, websites, and marketing packages.",
        },
      ]}
      ctaTitle="Make every drone shot listing-ready."
      ctaSubtitle="Upload your aerial images and select the fixed-price markup operations each one needs."
    />
    </>
  );
}
