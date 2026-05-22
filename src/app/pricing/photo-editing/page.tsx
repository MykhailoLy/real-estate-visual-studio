import type { Metadata } from "next";
import PricingHero from "@/components/pricing/PricingHero";
import PricingTable from "@/components/pricing/PricingTable";
import BeforeAfterPlaceholder from "@/components/pricing/BeforeAfterPlaceholder";
import ServiceExampleBlock from "@/components/pricing/ServiceExampleBlock";
import UploadRequirementsBlock from "@/components/pricing/UploadRequirementsBlock";
import ServiceCTA from "@/components/pricing/ServiceCTA";
import SectionLead from "@/components/pricing/SectionLead";
import Wide from "@/components/pricing/Wide";

export const metadata: Metadata = {
  title: "Photo Editing & Virtual Cleaning Pricing",
  description:
    "Per-option photo editing for real estate. Image enhancement, day to dusk, item removal, virtual cleaning, background change, colour change, water effect, shadow removal and more. Pay only for the options you select.",
};

const photoEditRows = [
  { label: "Image Enhancement", price: "US$2.00" },
  { label: "Turn On Lights", price: "US$1.00" },
  { label: "Colour Change", price: "US$3.00" },
  { label: "Background Removal", price: "US$3.00" },
  { label: "Background Change", price: "US$5.00" },
  { label: "Day to Dusk", price: "US$5.00" },
  { label: "Water Effect for Empty Pools & Jacuzzi", price: "US$5.00" },
  { label: "Item Removal & Virtual Cleaning", price: "US$8.00" },
  { label: "Shadow Removal", price: "US$8.00" },
];

// ============================================================
// EXAMPLE BLOCKS
// ============================================================

interface Example {
  title: string;
  description: string;
  price: string;
  variant:
    | "enhancement"
    | "dusk"
    | "object-removal"
    | "pool"
    | "background"
    | "color"
    | "editing";
  bullets?: string[];
}

const examples: Example[] = [
  {
    title: "Image Enhancement",
    description:
      "Real-estate-grade colour correction, exposure balancing, white balance, and lens cleanup. The fastest way to make every listing photo look professional.",
    price: "US$2.00 / image",
    variant: "enhancement",
    bullets: [
      "Exposure & contrast balanced",
      "White balance corrected",
      "Lens distortion cleaned",
      "Window views recovered",
    ],
  },
  {
    title: "Day to Dusk",
    description:
      "Convert daytime exterior photos into warm dusk scenes — glowing windows, soft sky tones, and inviting twilight ambience.",
    price: "US$5.00 / image",
    variant: "dusk",
    bullets: [
      "Realistic dusk sky replacement",
      "Warm interior glow",
      "Lights turned on automatically",
    ],
  },
  {
    title: "Minor Object Removal",
    description:
      "Remove distracting objects — bins, cables, signs, clutter, reflections — while preserving the natural look of the room or facade.",
    price: "US$8.00 / image",
    variant: "object-removal",
    bullets: [
      "Cables, signs, and clutter removed",
      "Background fill blended seamlessly",
    ],
    
  },
  {
    title: "Standard Item Removal / Virtual Cleaning",
    description:
      "Clean entire rooms by removing furniture, decor, and personal items — perfect for cleaned-up listing photos before staging or selling unfurnished.",
    price: "US$8.00 / image",
    variant: "object-removal",
    bullets: [
      "Furniture and personal items removed",
      "Floors and walls reconstructed",
      "Combine with Virtual Staging for full transformation",
    ],
  },
  {
    title: "Pool Water Effect",
    description:
      "Fill empty pools and jacuzzis with realistic water — ideal for listings shot during off-season or maintenance.",
    price: "US$5.00 / image",
    variant: "pool",
    bullets: [
      "Realistic water fill",
      "Reflection & light adjustments",
    ],
  },
  {
    title: "Background Change",
    description:
      "Replace the sky, view, or background behind a property to create a cleaner or more attractive setting.",
    price: "US$5.00 / image",
    variant: "background",
    bullets: [
      "Sky replacement",
      "Cleaner view backgrounds",
      "Custom requests accepted",
    ],
  },
  {
    title: "Colour Change",
    description:
      "Change the colour of walls, doors, ceilings, or specific elements to test palettes or match a brand.",
    price: "US$3.00 / image",
    variant: "color",
    bullets: [
      "Walls, doors, ceilings, fixtures",
      "Match exact brand or reference colour",
    ],
  },
];

export default function PhotoEditingPricingPage() {
  return (
    <>
      <PricingHero
        eyebrow="Photo Editing & Virtual Cleaning"
        title="Photo Editing Pricing"
        description="Enhance listing images, remove distractions, change backgrounds, turn on lights, add dusk skies, fill pools, and clean spaces. Pay per option, per image."
        priceLine="From US$1 / option"
        primaryHref="/order/photo-editing"
        primaryLabel="Order Photo Editing"
      />

      {/* Big before/after */}
      <section className="py-16 lg:py-24 bg-white">
        <Wide>
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">
            <div className="lg:col-span-5">
              <SectionLead
                eyebrow="What it is"
                title="Per-option editing built for real estate"
                description="Each editing option has its own price. Stack as many as you need on one image — your final total is the sum of selected options multiplied by the number of images."
              />
              <ul className="space-y-3 text-sm lg:text-base text-foreground">
                <li className="flex gap-2.5">
                  <span className="text-secondary-dark mt-1">•</span>
                  <span>9 individually priced editing options</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="text-secondary-dark mt-1">•</span>
                  <span>Combine multiple options on the same image</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="text-secondary-dark mt-1">•</span>
                  <span>1 revision included per image</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="text-secondary-dark mt-1">•</span>
                  <span>High-resolution JPG delivery in 24–48h</span>
                </li>
              </ul>
            </div>
            <div className="lg:col-span-7">
              <BeforeAfterPlaceholder
                variant="editing"
                beforeLabel="Original"
                afterLabel="Edited"
                caption="Before/after preview placeholder. Real editing examples will be added soon."
              />
            </div>
          </div>
        </Wide>
      </section>

      {/* Example blocks */}
      <section className="py-16 lg:py-24 bg-stone-50">
        <Wide>
          <SectionLead
            eyebrow="Service examples"
            title="See what each editing option does"
            description="Each block shows the type of transformation you can expect, with the price for that option per image."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {examples.map((ex) => (
              <ServiceExampleBlock
                key={ex.title}
                title={ex.title}
                description={ex.description}
                price={ex.price}
                priceLabel="Price"
                variant={ex.variant}
                bullets={ex.bullets}
              />
            ))}
          </div>
        </Wide>
      </section>

      {/* Pricing table */}
      <section className="py-16 lg:py-24 bg-white">
        <Wide>
          <SectionLead
            eyebrow="Pricing"
            title="All photo editing options"
            description="The full per-option pricing list. Pricing is per image — combine multiple options on one image to build a complete edit."
          />
          <PricingTable
            rows={photoEditRows}
            headerLabel="Editing Option"
            headerPrice="Price / image"
            caption="Stack multiple options on the same image — your final total is the sum of selected options."
          />
        </Wide>
      </section>

      {/* Upload requirements */}
      <section className="py-16 lg:py-24 bg-stone-50">
        <Wide>
          <SectionLead
            eyebrow="Before you order"
            title="What we need from you"
            description="Send us the original photo and tell us which options you need. The clearer your notes, the closer the result to your vision."
          />
          <UploadRequirementsBlock
            items={[
              {
                label: "Original photo",
                required: true,
                hint: "JPG or PNG, ideally the highest-resolution version available",
              },
              {
                label: "Selected editing options",
                required: true,
                hint: "Pick from the options above for each image",
              },
              {
                label: "Notes about what should be changed",
                hint: "Specific colours, items to remove, sky direction, etc.",
              },
              {
                label: "Reference image or link",
                hint: "Optional — useful for colour matching or background changes",
              },
            ]}
            footnote="Required fields are marked with *. Multiple images and option combinations are supported in a single order."
          />
        </Wide>
      </section>

      <ServiceCTA
        title="Ready to enhance your photos?"
        subtitle="Upload your images, choose the editing options, and receive market-ready photos within 24–48 hours."
        primaryHref="/order/photo-editing"
        primaryLabel="Order Photo Editing"
      />
    </>
  );
}
