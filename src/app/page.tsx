import Link from "next/link";
import Container from "@/components/layout/Container";
import TrustBar from "@/components/sections/TrustBar";
import ServiceCategories from "@/components/sections/ServiceCategories";
import HowItWorks from "@/components/sections/HowItWorks";
import WhyChooseUs from "@/components/sections/WhyChooseUs";
import PricingTeaser from "@/components/sections/PricingTeaser";
import CtaSection from "@/components/sections/CtaSection";

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-primary py-20 lg:py-32">
        <Container>
          <div className="max-w-3xl">
            <p className="text-secondary text-sm font-semibold uppercase tracking-wider mb-4">
              Real Estate Visual Marketing
            </p>
            <h1 className="text-4xl lg:text-6xl font-bold text-white leading-tight mb-6">
              Help Your Listings Stand Out and Sell Faster
            </h1>
            <p className="text-lg lg:text-xl text-white/75 leading-relaxed mb-8 max-w-2xl">
              Virtual staging, photo editing, and floor plans — delivered in
              24-48 hours. Professional photography and video tours on-site in
              Alicante & Costa Blanca.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/order"
                className="px-7 py-3.5 bg-secondary text-primary-dark font-semibold rounded-lg hover:bg-secondary-light transition-colors text-sm"
              >
                Order Online
              </Link>
              <Link
                href="/portfolio"
                className="px-7 py-3.5 border border-white/40 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors text-sm"
              >
                View Our Work
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* Trust Bar */}
      <TrustBar />

      {/* Service Categories */}
      <ServiceCategories />

      {/* How It Works */}
      <HowItWorks />

      {/* Why Choose Us */}
      <WhyChooseUs />

      {/* Pricing Teaser */}
      <PricingTeaser />

      {/* Final CTA */}
      <CtaSection
        title="Ready to Elevate Your Listings?"
        subtitle="Join hundreds of agents who sell properties faster with professional visual marketing."
        primaryLabel="Order Remote Services"
        primaryHref="/order"
        secondaryLabel="Book a Local Shoot"
        secondaryHref="/contact"
      />
    </>
  );
}
