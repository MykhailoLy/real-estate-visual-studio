import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import ServicePlaceholder, {
  type ServiceVariant,
} from "./ServicePlaceholder";

// ============================================================
// REMOTE DIGITAL SERVICES — "This is what we do" grid
//
// Each card is a single link wrapping a generous before/after
// visual + name + price + description. No inner CTAs — the
// whole card is the CTA, which keeps the grid feeling like a
// portfolio rather than an order form.
//
// Routes match the second-row navigation: every service has its
// own pricing/detail page. The Order CTA inside those pricing
// pages routes to the appropriate existing order form (the
// real-estate-photo-editing family all share /order/photo-editing
// per the latest spec).
// ============================================================

interface ServiceEntry {
  /** Anchor used for `id=...` so deep-links from elsewhere keep
   *  working; not used by the second-row sub-nav anymore. */
  id: string;
  variant: ServiceVariant;
  name: string;
  description: string;
  /** Display string for the price line. Empty = "Request a quote". */
  price?: string;
  /** Single destination for the whole card. */
  href: string;
}

const SERVICES: ServiceEntry[] = [
  {
    id: "image-enhancement",
    variant: "image-enhancement",
    name: "Image Enhancement",
    description:
      "Color, exposure, and window correction so listing photos look bright, crisp, and natural.",
    price: "From US$2.00 / image",
    href: "/pricing/image-enhancement",
  },
  {
    id: "day-to-dusk",
    variant: "day-to-dusk",
    name: "Day to Dusk",
    description:
      "Turn a daytime exterior into a warm dusk shot — perfect for the hero photo of a listing.",
    price: "From US$5.00 / image",
    href: "/pricing/day-to-dusk",
  },
  {
    id: "virtual-staging",
    variant: "virtual-staging",
    name: "Virtual Staging",
    description:
      "Furnish empty rooms with realistic, market-aware styling so buyers can picture the space.",
    price: "From US$19.00 / image",
    href: "/pricing/virtual-staging",
  },
  {
    id: "item-removal",
    variant: "item-removal",
    name: "Item Removal & Virtual Cleaning",
    description:
      "Remove distracting clutter, personal items, or stray objects so the room itself is the star.",
    price: "From US$8.00 / image",
    href: "/pricing/photo-editing",
  },
  {
    id: "floor-plans",
    variant: "floor-plans",
    name: "Floor Plans",
    description:
      "Sketches, existing plans, or photos converted into clean 2D and 3D floor plans for marketing.",
    price: "From US$16.00 / floor",
    href: "/pricing/floor-plans",
  },
  {
    id: "virtual-renovation",
    variant: "virtual-renovation",
    name: "Virtual Renovation",
    description:
      "Show how a kitchen, bathroom, or facade could look after renovation — without lifting a hammer.",
    price: "Option-based pricing",
    href: "/pricing/virtual-renovation",
  },
  {
    id: "360-image-enhancement",
    variant: "panorama-enhancement",
    name: "360° Image Enhancement",
    description:
      "Enhance equirectangular panoramas so every direction reads as listing-quality.",
    href: "/pricing/360-image-enhancement",
  },
  {
    id: "360-virtual-staging",
    variant: "panorama-staging",
    name: "360° Virtual Staging",
    description:
      "Stage furniture inside a 360 panorama so virtual tours show furnished, lived-in spaces.",
    href: "/pricing/360-virtual-staging",
  },
  {
    id: "aerial-editing",
    variant: "aerial-editing",
    name: "Aerial Editing",
    description:
      "Cleaner skies, sharper detail, and balanced color for drone exteriors and listing aerials.",
    price: "Request a quote",
    href: "/pricing/aerial-editing",
  },
  {
    id: "development-site-plans",
    variant: "site-plans",
    name: "Development Site Plans",
    description:
      "Top-down site layouts that show plot boundaries, units, and amenities for development marketing.",
    href: "/pricing/development-site-plans",
  },
];

export default function ServiceGrid() {
  return (
    <section className="py-16 lg:py-28 bg-surface">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="max-w-3xl mb-12 lg:mb-16">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-4">
            What We Do
          </p>
          <h2 className="text-4xl lg:text-6xl font-bold text-primary tracking-tight leading-[1.02]">
            Remote digital services for property listings.
          </h2>
          <p className="mt-6 text-base lg:text-xl text-muted leading-relaxed">
            Tap any service to see pricing, browse styles, and start an order.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10">
          {SERVICES.map((svc) => (
            <ServiceCard key={svc.id} svc={svc} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ServiceCard({ svc }: { svc: ServiceEntry }) {
  const priceText = svc.price ?? "Request a quote";

  return (
    <Link
      href={svc.href}
      id={svc.id}
      className="group relative flex flex-col bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-1 hover:border-primary/40 transition-all duration-300 scroll-mt-32 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
      aria-label={`${svc.name} — ${priceText}`}
    >
      {/* Visual — wide before/after comparison frame.
          Aspect 5:2 gives each side roughly 5:4, suitable for two
          listing photos placed side by side once real before/after
          imagery replaces the placeholder. Keeps the cards compact
          (not tall) while still showing the transformation clearly. */}
      <div className="aspect-[5/2] relative overflow-hidden bg-stone-100">
        <ServicePlaceholder variant={svc.variant} />
        {/* Hover overlay arrow */}
        <span
          aria-hidden
          className="absolute bottom-4 right-4 w-10 h-10 lg:w-11 lg:h-11 rounded-full bg-primary text-white flex items-center justify-center shadow-lg opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300"
        >
          <ArrowUpRight className="w-5 h-5" />
        </span>
      </div>

      {/* Content */}
      <div className="p-6 lg:p-8 flex-1 flex flex-col">
        <h3 className="text-xl lg:text-2xl font-bold text-primary leading-tight tracking-tight group-hover:text-primary-light transition-colors">
          {svc.name}
        </h3>
        <p
          className={
            svc.price
              ? "mt-2 text-sm lg:text-base font-semibold text-secondary-dark"
              : "mt-2 text-sm font-medium text-muted"
          }
        >
          {priceText}
        </p>
        <p className="mt-3 text-sm lg:text-base text-muted leading-relaxed flex-1">
          {svc.description}
        </p>
      </div>
    </Link>
  );
}
