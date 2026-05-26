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
// Refined post-PR-#9: sections are wider (max-w-[1500px]) and
// the hero uses a stacked layout — bold headline + CTAs sitting
// above a near-full-width before/after showcase. The hero
// showcase wrapper uses a slightly wider max width so the
// visual is the obvious focal point on large displays.
// ============================================================

export default function HomePage() {
  return (
    <>
      {/* 1. Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary-dark via-primary to-primary text-white">
        {/* Subtle grid texture so the dark band has depth without
            relying on imagery. Pure CSS, very low contrast. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />

        {/* Headline + CTA */}
        <div className="relative max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 pt-12 sm:pt-16 lg:pt-24">
          <div className="max-w-3xl">
            <p className="text-secondary text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase mb-5 lg:mb-6">
              Remote Digital Services
            </p>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-[5.5rem] font-bold leading-[0.95] tracking-tight">
              Real estate visuals,
              <br />
              ready for the listing.
            </h1>
            <p className="mt-6 lg:mt-8 text-lg sm:text-xl lg:text-2xl text-white/75 leading-snug max-w-2xl">
              Upload your photos, choose what you need, and receive
              market-ready files in 24-48 hours. No subscriptions, no
              surprises.
            </p>
            <div className="mt-8 lg:mt-10 flex flex-wrap gap-3">
              <Link
                href="/order"
                className="inline-flex items-center gap-2 px-7 lg:px-8 py-3.5 lg:py-4 bg-secondary text-primary-dark font-bold rounded-lg hover:bg-secondary-light transition-colors text-sm lg:text-base"
              >
                Order Online
                <ArrowRight className="w-4 h-4 lg:w-5 lg:h-5" aria-hidden />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center px-7 lg:px-8 py-3.5 lg:py-4 border border-white/40 text-white font-bold rounded-lg hover:bg-white/10 transition-colors text-sm lg:text-base"
              >
                See Pricing
              </Link>
            </div>
          </div>
        </div>

        {/* Showcase — wider container so the visual feels near full-bleed */}
        <div className="relative max-w-[1640px] mx-auto px-4 sm:px-6 lg:px-12 pt-12 lg:pt-16 pb-12 lg:pb-20">
          <BeforeAfterShowcase />
        </div>
      </section>

      {/* 2. Headline transition */}
      <section className="py-14 lg:py-24 bg-white">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-4">
              For Listing Teams &amp; Agents
            </p>
            <h2 className="text-4xl lg:text-6xl font-bold text-primary tracking-tight leading-[1.02]">
              Professional Real Estate Visual Services
            </h2>
            <p className="mt-6 text-lg lg:text-2xl text-muted leading-snug max-w-3xl">
              Virtual staging, photo editing, floor plans, renovation
              concepts, 360 visuals, and local media for market-ready
              property listings.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Benefits row */}
      <BenefitsRow />

      {/* 4. Service grid */}
      <ServiceGrid />

      {/* 5. How it works */}
      <HowItWorksDetailed />

      {/* 6. About PicchuSpot */}
      <AboutPicchuSpot />

      {/* 7. Testimonials */}
      <Testimonials />

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
