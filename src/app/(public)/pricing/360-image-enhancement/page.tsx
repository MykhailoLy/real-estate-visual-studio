import type { Metadata } from "next";
import { Compass, SlidersHorizontal, ImageIcon, Globe } from "lucide-react";
import PanoramaHeroViewer from "@/components/pricing/PanoramaHeroViewer";
import ServicePage from "@/components/pricing/ServicePage";
import SyncedPanoramaCompareViewer from "@/components/pricing/SyncedPanoramaCompareViewer";
import {
  getServiceHeroBeforeAfterItem,
  getServiceHeroPanoramaItems,
  getSiteMediaPublicUrl,
} from "@/lib/site-media";
import { localizedAlternates } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import { serviceSchema, breadcrumbSchema } from "@/lib/structured-data";
import { absoluteUrl } from "@/lib/seo";
import { CatalogPriceText } from "@/components/pricing/currency-client";
import { getCatalogPriceDecimal } from "@/lib/pricing/public";
import { getBeforeAfterAlt } from "@/lib/before-after-alt";

export const metadata: Metadata = {
  title: "360° Image Enhancement",
  description:
    "Enhance equirectangular panoramas for cleaner virtual tours with balanced color, exposure, and stitch cleanup.",
  alternates: localizedAlternates({
    canonicalPath: "/pricing/360-image-enhancement",
    englishPath: "/pricing/360-image-enhancement",
    spanishPath: "/es/pricing/360-image-enhancement",
  }),
};

export default async function ThreeSixtyImageEnhancementPricingPage() {
  const [heroBeforeAfter, heroPanoramas] = await Promise.all([
    getServiceHeroBeforeAfterItem("360-image-enhancement"),
    getServiceHeroPanoramaItems("360-image-enhancement"),
  ]);
  const beforePanoramaUrl = getSiteMediaPublicUrl(
    heroBeforeAfter?.before_image_path
  );
  const afterPanoramaUrl = getSiteMediaPublicUrl(
    heroBeforeAfter?.after_image_path
  );
  const heroPanorama = heroPanoramas.find((item) => item.panorama_image_path);
  const heroPanoramaUrl = getSiteMediaPublicUrl(
    heroPanorama?.panorama_image_path,
  );
  const heroAlt = getBeforeAfterAlt({
    sharedAlt: heroBeforeAfter?.alt_text,
    title: heroBeforeAfter?.title,
    description: heroBeforeAfter?.description,
    serviceLabel: "360° Image Enhancement",
    serviceSlug: heroBeforeAfter?.service_slug,
  });
  const heroContent =
    beforePanoramaUrl && afterPanoramaUrl ? (
      <SyncedPanoramaCompareViewer
        beforeImageUrl={beforePanoramaUrl}
        afterImageUrl={afterPanoramaUrl}
        beforeTitle={heroAlt.beforeAlt}
        afterTitle={heroAlt.afterAlt}
        fallbackLabel="360 Image Enhancement before and after hero placeholder"
        serviceSlug="360-image-enhancement"
        locale="en"
        orderHref="/order/photo-editing"
        orderLabel="Order 360° Enhancement"
      />
    ) : (
      <PanoramaHeroViewer
        imageUrl={heroPanoramaUrl}
        title={
          heroPanorama?.alt_text ??
          heroPanorama?.title ??
          "Interactive 360 image enhancement panorama"
        }
        fallbackLabel="360 Image Enhancement hero placeholder"
        serviceSlug="360-image-enhancement"
        locale="en"
        orderHref="/order/photo-editing"
        orderLabel="Order 360° Enhancement"
      />
    );

  return (
    <>
      <JsonLd
        data={[
          serviceSchema({
            name: "360° Image Enhancement",
            description:
              "Enhance equirectangular panoramas for cleaner virtual tours. Balanced color, exposure, and stitch cleanup.",
            url: absoluteUrl("/pricing/360-image-enhancement"),
            price: getCatalogPriceDecimal("360-image-enhancement"),
            priceCurrency: "USD",
            offerNote: "Starting price per panorama",
          }),
          breadcrumbSchema([
            { name: "Home", item: absoluteUrl("/") },
            { name: "Pricing", item: absoluteUrl("/pricing") },
            {
              name: "360° Image Enhancement",
              item: absoluteUrl("/pricing/360-image-enhancement"),
            },
          ]),
        ]}
      />
      <ServicePage
      serviceSlug="360-image-enhancement"
      portfolioViewerVariant="photo"
      placeholderVariant="panorama-enhancement"
      eyebrow="360° Image Enhancement"
      title="360° Image Enhancement Pricing"
      description="Improve 360° property images with cleaner color, exposure, and presentation quality for virtual tours and interactive listing media."
      priceLine={
        <CatalogPriceText
          priceKey="360-image-enhancement"
          prefix="From "
          suffix=" / panorama"
        />
      }
      orderHref="/order/photo-editing"
      heroContent={heroContent}
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
        "Unlimited revisions for 30 days from first delivery",
        "Final delivery as equirectangular JPG",
      ]}
      beforeYouOrderDescription="Send your panoramic files and any tour platform notes so we can confirm the required corrections."
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
      uploadFootnote="Required fields are marked *. Please send a sample panorama so we can confirm scope accurately."
      pricingTitle="360° Enhancement pricing"
      pricingDescription="Standard enhancement has a fixed per-panorama price. Custom patching or unusually complex corrections may require a separate quote."
      pricingCards={[
        {
          label: "Single Panorama Enhancement",
          price: <CatalogPriceText priceKey="360-image-enhancement" />,
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
      pricingFootnote="The fixed price covers standard enhancement. Custom nadir, ceiling, or unusually complex restoration remains quote-based."
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
          answer: "Standard enhancement uses the fixed per-panorama price shown above. Custom patches or unusually complex restoration can be quoted separately after reviewing a sample.",
        },
        {
          question: "How long does it take?",
          answer: "Turnaround depends on the number of panoramas and complexity. Simple enhancements are usually delivered within 24–48 hours.",
        },
        {
          question: "Are revisions included?",
          answer: "Yes. Unlimited revisions are included for 30 calendar days from first delivery, provided the changes stay within the original brief, overall style, and design direction.",
        },
      ]}
      ctaTitle="Ready to polish your 360 tour?"
      ctaSubtitle="Send a panorama and any correction notes to get started."
    />
    </>
  );
}
