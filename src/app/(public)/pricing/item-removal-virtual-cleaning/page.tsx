import type { Metadata } from "next";
import { Eraser, Home, Star, ImageIcon } from "lucide-react";
import ServicePage from "@/components/pricing/ServicePage";
import { CatalogPriceText } from "@/components/pricing/currency-client";
import { localizedAlternates } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import { serviceSchema, breadcrumbSchema } from "@/lib/structured-data";
import { absoluteUrl } from "@/lib/seo";
import { getCatalogPriceDecimal } from "@/lib/pricing/public";

export const metadata: Metadata = {
  title: "Real Estate Item Removal & Virtual Cleaning",
  description:
    "Remove distracting items, clutter, and imperfections from property photos for cleaner, more listing-ready images.",
  alternates: localizedAlternates({
    canonicalPath: "/pricing/item-removal-virtual-cleaning",
    englishPath: "/pricing/item-removal-virtual-cleaning",
    spanishPath: "/es/pricing/item-removal-virtual-cleaning",
  }),
};

export default function ItemRemovalPricingPage() {
  return (
    <>
      <JsonLd
        data={[
          serviceSchema({
            name: "Item Removal & Virtual Cleaning",
            description:
              "Remove distracting items, clutter, and imperfections from property photos for cleaner, more listing-ready images.",
            url: absoluteUrl("/pricing/item-removal-virtual-cleaning"),
            price: getCatalogPriceDecimal("item-removal-virtual-cleaning"),
            priceCurrency: "USD",
            offerNote: "Starting price per image",
          }),
          breadcrumbSchema([
            { name: "Home", item: absoluteUrl("/") },
            { name: "Pricing", item: absoluteUrl("/pricing") },
            {
              name: "Item Removal & Virtual Cleaning",
              item: absoluteUrl("/pricing/item-removal-virtual-cleaning"),
            },
          ]),
        ]}
      />
      <ServicePage
      serviceSlug="item-removal-virtual-cleaning"
      portfolioViewerVariant="photo"
      placeholderVariant="item-removal"
      eyebrow="Item Removal & Virtual Cleaning"
      title="Item Removal & Virtual Cleaning Pricing"
      description="Remove distracting items, clutter, small imperfections, and visual distractions to make property photos cleaner and more listing-ready."
      priceLine={
        <CatalogPriceText
          priceKey="item-removal-virtual-cleaning"
          prefix="From "
          suffix=" / image"
        />
      }
      orderHref="/dashboard/orders/new/item-removal-virtual-cleaning"
      orderLabel="Order Item Removal"
      whenToUseTitle="When to use Item Removal & Virtual Cleaning"
      whenToUseDescription="Item removal and virtual cleaning is the practical first step before staging, publishing, or upgrading listing photos."
      useCases={[
        {
          icon: Home,
          title: "Cluttered rooms",
          description: "Remove furniture, personal items, and clutter from rooms that could not be cleared before the shoot.",
        },
        {
          icon: Eraser,
          title: "Small object removal",
          description: "Take out bins, cables, signs, reflections, and other small distractions cleanly.",
        },
        {
          icon: Star,
          title: "Cleaner listing presentation",
          description: "Present a cleaner, more spacious-looking room without reshooting.",
        },
        {
          icon: ImageIcon,
          title: "Pre-sale photo cleanup",
          description: "Clean up listing photos quickly before publishing so every image looks polished.",
        },
      ]}
      whatItIsTitle="Cleaner property photos without visual distractions"
      whatItIsBody="We clean up listing photos by removing unwanted objects, clutter, cables, small marks, or distracting details while keeping the space realistic and natural."
      whatItIsBullets={[
        "Objects, clutter, and personal items removed",
        "Background fill blended naturally",
        "Cables, signs, and reflections cleaned up",
        "Compatible with Virtual Staging on the same image",
        "Unlimited revisions for 30 days from first delivery",
        "High-resolution JPG delivery in 24–48h",
      ]}
      beforeYouOrderDescription="Send the original image with clear notes about what should be removed — the more specific you are, the cleaner the result."
      uploadItems={[
        {
          label: "Original photo",
          required: true,
          hint: "JPG or PNG at the highest resolution available",
        },
        {
          label: "Objects to remove",
          required: true,
          hint: "Describe or mark every item that should be removed",
        },
        {
          label: "Areas to keep unchanged",
          hint: "Specify anything that must stay exactly as it is",
        },
        {
          label: "Notes or instructions",
          hint: "Any additional context or special requests",
        },
      ]}
      uploadFootnote="Required fields are marked *. The clearer your removal notes, the more accurate the result."
      pricingTitle="Item Removal pricing"
      pricingDescription="Per-image pricing. Multiple editing options can be combined on the same image."
      pricingCards={[
        {
          label: "Item Removal & Virtual Cleaning",
          price: (
            <CatalogPriceText priceKey="item-removal-virtual-cleaning" />
          ),
          unit: "per image",
          note: "Remove objects, clutter, and distracting details cleanly.",
          isBase: true,
        },
        {
          label: "Image Enhancement",
          price: <CatalogPriceText priceKey="image-enhancement" prefix="+" />,
          unit: "per image",
          note: "Color and exposure correction applied after cleanup.",
        },
        {
          label: "Virtual Staging",
          price: <CatalogPriceText priceKey="virtual-staging" prefix="+" />,
          unit: "per image",
          note: "Add furniture after the room has been cleaned virtually.",
        },
      ]}
      pricingFootnote="Item Removal can be combined with Image Enhancement, Virtual Staging, and other editing options in the same order."
      faqTitle="Item Removal & Virtual Cleaning questions"
      faqItems={[
        {
          question: "What kinds of items can be removed?",
          answer: "We can remove personal items, furniture, clutter, cables, bins, signs, reflections, small marks, and other visible distractions in most scenes.",
        },
        {
          question: "What if the background behind an object is complex?",
          answer: "We blend the fill naturally — if a wall, floor, or background is visible behind the removed item, we reconstruct it to match the surrounding area.",
        },
        {
          question: "Can I combine Item Removal with Virtual Staging on the same image?",
          answer: "Yes. A common workflow is to clean the room first with Item Removal, then add furnishings with Virtual Staging. Both are priced per image and can be in the same order.",
        },
        {
          question: "Do I need to mark what should be removed?",
          answer: "Yes — written descriptions are fine, but marking up a reference image makes it faster and more accurate.",
        },
        {
          question: "Can you remove items from exterior shots?",
          answer: "Yes. Cars, bins, cables, scaffolding, and other exterior distractions can be removed if the scene beneath is recoverable.",
        },
        {
          question: "How long does it take?",
          answer: "Standard delivery is 24–48 hours from when we receive your image and removal notes.",
        },
        {
          question: "Are revisions included?",
          answer: "Yes. Unlimited revisions are included for 30 calendar days from first delivery, provided the changes stay within the original brief, overall style, and design direction.",
        },
        {
          question: "Can I use the result for MLS and marketing?",
          answer: "Yes. Delivered images are suitable for real estate listings, websites, and marketing.",
        },
      ]}
      ctaTitle="Ready to clean up your listing photos?"
      ctaSubtitle="Upload your images, mark what needs removing, and receive cleaner photos within 24–48 hours."
    />
    </>
  );
}

