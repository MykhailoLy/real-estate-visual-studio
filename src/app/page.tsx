import Link from "next/link";
import { ArrowRight } from "lucide-react";
import BeforeAfterShowcase from "@/components/home/BeforeAfterShowcase";
import BenefitsRow from "@/components/home/BenefitsRow";
import ServiceGrid from "@/components/home/ServiceGrid";
import HowItWorksDetailed from "@/components/home/HowItWorksDetailed";
import AboutPicchuSpot from "@/components/home/AboutPicchuSpot";
import Testimonials from "@/components/home/Testimonials";
import CtaSection from "@/components/sections/CtaSection";

// ============================================================
// HOME / REMOTE DIGITAL SERVICES
//
// Image-led structure: a full-width before/after slider sits
// directly under the two-level navigation, then the hero text
// block (eyebrow + H1 + subhead + CTAs), then benefits, the
// 2-column service grid, how-it-works, the About collage,
// testimonials, and a closing CTA.
//
// The slider container uses minimal horizontal padding so it
// reads as a wide website banner, while the text block below
// stays inside the standard 1500px content rail so its line
// length stays readable.
// ============================================================

export default function HomePage() {
  return (
    <>
      {/* 1. Hero — slider first, then text */}
      <section className="bg-surface">
        {/* Full-width slider sitting just under the second-row
            navigation. Padding is intentionally minimal at lg+ so
            the slider reads as a banner rather than a centered
            card. The slider component itself owns its rounded
            corners + drop shadow, so a thin gutter on each side
            keeps the shadow visible without losing impact. */}
        <div className="px-4 sm:px-6 lg:px-4 pt-6 lg:pt-8">
          <BeforeAfterShowcase />
        </div>

        {/* Hero text block — sits below the slider. Constrained
            to the standard 1500px rail so the headline + subhead
            don't span an uncomfortable line length. */}
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 pt-10 lg:pt-14 pb-14 lg:pb-20">
          <div className="max-w-3xl">
            <p className="text-secondary-dark text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase mb-5 lg:mb-6">
              Remote Digital Services
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-primary leading-[1.02] tracking-tight">
              Help Your Listings Stand Out and Sell Faster
            </h1>
            <p className="mt-6 lg:mt-8 text-lg sm:text-xl lg:text-2xl text-muted leading-snug max-w-3xl">
              Virtual staging, photo editing, floor plans, 360 visuals, and
              local real estate media for market-ready property listings.
            </p>
            <div className="mt-8 lg:mt-10 flex flex-wrap gap-3">
              <Link
                href="/order"
                className="inline-flex items-center gap-2 px-7 lg:px-9 py-3.5 lg:py-4 bg-primary text-white font-bold rounded-lg hover:bg-primary-light transition-colors text-sm lg:text-base shadow-sm"
              >
                Order Online
                <ArrowRight className="w-4 h-4 lg:w-5 lg:h-5" aria-hidden />
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center px-7 lg:px-9 py-3.5 lg:py-4 border border-stone-300 text-foreground font-bold rounded-lg hover:border-primary hover:text-primary transition-colors text-sm lg:text-base"
              >
                View Services
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Benefits row */}
      <BenefitsRow />

      {/* 3. Service grid */}
      <ServiceGrid />

      {/* 4. How it works */}
      <HowItWorksDetailed />

      {/* 5. About PicchuSpot */}
      <AboutPicchuSpot />

      {/* 6. Testimonials */}
      <Testimonials />

      {/* 7. Final CTA */}
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
