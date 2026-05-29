import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Home, Sparkles, Building2, ImagePlus } from "lucide-react";
import Wide from "@/components/pricing/Wide";
import SectionLead from "@/components/pricing/SectionLead";
import StyleGallerySection from "@/components/pricing/StyleGallerySection";
import UploadRequirementsBlock from "@/components/pricing/UploadRequirementsBlock";
import ServiceCTA from "@/components/pricing/ServiceCTA";
import ServicePageSlider, {
  type ServicePageSlide,
} from "@/components/pricing/ServicePageSlider";
import FaqAccordion, { type FaqItem } from "@/components/pricing/FaqAccordion";
import BeforeAfterFrame from "@/components/portfolio/BeforeAfterFrame";
import { getPortfolioPublicUrl, getPublishedItemsForService } from "@/lib/portfolio";

// ============================================================
// /pricing/virtual-staging  —  Virtual Staging service page
//
// Section order and background rhythm (fixed — never toggled
// on data availability):
//
//   A  Hero slider          white   (near-edge, homepage style)
//   B  When to use          stone-50
//   C  Pricing intro        white
//   D  What it is + examples stone-50  (single merged section)
//   E  Before you order     white
//   F  Style options        stone-50
//   G  Pricing cards        white
//   H  FAQ                  stone-50
//   I  Final CTA            navy  (ServiceCTA)
//
// Data loading:
//   - getPublishedItemsForService returns [] when Supabase is
//     unconfigured → page still builds/renders statically.
//   - A single DB call fills both the slider (up to 5 slides)
//     and the examples grid (all items).
// ============================================================

export const metadata: Metadata = {
  title: "Virtual Staging",
  description:
    "Virtual staging from US$19 per image. Transform empty or outdated rooms into furnished, market-ready spaces. 9 interior styles, 1 revision included, delivered in 24–48 hours.",
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
  "1 revision included",
  "High-resolution JPG delivery in 24–48h",
] as const;

const PRICING_CARDS = [
  {
    label: "Base Virtual Staging",
    price: "US$19.00",
    unit: "per image",
    note: "Furniture, decor, and styling for one room.",
    isBase: true,
  },
  {
    label: "Image Enhancement",
    price: "+US$2.00",
    unit: "per image",
    note: "Colour, exposure, and window correction.",
    isBase: false,
  },
  {
    label: "Day to Dusk",
    price: "+US$5.00",
    unit: "per image",
    note: "Convert daytime exterior to a warm dusk shot.",
    isBase: false,
  },
  {
    label: "Item Removal & Virtual Cleaning",
    price: "+US$8.00",
    unit: "per image",
    note: "Remove clutter before staging the room.",
    isBase: false,
  },
  {
    label: "Turn On Lights",
    price: "+US$1.00",
    unit: "per image",
    note: "Make visible light sources appear switched on.",
    isBase: false,
  },
  {
    label: "Colour Change",
    price: "+US$3.00",
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
      "One revision is included for each item so the final image matches your brief more closely.",
  },
  {
    question: "Can I use the images for MLS and marketing?",
    answer:
      "Yes, the final images are prepared for real estate listings, websites, social media, and marketing packages.",
  },
];

// ── Data helpers ─────────────────────────────────────────────

async function buildSliderSlides(
  items: Awaited<ReturnType<typeof getPublishedItemsForService>>
): Promise<ServicePageSlide[]> {
  const usable = items
    .filter((it) => it.before_image_path && it.after_image_path)
    .slice(0, 5);

  if (usable.length === 0) {
    return [{ kind: "placeholder", id: "vs-fallback", variant: "virtual-staging" }];
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

export default async function VirtualStagingPage() {
  // Single DB round-trip — reuse for slider and examples grid.
  const allItems = await getPublishedItemsForService("virtual-staging");
  const sliderSlides = await buildSliderSlides(allItems);
  const hasItems = allItems.length > 0;

  return (
    <>
      {/* ═══════════════════════════════════════════════════════
          A. HERO SLIDER  —  white / near-edge (homepage feel)
          The px values here match the homepage slider wrapper
          exactly: px-3 sm:px-4 lg:px-2. overflow-hidden on the
          section prevents any bleed at narrow viewports.
          ═══════════════════════════════════════════════════════ */}
      <section className="bg-white overflow-hidden">
        <div className="px-3 sm:px-4 lg:px-2 pt-3 lg:pt-4 pb-4 lg:pb-6">
          <ServicePageSlider
            slides={sliderSlides}
            ariaLabel="Virtual Staging before and after examples"
          />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          B. WHEN TO USE  —  stone-50
          ═══════════════════════════════════════════════════════ */}
      <section className="py-14 lg:py-20 bg-stone-50">
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
          Uses <h1> because this is the primary page heading
          (the slider above is purely visual).
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
                From US$19 / image
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:flex-shrink-0">
              <Link
                href="/order/virtual-staging"
                className="inline-flex items-center gap-2 px-6 lg:px-7 py-3 lg:py-3.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-light transition-colors text-sm shadow-sm"
              >
                Order Virtual Staging
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
          D. WHAT IT IS + EXAMPLES  —  stone-50  (merged section)
          Copy + bullets form the intro; portfolio cards appear
          directly below in the same section — no separate
          heading, no separate description for the grid.
          If no items are uploaded, a single full-width placeholder
          frame stands in so the section still has visual weight.
          ═══════════════════════════════════════════════════════ */}
      <section className="py-14 lg:py-20 bg-stone-50">
        <Wide>
          {/* ── Intro copy ── */}
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start mb-10 lg:mb-14">
            <div className="lg:col-span-5">
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

            {/* Right column: first two examples or placeholder */}
            <div className="lg:col-span-7">
              {hasItems ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-5">
                  {allItems.slice(0, 2).map((item) => {
                    const beforeUrl = getPortfolioPublicUrl(item.before_image_path);
                    const afterUrl = getPortfolioPublicUrl(item.after_image_path);
                    return (
                      <article
                        key={item.id}
                        className="rounded-2xl overflow-hidden border border-stone-200 shadow-sm bg-white"
                      >
                        <div className="aspect-[5/3] relative overflow-hidden bg-stone-100">
                          <BeforeAfterFrame
                            beforeUrl={beforeUrl}
                            afterUrl={afterUrl}
                            beforeAlt={item.before_alt ?? `${item.title} — before`}
                            afterAlt={item.after_alt ?? `${item.title} — after`}
                            placeholderVariant="virtual-staging"
                          />
                        </div>
                        <div className="p-4">
                          <h3 className="text-sm font-bold text-primary tracking-tight">
                            {item.title}
                          </h3>
                          {item.description && (
                            <p className="mt-1 text-xs text-muted leading-relaxed line-clamp-2">
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
            </div>
          </div>

          {/* ── Full examples grid (all items, 2-col desktop) ──
              Only rendered when there are uploaded items.
              No extra heading — the intro copy above contextualises
              the grid so it reads as a continuation. */}
          {hasItems && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              {allItems.map((item) => {
                const beforeUrl = getPortfolioPublicUrl(item.before_image_path);
                const afterUrl = getPortfolioPublicUrl(item.after_image_path);
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
                        beforeAlt={item.before_alt ?? `${item.title} — before`}
                        afterAlt={item.after_alt ?? `${item.title} — after`}
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
          <StyleGallerySection />
        </Wide>
      </section>

      {/* ═══════════════════════════════════════════════════════
          G. PRICING CARDS  —  white
          3-col desktop / 2-col tablet / 1-col mobile.
          Navy card for base, white cards for add-ons.
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
                    {card.price}
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
            <Link
              href="/order/virtual-staging"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary-light transition-colors text-sm"
            >
              Order Virtual Staging
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
        primaryHref="/order/virtual-staging"
        primaryLabel="Order Virtual Staging"
        secondaryHref="/contact"
        secondaryLabel="Ask a Question"
      />
    </>
  );
}
