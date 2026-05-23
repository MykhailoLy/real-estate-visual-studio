import type { Metadata } from "next";
import { ImagePlus, Sparkles, Home, Building2 } from "lucide-react";
import PricingHero from "@/components/pricing/PricingHero";
import PricingTable from "@/components/pricing/PricingTable";
import BeforeAfterPlaceholder from "@/components/pricing/BeforeAfterPlaceholder";
import UploadRequirementsBlock from "@/components/pricing/UploadRequirementsBlock";
import ServiceCTA from "@/components/pricing/ServiceCTA";
import SectionLead from "@/components/pricing/SectionLead";
import StyleGallerySection from "@/components/pricing/StyleGallerySection";
import Wide from "@/components/pricing/Wide";

export const metadata: Metadata = {
  title: "Virtual Staging Pricing",
  description:
    "Virtual staging from US$19 per image. Add photo enhancement, day-to-dusk, item removal and more. Multiple interior styles available — modern, Scandinavian, Hamptons, contemporary and more.",
};

const baseRows = [
  {
    label: "Base Virtual Staging",
    price: "US$19.00",
    unit: "per image",
    note: "Furniture, decor, and styling for one room.",
  },
];

const addonRows = [
  { label: "Image Enhancement", price: "US$2.00" },
  { label: "Day to Dusk", price: "US$5.00" },
  { label: "Item Removal & Virtual Cleaning", price: "US$8.00" },
  { label: "Turn On Lights", price: "US$1.00" },
  { label: "Colour Change", price: "US$3.00" },
];

const useCases = [
  {
    icon: Home,
    title: "Empty Listings",
    description:
      "Show buyers how empty rooms can look fully furnished and ready to live in.",
  },
  {
    icon: Sparkles,
    title: "Outdated Interiors",
    description:
      "Replace tired furniture with a modern, marketable styling — without renovating.",
  },
  {
    icon: Building2,
    title: "Commercial Spaces",
    description:
      "Stage offices, retail, and commercial interiors to help buyers visualize use.",
  },
  {
    icon: ImagePlus,
    title: "Off-Plan & New Builds",
    description:
      "Bring renders and unfinished spaces to life with realistic styling.",
  },
];

export default function VirtualStagingPricingPage() {
  return (
    <>
      <PricingHero
        eyebrow="Virtual Staging"
        title="Virtual Staging Pricing"
        description="Transform empty rooms into realistic, furnished spaces. Choose from 9 interior styles and combine with optional add-ons for market-ready results."
        priceLine="From US$19 / image"
        primaryHref="/order/virtual-staging"
        primaryLabel="Order Virtual Staging"
      />

      {/* Service explanation + before/after */}
      <section className="py-16 lg:py-24 bg-white">
        <Wide>
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">
            <div className="lg:col-span-5">
              <SectionLead
                eyebrow="What it is"
                title="Furnished, market-ready images from empty rooms"
                description="We replace empty spaces with realistic furniture, decor, and lighting. Each image is styled to match your target buyer and listing positioning — residential or commercial."
              />
              <ul className="space-y-3 text-sm lg:text-base text-foreground">
                <li className="flex gap-2.5">
                  <span className="text-secondary-dark mt-1">•</span>
                  <span>Photorealistic furniture and decor</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="text-secondary-dark mt-1">•</span>
                  <span>Multiple interior styles to choose from</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="text-secondary-dark mt-1">•</span>
                  <span>1 revision included</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="text-secondary-dark mt-1">•</span>
                  <span>High-resolution JPG delivery in 24–48h</span>
                </li>
              </ul>
            </div>
            <div className="lg:col-span-7">
              <BeforeAfterPlaceholder
                variant="staging"
                beforeLabel="Empty"
                afterLabel="Staged"
                caption="Before/after preview placeholder. Real examples will be added soon."
              />
            </div>
          </div>
        </Wide>
      </section>

      {/* Best for / Use cases */}
      <section className="py-16 lg:py-24 bg-stone-50">
        <Wide>
          <SectionLead
            eyebrow="Best for"
            title="When to use Virtual Staging"
            description="Virtual staging works for almost any listing where empty or outdated rooms make it harder for buyers to visualize the space."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {useCases.map((u) => {
              const Icon = u.icon;
              return (
                <div
                  key={u.title}
                  className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-7 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-base lg:text-lg font-bold text-primary mb-2 tracking-tight">
                    {u.title}
                  </h3>
                  <p className="text-sm text-muted leading-relaxed">
                    {u.description}
                  </p>
                </div>
              );
            })}
          </div>
        </Wide>
      </section>

      {/* Pricing tables */}
      <section className="py-16 lg:py-24 bg-white">
        <Wide>
          <SectionLead
            eyebrow="Pricing"
            title="Base price + optional add-ons"
            description="Start with the base virtual staging price per image. Combine any add-ons you need for the same image — they stack on top of the base price."
          />
          <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
            <PricingTable
              title="Base Price"
              rows={baseRows}
              headerLabel="Service"
              headerPrice="Price"
            />
            <PricingTable
              title="Optional Add-ons"
              rows={addonRows}
              showPlusPrefix
              headerLabel="Add-on"
              headerPrice="Price / image"
              caption="Add-ons are per image and combine with the base virtual staging price."
            />
          </div>
        </Wide>
      </section>

      {/* Style options — visual gallery with lightbox */}
      <section className="py-16 lg:py-24 bg-stone-50">
        <Wide>
          <SectionLead
            eyebrow="Style options"
            title="Choose the right look for your buyer"
            description="Pick a single style per image — or let us match a reference. We tailor the furniture, materials and palette to fit the chosen direction. Tap a card to browse multiple examples per style."
          />
          <StyleGallerySection />
        </Wide>
      </section>

      {/* Upload requirements */}
      <section className="py-16 lg:py-24 bg-white">
        <Wide>
          <SectionLead
            eyebrow="Before you order"
            title="What we need from you"
            description="Send us a clean photo of the empty room and a few details — we handle the rest."
          />
          <UploadRequirementsBlock
            items={[
              { label: "Original room photo", required: true, hint: "JPG or PNG, well-lit, straight angle if possible" },
              { label: "Room name / area", required: true, hint: "Living room, bedroom, kitchen, outdoor, etc." },
              { label: "Preferred furniture style", required: true, hint: "Pick from the 9 styles above" },
              { label: "Reference image or link", hint: "Optional — helps us match a specific look" },
              { label: "Notes or instructions", hint: "Special requests, focal points, items to keep / remove" },
            ]}
            footnote="Required fields are marked with *. You can also add any standard photo editing add-ons during the order — they apply to the same image."
          />
        </Wide>
      </section>

      <ServiceCTA
        title="Ready to stage your listing?"
        subtitle="Upload your photos, choose a style, and receive market-ready images within 24–48 hours."
        primaryHref="/order/virtual-staging"
        primaryLabel="Order Virtual Staging"
      />
    </>
  );
}
