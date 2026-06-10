import type { Metadata } from "next";
import { SlidersHorizontal, ImageIcon, Aperture, CheckCircle } from "lucide-react";
import ServicePage from "@/components/pricing/ServicePage";
import { RegionalPriceText } from "@/components/pricing/currency-client";
import { regionalPrice } from "@/lib/currency";

export const metadata: Metadata = {
  title: "Image Enhancement",
  description:
    "Real-estate-grade image enhancement: exposure balance, white balance, lens correction, and recovered window views. From US$2 / image.",
};

export default function ImageEnhancementPricingPage() {
  return (
    <ServicePage
      serviceSlug="image-enhancement"
      placeholderVariant="image-enhancement"
      eyebrow="Image Enhancement"
      title="Image Enhancement Pricing"
      description="Improve color, exposure, clarity, and presentation quality so listing photos look clean, natural, and market-ready."
      priceLine={
        <RegionalPriceText
          price={regionalPrice("From $2 / image", "From €2 / image")}
        />
      }
      orderHref="/order/photo-editing"
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
        "1 revision included per image",
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
          price: <RegionalPriceText price={regionalPrice("$2.00", "€2.00")} />,
          unit: "per image",
          note: "Color, exposure, white balance, and window correction.",
          isBase: true,
        },
        {
          label: "Turn On Lights",
          price: <RegionalPriceText price={regionalPrice("+$1.00", "+€1.00")} />,
          unit: "per image",
          note: "Make visible light sources appear switched on.",
        },
        {
          label: "Colour Change",
          price: <RegionalPriceText price={regionalPrice("+$3.00", "+€3.00")} />,
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
          question: "Is one revision included?",
          answer: "Yes. One revision round is included for each image so the final result matches your brief.",
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
  );
}
