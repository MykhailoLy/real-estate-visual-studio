import type { Metadata } from "next";
import { Compass, SlidersHorizontal, ImageIcon, Globe } from "lucide-react";
import ServicePage from "@/components/pricing/ServicePage";

export const metadata: Metadata = {
  title: "360° Image Enhancement",
  description:
    "Enhance equirectangular panoramas for cleaner virtual tours. Balanced color, exposure, and stitch cleanup. Quote-based.",
};

export default function ThreeSixtyImageEnhancementPricingPage() {
  return (
    <ServicePage
      serviceSlug="360-image-enhancement"
      placeholderVariant="panorama-enhancement"
      eyebrow="360° Image Enhancement"
      title="360° Image Enhancement Pricing"
      description="Improve 360° property images with cleaner color, exposure, and presentation quality for virtual tours and interactive listing media."
      priceLine="Request a quote"
      orderHref="/order/photo-editing"
      orderLabel="Order 360° Enhancement"
      whenToUseTitle="When to use 360° Image Enhancement"
      whenToUseDescription="360° enhancement is the essential step before publishing any virtual tour — making every direction in the panorama look polished and listing-ready."
      useCases={[
        {
          icon: Globe,
          title: "360 virtual tours",
          description: "Improve panoramas before publishing to Matterport, Kuula, or any tour platform.",
        },
        {
          icon: SlidersHorizontal,
          title: "Dull or dark panoramas",
          description: "Fix underexposed or flat panoramic images so every angle looks clear.",
        },
        {
          icon: ImageIcon,
          title: "Color and exposure cleanup",
          description: "Correct mixed lighting, color casts, and uneven brightness across the full 360.",
        },
        {
          icon: Compass,
          title: "Tour-ready presentation",
          description: "Ensure every direction reads well in an interactive viewer before the tour goes live.",
        },
      ]}
      whatItIsTitle="Cleaner 360° visuals for virtual tours"
      whatItIsBody="We enhance 360° images for more balanced exposure, cleaner color, and a more professional tour presentation while respecting panoramic image structure."
      whatItIsBullets={[
        "Color, exposure, and white balance balanced across the full panorama",
        "Stitch line cleanup where visible",
        "Ceiling and nadir patches improved",
        "Window view recovery where possible",
        "1 revision included per panorama",
        "Final delivery as equirectangular JPG",
      ]}
      beforeYouOrderDescription="Send your panoramic files and any tour platform notes — we'll quote and handle the enhancement."
      uploadItems={[
        {
          label: "Equirectangular panorama file",
          required: true,
          hint: "Typically 6000×3000 or 8000×4000 JPG",
        },
        {
          label: "Tour platform",
          hint: "Matterport, Kuula, or other — helps with output spec",
        },
        {
          label: "Zones to focus on",
          hint: "Optional — ceiling, floor, specific areas of concern",
        },
        {
          label: "Nadir or logo patch",
          hint: "Optional — if you want it baked into the file",
        },
      ]}
      uploadFootnote="Required fields are marked *. Please send a sample panorama so we can quote accurately."
      pricingTitle="360° Enhancement pricing"
      pricingDescription="Pricing is based on panorama resolution and the amount of correction needed. Send a sample and we'll quote in writing."
      pricingCards={[
        {
          label: "Single Panorama Enhancement",
          price: "Request quote",
          unit: "per panorama",
          note: "Full color, exposure, and stitch cleanup for one 360 image.",
          isBase: true,
        },
        {
          label: "Batch Enhancement",
          price: "Request quote",
          unit: "per panorama",
          note: "Multiple panoramas from the same property or shoot.",
        },
        {
          label: "Nadir / Ceiling Patch",
          price: "Request quote",
          unit: "per panorama",
          note: "Custom nadir or ceiling patch baked into the file.",
        },
      ]}
      pricingFootnote="Pricing depends on resolution and correction complexity. Contact us with a sample file for an accurate quote."
      faqTitle="360° Image Enhancement questions"
      faqItems={[
        {
          question: "What is 360° Image Enhancement?",
          answer: "It covers color correction, exposure balancing, white balance, and cleanup of stitch lines and nadir/ceiling areas for equirectangular panoramas used in virtual tours.",
        },
        {
          question: "What file format do I need to send?",
          answer: "Send equirectangular JPG or TIFF files. Typical resolutions are 6000×3000 or 8000×4000 pixels.",
        },
        {
          question: "Will it work with my tour platform?",
          answer: "Yes. We deliver standard equirectangular JPG files compatible with Matterport, Kuula, and most other virtual tour platforms.",
        },
        {
          question: "Can you clean up stitching artifacts?",
          answer: "Yes. Visible stitch lines and common stitching artifacts can be reduced as part of the enhancement.",
        },
        {
          question: "Do you add nadir patches?",
          answer: "Yes. If you provide a logo or nadir graphic, we can bake it into the panorama. Ask us when you get in touch.",
        },
        {
          question: "How is the price calculated?",
          answer: "Pricing is based on the number of panoramas, their resolution, and the amount of correction needed. Send a sample and we'll quote in writing within 24 hours.",
        },
        {
          question: "How long does it take?",
          answer: "Turnaround depends on the number of panoramas and complexity. Simple enhancements are usually delivered within 24–48 hours.",
        },
        {
          question: "Is a revision included?",
          answer: "Yes. One revision round is included per panorama.",
        },
      ]}
      ctaTitle="Send a sample 360 — we'll quote in 24 hours."
      ctaSubtitle="Pricing is based on resolution and correction complexity. Get an accurate quote before you commit."
    />
  );
}
