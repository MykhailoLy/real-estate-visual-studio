import type { Metadata } from "next";
import { Paintbrush, Wrench, Trees, Layers } from "lucide-react";
import ServicePage from "@/components/pricing/ServicePage";
import { RegionalPriceText } from "@/components/pricing/currency-client";
import { regionalPrice } from "@/lib/currency";

export const metadata: Metadata = {
  title: "Virtual Renovation",
  description:
    "Show renovation potential with realistic visual updates for finishes, fixtures, layouts, materials, and property presentation. Option-based pricing.",
};

const INTERNAL = [
  { label: "Replace Flooring", price: regionalPrice("$20.00", "€20.00") },
  { label: "Replace Walls", price: regionalPrice("$14.00", "€14.00") },
  { label: "Replace Ceiling", price: regionalPrice("$14.00", "€14.00") },
  { label: "Item Removal & Virtual Cleaning", price: regionalPrice("$8.00", "€8.00") },
  { label: "Add / Remove Walls", price: regionalPrice("$35.00", "€35.00") },
  { label: "Add or Complete Kitchen Fit Out", price: regionalPrice("$55.00", "€55.00") },
  { label: "Add or Complete Bathroom Fit Out", price: regionalPrice("$55.00", "€55.00") },
  { label: "Add Fixtures", price: regionalPrice("$20.00", "€20.00") },
  { label: "Virtual Staging — Residential", price: regionalPrice("$19.00", "€19.00") },
  { label: "Colour Change — Walls / Ceiling / Doors", price: regionalPrice("$3.00", "€3.00") },
];

const EXTERNAL = [
  { label: "Add Pool Only", price: regionalPrice("$35.00", "€35.00") },
  { label: "Add Pool Surrounds", price: regionalPrice("$28.00", "€28.00") },
  { label: "Add Basic Landscaping", price: regionalPrice("$20.00", "€20.00") },
  { label: "Add Full Landscaping", price: regionalPrice("$55.00", "€55.00") },
  { label: "Season Change with Full Landscaping", price: regionalPrice("$55.00", "€55.00") },
  { label: "Replace Driveway", price: regionalPrice("$20.00", "€20.00") },
  { label: "Replace Roof", price: regionalPrice("$20.00", "€20.00") },
  { label: "Replace Exterior Walls", price: regionalPrice("$40.00", "€40.00") },
  { label: "Item Removal & Virtual Cleaning", price: regionalPrice("$8.00", "€8.00") },
];

export default function VirtualRenovationPricingPage() {
  return (
    <ServicePage
      serviceSlug="virtual-renovation"
      placeholderVariant="virtual-renovation"
      eyebrow="Virtual Renovation"
      title="Virtual Renovation Pricing"
      description="Show renovation potential with realistic visual updates for finishes, fixtures, layouts, materials, and property presentation."
      priceLine="Option-based pricing"
      orderHref="/order/virtual-renovation"
      orderLabel="Order Virtual Renovation"
      whenToUseTitle="When to use Virtual Renovation"
      whenToUseDescription="Virtual renovation helps buyers and sellers see the potential of a property without construction — turning dated or empty spaces into confident listing visuals."
      useCases={[
        {
          icon: Paintbrush,
          title: "Outdated interiors",
          description: "Update tired finishes, flooring, and fixtures to show modern styling without physical work.",
        },
        {
          icon: Wrench,
          title: "Renovation concepts",
          description: "Show kitchen, bathroom, or structural renovation concepts to attract renovation buyers.",
        },
        {
          icon: Trees,
          title: "Buyer visualization",
          description: "Help buyers imagine how the property could look with their preferred materials and style.",
        },
        {
          icon: Layers,
          title: "Pre-sale improvement ideas",
          description: "Demonstrate renovation ROI to sellers before they commit to physical changes.",
        },
      ]}
      whatItIsTitle="Visual renovation concepts for listing presentation"
      whatItIsBody="We create realistic renovation visuals that help buyers understand how a space could look with updated finishes, materials, fixtures, or design direction."
      whatItIsBullets={[
        "Internal and external renovation options available",
        "Flooring, walls, kitchens, bathrooms, fixtures, and more",
        "Pools, landscaping, and exterior upgrades",
        "Stack multiple options on one image",
        "1 revision included per image",
        "High-resolution JPG delivery in 24–48h",
      ]}
      beforeYouOrderDescription="Send the original photo with clear instructions about what to change, keep, and reference materials if you have them."
      uploadItems={[
        {
          label: "Original photo",
          required: true,
          hint: "JPG or PNG, well-lit, straight angle if possible",
        },
        {
          label: "Renovation instructions",
          required: true,
          hint: "Describe the transformation you want for each image",
        },
        {
          label: "Elements to keep",
          hint: "Anything that must stay exactly as it is",
        },
        {
          label: "Elements to replace or remove",
          hint: "Specific items, walls, fixtures, or finishes to change",
        },
        {
          label: "Preferred materials or style",
          hint: "Wood, marble, modern, Hamptons, etc.",
        },
        {
          label: "Reference image or link",
          hint: "Strongly recommended for kitchen and bathroom fit-outs",
        },
      ]}
      uploadFootnote="Required fields are marked *. Detailed per-image instructions always produce the best results."
      pricingTitle="Virtual Renovation pricing"
      pricingDescription="Select only the options you need. Pricing is per option, per image — stack as many as required."
      pricingCards={[
        ...INTERNAL.slice(0, 6).map((row, i) => ({
          label: row.label,
          price: <RegionalPriceText price={row.price} />,
          unit: "per image",
          note: i === 0 ? "Replace existing flooring with a new surface finish." :
                i === 1 ? "Change wall finishes, texture, or paint colour." :
                i === 2 ? "Update ceiling finish or add detail." :
                i === 3 ? "Remove items before applying renovation options." :
                i === 4 ? "Add or remove walls to reconfigure the layout." :
                "Complete or redesign the kitchen cabinetry and layout.",
          isBase: i === 0,
        })),
      ]}
      pricingFootnote={`Full internal option list also includes: ${INTERNAL.slice(6).map(r => r.label).join(", ")}. External options include: ${EXTERNAL.map(r => r.label).join(", ")}. All priced per image — visit the order form to build your exact combination.`}
      faqTitle="Virtual Renovation questions"
      faqItems={[
        {
          question: "How does option-based pricing work?",
          answer: "Each renovation option has a fixed price per image. Your total is the sum of the options you select for each image. Add more images and more options as needed.",
        },
        {
          question: "Can I combine multiple options on one image?",
          answer: "Yes. Most renovation orders combine several options — for example, Replace Flooring + Replace Walls + Add or Complete Kitchen Fit Out in one image.",
        },
        {
          question: "Do I need a reference image for the style?",
          answer: "For kitchens and bathrooms especially, a reference image or link helps our editors match the finish direction closely. For simpler changes like flooring colour, a description is enough.",
        },
        {
          question: "Are external options separate from internal options?",
          answer: "Yes. Internal options cover rooms and interiors. External options cover pools, landscaping, driveways, roofs, and exterior walls. Both can be combined on exterior images.",
        },
        {
          question: "Can you add a pool to an exterior image?",
          answer: "Yes. Pool-only, pool with surrounds, and pool cover removal are all available as external renovation options.",
        },
        {
          question: "What should I send in my brief?",
          answer: "The original photo, a list of options, what to keep, what to change, preferred materials, and any reference images. Detailed briefs per image always produce the best results.",
        },
        {
          question: "How long does it take?",
          answer: "Standard delivery is 24–48 hours from when we receive your photos and instructions. Complex full-room renovations may take slightly longer — we'll confirm at order.",
        },
        {
          question: "Is a revision included?",
          answer: "Yes. One revision round is included per image so the final result matches your brief.",
        },
      ]}
      ctaTitle="Ready to renovate digitally?"
      ctaSubtitle="Upload your photos, describe the renovation, and receive market-ready images in 24–48 hours."
    />
  );
}
