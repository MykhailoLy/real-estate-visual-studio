import type { Metadata } from "next";
import { Layers, Compass, Ruler, FileText, Building, MapPin } from "lucide-react";
import PricingHero from "@/components/pricing/PricingHero";
import PricingTable from "@/components/pricing/PricingTable";
import UploadRequirementsBlock from "@/components/pricing/UploadRequirementsBlock";
import ServiceCTA from "@/components/pricing/ServiceCTA";
import SectionLead from "@/components/pricing/SectionLead";
import Wide from "@/components/pricing/Wide";
import PortfolioExamples from "@/components/portfolio/PortfolioExamples";

export const metadata: Metadata = {
  title: "2D / 3D Floor Plans Pricing",
  description:
    "Floor plans from US$16 per floor. Choose 2D black & white, 2D full colour, 3D, or the 2D + 3D bundle. Convert sketches, existing plans, photos, PDFs, DWG/DXF or measurements into clean marketing-ready plans.",
};

const floorPlanRows = [
  {
    label: "2D Floor Plan — Black & White",
    price: "US$16.00",
    unit: "per floor",
  },
  {
    label: "2D Floor Plan — Full Colour",
    price: "US$22.00",
    unit: "per floor",
  },
  { label: "3D Floor Plan", price: "US$39.00", unit: "per floor" },
  {
    label: "2D + 3D Bundle",
    price: "US$49.00",
    unit: "per floor",
    note: "Best value — both styles delivered together.",
  },
];

// ============================================================
// Plan type cards — visual placeholder per option
// ============================================================

interface PlanCardProps {
  title: string;
  price: string;
  description: string;
  visual: "bw" | "color" | "3d" | "bundle";
}

function PlanVisual({ variant }: { variant: PlanCardProps["visual"] }) {
  if (variant === "bw") {
    return (
      <div className="absolute inset-0 bg-white">
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "linear-gradient(rgba(15,36,64,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(15,36,64,0.18) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        />
        <div className="absolute inset-x-8 inset-y-6 lg:inset-x-12 lg:inset-y-8">
          <div className="relative h-full border-2 border-stone-800 rounded-sm">
            <div className="absolute top-1/2 left-0 right-1/3 h-0.5 bg-stone-800" />
            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-stone-800" />
            <div className="absolute right-1/3 top-1/2 bottom-0 w-0.5 bg-stone-800" />
          </div>
        </div>
      </div>
    );
  }
  if (variant === "color") {
    return (
      <div className="absolute inset-0 bg-stone-50">
        <div className="absolute inset-x-8 inset-y-6 lg:inset-x-12 lg:inset-y-8">
          <div className="relative h-full border-2 border-primary/50 rounded-sm bg-white grid grid-cols-3 grid-rows-2 gap-0.5 p-0.5">
            <div className="bg-amber-100/80" />
            <div className="bg-stone-200/90" />
            <div className="bg-emerald-100/80" />
            <div className="bg-sky-100/80" />
            <div className="bg-rose-100/70" />
            <div className="bg-stone-100" />
          </div>
        </div>
      </div>
    );
  }
  if (variant === "3d") {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-stone-100 via-amber-50 to-stone-200">
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-[70%] aspect-[4/3] bg-white border border-primary/30 shadow-md rounded-sm"
            style={{
              transform: "perspective(800px) rotateX(48deg) rotateZ(-12deg)",
            }}
          >
            <div className="w-full h-full grid grid-cols-3 grid-rows-2">
              <div className="border-r border-b border-primary/20 bg-amber-50/60" />
              <div className="border-r border-b border-primary/20 bg-stone-50" />
              <div className="border-b border-primary/20 bg-emerald-50/60" />
              <div className="border-r border-primary/20 bg-sky-50/60" />
              <div className="border-r border-primary/20 bg-rose-50/50" />
              <div className="bg-stone-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }
  // bundle
  return (
    <div className="absolute inset-0 flex">
      <div className="w-1/2 relative bg-white border-r border-stone-200">
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "linear-gradient(rgba(15,36,64,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(15,36,64,0.18) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />
        <div className="absolute inset-4">
          <div className="relative h-full border-2 border-primary/50 rounded-sm bg-white grid grid-cols-2 grid-rows-2 gap-0.5 p-0.5">
            <div className="bg-amber-100/70" />
            <div className="bg-stone-200" />
            <div className="bg-sky-100/70" />
            <div className="bg-emerald-100/70" />
          </div>
        </div>
      </div>
      <div className="w-1/2 relative bg-gradient-to-br from-stone-100 via-amber-50 to-stone-200">
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-[80%] aspect-[4/3] bg-white border border-primary/30 shadow-md rounded-sm"
            style={{
              transform: "perspective(700px) rotateX(48deg) rotateZ(-10deg)",
            }}
          >
            <div className="w-full h-full grid grid-cols-2 grid-rows-2">
              <div className="border-r border-b border-primary/20 bg-amber-50/60" />
              <div className="border-b border-primary/20 bg-stone-50" />
              <div className="border-r border-primary/20 bg-sky-50/60" />
              <div className="bg-emerald-50/60" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanTypeCard({ title, price, description, visual }: PlanCardProps) {
  return (
    <article className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col">
      <div className="aspect-[4/3] relative overflow-hidden bg-white">
        <PlanVisual variant={visual} />
        <div className="absolute bottom-3 right-3">
          <span className="text-[10px] font-medium tracking-wide text-muted uppercase bg-white/85 backdrop-blur px-2.5 py-1 rounded-full border border-stone-200">
            Media placeholder
          </span>
        </div>
      </div>
      <div className="p-6 lg:p-7 flex-1 flex flex-col">
        <h3 className="text-lg lg:text-xl font-bold text-primary mb-2 tracking-tight">
          {title}
        </h3>
        <p className="text-sm lg:text-base text-muted leading-relaxed mb-4 flex-1">
          {description}
        </p>
        <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted">
            From
          </span>
          <span className="text-base lg:text-lg font-bold text-primary">
            {price}
          </span>
        </div>
      </div>
    </article>
  );
}

const planTypes: PlanCardProps[] = [
  {
    title: "2D Black & White",
    price: "US$16 / floor",
    description:
      "Clean, minimal black-and-white floor plan — perfect for print brochures and simple listings.",
    visual: "bw",
  },
  {
    title: "2D Full Colour",
    price: "US$22 / floor",
    description:
      "2D plan with colour-coded rooms and finishes — easy for buyers to read at a glance.",
    visual: "color",
  },
  {
    title: "3D Floor Plan",
    price: "US$39 / floor",
    description:
      "Stylized 3D top-down render with furniture, finishes and lighting — ideal for premium listings.",
    visual: "3d",
  },
  {
    title: "2D + 3D Bundle",
    price: "US$49 / floor",
    description:
      "Both 2D colour and 3D plans delivered together — best value for full marketing coverage.",
    visual: "bundle",
  },
];

// What affects final total
const factors = [
  {
    icon: Layers,
    title: "Number of floors",
    description:
      "Pricing is per floor. A two-storey home with a basement is priced as 3 floors.",
  },
  {
    icon: FileText,
    title: "Selected plan type",
    description:
      "2D black & white, 2D colour, 3D, or the 2D + 3D bundle each have a different per-floor price.",
  },
  {
    icon: Compass,
    title: "Plan & page orientation",
    description:
      "Choose landscape or portrait, and request a specific plan orientation if needed.",
  },
  {
    icon: MapPin,
    title: "Address display preference",
    description:
      "Show the property address, hide it, or use a custom heading on the plan.",
  },
  {
    icon: Building,
    title: "Floor finishes per room",
    description:
      "Specify materials per room (wood, tile, marble, carpet, etc.) for accurate visual results.",
  },
  {
    icon: Ruler,
    title: "Source you provide",
    description:
      "Sketches, existing plans, photos, PDFs, DWG/DXF or on-site measurements are all accepted.",
  },
];

export default function FloorPlansPricingPage() {
  return (
    <>
      <PricingHero
        eyebrow="2D / 3D Floor Plans"
        title="Floor Plans Pricing"
        description="Convert sketches, existing plans, photos, PDFs, DWG/DXF, or measurements into clean 2D and 3D floor plans for property marketing."
        priceLine="From US$16 / floor"
        primaryHref="/order/3d-floor-plans"
        primaryLabel="Order Floor Plans"
      />

      {/* Plan type cards */}
      <section className="py-16 lg:py-24 bg-white">
        <Wide>
          <SectionLead
            eyebrow="Plan types"
            title="Choose the right plan style"
            description="Each plan type has a per-floor price and serves a different marketing purpose. Multiple floors are billed individually based on the type selected."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {planTypes.map((p) => (
              <PlanTypeCard key={p.title} {...p} />
            ))}
          </div>
        </Wide>
      </section>

      {/* Real before/after examples — only renders when admin has
          uploaded portfolio_items rows for floor-plans. */}
      <PortfolioExamples
        serviceSlug="floor-plans"
        placeholderVariant="floor-plans"
        background="stone-50"
      />

      {/* Pricing table */}
      <section className="py-16 lg:py-24 bg-stone-50">
        <Wide>
          <SectionLead
            eyebrow="Pricing"
            title="Per-floor pricing for every plan type"
            description="The price below is per floor. For a two-storey property, the cost is the per-floor price multiplied by 2."
          />
          <PricingTable
            rows={floorPlanRows}
            headerLabel="Plan Type"
            headerPrice="Price"
            caption="Pricing is per floor. Multiple floors are billed individually."
          />
        </Wide>
      </section>

      {/* What affects final total */}
      <section className="py-16 lg:py-24 bg-white">
        <Wide>
          <SectionLead
            eyebrow="What affects the final total"
            title="Per-floor price is just the starting point"
            description="Final total depends on the plan type, number of floors, and configuration options you choose."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {factors.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-7 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-base lg:text-lg font-bold text-primary mb-2 tracking-tight">
                    {f.title}
                  </h3>
                  <p className="text-sm text-muted leading-relaxed">
                    {f.description}
                  </p>
                </div>
              );
            })}
          </div>
        </Wide>
      </section>

      {/* Upload requirements */}
      <section className="py-16 lg:py-24 bg-stone-50">
        <Wide>
          <SectionLead
            eyebrow="Before you order"
            title="What we need from you"
            description="We accept a wide range of source materials. Send whatever you have — we work from sketches, plans, photos, files, or measurements."
          />
          <UploadRequirementsBlock
            items={[
              {
                label: "Sketch, plan, PDF, DWG / DXF, photos, or measurements",
                required: true,
                hint: "Any combination is fine — clearer source = faster turnaround",
              },
              {
                label: "Number of floors",
                required: true,
                hint: "Each floor is priced and produced separately",
              },
              {
                label: "Preferred plan type",
                required: true,
                hint: "2D B&W, 2D Colour, 3D, or 2D + 3D Bundle",
              },
              {
                label: "Page orientation",
                hint: "Landscape, portrait, or let us decide",
              },
              {
                label: "Plan orientation",
                hint: "How the plan is rotated on the page",
              },
              {
                label: "Address display preference",
                hint: "Show, hide, or use a custom heading",
              },
              {
                label: "Notes about flooring / room finishes",
                hint: "E.g. light oak in living areas, grey tile in bathrooms",
              },
            ]}
            footnote="Required fields are marked with *. Accepted file types: JPG, PNG, PDF, DWG, DXF, FBX."
          />
        </Wide>
      </section>

      <ServiceCTA
        title="Ready to order your floor plans?"
        subtitle="Send your sketch, plan, or photos — we deliver clean 2D and 3D floor plans within 24–48 hours."
        primaryHref="/order/3d-floor-plans"
        primaryLabel="Order Floor Plans"
      />
    </>
  );
}
