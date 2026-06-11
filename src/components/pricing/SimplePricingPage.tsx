import { ArrowRight, Check } from "lucide-react";
import TrackedLink from "@/components/analytics/TrackedLink";
import PricingHero from "./PricingHero";
import ServiceCTA from "./ServiceCTA";
import SectionLead from "./SectionLead";
import Wide from "./Wide";
import ServicePlaceholder, {
  type ServiceVariant,
} from "@/components/home/ServicePlaceholder";
import PortfolioExamples from "@/components/portfolio/PortfolioExamples";
import type { PortfolioServiceSlug } from "@/lib/portfolio";

// ============================================================
// SIMPLE PRICING DETAIL PAGE
//
// Lightweight wrapper used by the new pricing/detail pages
// (image-enhancement, day-to-dusk, 360-image-enhancement,
// 360-virtual-staging, aerial-editing, development-site-plans).
// Reuses the existing pricing design system: PricingHero,
// SectionLead, ServiceCTA, and the Wide container — so the new
// pages match the look and feel of the existing detail pages.
// ============================================================

export interface SimplePricingPageProps {
  /** Eyebrow shown above the H1 in the hero. */
  eyebrow: string;
  title: string;
  /** Long-form hero description. */
  description: string;
  /** Optional starting-price or "Request a quote" line. */
  priceLine?: string;
  /** Pure-CSS placeholder identifying the service visually. */
  variant: ServiceVariant;
  /** Caption rendered under the hero placeholder. */
  visualCaption?: string;
  /** Bullet list of what the order includes. */
  whatsIncluded: string[];
  /** Body copy for the "What we need from you" / brief section. */
  whatToSend: string[];
  /** Primary order CTA — usually one of the four real /order/* routes. */
  primaryHref: string;
  primaryLabel: string;
  /** Secondary CTA label & href; defaults to /contact + Talk to Us. */
  secondaryHref?: string;
  secondaryLabel?: string;
  /** Final CTA section copy. */
  ctaTitle: string;
  ctaSubtitle: string;
  /** Canonical portfolio slug. When admin-uploaded portfolio
   *  items exist for this slug, a "Before & after examples"
   *  section is inserted under the placeholder visual. When no
   *  items exist the section is not rendered (no empty state). */
  portfolioSlug?: PortfolioServiceSlug;
}

export default function SimplePricingPage({
  eyebrow,
  title,
  description,
  priceLine,
  variant,
  visualCaption,
  whatsIncluded,
  whatToSend,
  primaryHref,
  primaryLabel,
  secondaryHref = "/contact",
  secondaryLabel = "Talk to Us",
  ctaTitle,
  ctaSubtitle,
  portfolioSlug,
}: SimplePricingPageProps) {
  return (
    <>
      <PricingHero
        eyebrow={eyebrow}
        title={title}
        description={description}
        priceLine={priceLine}
        primaryHref={primaryHref}
        primaryLabel={primaryLabel}
        secondaryHref={secondaryHref}
        secondaryLabel={secondaryLabel}
      />

      {/* Placeholder visual — large before/after card the user can
          replace with a real portfolio image later. We use the same
          ServicePlaceholder vocabulary as the homepage so the design
          system stays consistent. */}
      <section className="py-12 lg:py-16 bg-white">
        <Wide>
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl shadow-sm ring-1 ring-stone-200 bg-stone-100">
            <ServicePlaceholder variant={variant} />
          </div>
          {visualCaption && (
            <p className="mt-3 text-xs lg:text-sm text-muted leading-relaxed max-w-3xl">
              {visualCaption}
            </p>
          )}
        </Wide>
      </section>

      {/* Real before/after examples — renders only when admin has
          uploaded at least one portfolio_items row matching this
          service slug. Otherwise this whole section disappears so
          the page never shows an empty "Examples" block. */}
      {portfolioSlug && (
        <PortfolioExamples
          serviceSlug={portfolioSlug}
          placeholderVariant={variant}
          background="stone-50"
        />
      )}

      {/* What's included */}
      <section className="py-14 lg:py-20 bg-stone-50">
        <Wide>
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16">
            <div className="lg:col-span-5">
              <SectionLead
                eyebrow="What's included"
                title="In every order"
                description="What you receive when you order this service. Combine multiple services in one project — all coordinated under a single brief."
              />
            </div>
            <div className="lg:col-span-7">
              <ul className="space-y-3">
                {whatsIncluded.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 bg-white border border-stone-200 rounded-xl p-4 lg:p-5"
                  >
                    <span
                      aria-hidden
                      className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center mt-0.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-sm lg:text-base text-foreground leading-relaxed">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Wide>
      </section>

      {/* What to send us */}
      <section className="py-14 lg:py-20 bg-white">
        <Wide>
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16">
            <div className="lg:col-span-5">
              <SectionLead
                eyebrow="Before you order"
                title="What we need from you"
                description="The clearer your brief, the closer the result to your vision. Send us:"
              />
            </div>
            <div className="lg:col-span-7">
              <ul className="space-y-3">
                {whatToSend.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-sm lg:text-base text-muted leading-relaxed"
                  >
                    <span
                      aria-hidden
                      className="flex-shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-primary"
                    />
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>

              {/* Quick CTA inline so the user doesn't have to scroll
                  back up to start an order from this section. */}
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <TrackedLink
                  href={primaryHref}
                  analyticsLabel={primaryLabel}
                  analyticsLocation="pricing_inline"
                  analyticsEvent="pricing_cta"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary-light transition-colors text-sm"
                >
                  {primaryLabel}
                  <ArrowRight className="w-4 h-4" />
                </TrackedLink>
                {secondaryHref && secondaryLabel && (
                  <TrackedLink
                    href={secondaryHref}
                    analyticsLabel={secondaryLabel}
                    analyticsLocation="pricing_inline"
                    className="inline-flex items-center justify-center px-7 py-3.5 border border-stone-300 text-foreground font-semibold rounded-lg hover:border-primary hover:text-primary transition-all text-sm"
                  >
                    {secondaryLabel}
                  </TrackedLink>
                )}
              </div>
            </div>
          </div>
        </Wide>
      </section>

      <ServiceCTA
        title={ctaTitle}
        subtitle={ctaSubtitle}
        primaryHref={primaryHref}
        primaryLabel={primaryLabel}
        secondaryHref="/contact"
        secondaryLabel="Ask a Question"
      />
    </>
  );
}
