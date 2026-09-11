import type { Metadata } from "next";
import Link from "next/link";
import ClientPortalLink from "@/components/dashboard/ClientPortalLink";
import { ArrowRight, Check, Home, Sparkles, Building2, ImagePlus } from "lucide-react";
import Wide from "@/components/pricing/Wide";
import SectionLead from "@/components/pricing/SectionLead";
import StyleGallerySection, {
  type StyleGalleryImageOverride,
} from "@/components/pricing/StyleGallerySection";
import UploadRequirementsBlock from "@/components/pricing/UploadRequirementsBlock";
import ServiceCTA from "@/components/pricing/ServiceCTA";
import { CatalogPriceText } from "@/components/pricing/currency-client";
import ServicePageSlider, {
  type ServicePageSlide,
} from "@/components/pricing/ServicePageSlider";
import FaqAccordion, { type FaqItem } from "@/components/pricing/FaqAccordion";
import BeforeAfterFrame from "@/components/portfolio/BeforeAfterFrame";
import { getPortfolioPublicUrl, getServicePageItemsForService } from "@/lib/portfolio";
import {
  getServiceOptionsImages,
  getSiteMediaPublicUrl,
} from "@/lib/site-media";
import { localizedAlternates } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import { serviceSchema, breadcrumbSchema } from "@/lib/structured-data";
import { absoluteUrl } from "@/lib/seo";
import { getCatalogPriceDecimal } from "@/lib/pricing/public";
import type { PriceKey } from "@/lib/pricing/types";
import { getBeforeAfterAlt } from "@/lib/before-after-alt";

// ============================================================
// /pricing/virtual-staging  —  Virtual Staging service page
//
// Section order and background rhythm:
//
//   A  Hero slider               white   (near-edge, homepage style)
//   B  When to use               stone-50  (tight spacing after slider)
//   C  Pricing intro             white
//   D  What it is + examples     stone-50  (text-only intro, then grid)
//   E  Before you order          white
//   F  Style options             stone-50
//   G  Pricing cards             white     (after style options)
//   H  FAQ                       stone-50
//   I  Final CTA                 navy  (ServiceCTA)
//
// Data loading:
//   - getServicePageItemsForService returns [] when Supabase is
//     unconfigured → page still builds/renders statically.
//   - Service-page examples (published AND show_on_service_page)
//     fill both the slider (up to 5 slides) and the examples grid.
//   - service-options media fills style-card covers and galleries by title.
// ============================================================

export const metadata: Metadata = {
  title: "Virtual Staging Services",
  description:
    "Transform empty or outdated rooms into furnished, market-ready spaces. 9 interior styles, unlimited revisions for 30 days from first delivery, delivered in 24–48 hours.",
  alternates: localizedAlternates({
    canonicalPath: "/pricing/virtual-staging",
    englishPath: "/pricing/virtual-staging",
    spanishPath: "/es/pricing/virtual-staging",
  }),
};

// ── Static data ──────────────────────────────────────────────

const USE_CASES = [
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
] as const;

const WHAT_IT_IS_BULLETS = [
  "Photorealistic furniture and decor",
  "Multiple interior styles to choose from",
  "Unlimited revisions for 30 days from first delivery",
  "High-resolution JPG delivery in 24–48h",
] as const;

const PRICING_CARDS: Array<{
  label: string;
  priceKey: PriceKey;
  prefix?: string;
  unit: string;
  note: string;
  isBase: boolean;
}> = [
  {
    label: "Base Virtual Staging",
    priceKey: "virtual-staging",
    unit: "per image",
    note: "Furniture, decor, and styling for one room.",
    isBase: true,
  },
  {
    label: "Image Enhancement",
    priceKey: "image-enhancement",
    prefix: "+",
    unit: "per image",
    note: "Colour, exposure, and window correction.",
    isBase: false,
  },
  {
    label: "Day to Dusk",
    priceKey: "day-to-dusk",
    prefix: "+",
    unit: "per image",
    note: "Convert daytime exterior to a warm dusk shot.",
    isBase: false,
  },
  {
    label: "Item Removal & Virtual Cleaning",
    priceKey: "item-removal-virtual-cleaning",
    prefix: "+",
    unit: "per image",
    note: "Remove clutter before staging the room.",
    isBase: false,
  },
  {
    label: "Turn On Lights",
    priceKey: "turn-on-lights",
    prefix: "+",
    unit: "per image",
    note: "Make visible light sources appear switched on.",
    isBase: false,
  },
  {
    label: "Colour Change",
    priceKey: "colour-change",
    prefix: "+",
    unit: "per image",
    note: "Change wall, ceiling, or door colours.",
    isBase: false,
  },
] as const;

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "How realistic will the virtual staging look?",
    answer:
      "We match perspective, scale, lighting, shadows, and style direction so the final image feels natural and listing-ready.",
  },
  {
    question: "What rooms can you stage?",
    answer:
      "We can stage bedrooms, living rooms, dining rooms, kitchens, offices, outdoor areas, and selected commercial spaces.",
  },
  {
    question: "Can I choose the furniture style?",
    answer:
      "Yes. You can choose one of the available styles or send a reference image or link for a closer match.",
  },
  {
    question: "Can you stage a room that already has furniture?",
    answer:
      "Yes, but if existing furniture or clutter needs to be removed first, add Item Removal & Virtual Cleaning to the order.",
  },
  {
    question: "How long does it take?",
    answer:
      "Standard delivery is usually 24–48 hours once we have the original photo and instructions.",
  },
  {
    question: "What files should I upload?",
    answer:
      "Upload a clear JPG or PNG photo of the room, ideally well-lit and taken from a straight, natural angle.",
  },
  {
    question: "Are revisions included?",
    answer:
      "Yes. Unlimited revisions are included for 30 calendar days from first delivery, provided the changes stay within the original brief, overall style, and design direction.",
  },
  {
    question: "Can I use the images for MLS and marketing?",
    answer:
      "Yes, the final images are prepared for real estate listings, websites, social media, and marketing packages.",
  },
];

// ── Data helpers ─────────────────────────────────────────────

async function buildSliderSlides(
  items: Awaited<ReturnType<typeof getServicePageItemsForService>>
): Promise<ServicePageSlide[]> {
  const usable = items
    .filter((it) => it.before_image_path && it.after_image_path)
    .slice(0, 5);

  if (usable.length === 0) {
    return [{ kind: "placeholder", id: "vs-fallback", variant: "virtual-staging" }];
  }

  return usable.map((item) => {
    const alt = getBeforeAfterAlt({
      beforeAlt: item.before_alt,
      afterAlt: item.after_alt,
      title: item.title,
      description: item.description,
      serviceLabel: "Virtual Staging",
      serviceSlug: item.service_slug,
    });
    return {
      kind: "image" as const,
      id: item.id,
      beforeUrl: getPortfolioPublicUrl(item.before_image_path) ?? "",
      afterUrl: getPortfolioPublicUrl(item.after_image_path) ?? "",
      beforeAlt: alt.beforeAlt,
      afterAlt: alt.afterAlt,
      title: item.title,
    };
  });
}

// ── Page ─────────────────────────────────────────────────────

export default async function VirtualStagingPage() {
  const [allItems, optionImages] = await Promise.all([
    getServicePageItemsForService("virtual-staging"),
    getServiceOptionsImages("virtual-staging"),
  ]);
  const sliderSlides = await buildSliderSlides(allItems);
  const hasItems = allItems.length > 0;
  const styleImageOverrides: StyleGalleryImageOverride[] = optionImages
    .filter((item) => item.title && item.image_path)
    .map((item) => {
      const src = getSiteMediaPublicUrl(item.image_path);
      if (!src) return null;
      return {
        title: item.title!,
        src,
        alt:
          item.alt_text ??
          item.title ??
          `Virtual staging ${item.sort_order} style example`,
      };
    })
    .filter((item): item is StyleGalleryImageOverride => item !== null);

  return (
    <>
      <JsonLd
        data={[
          serviceSchema({
            name: "Virtual Staging",
            description:
              "Transform empty or outdated rooms into furnished, market-ready spaces. 9 interior styles, unlimited revisions for 30 days from first delivery, delivered in 24–48 hours.",
            url: absoluteUrl("/pricing/virtual-staging"),
            price: getCatalogPriceDecimal("virtual-staging"),
            priceCurrency: "USD",
            offerNote: "Starting price per image",
          }),
          breadcrumbSchema([
            { name: "Home", item: absoluteUrl("/") },
            { name: "Pricing", item: absoluteUrl("/pricing") },
            {
              name: "Virtual Staging",
              item: absoluteUrl("/pricing/virtual-staging"),
            },
          ]),
        ]}
      />
      {/* ═══════════════════════════════════════════════════════
          A. HERO SLIDER  —  white / near-edge (homepage feel)
          px-3 sm:px-4 lg:px-2 matches the homepage slider wrapper
          exactly so the banner feels edge-to-edge at every viewport.
          pb-0 removes the gap between slider and the next section
          so the "When to use" cards sit snugly beneath the banner.
          overflow-hidden on the section prevents lateral bleed.
          ═══════════════════════════════════════════════════════ */}
      <section className="bg-white overflow-hidden">
        <div className="px-3 sm:px-4 lg:px-2 pt-3 lg:pt-4 pb-0">
          <ServicePageSlider
            slides={sliderSlides}
            serviceSlug="virtual-staging"
            locale="en"
            orderHref="/dashboard/orders/new/virtual-staging"
            orderLabel="Order Virtual Staging"
            ariaLabel="Virtual Staging before and after examples"
          />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          B. WHEN TO USE  —  stone-50
          pt-8 lg:pt-10 gives a tight but readable gap after the
          slider; pb remains generous so the section breathes.
          ═══════════════════════════════════════════════════════ */}
      <section className="pt-8 lg:pt-10 pb-14 lg:pb-20 bg-stone-50">
        <Wide>
          <SectionLead
            eyebrow="Best for"
            title="When to use Virtual Staging"
            description="Virtual staging works for almost any listing where empty or outdated rooms make it harder for buyers to visualize the space."
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
          Compact side-by-side block: title + price + CTAs.
          Uses <h1> because this is the primary page heading.
          ═══════════════════════════════════════════════════════ */}
      <section className="bg-white border-y border-stone-200">
        <Wide className="py-10 lg:py-14">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 lg:gap-10">
            <div className="lg:max-w-2xl">
              <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-2">
                Virtual Staging
              </p>
              <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-primary leading-[1.05] tracking-tight">
                Virtual Staging Pricing
              </h1>
              <p className="mt-3 text-base lg:text-lg text-muted leading-relaxed">
                Transform empty rooms into realistic, furnished spaces. Choose
                from 9 interior styles and combine with optional add-ons for
                market-ready results.
              </p>
              <p className="mt-2 text-lg lg:text-xl font-semibold text-foreground">
                <CatalogPriceText
                  priceKey="virtual-staging"
                  prefix="From "
                  suffix=" / image"
                />
              </p>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-secondary-dark">
                Welcome Offer — 50% off your first Virtual Staging image. Each
                benefit can be used once per account and does not combine with
                a volume discount on the same image.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:flex-shrink-0">
              <ClientPortalLink
                href="/dashboard/orders/new/virtual-staging"
                className="inline-flex items-center gap-2 px-6 lg:px-7 py-3 lg:py-3.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-light transition-colors text-sm shadow-sm"
              >
                Order Virtual Staging
                <ArrowRight className="w-4 h-4" aria-hidden />
              </ClientPortalLink>
              <Link
                href="/pricing"
                className="inline-flex items-center px-6 lg:px-7 py-3 lg:py-3.5 border border-stone-300 text-foreground font-semibold rounded-lg hover:border-primary hover:text-primary transition-colors text-sm"
              >
                Back to Pricing
              </Link>
            </div>
          </div>
        </Wide>
      </section>

      {/* ═══════════════════════════════════════════════════════
          D. WHAT IT IS + EXAMPLES  —  stone-50
          Text block only on top (no right-side small cards).
          The full-width examples grid appears directly below
          the intro text inside the same section.
          ═══════════════════════════════════════════════════════ */}
      <section className="py-14 lg:py-20 bg-stone-50">
        <Wide>
          {/* ── Intro copy — full width, no side cards ── */}
          <div className="max-w-3xl mb-10 lg:mb-14">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
              What it is
            </p>
            <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-primary mb-4 tracking-tight leading-[1.1]">
              Furnished, market-ready images from empty rooms
            </h2>
            <p className="text-base lg:text-lg text-muted leading-relaxed mb-6">
              We replace empty spaces with realistic furniture, decor, and
              lighting. Each image is styled to match your target buyer and
              listing positioning — residential or commercial.
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

          {/* ── Full examples grid (2-col desktop, 1-col mobile) ──
              Shown when portfolio items are uploaded. Falls back to
              a single full-width placeholder so the section always
              has visual weight even before any images are added. */}
          {hasItems ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              {allItems.map((item) => {
                const beforeUrl = getPortfolioPublicUrl(item.before_image_path);
                const afterUrl = getPortfolioPublicUrl(item.after_image_path);
                const alt = getBeforeAfterAlt({
                  beforeAlt: item.before_alt,
                  afterAlt: item.after_alt,
                  title: item.title,
                  description: item.description,
                  serviceLabel: "Virtual Staging",
                  serviceSlug: item.service_slug,
                });
                return (
                  <article
                    key={item.id}
                    className="group bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
                  >
                    {/* 5:2 wide aspect — same as homepage service grid */}
                    <div className="aspect-[5/2] relative overflow-hidden bg-stone-100">
                      <BeforeAfterFrame
                        beforeUrl={beforeUrl}
                        afterUrl={afterUrl}
                        beforeAlt={alt.beforeAlt}
                        afterAlt={alt.afterAlt}
                        placeholderVariant="virtual-staging"
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
                beforeAlt="Empty room before virtual staging"
                afterAlt="Furnished room after virtual staging"
                placeholderVariant="virtual-staging"
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
            description="Send us a clean photo of the empty room and a few details — we handle the rest."
          />
          <UploadRequirementsBlock
            items={[
              {
                label: "Original room photo",
                required: true,
                hint: "JPG or PNG, well-lit, straight angle if possible",
              },
              {
                label: "Room name / area",
                required: true,
                hint: "Living room, bedroom, kitchen, outdoor, etc.",
              },
              {
                label: "Preferred furniture style",
                required: true,
                hint: "Pick from the 9 styles below",
              },
              {
                label: "Reference image or link",
                hint: "Optional — helps us match a specific look",
              },
              {
                label: "Notes or instructions",
                hint: "Special requests, focal points, items to keep / remove",
              },
            ]}
            footnote="Required fields are marked *. Standard photo editing add-ons can be added during the order and apply to the same image."
          />
        </Wide>
      </section>

      {/* ═══════════════════════════════════════════════════════
          F. STYLE OPTIONS  —  stone-50
          StyleGallerySection renders 9 horizontal cards (3-col
          desktop, 2-col tablet, 1-col mobile) + lightbox.
          ═══════════════════════════════════════════════════════ */}
      <section className="py-14 lg:py-20 bg-stone-50">
        <Wide>
          <SectionLead
            eyebrow="Style options"
            title="Choose the right look for your buyer"
            description="Pick a single style per image — or let us match a reference. We tailor the furniture, materials and palette to fit the chosen direction. Tap a card to browse multiple examples per style."
          />
          <StyleGallerySection imageOverrides={styleImageOverrides} />
        </Wide>
      </section>

      {/* ═══════════════════════════════════════════════════════
          G. PRICING CARDS  —  white
          3-col desktop / 2-col tablet / 1-col mobile.
          Navy card for base, white cards for add-ons.
          Placed after Style options so users have seen all
          available styles before reviewing the price breakdown.
          ═══════════════════════════════════════════════════════ */}
      <section className="py-14 lg:py-20 bg-white">
        <Wide>
          <SectionLead
            eyebrow="Pricing"
            title="Base price + optional add-ons"
            description="Start with the base virtual staging price per image. Combine any add-ons you need for the same image — they stack on top of the base price."
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
                    Base Price
                  </span>
                )}
                <div>
                  <p
                    className={`text-2xl lg:text-3xl font-bold tracking-tight ${
                      card.isBase ? "text-white" : "text-primary"
                    }`}
                  >
                    <CatalogPriceText
                      priceKey={card.priceKey}
                      prefix={card.prefix}
                    />
                  </p>
                  <p
                    className={`text-xs font-medium mt-0.5 ${
                      card.isBase ? "text-white/70" : "text-muted"
                    }`}
                  >
                    {card.unit}
                  </p>
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
            Add-ons are per image and stack on top of the base virtual staging
            price. Multiple add-ons can be combined on the same image.
          </p>

          <div className="mt-8">
            <ClientPortalLink
              href="/dashboard/orders/new/virtual-staging"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary-light transition-colors text-sm"
            >
              Order Virtual Staging
              <ArrowRight className="w-4 h-4" aria-hidden />
            </ClientPortalLink>
          </div>
        </Wide>
      </section>

      {/* ═══════════════════════════════════════════════════════
          H. FAQ  —  stone-50
          ═══════════════════════════════════════════════════════ */}
      <section className="py-14 lg:py-20 bg-stone-50">
        <Wide>
          <SectionLead eyebrow="FAQ" title="Virtual Staging questions" />
          <div className="max-w-3xl">
            <FaqAccordion items={FAQ_ITEMS} />
          </div>
        </Wide>
      </section>

      {/* ═══════════════════════════════════════════════════════
          I. FINAL CTA  —  navy  (ServiceCTA owns its own bg)
          ═══════════════════════════════════════════════════════ */}
      <ServiceCTA
        title="Ready to stage your listing?"
        subtitle="Upload your photos, choose a style, and receive market-ready images within 24–48 hours."
        primaryHref="/dashboard/orders/new/virtual-staging"
        primaryLabel="Order Virtual Staging"
        secondaryHref="/contact"
        secondaryLabel="Ask a Question"
      />
    </>
  );
}
