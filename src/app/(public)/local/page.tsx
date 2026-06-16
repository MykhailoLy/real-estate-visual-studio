import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Container from "@/components/layout/Container";
import CategoryServiceList, {
  type CategoryServiceItem,
} from "@/components/home/CategoryServiceList";
import CtaSection from "@/components/sections/CtaSection";
import { canonicalAlternates } from "@/lib/seo";

// ============================================================
// /local — Local Real Estate Media (Alicante & Costa Blanca)
//
// Placeholder hub page that surfaces the category's second-row
// services. Photography, video, 360 tours, and drone work are
// quote-based today, so every CTA points at /contact. The Header
// component shows the matching second-row sub-nav.
// ============================================================

export const metadata: Metadata = {
  title: "Local Real Estate Media — Alicante & Costa Blanca",
  description:
    "On-location real estate photography, video tours, 360 tours, drone media, and full listing packages across Alicante and Costa Blanca.",
  alternates: canonicalAlternates("/local"),
  openGraph: {
    title: "Local Real Estate Media - Alicante & Costa Blanca",
    description:
      "On-location real estate photography, video tours, 360 tours, drone media, and full listing packages across Alicante and Costa Blanca.",
    url: "/local",
  },
};

const ITEMS: CategoryServiceItem[] = [
  {
    id: "real-estate-photography",
    variant: "local-photography",
    name: "Real Estate Photography",
    description:
      "Professional HDR interiors and exteriors for apartments, villas, and rentals. Edited and listing-ready.",
  },
  {
    id: "360-virtual-tours",
    variant: "local-360-tour",
    name: "360 Virtual Tours",
    description:
      "Walkthrough tours that let buyers explore the property remotely, hosted on the platform of your choice.",
  },
  {
    id: "property-video-tours",
    variant: "local-video",
    name: "Property Video Tours",
    description:
      "Clean walkthrough videos optimised for listings, social media, and agency feeds.",
  },
  {
    id: "drone-aerial-media",
    variant: "local-drone",
    name: "Drone / Aerial Media",
    description:
      "Aerial photography and short videos via a licensed specialist where regulations permit.",
  },
  {
    id: "full-listing-packages",
    variant: "local-package",
    name: "Full Listing Media Packages",
    description:
      "Photography + video + tour bundled into a single shoot so the property is documented end-to-end in one visit.",
  },
];

export default function LocalServicesPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-primary py-14 lg:py-20">
        <Container>
          <div className="max-w-3xl">
            <p className="text-secondary text-xs font-semibold tracking-[0.2em] uppercase mb-4">
              Local Real Estate Media
            </p>
            <h1 className="text-4xl lg:text-6xl font-bold text-white leading-[1.05] tracking-tight">
              On-location media in Alicante &amp; Costa Blanca.
            </h1>
            <p className="mt-5 text-base lg:text-lg text-white/75 leading-relaxed">
              Photography, video, 360 tours, and drone work for properties
              listed across the Costa Blanca region. We come to the
              property, capture everything in a single visit, and deliver
              edited media within 24-48 hours.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-secondary text-primary-dark font-semibold rounded-lg hover:bg-secondary-light transition-colors text-sm"
              >
                Request a Quote
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center px-7 py-3.5 border border-white/40 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors text-sm"
              >
                See All Services
              </Link>
            </div>
          </div>
        </Container>
      </section>

      <CategoryServiceList
        eyebrow="Service Coverage"
        heading="What we shoot on location"
        intro="Local quotes depend on property size, location, scope, and required deliverables. We confirm the exact price in writing before booking."
        items={ITEMS}
      />

      <CtaSection
        title="Booking a property in Alicante or Costa Blanca?"
        subtitle="Send us the address and the deliverables you need — we'll come back with a fixed quote and the next available slot."
        primaryLabel="Request a Quote"
        primaryHref="/contact"
        secondaryLabel="Browse Remote Services"
        secondaryHref="/"
      />
    </>
  );
}
