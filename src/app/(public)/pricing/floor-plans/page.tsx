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
import { CatalogPriceText } from "@/components/pricing/currency-client";
import ServicePageSlider, {
  type ServicePageSlide,
} from "@/components/pricing/ServicePageSlider";
import FaqAccordion, { type FaqItem } from "@/components/pricing/FaqAccordion";
import { getPortfolioPublicUrl, getServicePageItemsForService } from "@/lib/portfolio";
import {
  getServiceHeroSliderItems,
  getServiceOptionsImages,
  getSiteMediaPublicUrl,
} from "@/lib/site-media";
import {
  PortfolioExamplesGrid,
  StyleOptionsGrid,
  type PortfolioExampleCard,
  type StyleOptionCard,
} from "./FloorPlansInteractive";
import { localizedAlternates } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import { serviceSchema, breadcrumbSchema } from "@/lib/structured-data";
import { absoluteUrl } from "@/lib/seo";
import { getCatalogPriceDecimal } from "@/lib/pricing/public";
import type { PriceKey } from "@/lib/pricing/types";

// ============================================================
// /pricing/floor-plans  —  Floor Plans service page
//
// Section order and background rhythm:
//
//   A  Hero slider               white   (service-hero media only)
//   B  When to use               stone-50
//   C  Pricing intro             white
//   D  What it is + examples     stone-50  (portfolio_items only)
//   E  Before you order          white
//   F  Style options             stone-50  (service-options media)
//   G  Pricing cards             white
//   H  FAQ                       stone-50
//   I  Final CTA                 navy
//
// Media sources:
//   A  → /admin/media, section=service-hero, service_slug=floor-plans
//   D  → /admin/portfolio, service_slug=floor-plans
//   F  → /admin/media, section=service-options, service_slug=floor-plans
// ============================================================

export const metadata: Metadata = {
  title: "Floor Plans",
  description:
    "Professional 2D and 3D floor plans. Send a sketch, scan, PDF, or measurements and receive clean, listing-ready floor plans in JPG and PDF.",
  alternates: localizedAlternates({
    canonicalPath: "/pricing/floor-plans",
    englishPath: "/pricing/floor-plans",
    spanishPath: "/es/pricing/floor-plans",
  }),
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

/**
 * Fallback style option cards used when no admin service-options
 * items are uploaded. Named as visual styles, not plan types, so
 * the section communicates presentation direction rather than
 * technical output format (2D/3D/etc.).
 *
 * The plan type examples (2D, 3D, furnished, site plan…) belong
 * in /admin/portfolio where they will appear in the "What it is"
 * section instead.
 */
const FALLBACK_STYLE_OPTIONS: StyleOptionCard[] = [
  {
    sortOrder: 1,
    title: "Modern",
    description: "Clean lines, neutral tones, and open layouts for contemporary listings.",
    imageUrl: null,
    imageAlt: "Modern floor plan style",
    placeholderVariant: "modern",
  },
  {
    sortOrder: 2,
    title: "Scandinavian",
    description: "Soft whites, natural materials, and minimal styling for calm Nordic spaces.",
    imageUrl: null,
    imageAlt: "Scandinavian floor plan style",
    placeholderVariant: "scandinavian",
  },
  {
    sortOrder: 3,
    title: "Minimal",
    description: "Stripped-back, highly legible plan with maximum whitespace and clarity.",
    imageUrl: null,
    imageAlt: "Minimal floor plan style",
    placeholderVariant: "minimal",
  },
  {
    sortOrder: 4,
    title: "Classic",
    description: "Warm tones, measured proportions, and a timeless presentation feel.",
    imageUrl: null,
    imageAlt: "Classic floor plan style",
    placeholderVariant: "classic",
  },
  {
    sortOrder: 5,
    title: "Luxury",
    description: "Dark, premium presentation with bold contrast and polished detail.",
    imageUrl: null,
    imageAlt: "Luxury floor plan style",
    placeholderVariant: "luxury",
  },
  {
    sortOrder: 6,
    title: "Editorial",
    description: "Styled for brochures and marketing — typographic, layered, and refined.",
    imageUrl: null,
    imageAlt: "Editorial floor plan style",
    placeholderVariant: "editorial",
  },
  {
    sortOrder: 7,
    title: "Clean B&W",
    description: "High-contrast black-and-white output, ideal for print and MLS listings.",
    imageUrl: null,
    imageAlt: "Clean black and white floor plan style",
    placeholderVariant: "clean-bw",
  },
  {
    sortOrder: 8,
    title: "Soft Color",
    description: "Pastel colour zones with a warm, welcoming residential character.",
    imageUrl: null,
    imageAlt: "Soft color floor plan style",
    placeholderVariant: "soft-color",
  },
  {
    sortOrder: 9,
    title: "Presentation Style",
    description: "Designed for client presentations, websites, and listing packages.",
    imageUrl: null,
    imageAlt: "Presentation floor plan style",
    placeholderVariant: "presentation",
  },
];

const PRICING_CARDS: Array<{
  label: string;
  priceKey?: PriceKey;
  prefix?: string;
  price?: string;
  unit: string;
  note: string;
  isBase: boolean;
}> = [
  {
    label: "2D Floor Plan Redraw",
    priceKey: "floor-plan-2d-bw" as const,
    prefix: "From ",
    unit: "per floor",
    note: "Black & white or full colour, per storey.",
    isBase: true,
  },
  {
    label: "3D Floor Plan",
    priceKey: "floor-plan-3d" as const,
    prefix: "From ",
    unit: "per floor",
    note: "Stylised 3D top-down with furniture and finishes.",
    isBase: false,
  },
  {
    label: "2D + 3D Bundle",
    priceKey: "floor-plan-2d-3d-bundle" as const,
    prefix: "From ",
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
    answer: "Yes. Send the current plan and mark the changes you need.",
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

// ── Data helpers ─────────────────────────────────────────────

/**
 * Build slides for the hero slider.
 * Source: ONLY site_media_items (section=service-hero, floor-plans).
 * No portfolio fallback — keeps hero slider and examples grids
 * independently managed.
 */
async function buildSliderSlides(): Promise<ServicePageSlide[]> {
  const heroMedia = await getServiceHeroSliderItems("floor-plans");
  const usable = heroMedia.filter(
    (it) => it.before_image_path && it.after_image_path
  );
  if (usable.length > 0) {
    return usable.map((item) => ({
      kind: "image" as const,
      id: item.id,
      beforeUrl: getSiteMediaPublicUrl(item.before_image_path) ?? "",
      afterUrl: getSiteMediaPublicUrl(item.after_image_path) ?? "",
      beforeAlt: item.alt_text ?? item.title ?? "Floor plan — before",
      afterAlt: item.alt_text ?? item.title ?? "Floor plan — after",
      title: item.title ?? undefined,
    }));
  }
  return [{ kind: "placeholder", id: "fp-fallback", variant: "floor-plans" }];
}

function e2eStaticImageViewerCards(): PortfolioExampleCard[] | null {
  if (process.env.PLAYWRIGHT_STATIC_IMAGE_VIEWER_FIXTURES !== "1") {
    return null;
  }

  return [
    {
      id: "e2e-static-image-viewer",
      title: "Static image fit fixture",
      description: "Raster aspect-ratio coverage for the expanded viewer.",
      beforeUrl: "/brand/property-social-emergency.png",
      afterUrl: "/brand/picchuspot-logo-800.png",
      beforeAlt: "Landscape static image fit fixture",
      afterAlt: "Extra-wide transparent static image fit fixture",
    },
  ];
}

// ── Page ─────────────────────────────────────────────────────

export default async function FloorPlansPage() {
  const [allItems, optionImages, sliderSlides] = await Promise.all([
    getServicePageItemsForService("floor-plans"), // → section D (examples)
    getServiceOptionsImages("floor-plans"),        // → section F (style options)
    buildSliderSlides(),                           // → section A (hero slider)
  ]);

  // ── Resolve portfolio example cards ────────────────────────
  const portfolioCards: PortfolioExampleCard[] =
    e2eStaticImageViewerCards() ??
    allItems.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      beforeUrl: getPortfolioPublicUrl(item.before_image_path),
      afterUrl: getPortfolioPublicUrl(item.after_image_path),
      beforeAlt: item.before_alt ?? `${item.title} — before`,
      afterAlt: item.after_alt ?? `${item.title} — after`,
    }));

  // ── Resolve style option cards ──────────────────────────────
  // If admin has uploaded service-options items, use them fully
  // (title, description, image all from the DB row).
  // Otherwise fall back to the hardcoded FALLBACK_STYLE_OPTIONS which
  // present visual styles rather than technical plan types.
  let styleOptionCards: StyleOptionCard[];

  if (optionImages.length > 0) {
    // Admin-managed: use DB title/description/image.
    styleOptionCards = optionImages.map((item) => ({
      sortOrder: item.sort_order,
      title: item.title ?? `Style ${item.sort_order}`,
      description: item.description ?? "",
      imageUrl: getSiteMediaPublicUrl(item.image_path),
      imageAlt: item.alt_text ?? item.title ?? `Floor plan style ${item.sort_order}`,
      placeholderVariant: "modern", // not shown when imageUrl is set
    }));
  } else {
    // CSS placeholder fallback.
    styleOptionCards = FALLBACK_STYLE_OPTIONS;
  }

  return (
    <>
      <JsonLd
        data={[
          serviceSchema({
            name: "Floor Plans",
            description:
              "Professional 2D and 3D floor plan redraws from sketches, scans, PDFs, or measurements. Listing-ready JPG and PDF delivery.",
            url: absoluteUrl("/pricing/floor-plans"),
            price: getCatalogPriceDecimal("floor-plan-2d-bw"),
            priceCurrency: "USD",
            offerNote: "Starting price per floor (2D floor plan redraw)",
          }),
          breadcrumbSchema([
            { name: "Home", item: absoluteUrl("/") },
            { name: "Pricing", item: absoluteUrl("/pricing") },
            { name: "Floor Plans", item: absoluteUrl("/pricing/floor-plans") },
          ]),
        ]}
      />
      {/* ═══════════════════════════════════════════════════════
          A. HERO SLIDER  —  white / near-edge
          Source: /admin/media → service-hero / floor-plans
          ═══════════════════════════════════════════════════════ */}
      <section className="bg-white overflow-hidden">
        <div className="px-3 sm:px-4 lg:px-2 pt-3 lg:pt-4 pb-0">
          <ServicePageSlider
            slides={sliderSlides}
            ariaLabel="Floor plan before and after examples"
            imageFit="contain"
            imageBackground="bg-white"
            mobileAspect="aspect-[16/10]"
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
                <CatalogPriceText
                  priceKey="floor-plan-2d-bw"
                  prefix="From "
                  suffix=" / floor"
                />
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
          Source: /admin/portfolio → floor-plans
          Clicking image cards opens a lightbox (PortfolioExamplesGrid).
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

          {/* Client component — owns lightbox state for portfolio cards */}
          <PortfolioExamplesGrid cards={portfolioCards} viewerVariant="plan" />
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
          F. STYLE OPTIONS  —  stone-50
          Source: /admin/media → service-options / floor-plans
          When no admin items exist, shows visual style fallbacks.
          Clicking image cards opens a lightbox (StyleOptionsGrid).
          ═══════════════════════════════════════════════════════ */}
      <section className="py-14 lg:py-20 bg-stone-50">
        <Wide>
          <SectionLead
            eyebrow="Style options"
            title="Choose the right floor plan style"
            description="Pick a visual style for your floor plan presentation — or send a reference and we'll match the look. Tap any card to view a larger example."
          />
          {/* Client component — owns lightbox state for style option cards */}
          <StyleOptionsGrid cards={styleOptionCards} />
        </Wide>
      </section>

      {/* ═══════════════════════════════════════════════════════
          G. PRICING CARDS  —  white
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
                    {card.priceKey ? (
                      <CatalogPriceText
                        priceKey={card.priceKey}
                        prefix={card.prefix}
                      />
                    ) : (
                      card.price
                    )}
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
