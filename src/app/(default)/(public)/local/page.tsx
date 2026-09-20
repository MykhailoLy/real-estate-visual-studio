import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  LayoutGrid,
  Plane,
  Video,
  View,
} from "lucide-react";
import Container from "@/components/layout/Container";
import CategoryServiceList, {
  type CategoryServiceItem,
} from "@/components/home/CategoryServiceList";
import CtaSection from "@/components/sections/CtaSection";
import {
  getLocalPricingPresentation,
  type LocalPricingServiceId,
} from "@/lib/pricing/local-catalog";
import { absoluteUrl } from "@/lib/seo";

// ============================================================
// /local — Local Real Estate Media (Alicante & Costa Blanca)
//
// Detailed local-services destination. The image-led /pricing hub and
// second-row navigation land on the pricing cards below; availability
// and booking remain handled through /contact.
// ============================================================

export const metadata: Metadata = {
  title: "Local Real Estate Media — Alicante & Costa Blanca",
  description:
    "On-location real estate photography, video tours, 360 tours, drone media, and full listing packages across Alicante and Costa Blanca.",
  alternates: {
    canonical: absoluteUrl("/local"),
  },
};

const ITEMS: CategoryServiceItem[] = [
  {
    id: "coverage-real-estate-photography",
    variant: "local-photography",
    name: "Real Estate Photography",
    description:
      "Professional HDR interiors and exteriors for apartments, villas, and rentals. Edited and listing-ready.",
  },
  {
    id: "coverage-360-virtual-tours",
    variant: "local-360-tour",
    name: "360 Virtual Tours",
    description:
      "Walkthrough tours that let buyers explore the property remotely, hosted on the platform of your choice.",
  },
  {
    id: "coverage-property-video-tours",
    variant: "local-video",
    name: "Property Video Tours",
    description:
      "Clean walkthrough videos optimised for listings, social media, and agency feeds.",
  },
  {
    id: "coverage-drone-aerial-media",
    variant: "local-drone",
    name: "Drone / Aerial Media",
    description:
      "Aerial photography and short videos via a licensed specialist where regulations permit.",
  },
  {
    id: "coverage-full-listing-packages",
    variant: "local-package",
    name: "Full Listing Media Packages",
    description:
      "Photography + video + tour bundled into a single shoot so the property is documented end-to-end in one visit.",
  },
];

const LOCAL_PRICING_CARDS: readonly {
  id: string;
  serviceId: LocalPricingServiceId;
  icon: typeof Camera;
}[] = [
  {
    id: "real-estate-photography",
    serviceId: "photography",
    icon: Camera,
  },
  {
    id: "360-virtual-tours",
    serviceId: "360-tours",
    icon: View,
  },
  {
    id: "property-video-tours",
    serviceId: "video-tours",
    icon: Video,
  },
  {
    id: "drone-aerial-media",
    serviceId: "drone-photography",
    icon: Plane,
  },
  {
    id: "2d-floor-plan",
    serviceId: "floor-plan-2d",
    icon: LayoutGrid,
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
               property and capture the agreed media in a single visit.
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
                href="/pricing"
                className="inline-flex items-center px-7 py-3.5 border border-white/40 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors text-sm"
              >
                See All Services
              </Link>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-b border-stone-200 bg-stone-50 py-16 lg:py-24">
        <Container>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary-dark">
              Local pricing
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-primary lg:text-5xl">
              Alicante &amp; Costa Blanca packages
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted lg:text-lg">
              Review the current local packages, then contact us to confirm
              availability and book your property.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {LOCAL_PRICING_CARDS.map((card) => {
              const pricing = getLocalPricingPresentation(card.serviceId, "en");
              const Icon = card.icon;

              return (
                <article
                  key={card.serviceId}
                  id={card.id}
                  className="scroll-mt-32 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm lg:p-7"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl font-bold leading-tight text-primary">
                        {pricing.serviceLabel}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-secondary-dark">
                        {pricing.overviewPriceLabel}
                      </p>
                    </div>
                  </div>

                  <ul className="mt-6 divide-y divide-stone-100 border-t border-stone-100">
                    {pricing.rows.map((row) => (
                      <li key={row.id} className="py-3.5 first:pt-4">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                          <div className="text-sm text-foreground">
                            {row.packageLabel && (
                              <span className="font-bold text-primary">
                                {row.packageLabel}
                                {row.detailLabel ? " — " : ""}
                              </span>
                            )}
                            {row.detailLabel}
                          </div>
                          <span className="shrink-0 text-sm font-bold text-primary">
                            {row.priceLabel}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/contact"
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-light"
                  >
                    Request availability
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </article>
              );
            })}
          </div>
        </Container>
      </section>

      <CategoryServiceList
        eyebrow="Service Coverage"
        heading="What we shoot on location"
        intro="Explore the on-location services available for listings across Alicante and Costa Blanca."
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
