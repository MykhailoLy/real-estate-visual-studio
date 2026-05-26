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
//   1. Header / two-level nav (sticky, owned by RootLayout)
//   2. Wide low-height before/after slider (banner strip)
//   3. Slider dots
//   4. Why work with PicchuSpot — benefits row
//   5. Remote Digital Services — compact horizontal intro strip
//   6. This is what we do — service grid (2 large cards / row)
//   7. How it works
//   8. About PicchuSpot — collage + narrative
//   9. Testimonials carousel
//  10. Footer CTA
//
// First-viewport rule: at desktop breakpoints the nav, slider,
// dots, and the "Why work with PicchuSpot" benefits row should
// all be visible without scrolling. The slider therefore uses a
// ~5:1 aspect (BeforeAfterShowcase), the slider section uses
// minimal vertical padding, and the Remote Digital Services
// block is reduced to a single-row strip below the benefits.
//
// Section background rhythm intentionally alternates so the page
// reads as a sequence of structured chunks rather than one slab:
//   slider          white
//   benefits        surface
//   intro strip     white
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
        <div className="px-3 sm:px-4 lg:px-2 pt-3 lg:pt-4 pb-2 lg:pb-3">
          <BeforeAfterShowcase />
        </div>
      </section>

      {/* 2. Why work with PicchuSpot — benefits */}
      <BenefitsRow />

      {/* 3. Remote Digital Services — compact horizontal intro strip
            sitting below the benefits. Reads as a transitional band
            into the service grid rather than a full hero. */}
      <section className="bg-white border-y border-border">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 py-8 lg:py-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 lg:gap-10">
            <div className="lg:max-w-2xl">
              <p className="text-secondary-dark text-[11px] sm:text-xs font-semibold tracking-[0.2em] uppercase mb-2">
                Remote Digital Services
              </p>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary leading-tight tracking-tight">
                Help Your Listings Stand Out and Sell Faster
              </h2>
              <p className="mt-2 text-sm sm:text-base lg:text-lg text-muted leading-snug">
                Virtual staging, photo editing, floor plans, 360 visuals, and
                local real estate media for market-ready property listings.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:flex-shrink-0">
              <Link
                href="/order"
                className="inline-flex items-center gap-2 px-6 lg:px-7 py-3 lg:py-3.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-light transition-colors text-sm shadow-sm"
              >
                Order Online
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center px-6 lg:px-7 py-3 lg:py-3.5 border border-stone-300 text-foreground font-bold rounded-lg hover:border-primary hover:text-primary transition-colors text-sm"
              >
                View Services
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 4. This is what we do — service grid (2 large cards per row). */}
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
