import { ArrowRight } from "lucide-react";
import TrackedLink from "@/components/analytics/TrackedLink";
import Wide from "./Wide";

interface ServiceCTAProps {
  title: string;
  subtitle?: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}

/**
 * Bottom CTA section for pricing detail pages.
 * Premium navy block with gold primary action — same family as Services page.
 */
export default function ServiceCTA({
  title,
  subtitle,
  primaryHref,
  primaryLabel,
  secondaryHref = "/contact",
  secondaryLabel = "Ask a Question",
}: ServiceCTAProps) {
  return (
    <section className="bg-primary py-20 lg:py-28">
      <Wide>
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary mb-5">
            Get Started
          </p>
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-5 tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-white/70 text-base lg:text-xl mb-10 leading-relaxed">
              {subtitle}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <TrackedLink
              href={primaryHref}
              analyticsLabel={primaryLabel}
              analyticsLocation="cta_section"
              analyticsEvent="pricing_cta"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-secondary text-primary-dark font-semibold rounded-lg hover:bg-secondary-light transition-colors text-sm shadow-sm"
            >
              {primaryLabel}
              <ArrowRight className="w-4 h-4" />
            </TrackedLink>
            {secondaryHref && secondaryLabel && (
              <TrackedLink
                href={secondaryHref}
                analyticsLabel={secondaryLabel}
                analyticsLocation="cta_section"
                className="inline-flex items-center justify-center px-8 py-4 border border-white/40 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors text-sm"
              >
                {secondaryLabel}
              </TrackedLink>
            )}
          </div>
        </div>
      </Wide>
    </section>
  );
}
