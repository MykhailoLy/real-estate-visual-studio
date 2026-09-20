import type { Metadata } from "next";
import { SlidersHorizontal, ImageIcon, Aperture, CheckCircle } from "lucide-react";
import ServicePage from "@/components/pricing/ServicePage";
import { CatalogPriceText } from "@/components/pricing/currency-client";
import { localizedAlternates } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import { serviceSchema, breadcrumbSchema } from "@/lib/structured-data";
import { absoluteUrl } from "@/lib/seo";
import { getCatalogPriceDecimal } from "@/lib/pricing/public";
import { WELCOME_OFFER_PUBLIC_COPY } from "@/lib/welcome-offer";

export const metadata: Metadata = {
  title: "Image Enhancement",
  description:
    "Real-estate-grade image enhancement: exposure balance, white balance, lens correction, and recovered window views.",
  alternates: localizedAlternates({
    canonicalPath: "/pricing/image-enhancement",
    englishPath: "/pricing/image-enhancement",
    spanishPath: "/es/pricing/image-enhancement",
  }),
};

export default function ImageEnhancementPricingPage() {
  return (
    <>
      <JsonLd
        data={[
          serviceSchema({
            name: "Image Enhancement",
            description:
              "Real-estate-grade image enhancement: exposure balance, white balance, lens correction, and recovered window views.",
            url: absoluteUrl("/pricing/image-enhancement"),
            price: getCatalogPriceDecimal("image-enhancement"),
            priceCurrency: "USD",
            offerNote: "Starting price per image",
          }),
          breadcrumbSchema([
            { name: "Home", item: absoluteUrl("/") },
            { name: "Pricing", item: absoluteUrl("/pricing") },
            {
              name: "Image Enhancement",
              item: absoluteUrl("/pricing/image-enhancement"),
            },
          ]),
        ]}
      />
      <ServicePage
      serviceSlug="image-enhancement"
      portfolioViewerVariant="photo"
      placeholderVariant="image-enhancement"
      eyebrow="Image Enhancement"
      title="Image Enhancement Pricing"
      description="Improve color, exposure, clarity, and presentation quality so listing photos look clean, natural, and market-ready."
      priceLine={
        <CatalogPriceText
          priceKey="image-enhancement"
          prefix="From "
          suffix=" / image"
        />
      }
      welcomeOfferDescription={`${WELCOME_OFFER_PUBLIC_COPY.en.short} ${WELCOME_OFFER_PUBLIC_COPY.en.rules}`}
      orderHref="/dashboard/orders/new/image-enhancement"
      orderLabel="Order Image Enhancement"
      whenToUseTitle="When to use Image Enhancement"
      whenToUseDescription="Image enhancement is the baseline edit that makes every listing photo look professionally shot and listing-ready."
      useCases={[
        {
          icon: SlidersHorizontal,
          title: "Dark or flat photos",
          description: "Bring out detail and brightness in underexposed or flat interior shots.",
        },
        {
          icon: ImageIcon,
          title: "Color correction",
          description: "Fix mixed lighting, yellow casts, and unnatural white balance for a cleaner look.",
        },
        {
          icon: Aperture,
          title: "Window and exposure balance",
          description: "Recover blown-out windows and balance interior/exterior exposure in one image.",
        },
        {
          icon: CheckCircle,
          title: "Listing photo polish",
          description: "Make every photo in a listing set look consistent, sharp, and professional.",
        },
      ]}
      whatItIsTitle="Clean, balanced real estate images"
      whatItIsBody="We refine real estate photos with natural color correction, exposure balancing, perspective-friendly cleanup, and detail-focused editing so images feel polished without looking artificial."
      whatItIsBullets={[
        "Exposure and contrast balanced",
        "White balance and color corrected",
        "Window views recovered where possible",
        "Lens distortion cleaned up",
        "Unlimited revisions for 30 days from first delivery",
        "High-resolution JPG delivery in 24–48h",
      ]}
      beforeYouOrderDescription="Send us your original images and any specific notes — we handle the rest."
      uploadItems={[
        {
          label: "Original photos",
          required: true,
          hint: "JPG or PNG at the highest resolution available",
        },
        {
          label: "Notes on corrections needed",
          hint: "Anything specific to brighten, fix, or tone down per image",
        },
        {
          label: "Reference image or link",
          hint: "Optional — useful if you have a target look in mind",
        },
      ]}
      uploadFootnote="Required fields are marked *. Multiple images can be included in a single order."
      pricingTitle="Image Enhancement pricing"
      pricingDescription="Simple per-image pricing. The more images in your batch, the faster each one ships."
      pricingCards={[
        {
          label: "Image Enhancement",
          price: <CatalogPriceText priceKey="image-enhancement" />,
          unit: "per image",
          note: "Color, exposure, white balance, and window correction.",
          isBase: true,
        },
        {
          label: "Turn On Lights",
          price: <CatalogPriceText priceKey="turn-on-lights" prefix="+" />,
          unit: "per image",
          note: "Make visible light sources appear switched on.",
        },
        {
          label: "Colour Change",
          price: <CatalogPriceText priceKey="colour-change" prefix="+" />,
          unit: "per image",
          note: "Change wall, ceiling, or door colours.",
        },
      ]}
      pricingFootnote="Add-ons are per image and can be combined with Image Enhancement on the same image."
      faqTitle="Image Enhancement questions"
      faqItems={[
        {
          question: "What does Image Enhancement include?",
          answer: "It includes color correction, exposure and contrast balancing, white balance, lens cleanup, and window-view recovery where possible.",
        },
        {
          question: "Will the images look natural or over-processed?",
          answer: "We edit for a clean, natural look that matches listing photography standards — not a heavily filtered or artificially brightened result.",
        },
        {
          question: "Can I combine Image Enhancement with other edits on the same image?",
          answer: "Yes. You can add Turn On Lights, Colour Change, Day to Dusk, and other options on the same image — each is priced separately.",
        },
        {
          question: "What file format should I upload?",
          answer: "JPG or PNG at the highest resolution you have. RAW files are accepted on request.",
        },
        {
          question: "How long does it take?",
          answer: "Standard delivery is 24–48 hours from when we receive your images and any notes.",
        },
        {
          question: "Are revisions included?",
          answer: "Yes. Unlimited revisions are included for 30 calendar days from first delivery, provided the changes stay within the original brief, overall style, and design direction.",
        },
        {
          question: "Can I order enhancement for a full listing set?",
          answer: "Yes. You can upload multiple images in a single order. Each image is priced and edited individually.",
        },
        {
          question: "Can I use the enhanced images for MLS and marketing?",
          answer: "Yes. Delivered images are prepared for MLS listings, websites, print, and marketing packages.",
        },
      ]}
      ctaTitle="Ready to brighten your listing photos?"
      ctaSubtitle="Upload your images and we'll return market-ready files in 24–48 hours."
    />
    </>
  );
}
