import Link from "next/link";
import type { ReactNode } from "react";
import { PUBLIC_TAX_NOTICE } from "@/lib/pricing/public";
import { ArrowRight, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import TrackedLink from "@/components/analytics/TrackedLink";
import Wide from "@/components/pricing/Wide";
import SectionLead from "@/components/pricing/SectionLead";
import UploadRequirementsBlock from "@/components/pricing/UploadRequirementsBlock";
import ServiceCTA from "@/components/pricing/ServiceCTA";
import ServicePageSlider, {
  type ServicePageSlide,
} from "@/components/pricing/ServicePageSlider";
import FaqAccordion, { type FaqItem } from "@/components/pricing/FaqAccordion";
import BeforeAfterFrame from "@/components/portfolio/BeforeAfterFrame";
import type { ServiceVariant } from "@/components/home/ServicePlaceholder";
import { getPortfolioPublicUrl, getServicePageItemsForService } from "@/lib/portfolio";
import type { PortfolioServiceSlug } from "@/lib/portfolio";
import {
  getServiceHeroSliderItems,
  getSiteMediaPublicUrl,
} from "@/lib/site-media";
import { PortfolioExamplesGrid } from "@/app/(public)/pricing/floor-plans/FloorPlansInteractive";
import type { PortfolioExampleCard } from "@/app/(public)/pricing/floor-plans/FloorPlansInteractive";

// ============================================================
// ServicePage — shared server component
//
// Renders the full 8-section service page structure used by all
// remaining service/pricing pages (image-enhancement, day-to-dusk,
// photo-editing, virtual-renovation, 360-image-enhancement,
// aerial-editing, development-site-plans).
//
// Section order and background rhythm:
//   A  Hero slider         white
//   B  When to use         stone-50
//   C  Pricing intro       white
//   D  What it is + grid   stone-50
//   E  Before you order    white
//   F  Pricing cards       stone-50
//   G  FAQ                 white
//   H  Final CTA           navy
//
// Data sources (same rules as floor-plans):
//   A  → site_media_items (service-hero, slug, before-after only)
//   D  → portfolio_items (slug, published, sort_order)
//
// No Style options section on these pages.
// ============================================================

export interface UseCase {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface PricingCard {
  label: string;
  price: ReactNode;
  unit?: string;
  note: string;
  isBase?: boolean;
}

export interface UploadItem {
  label: string;
  required?: boolean;
  hint?: string;
}

export interface ServicePageProps {
  // Metadata
  serviceSlug: PortfolioServiceSlug;
  placeholderVariant: ServiceVariant;

  // Section C — pricing intro
  eyebrow: string;
  title: string;
  description: string;
  priceLine: ReactNode;
  orderHref: string;
  orderLabel: string;

  // Section B — when to use
  whenToUseTitle: string;
  whenToUseDescription: string;
  useCases: UseCase[];

  // Section D — what it is
  whatItIsTitle: string;
  whatItIsBody: string;
  whatItIsBullets: string[];

  // Section E — before you order
  beforeYouOrderDescription: string;
  uploadItems: UploadItem[];
  uploadFootnote?: string;

  // Section F — pricing
  pricingTitle: string;
  pricingDescription: string;
  pricingCards: PricingCard[];
  pricingFootnote?: string;

  // Section G — FAQ
  faqTitle: string;
  faqItems: FaqItem[];

  // Section H — final CTA
  ctaTitle: string;
  ctaSubtitle: string;

  // Optional custom hero visual. Defaults to the standard before/after slider.
  heroContent?: ReactNode;
  labels?: {
    heroAriaLabel?: string;
    bestForEyebrow?: string;
    backToServices?: string;
    backToServicesHref?: string;
    whatItIsEyebrow?: string;
    beforeYouOrderEyebrow?: string;
    beforeYouOrderTitle?: string;
    pricingEyebrow?: string;
    basePriceBadge?: string;
    taxNotice?: string;
    faqEyebrow?: string;
    beforeLabel?: string;
    afterLabel?: string;
    viewExamplePrefix?: string;
    viewExampleSuffix?: string;
    translateExampleTitle?: (title: string) => string;
    translateExampleDescription?: (description: string) => string;
    secondaryCtaLabel?: string;
    secondaryCtaHref?: string;
  };
}

// ── Slider data helper ────────────────────────────────────────

async function buildSlides(
  slug: PortfolioServiceSlug,
  fallbackVariant: ServiceVariant
): Promise<ServicePageSlide[]> {
  const heroMedia = await getServiceHeroSliderItems(slug);
  const usable = heroMedia.filter(
    (it) => it.before_image_path && it.after_image_path
  );
  if (usable.length > 0) {
    return usable.map((item) => ({
      kind: "image" as const,
      id: item.id,
      beforeUrl: getSiteMediaPublicUrl(item.before_image_path) ?? "",
      afterUrl: getSiteMediaPublicUrl(item.after_image_path) ?? "",
      beforeAlt: item.alt_text ?? item.title ?? `${slug} — before`,
      afterAlt: item.alt_text ?? item.title ?? `${slug} — after`,
      title: item.title ?? undefined,
    }));
  }
  return [{ kind: "placeholder", id: `${slug}-fallback`, variant: fallbackVariant }];
}

// ── Component ─────────────────────────────────────────────────

export default async function ServicePage({
  serviceSlug,
  placeholderVariant,
  eyebrow,
  title,
  description,
  priceLine,
  orderHref,
  orderLabel,
  whenToUseTitle,
  whenToUseDescription,
  useCases,
  whatItIsTitle,
  whatItIsBody,
  whatItIsBullets,
  beforeYouOrderDescription,
  uploadItems,
  uploadFootnote,
  pricingTitle,
  pricingDescription,
  pricingCards,
  pricingFootnote,
  faqTitle,
  faqItems,
  ctaTitle,
  ctaSubtitle,
  heroContent,
  labels,
}: ServicePageProps) {
  const slidesPromise = heroContent
    ? Promise.resolve<ServicePageSlide[] | null>(null)
    : buildSlides(serviceSlug, placeholderVariant);

  const [sliderSlides, allItems] = await Promise.all([
    slidesPromise,
    getServicePageItemsForService(serviceSlug),
  ]);

  const portfolioCards: PortfolioExampleCard[] = allItems.map((item) => ({
    id: item.id,
    title: labels?.translateExampleTitle?.(item.title) ?? item.title,
    description: item.description
      ? (labels?.translateExampleDescription?.(item.description) ??
        item.description)
      : item.description,
    beforeUrl: getPortfolioPublicUrl(item.before_image_path),
    afterUrl: getPortfolioPublicUrl(item.after_image_path),
    beforeAlt: item.before_alt ?? `${item.title} — before`,
    afterAlt: item.after_alt ?? `${item.title} — after`,
  }));

  return (
    <>
      {/* ── A. HERO SLIDER — white ── */}
      <section className="bg-white overflow-hidden">
        <div className="px-3 sm:px-4 lg:px-2 pt-3 lg:pt-4 pb-0">
          {heroContent ?? (
            <ServicePageSlider
              slides={sliderSlides ?? []}
              ariaLabel={
                labels?.heroAriaLabel ?? `${title} before and after examples`
              }
            />
          )}
        </div>
      </section>

      {/* ── B. WHEN TO USE — stone-50 ── */}
      <section className="pt-8 lg:pt-10 pb-14 lg:pb-20 bg-stone-50">
        <Wide>
          <SectionLead
            eyebrow={labels?.bestForEyebrow ?? "Best for"}
            title={whenToUseTitle}
            description={whenToUseDescription}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
            {useCases.map((u) => {
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

      {/* ── C. PRICING INTRO — white ── */}
      <section className="bg-white border-y border-stone-200">
        <Wide className="py-10 lg:py-14">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 lg:gap-10">
            <div className="lg:max-w-2xl">
              <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-2">
                {eyebrow}
              </p>
              <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-primary leading-[1.05] tracking-tight">
                {title}
              </h1>
              <p className="mt-3 text-base lg:text-lg text-muted leading-relaxed">
                {description}
              </p>
              <p className="mt-2 text-lg lg:text-xl font-semibold text-foreground">
                {priceLine}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:flex-shrink-0">
              <TrackedLink
                href={orderHref}
                analyticsLabel={orderLabel}
                analyticsLocation="pricing_intro"
                analyticsEvent="pricing_cta"
                className="inline-flex items-center gap-2 px-6 lg:px-7 py-3 lg:py-3.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-light transition-colors text-sm shadow-sm"
              >
                {orderLabel}
                <ArrowRight className="w-4 h-4" aria-hidden />
              </TrackedLink>
              <Link
                href={labels?.backToServicesHref ?? "/services"}
                className="inline-flex items-center px-6 lg:px-7 py-3 lg:py-3.5 border border-stone-300 text-foreground font-semibold rounded-lg hover:border-primary hover:text-primary transition-colors text-sm"
              >
                {labels?.backToServices ?? "Back to Services"}
              </Link>
            </div>
          </div>
        </Wide>
      </section>

      {/* ── D. WHAT IT IS + EXAMPLES — stone-50 ── */}
      <section className="py-14 lg:py-20 bg-stone-50">
        <Wide>
          <div className="max-w-3xl mb-10 lg:mb-14">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
              {labels?.whatItIsEyebrow ?? "What it is"}
            </p>
            <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-primary mb-4 tracking-tight leading-[1.1]">
              {whatItIsTitle}
            </h2>
            <p className="text-base lg:text-lg text-muted leading-relaxed mb-6">
              {whatItIsBody}
            </p>
            <ul className="space-y-3">
              {whatItIsBullets.map((item) => (
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

          {/* Portfolio examples grid — client component with lightbox */}
          {portfolioCards.length > 0 ? (
            <PortfolioExamplesGrid
              cards={portfolioCards}
              imageFit="cover"
              labels={{
                before: labels?.beforeLabel,
                after: labels?.afterLabel,
                viewExamplePrefix: labels?.viewExamplePrefix,
                viewExampleSuffix: labels?.viewExampleSuffix,
              }}
            />
          ) : (
            <div className="relative aspect-[5/2] w-full overflow-hidden rounded-2xl shadow-sm ring-1 ring-stone-200 bg-stone-100">
              <BeforeAfterFrame
                beforeUrl={null}
                afterUrl={null}
                beforeAlt={`${title} — before`}
                afterAlt={`${title} — after`}
                placeholderVariant={placeholderVariant}
                beforeLabel={labels?.beforeLabel}
                afterLabel={labels?.afterLabel}
                placeholderLabels={
                  labels?.beforeLabel || labels?.afterLabel
                    ? {
                        left: labels?.beforeLabel ?? "Before",
                        right: labels?.afterLabel ?? "After",
                      }
                    : undefined
                }
              />
            </div>
          )}
        </Wide>
      </section>

      {/* ── E. BEFORE YOU ORDER — white ── */}
      <section className="py-14 lg:py-20 bg-white">
        <Wide>
          <SectionLead
            eyebrow={labels?.beforeYouOrderEyebrow ?? "Before you order"}
            title={labels?.beforeYouOrderTitle ?? "What we need from you"}
            description={beforeYouOrderDescription}
          />
          <UploadRequirementsBlock
            items={uploadItems}
            footnote={uploadFootnote}
          />
        </Wide>
      </section>

      {/* ── F. PRICING CARDS — stone-50 ── */}
      <section className="py-14 lg:py-20 bg-stone-50">
        <Wide>
          <SectionLead
            eyebrow={labels?.pricingEyebrow ?? "Pricing"}
            title={pricingTitle}
            description={pricingDescription}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
            {pricingCards.map((card) => (
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
                    {labels?.basePriceBadge ?? "Base Price"}
                  </span>
                )}
                <div>
                  <p className={`text-2xl lg:text-3xl font-bold tracking-tight ${card.isBase ? "text-white" : "text-primary"}`}>
                    {card.price}
                  </p>
                  {card.unit && (
                    <p className={`text-xs font-medium mt-0.5 ${card.isBase ? "text-white/70" : "text-muted"}`}>
                      {card.unit}
                    </p>
                  )}
                </div>
                <div>
                  <p className={`text-sm lg:text-base font-semibold leading-tight ${card.isBase ? "text-white" : "text-foreground"}`}>
                    {card.label}
                  </p>
                  <p className={`text-xs lg:text-sm mt-1 leading-relaxed ${card.isBase ? "text-white/75" : "text-muted"}`}>
                    {card.note}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {pricingFootnote && (
            <p className="mt-6 text-xs lg:text-sm text-muted leading-relaxed max-w-2xl">
              {pricingFootnote}
            </p>
          )}
          <p className="mt-3 text-xs lg:text-sm text-muted leading-relaxed max-w-2xl">
            {labels?.taxNotice ?? PUBLIC_TAX_NOTICE}
          </p>
          <div className="mt-8">
            <TrackedLink
              href={orderHref}
              analyticsLabel={orderLabel}
              analyticsLocation="pricing_card"
              analyticsEvent="pricing_cta"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary-light transition-colors text-sm"
            >
              {orderLabel}
              <ArrowRight className="w-4 h-4" aria-hidden />
            </TrackedLink>
          </div>
        </Wide>
      </section>

      {/* ── G. FAQ — white ── */}
      <section className="py-14 lg:py-20 bg-white">
        <Wide>
          <SectionLead eyebrow={labels?.faqEyebrow ?? "FAQ"} title={faqTitle} />
          <div className="max-w-3xl">
            <FaqAccordion items={faqItems} />
          </div>
        </Wide>
      </section>

      {/* ── H. FINAL CTA — navy ── */}
      <ServiceCTA
        title={ctaTitle}
        subtitle={ctaSubtitle}
        primaryHref={orderHref}
        primaryLabel={orderLabel}
        secondaryHref={labels?.secondaryCtaHref ?? "/contact"}
        secondaryLabel={labels?.secondaryCtaLabel ?? "Ask a Question"}
      />
    </>
  );
}
