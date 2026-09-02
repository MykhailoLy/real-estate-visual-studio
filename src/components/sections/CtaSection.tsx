import TrackedLink from "@/components/analytics/TrackedLink";
import Container from "@/components/layout/Container";

interface CtaSectionProps {
  title?: string;
  subtitle?: string;
  primaryLabel?: string;
  primaryHref?: string;
  primaryAnalyticsEvent?: "order_intent" | "pricing_cta" | "contact_intent";
  secondaryLabel?: string;
  secondaryHref?: string;
  secondaryAnalyticsEvent?: "order_intent" | "pricing_cta" | "contact_intent";
}

export default function CtaSection({
  title = "Ready to Elevate Your Listings?",
  subtitle = "Professional visual marketing that helps you sell properties faster.",
  primaryLabel = "Order Online",
  primaryHref = "/order",
  primaryAnalyticsEvent,
  secondaryLabel = "Contact Us",
  secondaryHref = "/contact",
  secondaryAnalyticsEvent,
}: CtaSectionProps) {
  const primaryIntentType = primaryHref.startsWith("/order")
    ? "order"
    : undefined;
  const secondaryIntentType = secondaryHref.startsWith("/contact")
    ? "contact"
    : undefined;

  return (
    <section className="bg-primary py-16 lg:py-20">
      <Container>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl lg:text-4xl font-bold text-white mb-4">
            {title}
          </h2>
          <p className="text-white/70 text-base lg:text-lg mb-8">{subtitle}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <TrackedLink
              href={primaryHref}
              analyticsLabel={primaryLabel}
              analyticsLocation="cta_section"
              analyticsIntentType={primaryIntentType}
              analyticsEvent={primaryAnalyticsEvent}
              className="px-8 py-3.5 bg-secondary text-primary-dark font-semibold rounded-lg hover:bg-secondary-light transition-colors text-public-copy-sm"
            >
              {primaryLabel}
            </TrackedLink>
            <TrackedLink
              href={secondaryHref}
              analyticsLabel={secondaryLabel}
              analyticsLocation="cta_section"
              analyticsIntentType={secondaryIntentType}
              analyticsEvent={secondaryAnalyticsEvent}
              className="px-8 py-3.5 border border-white/40 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors text-public-copy-sm"
            >
              {secondaryLabel}
            </TrackedLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
