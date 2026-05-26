import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ServicePlaceholder, {
  type ServiceVariant,
} from "./ServicePlaceholder";

// ============================================================
// REMOTE DIGITAL SERVICES — "This is what we do" grid
//
// Each card describes one remote service. Routes follow the
// repository's existing pricing / order pages where they exist;
// the rest surface a "Coming Soon / Request Quote" state that
// links to /contact.
// ============================================================

interface ServiceEntry {
  /** Anchor used by the second-row sub-nav. */
  id: string;
  variant: ServiceVariant;
  name: string;
  description: string;
  /** Display string for the price line. Empty when there is no
   *  public price yet. */
  price?: string;
  /** Internal route for "View Pricing"; null when not available. */
  pricingHref: string | null;
  /** Internal route for "Order Online"; null when not available. */
  orderHref: string | null;
  /** Use a "Request Quote / Coming Soon" CTA instead of order/pricing. */
  comingSoon?: boolean;
}

const SERVICES: ServiceEntry[] = [
  {
    id: "image-enhancement",
    variant: "image-enhancement",
    name: "Image Enhancement",
    description:
      "Color, exposure, and window correction so listing photos look bright, crisp, and natural.",
    price: "From US$1.00 / option",
    pricingHref: "/pricing/photo-editing",
    orderHref: "/order/photo-editing",
  },
  {
    id: "day-to-dusk",
    variant: "day-to-dusk",
    name: "Day to Dusk",
    description:
      "Turn a daytime exterior into a warm dusk shot — perfect for the hero photo of a listing.",
    pricingHref: "/pricing/photo-editing",
    orderHref: "/order/photo-editing",
  },
  {
    id: "virtual-staging",
    variant: "virtual-staging",
    name: "Virtual Staging",
    description:
      "Furnish empty rooms with realistic, market-aware styling so buyers can picture the space.",
    price: "From US$19.00 / image",
    pricingHref: "/pricing/virtual-staging",
    orderHref: "/order/virtual-staging",
  },
  {
    id: "item-removal",
    variant: "item-removal",
    name: "Item Removal & Virtual Cleaning",
    description:
      "Remove distracting clutter, personal items, or stray objects so the room itself is the star.",
    pricingHref: "/pricing/photo-editing",
    orderHref: "/order/photo-editing",
  },
  {
    id: "floor-plans",
    variant: "floor-plans",
    name: "Floor Plans",
    description:
      "Sketches, existing plans, or photos converted into clean 2D and 3D floor plans for marketing.",
    price: "From US$16.00 / floor",
    pricingHref: "/pricing/floor-plans",
    orderHref: "/order/3d-floor-plans",
  },
  {
    id: "virtual-renovation",
    variant: "virtual-renovation",
    name: "Virtual Renovation",
    description:
      "Show how a kitchen, bathroom, or facade could look after renovation — without lifting a hammer.",
    price: "Option-based pricing",
    pricingHref: "/pricing/virtual-renovation",
    orderHref: "/order/virtual-renovation",
  },
  {
    id: "360-image-enhancement",
    variant: "panorama-enhancement",
    name: "360° Image Enhancement",
    description:
      "Enhance equirectangular panoramas so every direction reads as listing-quality.",
    pricingHref: null,
    orderHref: null,
    comingSoon: true,
  },
  {
    id: "360-virtual-staging",
    variant: "panorama-staging",
    name: "360° Virtual Staging",
    description:
      "Stage furniture inside a 360 panorama so virtual tours show furnished, lived-in spaces.",
    pricingHref: null,
    orderHref: null,
    comingSoon: true,
  },
  {
    id: "aerial-editing",
    variant: "aerial-editing",
    name: "Aerial Editing",
    description:
      "Cleaner skies, sharper detail, and balanced color for drone exteriors and listing aerials.",
    pricingHref: "/pricing/photo-editing",
    orderHref: "/order/photo-editing",
  },
  {
    id: "development-site-plans",
    variant: "site-plans",
    name: "Development Site Plans",
    description:
      "Top-down site layouts that show plot boundaries, units, and amenities for development marketing.",
    pricingHref: null,
    orderHref: null,
    comingSoon: true,
  },
];

export default function ServiceGrid() {
  return (
    <section className="py-16 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-10 lg:mb-14">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
            What We Do
          </p>
          <h2 className="text-3xl lg:text-5xl font-bold text-primary tracking-tight leading-[1.1]">
            Remote digital services for property listings
          </h2>
          <p className="mt-4 text-base lg:text-lg text-muted leading-relaxed">
            Every card below has its own pricing or quote flow. Order what you
            need today; come back when you need something different.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {SERVICES.map((svc) => (
            <ServiceCard key={svc.id} svc={svc} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ServiceCard({ svc }: { svc: ServiceEntry }) {
  const isComingSoon = svc.comingSoon === true;
  return (
    <article
      id={svc.id}
      className="group flex flex-col bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 scroll-mt-32"
    >
      {/* Visual */}
      <div className="aspect-[4/3] relative overflow-hidden bg-stone-100">
        <ServicePlaceholder variant={svc.variant} />
        {isComingSoon && (
          <span className="absolute top-3 right-3 inline-flex items-center px-2.5 py-1 rounded-full bg-white/95 backdrop-blur text-[10px] font-bold tracking-[0.18em] uppercase text-secondary-dark shadow-sm">
            Coming Soon
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-5 lg:p-6 flex-1 flex flex-col">
        <h3 className="text-lg lg:text-xl font-bold text-primary leading-tight">
          {svc.name}
        </h3>
        {svc.price ? (
          <p className="mt-1 text-sm font-semibold text-secondary-dark">
            {svc.price}
          </p>
        ) : (
          <p className="mt-1 text-sm font-medium text-muted">
            Request a quote
          </p>
        )}
        <p className="mt-3 text-sm text-muted leading-relaxed flex-1">
          {svc.description}
        </p>

        {/* CTAs */}
        <div className="mt-5 pt-5 border-t border-stone-100 flex flex-col sm:flex-row gap-2">
          {isComingSoon ? (
            <Link
              href="/contact"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-light transition-colors"
            >
              Request Quote
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              {svc.pricingHref && (
                <Link
                  href={svc.pricingHref}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2.5 border border-stone-300 text-foreground text-sm font-semibold rounded-lg hover:border-primary hover:text-primary transition-colors"
                >
                  View Pricing
                </Link>
              )}
              {svc.orderHref && (
                <Link
                  href={svc.orderHref}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-light transition-colors"
                >
                  Order Online
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}
