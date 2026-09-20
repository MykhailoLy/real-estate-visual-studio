import type { Metadata } from "next";
import { Building2, Camera, Layers3, Sparkles } from "lucide-react";
import ServicePage from "@/components/pricing/ServicePage";
import { CatalogPriceText } from "@/components/pricing/currency-client";
import JsonLd from "@/components/seo/JsonLd";
import { absoluteUrl, localizedAlternates } from "@/lib/seo";
import { breadcrumbSchema, serviceSchema } from "@/lib/structured-data";
import { getCatalogPriceDecimal } from "@/lib/pricing/public";

const description =
  "Professional real estate photo editing for photographers, agents and property marketers. Natural HDR editing, color correction, window views, image enhancement and listing-ready results.";

export const metadata: Metadata = {
  title: "Real Estate Photo Editing Services",
  description,
  alternates: localizedAlternates({
    canonicalPath: "/pricing/photo-editing",
    englishPath: "/pricing/photo-editing",
    spanishPath: "/es/pricing/photo-editing",
  }),
};

export default function PhotoEditingPricingPage() {
  return (
    <>
      <JsonLd
        data={[
          serviceSchema({
            name: "Real Estate Photo Editing Services",
            description,
            url: absoluteUrl("/pricing/photo-editing"),
            price: getCatalogPriceDecimal("image-enhancement"),
            priceCurrency: "USD",
            offerNote: "Starting price per image",
          }),
          breadcrumbSchema([
            { name: "Home", item: absoluteUrl("/") },
            { name: "Pricing", item: absoluteUrl("/pricing") },
            {
              name: "Real Estate Photo Editing",
              item: absoluteUrl("/pricing/photo-editing"),
            },
          ]),
        ]}
      />
      <ServicePage
        serviceSlug="image-enhancement"
        portfolioViewerVariant="photo"
        placeholderVariant="image-enhancement"
        eyebrow="Real Estate Photo Editing"
        title="Professional Real Estate Photo Editing"
        description="Natural, consistent editing for real estate photographers, agents, and property marketers — from exposure and color correction to window views and listing-ready finishing."
        priceLine={
          <CatalogPriceText
            priceKey="image-enhancement"
            prefix="From "
            suffix=" / image"
          />
        }
        orderHref="/dashboard/orders/new/photo-editing"
        orderLabel="Order Photo Editing"
        whenToUseTitle="When professional photo editing makes the difference"
        whenToUseDescription="Use our real estate editing service when a shoot needs a natural, polished finish across an entire listing or targeted corrections on individual images."
        useCases={[
          {
            icon: Camera,
            title: "Real estate photographers",
            description:
              "Outsource dependable post-production while keeping a consistent look across shoots and clients.",
          },
          {
            icon: Building2,
            title: "Agents and property marketers",
            description:
              "Prepare clean, balanced imagery for portals, brochures, websites, and listing campaigns.",
          },
          {
            icon: Layers3,
            title: "HDR-style balancing",
            description:
              "Create natural-looking interiors with controlled highlights, balanced shadows, and clear window views.",
          },
          {
            icon: Sparkles,
            title: "Targeted retouching",
            description:
              "Correct color, lighting, perspective, skies, reflections, or other distractions image by image.",
          },
        ]}
        whatItIsTitle="Natural post-production built for property listings"
        whatItIsBody="Our real estate photo editing service improves the technical finish of your images without making rooms look artificial. Select the exact editing options each photo needs and add clear notes for any property-specific details."
        whatItIsBullets={[
          "Natural exposure, contrast, and white-balance correction",
          "Window-view recovery and highlight control",
          "Color correction and consistent batch finishing",
          "Lens, perspective, shadow, and reflection cleanup",
          "Optional sky, background, light, and object edits",
          "High-resolution delivery in 24–48h",
        ]}
        beforeYouOrderDescription="Upload the highest-quality originals available and tell us which editing options apply to each image. Add reference notes when a listing needs a specific finish."
        uploadItems={[
          {
            label: "Original photos",
            required: true,
            hint: "JPG or PNG at the highest resolution available",
          },
          {
            label: "Editing options",
            required: true,
            hint: "Choose the corrections needed for each individual photo",
          },
          {
            label: "Reference style",
            hint: "Share an example if you need a specific color or tonal finish",
          },
          {
            label: "Photo-specific notes",
            hint: "Call out window views, color casts, reflections, or details to preserve",
          },
        ]}
        uploadFootnote="Each image can have its own combination of editing options and instructions."
        pricingTitle="Real estate photo editing pricing"
        pricingDescription="Choose only the edits each photo needs. Prices are calculated per selected option."
        pricingCards={[
          {
            label: "Image Enhancement",
            price: <CatalogPriceText priceKey="image-enhancement" />,
            unit: "per image",
            note: "Balanced color, exposure, contrast, white balance, and detail.",
            isBase: true,
          },
          {
            label: "Day to Dusk",
            price: <CatalogPriceText priceKey="day-to-dusk" />,
            unit: "per image",
            note: "Convert a daytime exterior into a natural twilight presentation.",
          },
          {
            label: "Item Removal & Virtual Cleaning",
            price: (
              <CatalogPriceText priceKey="item-removal-virtual-cleaning" />
            ),
            unit: "per image",
            note: "Remove specified objects, clutter, and visual distractions.",
          },
        ]}
        pricingFootnote="Additional options include shadow removal, background changes, light activation, color changes, aerial markups, and water effects."
        faqTitle="Real estate photo editing questions"
        faqItems={[
          {
            question: "What does real estate photo editing include?",
            answer:
              "You can select enhancement, color and exposure correction, window-view balancing, shadow or object removal, background changes, sky and lighting edits, and other listing-focused corrections for each photo.",
          },
          {
            question: "Can you match my existing editing style?",
            answer:
              "Yes. Send a reference image and describe the look you want so we can keep color, brightness, and contrast consistent with your portfolio or brand.",
          },
          {
            question: "Do you edit complete property shoots?",
            answer:
              "Yes. You can upload multiple images and apply the same editing options across a set, while still adding instructions for individual photos.",
          },
          {
            question: "Will the finished photos still look natural?",
            answer:
              "Yes. Our default approach is clean and realistic, with controlled highlights, neutral color, and detail that supports the property rather than drawing attention to the edit.",
          },
          {
            question: "How quickly are edited photos delivered?",
            answer:
              "Standard delivery is 24–48 hours after we receive the source images and complete instructions.",
          },
          {
            question: "Are revisions included?",
            answer:
              "Yes. Unlimited revisions are included for 30 calendar days from first delivery, provided the changes stay within the original brief, overall style, and agreed direction.",
          },
        ]}
        ctaTitle="Ready for consistent, listing-ready photos?"
        ctaSubtitle="Upload your property images, choose the edits you need, and receive polished results within 24–48 hours."
      />
    </>
  );
}
