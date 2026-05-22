import type { Metadata } from "next";
import {
  Paintbrush,
  Wrench,
  Bath,
  Trees,
  Waves,
  Hammer,
  Info,
} from "lucide-react";
import PricingHero from "@/components/pricing/PricingHero";
import PricingTable from "@/components/pricing/PricingTable";
import BeforeAfterPlaceholder from "@/components/pricing/BeforeAfterPlaceholder";
import UploadRequirementsBlock from "@/components/pricing/UploadRequirementsBlock";
import ServiceCTA from "@/components/pricing/ServiceCTA";
import SectionLead from "@/components/pricing/SectionLead";
import Wide from "@/components/pricing/Wide";

export const metadata: Metadata = {
  title: "Virtual Renovation Pricing",
  description:
    "Option-based virtual renovation pricing. Update flooring, walls, kitchens, bathrooms, exteriors, pools, and landscaping digitally — without construction. Pay only for the options you select per image.",
};

// ============================================================
// PRICING — pulled from src/data/order-options.ts
// ============================================================

const internalOptions = [
  { label: "Replace Flooring", price: "US$20.00" },
  { label: "Replace Walls", price: "US$14.00" },
  { label: "Replace Ceiling", price: "US$14.00" },
  { label: "Item Removal & Virtual Cleaning", price: "US$8.00" },
  { label: "Add / Remove Walls", price: "US$35.00" },
  { label: "Add or Complete Kitchen Fit Out", price: "US$55.00" },
  { label: "Add or Complete Bathroom Fit Out", price: "US$55.00" },
  { label: "Add Fixtures", price: "US$20.00" },
  { label: "Virtual Staging — Residential", price: "US$19.00" },
  { label: "Virtual Staging — Commercial (Office)", price: "US$19.00" },
  { label: "Virtual Staging — Commercial (Non-office)", price: "US$19.00" },
  { label: "Colour Change — Walls / Ceiling / Doors", price: "US$3.00" },
];

const externalOptions = [
  { label: "Add Pool Only", price: "US$35.00" },
  { label: "Add Pool Surrounds", price: "US$28.00" },
  { label: "Remove Pool Cover", price: "US$35.00" },
  { label: "Add Leaves", price: "US$20.00" },
  { label: "Add Basic Landscaping", price: "US$20.00" },
  { label: "Add Full Landscaping", price: "US$55.00" },
  { label: "Season Change with Full Landscaping", price: "US$55.00" },
  { label: "Virtual Staging — Residential or Commercial", price: "US$19.00" },
  { label: "Item Removal & Virtual Cleaning", price: "US$8.00" },
  { label: "Add Fixtures", price: "US$20.00" },
  { label: "Replace Driveway", price: "US$20.00" },
  { label: "Replace Roof", price: "US$20.00" },
  { label: "Replace Exterior Walls", price: "US$40.00" },
  {
    label: "Add or Complete Patio, Balcony, Pergola, Veranda or Decking",
    price: "US$40.00",
  },
  { label: "Colour Change — Exterior Features", price: "US$3.00" },
];

// ============================================================
// SCENARIO CARDS
// ============================================================

type ScenarioVariant =
  | "renovation"
  | "staging"
  | "pool"
  | "object-removal"
  | "color"
  | "background";

interface Scenario {
  icon: typeof Paintbrush;
  variant: ScenarioVariant;
  title: string;
  description: string;
  includes: string[];
}

const scenarios: Scenario[] = [
  {
    icon: Paintbrush,
    variant: "color",
    title: "Small Renovation",
    description:
      "Refresh a tired interior with cosmetic updates only — perfect for listings that need a light visual upgrade.",
    includes: [
      "Replace Flooring",
      "Colour Change — Walls / Ceiling / Doors",
      "Item Removal & Virtual Cleaning",
    ],
  },
  {
    icon: Wrench,
    variant: "renovation",
    title: "Kitchen Fit Out",
    description:
      "Replace dated kitchens with modern cabinetry, appliances, and finishes to attract serious buyers.",
    includes: [
      "Add or Complete Kitchen Fit Out",
      "Replace Flooring",
      "Colour Change — Walls / Ceiling / Doors",
      "Add Fixtures",
    ],
  },
  {
    icon: Bath,
    variant: "renovation",
    title: "Bathroom Fit Out",
    description:
      "Show fully renovated bathrooms with new tiling, fixtures, and modern finishes.",
    includes: [
      "Add or Complete Bathroom Fit Out",
      "Replace Flooring",
      "Add Fixtures",
      "Colour Change — Walls / Ceiling / Doors",
    ],
  },
  {
    icon: Trees,
    variant: "background",
    title: "Outdoor / Landscaping",
    description:
      "Turn neglected outdoor areas into welcoming gardens and entertaining spaces.",
    includes: [
      "Add Full Landscaping",
      "Add Leaves",
      "Item Removal & Virtual Cleaning",
      "Add or Complete Patio, Balcony, Pergola, Veranda or Decking",
    ],
  },
  {
    icon: Waves,
    variant: "pool",
    title: "Pool / Exterior Updates",
    description:
      "Add a pool, refresh exteriors, or remove pool covers to highlight outdoor lifestyle features.",
    includes: [
      "Add Pool Only",
      "Add Pool Surrounds",
      "Replace Exterior Walls",
      "Replace Driveway",
    ],
  },
  {
    icon: Hammer,
    variant: "renovation",
    title: "Complete Transformation",
    description:
      "Full digital renovation combining structural, surface, fixture, and styling updates in one image.",
    includes: [
      "Add / Remove Walls",
      "Replace Flooring",
      "Replace Walls",
      "Add or Complete Kitchen Fit Out",
      "Virtual Staging — Residential",
    ],
  },
];

export default function VirtualRenovationPricingPage() {
  return (
    <>
      <PricingHero
        eyebrow="Virtual Renovation"
        title="Virtual Renovation Pricing"
        description="Show buyers the full potential of any property — without construction. Pricing is option-based: select only the renovations you need per image, and stack them as required."
        priceLine="Option-based pricing — pay only for what you select"
        primaryHref="/order/virtual-renovation"
        primaryLabel="Order Virtual Renovation"
      />

      {/* Big before/after */}
      <section className="py-16 lg:py-24 bg-white">
        <Wide>
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">
            <div className="lg:col-span-5">
              <SectionLead
                eyebrow="What it is"
                title="Digital renovation, image by image"
                description="We rebuild rooms, exteriors, and outdoor areas digitally — replacing flooring, walls, kitchens, bathrooms, pools, landscaping and more. The original photo stays as the base; we transform it according to your instructions."
              />
              <ul className="space-y-3 text-sm lg:text-base text-foreground">
                <li className="flex gap-2.5">
                  <span className="text-secondary-dark mt-1">•</span>
                  <span>Internal and external renovation options</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="text-secondary-dark mt-1">•</span>
                  <span>Stack multiple options on one image</span>
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
                variant="renovation"
                beforeLabel="Existing"
                afterLabel="Renovated"
                caption="Before/after preview placeholder. Real renovation examples will be added soon."
              />
            </div>
          </div>
        </Wide>
      </section>

      {/* How pricing works */}
      <section className="py-16 lg:py-24 bg-stone-50">
        <Wide>
          <div className="max-w-4xl mx-auto">
            <SectionLead
              eyebrow="How pricing works"
              title="You pay per option, per image"
              description="Each renovation option has its own fixed price. Your final total depends on which options you select for each image and how many images you order."
              align="center"
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
              <div className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-7 shadow-sm text-center">
                <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-base mb-4 mx-auto">
                  1
                </div>
                <h3 className="text-base lg:text-lg font-bold text-primary mb-2 tracking-tight">
                  Pick the image
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  Upload the original photo of the room or exterior you want
                  transformed.
                </p>
              </div>
              <div className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-7 shadow-sm text-center">
                <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-base mb-4 mx-auto">
                  2
                </div>
                <h3 className="text-base lg:text-lg font-bold text-primary mb-2 tracking-tight">
                  Choose options
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  Select the renovation options you need from the internal or
                  external list.
                </p>
              </div>
              <div className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-7 shadow-sm text-center">
                <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-base mb-4 mx-auto">
                  3
                </div>
                <h3 className="text-base lg:text-lg font-bold text-primary mb-2 tracking-tight">
                  Total is calculated
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  Your image total is the sum of selected options. Add more
                  images and stack as needed.
                </p>
              </div>
            </div>
          </div>
        </Wide>
      </section>

      {/* Internal renovations */}
      <section className="py-16 lg:py-24 bg-white" id="internal">
        <Wide>
          <SectionLead
            eyebrow="Internal renovations"
            title="Inside-the-property options"
            description="Update flooring, walls, ceilings, kitchens, bathrooms, fixtures and styling. Pricing is per option, per image."
          />
          <PricingTable
            rows={internalOptions}
            headerLabel="Internal Renovation Option"
            headerPrice="Price / image"
            caption="Stack multiple internal options on the same image to build a complete interior renovation."
          />
        </Wide>
      </section>

      {/* External renovations */}
      <section className="py-16 lg:py-24 bg-stone-50" id="external">
        <Wide>
          <SectionLead
            eyebrow="External renovations"
            title="Outside-the-property options"
            description="Pools, landscaping, driveways, roofs, exterior walls, patios, balconies, pergolas and more. Pricing is per option, per image."
          />
          <PricingTable
            rows={externalOptions}
            headerLabel="External Renovation Option"
            headerPrice="Price / image"
            caption="Combine pool, landscaping, and exterior options on one image to show a full outdoor transformation."
          />
        </Wide>
      </section>

      {/* Example scenarios */}
      <section className="py-16 lg:py-24 bg-white">
        <Wide>
          <SectionLead
            eyebrow="Example scenarios"
            title="Common combinations of renovation options"
            description="These are examples of how renovation options are typically combined for different listing needs. Use them as inspiration when configuring your order."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {scenarios.map((s) => {
              const Icon = s.icon;
              return (
                <article
                  key={s.title}
                  className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col"
                >
                  <div className="aspect-[16/10] relative overflow-hidden">
                    <BeforeAfterPlaceholder
                      variant={s.variant}
                      beforeLabel="Before"
                      afterLabel="After"
                      rounded="lg"
                    />
                  </div>
                  <div className="p-6 lg:p-7 flex-1 flex flex-col">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <h3 className="text-lg lg:text-xl font-bold text-primary tracking-tight">
                        {s.title}
                      </h3>
                    </div>
                    <p className="text-sm lg:text-base text-muted leading-relaxed mb-5">
                      {s.description}
                    </p>
                    <div className="border-t border-stone-100 pt-4 mt-auto">
                      <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted mb-2.5">
                        Example included options
                      </p>
                      <ul className="space-y-1.5">
                        {s.includes.map((inc) => (
                          <li
                            key={inc}
                            className="text-xs lg:text-sm text-foreground flex gap-2 leading-relaxed"
                          >
                            <span className="text-secondary-dark mt-0.5">
                              •
                            </span>
                            <span>{inc}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-[11px] text-muted italic mt-3 leading-relaxed">
                        Final total depends on the exact options you select.
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </Wide>
      </section>

      {/* Upload + Instructions */}
      <section className="py-16 lg:py-24 bg-stone-50">
        <Wide>
          <SectionLead
            eyebrow="Before you order"
            title="What we need from you"
            description="Clear photos and clear instructions give the best results. The more specific you are, the closer the renovation will match your vision."
          />
          <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
            <UploadRequirementsBlock
              title="What to upload"
              items={[
                {
                  label: "Original photo",
                  required: true,
                  hint: "JPG or PNG, well-lit, straight angle if possible",
                },
                {
                  label: "Renovation instructions",
                  required: true,
                  hint: "Describe the transformation you want for this image",
                },
                {
                  label: "Elements to keep",
                  hint: "Anything that should stay exactly as it is",
                },
                {
                  label: "Elements to remove",
                  hint: "Items, walls, fixtures, or features to delete",
                },
                {
                  label: "Elements to replace",
                  hint: "What should be swapped (e.g. floor, kitchen, walls)",
                },
                {
                  label: "Preferred materials / style",
                  hint: "Wood, marble, modern, Hamptons, etc.",
                },
                {
                  label: "Reference image or link",
                  hint: "Optional — helps us match a specific look",
                },
                {
                  label: "Additional notes",
                  hint: "Anything else our editors should know",
                },
              ]}
              footnote="Required fields are marked with *. Detailed notes per image always produce the best results."
            />

            <div className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8 shadow-sm">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Info className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg lg:text-xl font-bold text-primary tracking-tight">
                    Instruction guidance
                  </h3>
                  <p className="text-sm lg:text-base text-muted mt-1 leading-relaxed">
                    Tips to help our editors deliver exactly what you have in
                    mind.
                  </p>
                </div>
              </div>
              <ul className="space-y-3 text-sm lg:text-base text-foreground">
                <li className="flex gap-2.5 leading-relaxed">
                  <span className="text-secondary-dark mt-1">•</span>
                  <span>
                    Be specific per image — describe each renovation separately
                    instead of giving general instructions for a batch.
                  </span>
                </li>
                <li className="flex gap-2.5 leading-relaxed">
                  <span className="text-secondary-dark mt-1">•</span>
                  <span>
                    State materials and tones (e.g. light oak flooring, matte
                    white walls, brushed brass fixtures).
                  </span>
                </li>
                <li className="flex gap-2.5 leading-relaxed">
                  <span className="text-secondary-dark mt-1">•</span>
                  <span>
                    For exteriors, mention pool placement, landscaping density,
                    and any items to remove (cars, bins, cables).
                  </span>
                </li>
                <li className="flex gap-2.5 leading-relaxed">
                  <span className="text-secondary-dark mt-1">•</span>
                  <span>
                    Reference images or links are highly recommended for kitchen
                    and bathroom fit-outs.
                  </span>
                </li>
                <li className="flex gap-2.5 leading-relaxed">
                  <span className="text-secondary-dark mt-1">•</span>
                  <span>
                    If uncertain, choose &ldquo;Let us decide&rdquo; in the
                    style picker — our editors will style appropriately.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </Wide>
      </section>

      <ServiceCTA
        title="Ready to renovate digitally?"
        subtitle="Upload your photos, choose the renovation options that match your vision, and receive market-ready images in 24–48h."
        primaryHref="/order/virtual-renovation"
        primaryLabel="Order Virtual Renovation"
      />
    </>
  );
}
