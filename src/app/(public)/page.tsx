import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import BeforeAfterShowcase, {
  type ShowcaseSlide,
} from "@/components/home/BeforeAfterShowcase";
import BenefitsRow from "@/components/home/BenefitsRow";
import ServiceGrid from "@/components/home/ServiceGrid";
import HowItWorksDetailed from "@/components/home/HowItWorksDetailed";
import AboutPicchuSpot, {
  type AboutCollageTile,
} from "@/components/home/AboutPicchuSpot";
import Testimonials from "@/components/home/Testimonials";
import CtaSection from "@/components/sections/CtaSection";
import {
  getAboutCollageItems,
  getHomepageSliderItems,
  getSiteMediaPublicUrl,
} from "@/lib/site-media";
import { publicPageMetadata } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import { organizationSchema, webSiteSchema } from "@/lib/structured-data";
import { getBeforeAfterAlt } from "@/lib/before-after-alt";

export const metadata: Metadata = publicPageMetadata({
  title: "Real Estate Visuals for Listings",
  description:
    "Property visuals that make listings stand out. Virtual staging, virtual renovation, floor plans, photo editing, and local real estate media.",
  canonicalPath: "/",
  spanishPath: "/es",
});

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
// Data flow:
//   - The slider and the About collage now read from the
//     admin-managed `site_media_items` table (see /admin/media).
//   - When the table is empty (or Supabase isn't configured),
//     each component falls back to its built-in placeholders so
//     a fresh deploy still ships a polished hero + About section.
//   - This page is rendered as a server component; the slider
//     stays "use client" for autoplay/pause logic.
// ============================================================

export default async function HomePage() {
  // Load admin media in parallel. Both helpers return [] on
  // misconfigured / unreachable Supabase, so neither will throw.
  const [sliderRows, collageRows] = await Promise.all([
    getHomepageSliderItems(),
    getAboutCollageItems(),
  ]);

  const sliderSlides: ShowcaseSlide[] = sliderRows
    .map<ShowcaseSlide | null>((row) => {
      const beforeUrl = getSiteMediaPublicUrl(row.before_image_path);
      const afterUrl = getSiteMediaPublicUrl(row.after_image_path);
      // The DB query already filters out rows missing either
      // path, but a local check makes the URL fallback explicit
      // and keeps TypeScript happy.
      if (!beforeUrl || !afterUrl) return null;
      const alt = getBeforeAfterAlt({
        sharedAlt: row.alt_text,
        title: row.title,
        description: row.description,
        serviceSlug: row.service_slug,
      });
      return {
        kind: "image",
        id: row.id,
        beforeUrl,
        afterUrl,
        beforeAlt: alt.beforeAlt,
        afterAlt: alt.afterAlt,
      };
    })
    .filter((s): s is ShowcaseSlide => s !== null);

  const collageTiles: AboutCollageTile[] = collageRows
    .map<AboutCollageTile | null>((row) => {
      // Pick the most representative image for this row. About
      // collage items are usually plain "image" media_type, but
      // we tolerate other shapes (e.g. an admin reuses a
      // before/after item by surfacing only the after frame).
      const pairAlt = getBeforeAfterAlt({
        sharedAlt: row.alt_text,
        title: row.title,
        description: row.description,
        serviceSlug: row.service_slug,
      });
      const singleAlt = row.alt_text || row.title || "About PicchuSpot";
      const selected = [
        { url: getSiteMediaPublicUrl(row.image_path), alt: singleAlt },
        { url: getSiteMediaPublicUrl(row.after_image_path), alt: pairAlt.afterAlt },
        { url: getSiteMediaPublicUrl(row.before_image_path), alt: pairAlt.beforeAlt },
        { url: getSiteMediaPublicUrl(row.poster_image_path), alt: singleAlt },
        { url: getSiteMediaPublicUrl(row.panorama_image_path), alt: singleAlt },
      ].find((candidate) => candidate.url);
      if (!selected?.url) return null;
      return {
        kind: "image",
        id: row.id,
        url: selected.url,
        alt: selected.alt,
      };
    })
    .filter((t): t is AboutCollageTile => t !== null);

  return (
    <>
      <JsonLd data={[organizationSchema(), webSiteSchema()]} />
      {/* Visually-hidden page-level h1 — first heading in DOM order so
          the document outline starts with exactly one h1 before any
          visible section headings (h2) appear. */}
      <h1 className="sr-only">PicchuSpot Real Estate Visual Services</h1>
      {/* 1. Slider — wide banner strip directly under the nav. */}
      <section className="bg-white overflow-hidden">
        <div className="px-3 sm:px-4 lg:px-2 pt-3 lg:pt-4 pb-2 lg:pb-3">
          <BeforeAfterShowcase slides={sliderSlides} />
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
      <AboutPicchuSpot tiles={collageTiles} />

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
