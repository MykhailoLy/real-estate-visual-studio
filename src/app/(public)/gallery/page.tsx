import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Container from "@/components/layout/Container";
import GalleryCategoryCard from "@/components/gallery/GalleryCategoryCard";
import {
  PORTFOLIO_SERVICES,
  getFeaturedHomeItems,
  getPortfolioPublicUrl,
} from "@/lib/portfolio";
import {
  GALLERY_CARD_DESCRIPTIONS,
} from "@/lib/gallery";
import { localizedAlternates } from "@/lib/seo";

// ============================================================
// /gallery  —  Gallery landing page (EN)
//
// Renders a grid of service category cards. Only categories
// that have at least one published portfolio item are shown.
// The category image is the first featured/published item's
// after-image for that service.
//
// Data flow:
//   getFeaturedHomeItems() → Map<slug, PortfolioItem>
//   Filter PORTFOLIO_SERVICES to slugs in the Map
//   Render one GalleryCategoryCard per visible service
// ============================================================

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "Browse real before-and-after property visual work from PicchuSpot — virtual staging, renovation, floor plans, photo editing, and more.",
  alternates: localizedAlternates({
    canonicalPath: "/gallery",
    englishPath: "/gallery",
    spanishPath: "/es/gallery",
  }),
};

export default async function GalleryPage() {
  const featuredItems = await getFeaturedHomeItems();

  // Only show categories that have at least one published item.
  const visibleServices = PORTFOLIO_SERVICES.filter((svc) =>
    featuredItems.has(svc.slug)
  );

  return (
    <>
      {/* ── Hero / intro ──────────────────────────────────── */}
      <section className="bg-white border-b border-border">
        <Container className="py-14 lg:py-20">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-4">
              Gallery
            </p>
            <h1 className="text-4xl lg:text-5xl font-bold text-primary tracking-tight leading-[1.05] mb-5">
              Gallery
            </h1>
            <p className="text-base lg:text-lg text-muted leading-relaxed max-w-2xl">
              Real before-and-after examples of PicchuSpot property visual
              work. Select a service category to browse published examples.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Category grid ─────────────────────────────────── */}
      {visibleServices.length > 0 ? (
        <section className="bg-stone-50 py-12 lg:py-16">
          <Container>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
              {visibleServices.map((svc) => {
                const item = featuredItems.get(svc.slug)!;
                const imageUrl = getPortfolioPublicUrl(item.after_image_path);
                return (
                  <GalleryCategoryCard
                    key={svc.slug}
                    href={`/gallery/${svc.slug}`}
                    imageUrl={imageUrl}
                    imageAlt={
                      item.after_alt ?? `${svc.label} after example`
                    }
                    title={svc.label}
                    description={GALLERY_CARD_DESCRIPTIONS[svc.slug]}
                  />
                );
              })}
            </div>
          </Container>
        </section>
      ) : (
        /* ── Empty state ─────────────────────────────────── */
        <section className="bg-white py-16 lg:py-24">
          <Container>
            <div className="max-w-2xl">
              <p className="text-base lg:text-lg text-muted leading-relaxed mb-8">
                Gallery examples are published through the PicchuSpot admin
                workflow and will appear here once available. In the meantime,
                explore our services or get in touch to request samples.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/services"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary-light transition-colors text-sm"
                >
                  View Services
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 px-6 py-3 border border-border text-primary font-bold rounded-lg hover:border-primary/40 hover:bg-surface transition-colors text-sm"
                >
                  Contact Us
                </Link>
              </div>
            </div>
          </Container>
        </section>
      )}

      {/* ── Bottom CTA ────────────────────────────────────── */}
      <section className="bg-primary text-white">
        <Container className="py-12 lg:py-16">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 lg:gap-10">
            <div className="lg:max-w-2xl">
              <h2 className="text-2xl lg:text-3xl font-bold leading-tight mb-2">
                Ready to prepare your listing visuals?
              </h2>
              <p className="text-base text-white/75 leading-relaxed">
                Order online in minutes. Upload your photos and choose the
                service — we deliver in 24–48 hours.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:flex-shrink-0">
              <Link
                href="/order"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary font-bold rounded-lg hover:bg-stone-50 transition-colors text-sm shadow-sm"
              >
                Order Online
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center px-6 py-3 border border-white/30 text-white font-bold rounded-lg hover:border-white/60 hover:bg-white/10 transition-colors text-sm"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
