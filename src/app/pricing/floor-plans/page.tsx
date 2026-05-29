import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Home,
  Building,
  Wrench,
  BedDouble,
} from "lucide-react";
import Wide from "@/components/pricing/Wide";
import SectionLead from "@/components/pricing/SectionLead";
import UploadRequirementsBlock from "@/components/pricing/UploadRequirementsBlock";
import ServiceCTA from "@/components/pricing/ServiceCTA";
import ServicePageSlider, {
  type ServicePageSlide,
} from "@/components/pricing/ServicePageSlider";
import FaqAccordion, { type FaqItem } from "@/components/pricing/FaqAccordion";
import BeforeAfterFrame from "@/components/portfolio/BeforeAfterFrame";
import { getPortfolioPublicUrl, getPublishedItemsForService } from "@/lib/portfolio";

// ============================================================
// /pricing/floor-plans  —  Floor Plans service page
//
// Section order and background rhythm (mirrors Virtual Staging):
//
//   A  Hero slider               white   (near-edge, homepage style)
//   B  When to use               stone-50
//   C  Pricing intro             white
//   D  What it is + examples     stone-50
//   E  Before you order          white
//   F  Plan options              stone-50
//   G  Pricing cards             white
//   H  FAQ                       stone-50
//   I  Final CTA                 navy  (ServiceCTA)
// ============================================================

export const metadata: Metadata = {
  title: "Floor Plans",
  description:
    "Professional 2D and 3D floor plans from US$16 per floor. Send a sketch, scan, PDF, or measurements and receive clean, listing-ready floor plans in JPG and PDF.",
};


// ── Static data ──────────────────────────────────────────────

const USE_CASES = [
  {
    icon: Home,
    title: "Real Estate Listings",
    description:
      "Help buyers understand layout and room flow before visiting the property.",
  },
  {
    icon: Building,
    title: "New Builds & Developments",
    description:
      "Present off-plan units with clear, polished layouts for marketing and sales.",
  },
  {
    icon: Wrench,
    title: "Renovation Planning",
    description:
      "Communicate spatial changes clearly to clients, contractors, and permit reviewers.",
  },
  {
    icon: BedDouble,
    title: "Short-Term Rentals",
    description:
      "Show guests exactly how the property is laid out and what spaces are available.",
  },
] as const;

const WHAT_IT_IS_BULLETS = [
  "Clean 2D floor plan redraws",
  "3D floor plan options",
  "Room labels and dimensions",
  "Listing-ready JPG/PDF delivery",
] as const;

const PLAN_OPTIONS = [
  {
    title: "2D Black & White Plan",
    description:
      "Clean, simple layout for standard real estate listings. Clear room labels and dimensions.",
    visual: "bw" as const,
  },
  {
    title: "2D Color Plan",
    description:
      "A more visual plan with color zones and clearer room separation for marketing materials.",
    visual: "color" as const,
  },
  {
    title: "2D Furnished Plan",
    description:
      "Layout with furniture symbols to help buyers understand scale and room flow.",
    visual: "furnished" as const,
  },
  {
    title: "3D Floor Plan",
    description:
      "A more visual 3D layout for premium listings and marketing presentations.",
    visual: "3d" as const,
  },
  {
    title: "Site / Development Plan",
    description:
      "Useful for land, development, or multi-unit presentation with plot boundaries and amenities.",
    visual: "site" as const,
  },
  {
    title: "Interactive-Ready Plan",
    description:
      "Prepared for future interactive floor plan or virtual tour integrations.",
    visual: "interactive" as const,
  },
] as const;

type PlanVisualVariant = "bw" | "color" | "furnished" | "3d" | "site" | "interactive";

const PRICING_CARDS = [
  {
    label: "2D Floor Plan Redraw",
    price: "From US$16",
    unit: "per floor",
    note: "Black & white or full colour, per storey.",
    isBase: true,
  },
  {
    label: "3D Floor Plan",
    price: "From US$39",
    unit: "per floor",
    note: "Stylised 3D top-down with furniture and finishes.",
    isBase: false,
  },
  {
    label: "2D + 3D Bundle",
    price: "From US$49",
    unit: "per floor",
    note: "Both 2D colour and 3D plans together — best value.",
    isBase: false,
  },
  {
    label: "Site / Development Plan",
    price: "Request quote",
    unit: "",
    note: "Land, multi-unit, or development layouts.",
    isBase: false,
  },
  {
    label: "Additional Level",
    price: "Per floor rate",
    unit: "",
    note: "Each floor is priced and produced separately.",
    isBase: false,
  },
  {
    label: "Revisions / Updates",
    price: "Request quote",
    unit: "",
    note: "Update an existing plan with new changes.",
    isBase: false,
  },
] as const;

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What files can I send for a floor plan redraw?",
    answer:
      "You can send sketches, scans, PDFs, old floor plans, or clear photos of measured layouts.",
  },
  {
    question: "Do you need exact measurements?",
    answer:
      "Measurements are recommended for accuracy, but we can also redraw from an existing plan or sketch if dimensions are already shown.",
  },
  {
    question: "Can you create 3D floor plans?",
    answer:
      "Yes. 3D floor plans are available for projects where a more visual presentation is needed.",
  },
  {
    question: "Can you add furniture to the plan?",
    answer:
      "Yes, furniture symbols can be added when you want to show scale, layout, or room function.",
  },
  {
    question: "Can you update an existing plan?",
    answer:
      "Yes. Send the current plan and mark the changes you need.",
  },
  {
    question: "What format will I receive?",
    answer:
      "Final files can be prepared as JPG, PNG, or PDF depending on the project requirements.",
  },
  {
    question: "How long does it take?",
    answer:
      "Standard turnaround depends on complexity, but simple redraws are usually prepared quickly once all source files are provided.",
  },
  {
    question: "Can I use the floor plan for MLS and marketing?",
    answer:
      "Yes, the final floor plan is prepared for listing presentations, websites, brochures, and marketing packages.",
  },
];


// ── Plan option visual placeholders ──────────────────────────

function PlanOptionVisual({ variant }: { variant: PlanVisualVariant }) {
  // Each variant uses pure CSS to suggest the style category.
  // Real images can replace these once the admin uploads media.
  switch (variant) {
    case "bw":
      return (
        <div className="absolute inset-0 bg-white">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "linear-gradient(rgba(15,36,64,0.15) 1px,transparent 1px),linear-gradient(90deg,rgba(15,36,64,0.15) 1px,transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
          <div className="absolute inset-x-10 inset-y-6 border-2 border-stone-700 rounded-sm">
            <div className="absolute top-1/2 left-0 right-1/3 h-0.5 bg-stone-600" />
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-stone-600" />
            <div className="absolute right-1/3 top-0 h-1/2 w-0.5 bg-stone-600" />
          </div>
        </div>
      );
    case "color":
      return (
        <div className="absolute inset-0 bg-stone-50">
          <div className="absolute inset-x-10 inset-y-6 border-2 border-primary/40 rounded-sm grid grid-cols-3 grid-rows-2 gap-0.5 p-0.5">
            <div className="bg-amber-100/80" />
            <div className="bg-stone-200/80" />
            <div className="bg-emerald-100/70" />
            <div className="bg-sky-100/70" />
            <div className="bg-rose-100/70" />
            <div className="bg-stone-100" />
          </div>
        </div>
      );
    case "furnished":
      return (
        <div className="absolute inset-0 bg-stone-50">
          <div className="absolute inset-x-10 inset-y-6 border-2 border-primary/40 rounded-sm p-1">
            <div className="w-full h-full grid grid-cols-3 grid-rows-2 gap-0.5">
              <div className="relative bg-amber-50 border border-amber-200/60">
                <div className="absolute inset-1 border border-amber-300/50 rounded-sm" />
              </div>
              <div className="relative bg-stone-100 border border-stone-200">
                <div className="absolute bottom-1 left-1 right-1 h-1.5 bg-stone-300/60 rounded-sm" />
              </div>
              <div className="relative bg-emerald-50 border border-emerald-200/60">
                <div className="absolute inset-1.5 border border-emerald-300/40 rounded-full" />
              </div>
              <div className="bg-sky-50 border border-sky-200/50" />
              <div className="relative bg-rose-50 border border-rose-200/50">
                <div className="absolute inset-1 border border-rose-200/40 rounded-sm" />
              </div>
              <div className="bg-stone-100 border border-stone-200" />
            </div>
          </div>
        </div>
      );
    case "3d":
      return (
        <div className="absolute inset-0 bg-gradient-to-br from-stone-100 via-amber-50 to-stone-200 flex items-center justify-center">
          <div
            className="w-3/5 aspect-[4/3] bg-white border border-primary/25 shadow-md rounded-sm grid grid-cols-3 grid-rows-2"
            style={{ transform: "perspective(700px) rotateX(46deg) rotateZ(-10deg)" }}
          >
            <div className="border-r border-b border-primary/15 bg-amber-50/60" />
            <div className="border-r border-b border-primary/15 bg-stone-50" />
            <div className="border-b border-primary/15 bg-emerald-50/50" />
            <div className="border-r border-primary/15 bg-sky-50/60" />
            <div className="border-r border-primary/15 bg-rose-50/50" />
            <div className="bg-stone-100" />
          </div>
        </div>
      );
    case "site":
      return (
        <div className="absolute inset-0 bg-emerald-50/40">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(rgba(52,211,153,0.2) 1px,transparent 1px),linear-gradient(90deg,rgba(52,211,153,0.2) 1px,transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="absolute inset-8 border-2 border-emerald-500/40 rounded-sm">
            <div className="absolute inset-2 border border-primary/20 rounded-sm bg-stone-100/50" />
            <div className="absolute top-1/3 left-1/4 w-1/2 h-1/3 border border-primary/30 bg-amber-50/60" />
          </div>
        </div>
      );
    case "interactive":
      return (
        <div className="absolute inset-0 bg-gradient-to-br from-sky-50 to-indigo-50/50">
          <div className="absolute inset-x-10 inset-y-6 border-2 border-sky-400/30 rounded-sm grid grid-cols-3 grid-rows-2 gap-0.5 p-0.5">
            <div className="bg-sky-100/70 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-sky-400/60" />
            </div>
            <div className="bg-indigo-50/70 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-indigo-400/60" />
            </div>
            <div className="bg-sky-50/70 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-sky-300/60" />
            </div>
            <div className="bg-indigo-100/70" />
            <div className="bg-sky-100/60" />
            <div className="bg-indigo-50/70 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-indigo-300/60" />
            </div>
          </div>
        </div>
      );
  }
}


// ── Data helpers ─────────────────────────────────────────────

async function buildSliderSlides(
  items: Awaited<ReturnType<typeof getPublishedItemsForService>>
): Promise<ServicePageSlide[]> {
  const usable = items
    .filter((it) => it.before_image_path && it.after_image_path)
    .slice(0, 5);

  if (usable.length === 0) {
    return [{ kind: "placeholder", id: "fp-fallback", variant: "floor-plans" }];
  }

  return usable.map((item) => ({
    kind: "image" as const,
    id: item.id,
    beforeUrl: getPortfolioPublicUrl(item.before_image_path) ?? "",
    afterUrl: getPortfolioPublicUrl(item.after_image_path) ?? "",
    beforeAlt: item.before_alt ?? `${item.title} — before`,
    afterAlt: item.after_alt ?? `${item.title} — after`,
    title: item.title,
  }));
}

// ── Page ─────────────────────────────────────────────────────

export default async function FloorPlansPage() {
  const allItems = await getPublishedItemsForService("floor-plans");
  const sliderSlides = await buildSliderSlides(allItems);
  const hasItems = allItems.length > 0;

  return (
    <>
      {/* ═══════════════════════════════════════════════════════
          A. HERO SLIDER  —  white / near-edge
          ═══════════════════════════════════════════════════════ */}
      <section className="bg-white overflow-hidden">
        <div className="px-3 sm:px-4 lg:px-2 pt-3 lg:pt-4 pb-0">
          <ServicePageSlider
            slides={sliderSlides}
            ariaLabel="Floor plan before and after examples"
          />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          B. WHEN TO USE  —  stone-50
          ═══════════════════════════════════════════════════════ */}
      <section className="pt-8 lg:pt-10 pb-14 lg:pb-20 bg-stone-50">
        <Wide>
          <SectionLead
            eyebrow="Best for"
            title="When to use Floor Plans"
            description="Floor plans help buyers understand the property layout, room flow, and spatial relationships before they visit or book a showing."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
            {USE_CASES.map((u) => {
              const Icon = u.icon;
              return (
                <div
                  key={u.title}
                  className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-7 shadow-sm hover:shadow-md hover:border-primary/20 transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-primary" aria-hidden />
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

      {/* ═══════════════════════════════════════════════════════
          C. PRICING INTRO  —  white
          ═══════════════════════════════════════════════════════ */}
      <section className="bg-white border-y border-stone-200">
        <Wide className="py-10 lg:py-14">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 lg:gap-10">
            <div className="lg:max-w-2xl">
              <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-2">
                Floor Plans
              </p>
              <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-primary leading-[1.05] tracking-tight">
                Floor Plan Redraws &amp; 3D Floor Plans
              </h1>
              <p className="mt-3 text-base lg:text-lg text-muted leading-relaxed">
                Turn sketches, scans, or measured layouts into clean, professional
                floor plans for listings, marketing, websites, and client
                presentations.
              </p>
              <p className="mt-2 text-lg lg:text-xl font-semibold text-foreground">
                From US$16 / floor
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:flex-shrink-0">
              <Link
                href="/order/3d-floor-plans"
                className="inline-flex items-center gap-2 px-6 lg:px-7 py-3 lg:py-3.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-light transition-colors text-sm shadow-sm"
              >
                Order Floor Plan
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center px-6 lg:px-7 py-3 lg:py-3.5 border border-stone-300 text-foreground font-semibold rounded-lg hover:border-primary hover:text-primary transition-colors text-sm"
              >
                Back to Services
              </Link>
            </div>
          </div>
        </Wide>
      </section>

      {/* ═══════════════════════════════════════════════════════
          D. WHAT IT IS + EXAMPLES  —  stone-50
          ═══════════════════════════════════════════════════════ */}
      <section className="py-14 lg:py-20 bg-stone-50">
        <Wide>
          <div className="max-w-3xl mb-10 lg:mb-14">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
              What it is
            </p>
            <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-primary mb-4 tracking-tight leading-[1.1]">
              Clean, readable floor plans for property marketing
            </h2>
            <p className="text-base lg:text-lg text-muted leading-relaxed mb-6">
              We redraw your floor plans into clear, polished layouts that help
              buyers understand the space quickly. Plans can be prepared as
              simple 2D layouts, styled marketing plans, or 3D floor plans
              depending on the project.
            </p>
            <ul className="space-y-3">
              {WHAT_IT_IS_BULLETS.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 text-sm lg:text-base text-foreground"
                >
                  <span
                    aria-hidden
                    className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"
                  >
                    <Check className="w-3 h-3 text-primary" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {hasItems ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              {allItems.map((item) => {
                const beforeUrl = getPortfolioPublicUrl(item.before_image_path);
                const afterUrl = getPortfolioPublicUrl(item.after_image_path);
                return (
                  <article
                    key={item.id}
                    className="group bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
                  >
                    <div className="aspect-[5/2] relative overflow-hidden bg-stone-100">
                      <BeforeAfterFrame
                        beforeUrl={beforeUrl}
                        afterUrl={afterUrl}
                        beforeAlt={item.before_alt ?? `${item.title} — before`}
                        afterAlt={item.after_alt ?? `${item.title} — after`}
                        placeholderVariant="floor-plans"
                      />
                    </div>
                    <div className="p-5 lg:p-6">
                      <h3 className="text-base lg:text-lg font-bold text-primary tracking-tight">
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="mt-1.5 text-sm text-muted leading-relaxed line-clamp-3">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="relative aspect-[5/2] w-full overflow-hidden rounded-2xl shadow-sm ring-1 ring-stone-200 bg-stone-100">
              <BeforeAfterFrame
                beforeUrl={null}
                afterUrl={null}
                beforeAlt="Sketch before floor plan redraw"
                afterAlt="Clean floor plan after redraw"
                placeholderVariant="floor-plans"
              />
            </div>
          )}
        </Wide>
      </section>

      {/* ═══════════════════════════════════════════════════════
          E. BEFORE YOU ORDER  —  white
          ═══════════════════════════════════════════════════════ */}
      <section className="py-14 lg:py-20 bg-white">
        <Wide>
          <SectionLead
            eyebrow="Before you order"
            title="What we need from you"
            description="Send us your sketch, scan, original floor plan, or measurements. The clearer the source file, the more accurate the final redraw will be."
          />
          <UploadRequirementsBlock
            items={[
              {
                label: "Original sketch, scan, or plan",
                required: true,
                hint: "JPG, PNG, PDF, DWG/DXF, or a photo of a measured sketch",
              },
              {
                label: "Room names / labels",
                required: true,
                hint: "Living room, bedroom, kitchen, bathroom, etc.",
              },
              {
                label: "Dimensions if available",
                hint: "Improves accuracy — metric or imperial both accepted",
              },
              {
                label: "Preferred output type",
                required: true,
                hint: "2D B&W, 2D Colour, 3D, or 2D + 3D bundle",
              },
              {
                label: "Notes or corrections",
                hint: "Any changes from the source, special requests, or orientation preference",
              },
            ]}
            footnote="Required fields are marked *. Accepted source formats: JPG, PNG, PDF, DWG, DXF. Final delivery: JPG and/or PDF."
          />
        </Wide>
      </section>

      {/* ═══════════════════════════════════════════════════════
          F. PLAN OPTIONS  —  stone-50
          6 cards: 3-col desktop / 2-col tablet / 1-col mobile.
          Horizontal aspect (16:9) so the visual area is wide,
          not tall — consistent with the Style options cards on
          the Virtual Staging page.
          ═══════════════════════════════════════════════════════ */}
      <section className="py-14 lg:py-20 bg-stone-50">
        <Wide>
          <SectionLead
            eyebrow="Plan options"
            title="Choose the right floor plan style"
            description="Select the floor plan format that best fits your listing, presentation, or marketing package."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
            {PLAN_OPTIONS.map((opt) => (
              <div
                key={opt.title}
                className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:border-primary/30 hover:shadow-md transition-all"
              >
                {/* 16:9 horizontal visual area */}
                <div className="relative aspect-video overflow-hidden bg-stone-100">
                  <PlanOptionVisual variant={opt.visual} />
                  <span className="absolute bottom-2.5 right-3 text-[9px] font-medium tracking-[0.15em] uppercase text-muted bg-white/85 backdrop-blur px-2 py-0.5 rounded-full">
                    placeholder
                  </span>
                </div>
                <div className="px-4 py-3.5 lg:px-5 lg:py-4">
                  <h3 className="text-sm lg:text-base font-bold text-primary tracking-tight leading-tight">
                    {opt.title}
                  </h3>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    {opt.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Wide>
      </section>

      {/* ═══════════════════════════════════════════════════════
          G. PRICING CARDS  —  white
          3-col desktop / 2-col tablet / 1-col mobile.
          Navy card for the base plan, white cards for others.
          ═══════════════════════════════════════════════════════ */}
      <section className="py-14 lg:py-20 bg-white">
        <Wide>
          <SectionLead
            eyebrow="Pricing"
            title="Floor plan pricing"
            description="Choose the plan format you need. More detailed or multi-level plans can be quoted based on complexity."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
            {PRICING_CARDS.map((card) => (
              <div
                key={card.label}
                className={`rounded-2xl border p-6 lg:p-7 flex flex-col gap-3 ${
                  card.isBase
                    ? "bg-primary border-primary text-white shadow-lg"
                    : "bg-white border-stone-200 shadow-sm hover:border-primary/25 hover:shadow-md transition-all"
                }`}
              >
                {card.isBase && (
                  <span className="self-start inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold tracking-[0.18em] uppercase">
                    Most Popular
                  </span>
                )}
                <div>
                  <p
                    className={`text-2xl lg:text-3xl font-bold tracking-tight ${
                      card.isBase ? "text-white" : "text-primary"
                    }`}
                  >
                    {card.price}
                  </p>
                  {card.unit && (
                    <p
                      className={`text-xs font-medium mt-0.5 ${
                        card.isBase ? "text-white/70" : "text-muted"
                      }`}
                    >
                      {card.unit}
                    </p>
                  )}
                </div>
                <div>
                  <p
                    className={`text-sm lg:text-base font-semibold leading-tight ${
                      card.isBase ? "text-white" : "text-foreground"
                    }`}
                  >
                    {card.label}
                  </p>
                  <p
                    className={`text-xs lg:text-sm mt-1 leading-relaxed ${
                      card.isBase ? "text-white/75" : "text-muted"
                    }`}
                  >
                    {card.note}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-xs lg:text-sm text-muted leading-relaxed max-w-2xl">
            Pricing is per floor. A two-storey home with a basement is billed
            as 3 floors. Contact us for multi-unit or development pricing.
          </p>

          <div className="mt-8">
            <Link
              href="/order/3d-floor-plans"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary-light transition-colors text-sm"
            >
              Order Floor Plan
              <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
          </div>
        </Wide>
      </section>

      {/* ═══════════════════════════════════════════════════════
          H. FAQ  —  stone-50
          ═══════════════════════════════════════════════════════ */}
      <section className="py-14 lg:py-20 bg-stone-50">
        <Wide>
          <SectionLead eyebrow="FAQ" title="Floor Plan questions" />
          <div className="max-w-3xl">
            <FaqAccordion items={FAQ_ITEMS} />
          </div>
        </Wide>
      </section>

      {/* ═══════════════════════════════════════════════════════
          I. FINAL CTA  —  navy
          ═══════════════════════════════════════════════════════ */}
      <ServiceCTA
        title="Ready to create a clear floor plan?"
        subtitle="Upload your sketch, scan, or existing plan and we'll prepare a clean, listing-ready floor plan for your property."
        primaryHref="/order/3d-floor-plans"
        primaryLabel="Order Floor Plan"
        secondaryHref="/contact"
        secondaryLabel="Ask a Question"
      />
    </>
  );
}
