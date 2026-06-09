import type { Metadata } from "next";
import { Compass, Globe, Home, Sparkles } from "lucide-react";
import PanoramaHeroViewer from "@/components/pricing/PanoramaHeroViewer";
import ServicePage from "@/components/pricing/ServicePage";
import {
  getServiceHeroPanoramaItems,
  getSiteMediaPublicUrl,
} from "@/lib/site-media";

export const metadata: Metadata = {
  title: "360° Virtual Staging Pricing",
  description:
    "Stage furniture inside a 360 panorama so virtual tours show furnished, lived-in spaces. Quote-based — send a sample for an exact price.",
};

export default async function ThreeSixtyVirtualStagingPricingPage() {
  const heroPanoramas = await getServiceHeroPanoramaItems("360-virtual-staging");
  const heroPanorama = heroPanoramas.find((item) => item.panorama_image_path);
  const heroPanoramaUrl = getSiteMediaPublicUrl(
    heroPanorama?.panorama_image_path
  );

  return (
    <ServicePage
      serviceSlug="360-virtual-staging"
      placeholderVariant="panorama-staging"
      eyebrow="360° Virtual Staging"
      title="360° Virtual Staging Pricing"
      description="Stage furniture inside a 360 panorama so virtual tours show furnished, lived-in spaces — without the cost or scheduling of physical staging."
      priceLine="Request a quote"
      orderHref="/order/photo-editing"
      orderLabel="Order Online"
      heroContent={
        <PanoramaHeroViewer
          imageUrl={heroPanoramaUrl}
          title={
            heroPanorama?.alt_text ??
            heroPanorama?.title ??
            "Interactive 360 virtual staging panorama"
          }
          fallbackLabel="360 Virtual Staging hero placeholder"
        />
      }
      whenToUseTitle="When to use 360° Virtual Staging"
      whenToUseDescription="Use 360° Virtual Staging when an empty panorama needs to feel furnished, styled, and tour-ready before buyers explore the room."
      useCases={[
        {
          icon: Globe,
          title: "Virtual tours",
          description:
            "Furnish empty equirectangular panoramas before publishing to tour platforms.",
        },
        {
          icon: Home,
          title: "Vacant rooms",
          description:
            "Show scale, flow, and purpose without arranging physical staging.",
        },
        {
          icon: Sparkles,
          title: "Style-led marketing",
          description:
            "Match furniture style to the buyer profile, listing tier, and room type.",
        },
        {
          icon: Compass,
          title: "Tour-ready delivery",
          description:
            "Receive a staged panorama ready for most standard 360° viewers.",
        },
      ]}
      whatItIsTitle="Realistic furniture for immersive 360° rooms"
      whatItIsBody="We stage furniture directly into panoramic room images so buyers can look around a finished space inside an interactive virtual tour."
      whatItIsBullets={[
        "Realistic furniture placement that respects scale and perspective",
        "Style match for modern, Scandinavian, coastal, classic, and more",
        "Lighting and shadow blending across the full panorama",
        "Final delivery as equirectangular JPG ready for any 360 platform",
        "One round of revisions per panorama",
      ]}
      beforeYouOrderDescription="Send the empty 360° room panorama and a short style brief so we can quote accurately before production."
      uploadItems={[
        {
          label: "Empty equirectangular panorama",
          required: true,
          hint: "A 2:1 JPG or TIFF panorama, typically 6000x3000 or larger",
        },
        {
          label: "Preferred furniture style",
          required: true,
          hint: "Modern, Scandinavian, coastal, traditional, or your own reference",
        },
        {
          label: "Room notes",
          hint: "Furniture pieces to include, avoid, or keep clear for walkthroughs",
        },
        {
          label: "Tour platform",
          hint: "Matterport, Kuula, or another viewer if output specs matter",
        },
      ]}
      uploadFootnote="Required fields are marked *. Please send at least one sample panorama so we can confirm the quote."
      pricingTitle="360° Virtual Staging pricing"
      pricingDescription="Pricing depends on the room, furnishing complexity, and the number of panoramas in the tour."
      pricingCards={[
        {
          label: "Single Panorama Staging",
          price: "Request quote",
          unit: "per panorama",
          note: "One empty 360° room staged with realistic furniture and styling.",
          isBase: true,
        },
        {
          label: "Multi-room Tour",
          price: "Request quote",
          unit: "per panorama",
          note: "Consistent styling across several panoramas from the same property.",
        },
        {
          label: "Custom Style Direction",
          price: "Request quote",
          unit: "per room",
          note: "Specific buyer profile, furniture references, or branded look requirements.",
        },
      ]}
      pricingFootnote="Send a sample panorama and style notes for an exact written quote before we start."
      faqTitle="360° Virtual Staging questions"
      faqItems={[
        {
          question: "What is 360° Virtual Staging?",
          answer:
            "It is virtual furniture staging created inside an equirectangular 360° panorama so the finished room can be viewed interactively in a virtual tour.",
        },
        {
          question: "What file should I send?",
          answer:
            "Send the empty room as a 2:1 equirectangular JPG or TIFF panorama. Higher-resolution files usually produce cleaner final results.",
        },
        {
          question: "Can I choose the furniture style?",
          answer:
            "Yes. Send a preferred style such as modern, Scandinavian, coastal, traditional, or provide reference images for the look you want.",
        },
        {
          question: "Will the final image work in my 360° tour platform?",
          answer:
            "Yes. We deliver a standard equirectangular image suitable for most 360° viewers and virtual tour platforms.",
        },
        {
          question: "How is pricing calculated?",
          answer:
            "Pricing depends on the number of panoramas, room complexity, furniture density, and any custom style direction. Send a sample for an exact quote.",
        },
        {
          question: "Is a revision included?",
          answer:
            "Yes. One revision round is included per panorama so small furniture, styling, or blend adjustments can be handled.",
        },
      ]}
      ctaTitle="Furnish a 360 without lifting a sofa."
      ctaSubtitle="Pricing depends on room complexity and the number of furniture items."
    />
  );
}
