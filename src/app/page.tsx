import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Container from "@/components/layout/Container";
import BeforeAfterShowcase from "@/components/home/BeforeAfterShowcase";
import BenefitsRow from "@/components/home/BenefitsRow";
import ServiceGrid from "@/components/home/ServiceGrid";
import HowItWorksDetailed from "@/components/home/HowItWorksDetailed";
import AboutPicchuSpot from "@/components/home/AboutPicchuSpot";
import ClientsValue from "@/components/home/ClientsValue";
import CtaSection from "@/components/sections/CtaSection";

// ============================================================
// HOME / REMOTE DIGITAL SERVICES
//
// Default top-level page. The Header component handles the
// two-level navigation; this page focuses on the body content:
//   1. Hero before/after showcase
//   2. Headline section
//   3. Benefits row
//   4. Service grid (10 remote services)
//   5. How it works (4 steps)
//   6. About PicchuSpot
//   7. What clients value
//   8. Final CTA
// ============================================================

export default function HomePage() {
  return (
    <>
      {/* 1. Hero showcase */}
      <section className="bg-primary py-12 lg:py-20">
        <Container>
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <div className="lg:col-span-5">
              <p className="text-secondary text-xs font-semibold tracking-[0.2em] uppercase mb-4">
                Remote Digital Services
              </p>
              <h1 className="text-4xl lg:text-6xl font-bold text-white leading-[1.05] tracking-tight">
                Real estate visuals,
                <br />
                ready for the listing.
              </h1>
              <p className="mt-5 text-base lg:text-lg text-white/75 leading-relaxed max-w-xl">
                Upload your photos, choose what you need, and receive
                market-ready files in 24-48 hours. No subscriptions, no
                surprises.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/order"
                  className="inline-flex items-center gap-2 px-7 py-3.5 bg-secondary text-primary-dark font-semibold rounded-lg hover:bg-secondary-light transition-colors text-sm"
                >
                  Order Online
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center px-7 py-3.5 border border-white/40 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors text-sm"
                >
                  See Pricing
                </Link>
              </div>
            </div>

            <div className="lg:col-span-7">
              <BeforeAfterShowcase />
            </div>
          </div>
        </Container>
      </section>

      {/* 2. Headline section */}
      <section className="py-14 lg:py-20 bg-white">
        <Container>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
              For Listing Teams &amp; Agents
            </p>
            <h2 className="text-3xl lg:text-5xl font-bold text-primary tracking-tight leading-[1.05]">
              Professional Real Estate Visual Services
            </h2>
            <p className="mt-5 text-base lg:text-lg text-muted leading-relaxed">
              Virtual staging, photo editing, floor plans, renovation
              concepts, 360 visuals, and local media for market-ready
              property listings.
            </p>
          </div>
        </Container>
      </section>

      {/* 3. Benefits row */}
      <BenefitsRow />

      {/* 4. Service grid */}
      <ServiceGrid />

      {/* 5. How it works */}
      <HowItWorksDetailed />

      {/* 6. About PicchuSpot */}
      <AboutPicchuSpot />

      {/* 7. What clients value */}
      <ClientsValue />

      {/* 8. Final CTA */}
      <CtaSection
        title="Start your next listing with the visuals already done."
        subtitle="Upload your photos and we will take it from there."
        primaryLabel="Order Online"
        primaryHref="/order"
        secondaryLabel="Talk to Us"
        secondaryHref="/contact"
      />
    </>
  );
}
