import { ArrowRight } from "lucide-react";
import TrackedLink from "@/components/analytics/TrackedLink";
import Wide from "./Wide";

interface PricingHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  priceLine?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}

export default function PricingHero({
  eyebrow,
  title,
  description,
  priceLine,
  primaryHref,
  primaryLabel,
  secondaryHref = "/services",
  secondaryLabel = "Back to Services",
}: PricingHeroProps) {
  return (
    <section className="bg-stone-50 relative overflow-hidden">
      <Wide className="py-16 lg:py-24">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-5">
            {eyebrow}
          </p>
          <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold text-primary mb-6 leading-[1.05] tracking-tight">
            {title}
          </h1>
          <p className="text-base lg:text-lg text-muted leading-relaxed mb-6">
            {description}
          </p>
          {priceLine && (
            <p className="text-lg lg:text-xl font-semibold text-foreground mb-10">
              {priceLine}
            </p>
          )}
          {(primaryHref || secondaryHref) && (
            <div className="flex flex-col sm:flex-row gap-3">
              {primaryHref && primaryLabel && (
                <TrackedLink
                  href={primaryHref}
                  analyticsLabel={primaryLabel}
                  analyticsLocation="pricing_hero"
                  analyticsEvent="pricing_cta"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary-light transition-colors text-sm shadow-sm"
                >
                  {primaryLabel}
                  <ArrowRight className="w-4 h-4" />
                </TrackedLink>
              )}
              {secondaryHref && secondaryLabel && (
                <TrackedLink
                  href={secondaryHref}
                  analyticsLabel={secondaryLabel}
                  analyticsLocation="pricing_hero"
                  className="inline-flex items-center justify-center px-7 py-3.5 border border-primary/25 text-primary font-semibold rounded-lg hover:bg-primary hover:text-white hover:border-primary transition-all text-sm"
                >
                  {secondaryLabel}
                </TrackedLink>
              )}
            </div>
          )}
        </div>
      </Wide>
    </section>
  );
}
