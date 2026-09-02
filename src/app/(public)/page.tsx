import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
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
import { getHomeHeroServicePresentation } from "@/lib/pricing/remote-service-presentation";

export const revalidate = 300;

const getCachedHomepageSliderItems = unstable_cache(
  getHomepageSliderItems,
  ["homepage-slider-items-v1"],
  { revalidate: 300 },
);

const getCachedAboutCollageItems = unstable_cache(
  getAboutCollageItems,
  ["homepage-about-collage-items-v1"],
  { revalidate: 300 },
);

export const metadata: Metadata = publicPageMetadata({
  title: "Real Estate Photo Editing & Virtual Staging",
  description:
    "Professional real estate photo editing, virtual staging, day-to-dusk, item removal, virtual renovation, floor plans and 360° image enhancement.",
  canonicalPath: "/",
  spanishPath: "/es",
});

// ============================================================
// HOME
//
// Section order:
//   1. Header / two-level nav (sticky, owned by PublicLayout)
//   2. Before/After slider — visual demonstration banner strip
//   3. SEO intro — visible H1 + supporting paragraph
//   4. Compact benefits row
//   5. Remote Digital Services — service grid (what we do)
//   6. How It Works
//   7. Help Your Listings Stand Out — results / CTA strip
//   8. About PicchuSpot — collage + narrative
//   9. Testimonials carousel
//  10. Final CTA — navy block
//  11. Footer (owned by PublicLayout)
//
// Data flow:
//   - The slider and the About collage read from the
//     admin-managed `site_media_items` table (see /admin/media).
//   - When the table is empty (or Supabase isn't configured),
//     each component falls back to its built-in placeholders so
//     a fresh deploy still ships a polished page.
//   - This page is rendered as a server component; the slider
//     and Testimonials stay "use client" for interactivity.
// ============================================================

export default async function HomePage() {
  // Load admin media in parallel. Both helpers return [] on
  // misconfigured / unreachable Supabase, so neither will throw.
  const [sliderRows, collageRows] = await Promise.all([
    getCachedHomepageSliderItems(),
    getCachedAboutCollageItems(),
  ]);

  const sliderSlides: ShowcaseSlide[] = sliderRows
    .map<ShowcaseSlide | null>((row) => {
      const beforeUrl = getSiteMediaPublicUrl(row.before_image_path);
      const afterUrl = getSiteMediaPublicUrl(row.after_image_path);
      // The DB query already filters out rows missing either
      // path, but a local check makes the URL fallback explicit
      // and keeps TypeScript happy.
      if (!beforeUrl || !afterUrl) return null;
      const service = getHomeHeroServicePresentation(row.service_slug, "en");
      const alt = getBeforeAfterAlt({
        sharedAlt: row.alt_text,
        title: row.title,
        description: row.description,
        serviceLabel: service?.name,
        serviceSlug: row.service_slug,
      });
      return {
        kind: "image",
        id: row.id,
        beforeUrl,
        afterUrl,
        beforeAlt: alt.beforeAlt,
        afterAlt: alt.afterAlt,
        serviceSlug: row.service_slug,
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

      {/* 1. Slider — wide banner strip directly under the nav. */}
      <section className="bg-white overflow-hidden">
        <div className="px-3 pt-3 sm:px-4 lg:px-2 lg:pt-4">
          <BeforeAfterShowcase slides={sliderSlides} />
        </div>
      </section>

      {/* 2. SEO introduction — visible H1 and supporting paragraph.
            Compact band that tells users and search engines what the
            page is about without pushing the service content down. */}
      <section className="bg-white border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 py-6 lg:py-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary leading-tight tracking-tight">
            Real Estate Photo Editing, Virtual Staging &amp; Floor Plans
          </h1>
          <p className="mt-3 text-sm sm:text-base lg:text-lg text-muted leading-relaxed max-w-4xl">
            Create listing-ready visuals with professional image enhancement,
            day-to-dusk editing, virtual staging, item removal, virtual
            renovation, floor plans, and 360° image enhancement. Built for real
            estate agents, photographers, property managers, and marketing
            teams.
          </p>
        </div>
      </section>

      {/* 3. Compact supporting proof strip. */}
      <BenefitsRow />

      {/* 4. Remote Digital Services — service grid (what we do). */}
      <ServiceGrid />

      {/* 5. How It Works. */}
      <HowItWorksDetailed />

      {/* 6. Help Your Listings Stand Out — results / CTA strip. */}
      <section className="bg-white border-y border-border">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 py-8 lg:py-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 lg:gap-10">
            <div className="lg:max-w-2xl">
              <p className="text-secondary-dark text-public-kicker font-semibold uppercase mb-2">
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
                className="inline-flex items-center gap-2 px-6 lg:px-7 py-3 lg:py-3.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-light transition-colors text-public-copy-sm shadow-sm"
              >
                Order Online
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center px-6 lg:px-7 py-3 lg:py-3.5 border border-stone-300 text-foreground font-bold rounded-lg hover:border-primary hover:text-primary transition-colors text-public-copy-sm"
              >
                View Services
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 7. About PicchuSpot — collage + narrative. */}
      <AboutPicchuSpot tiles={collageTiles} />

      {/* 8. Testimonials carousel. */}
      <Testimonials />

      {/* 9. Final CTA — navy block. */}
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
