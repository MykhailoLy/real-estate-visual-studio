import Link from "next/link";
import Container from "@/components/layout/Container";

interface CtaSectionProps {
  title?: string;
  subtitle?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

export default function CtaSection({
  title = "Ready to Elevate Your Listings?",
  subtitle = "Professional visual marketing that helps you sell properties faster.",
  primaryLabel = "Order Online",
  primaryHref = "/order",
  secondaryLabel = "Contact Us",
  secondaryHref = "/contact",
}: CtaSectionProps) {
  return (
    <section className="bg-primary py-16 lg:py-20">
      <Container>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl lg:text-4xl font-bold text-white mb-4">
            {title}
          </h2>
          <p className="text-white/70 text-base lg:text-lg mb-8">{subtitle}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={primaryHref}
              className="px-8 py-3.5 bg-secondary text-primary-dark font-semibold rounded-lg hover:bg-secondary-light transition-colors text-sm"
            >
              {primaryLabel}
            </Link>
            <Link
              href={secondaryHref}
              className="px-8 py-3.5 border border-white/40 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors text-sm"
            >
              {secondaryLabel}
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
