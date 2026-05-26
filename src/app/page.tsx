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
// Final section order (post-refinement):
//   1. Header / two-level nav (sticky)
//   2. Wide low-height before/after slider (banner strip)
//   3. Why work with PicchuSpot — benefits row
//   4. Remote Digital Services — hero text + CTAs
//   5. This is what we do — service grid
//   6. How it works
//   7. About PicchuSpot — collage + narrative
//   8. Testimonials carousel
//   9. Footer CTA
//
// Section background rhythm intentionally alternates so the page
// reads as a sequence of structured chunks rather than one slab:
//   slider          white
//   benefits        surface
//   hero text       white
//   service grid    surface
//   how it works    white
//   about           surface
//   testimonials    white
//   final cta       primary (navy)
//
// Each child component owns its own background; this file simply
// places them in the right order.
// ============================================================

export default function HomePage() {
  return (
    <>
      {/* 1. Slider — wide banner strip directly under the nav. */}
      <section className="bg-white">
        <div className="px-3 sm:px-4 lg:px-2 pt-4 lg:pt-6 pb-2 lg:pb-4">
          <BeforeAfterShowcase />
        </div>
      </section>

      {/* 2. Why work with PicchuSpot — benefits */}
      <BenefitsRow />

      {/* 3. Remote Digital Services — hero text block */}
      <section className="bg-white py-14 lg:py-20">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12">
          <div className="max-w-3xl">
            <p className="text-secondary-dark text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase mb-5 lg:mb-6">
              Remote Digital Services
            </p>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-primary leading-[1.02] tracking-tight">
              Help Your Listings Stand Out and Sell Faster
            </h2>
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

      {/* 4. This is what we do — service grid (bg flipped to surface
            for clean alternation against the white hero block above). */}
      <ServiceGrid />

      {/* 5. How it works (bg flipped to white). */}
      <HowItWorksDetailed />

      {/* 6. About PicchuSpot — collage + narrative (bg flipped to surface). */}
      <AboutPicchuSpot />

      {/* 7. Testimonials carousel (bg flipped to white). */}
      <Testimonials />

      {/* 8. Final CTA — navy block. */}
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
