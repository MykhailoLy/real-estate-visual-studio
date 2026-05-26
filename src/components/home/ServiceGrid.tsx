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
// portfolio rather than an order form. Routes per spec:
//
//   Image Enhancement, Day to Dusk, Item Removal,
//   Aerial Editing      -> /pricing/photo-editing
//   Virtual Staging     -> /pricing/virtual-staging
//   Virtual Renovation  -> /pricing/virtual-renovation
//   Floor Plans         -> /pricing/floor-plans
//   360° Image Enh.,
//   360° Virtual Staging,
//   Development Site Plans -> /contact (Coming Soon)
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
  /** Single destination for the whole card. */
  href: string;
  /** Surfaces a "Coming Soon" badge and softens the price line. */
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
    href: "/pricing/photo-editing",
  },
  {
    id: "day-to-dusk",
    variant: "day-to-dusk",
    name: "Day to Dusk",
    description:
      "Turn a daytime exterior into a warm dusk shot — perfect for the hero photo of a listing.",
    href: "/pricing/photo-editing",
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
    href: "/contact",
    comingSoon: true,
  },
  {
    id: "360-virtual-staging",
    variant: "panorama-staging",
    name: "360° Virtual Staging",
    description:
      "Stage furniture inside a 360 panorama so virtual tours show furnished, lived-in spaces.",
    href: "/contact",
    comingSoon: true,
  },
  {
    id: "aerial-editing",
    variant: "aerial-editing",
    name: "Aerial Editing",
    description:
      "Cleaner skies, sharper detail, and balanced color for drone exteriors and listing aerials.",
    href: "/pricing/photo-editing",
  },
  {
    id: "development-site-plans",
    variant: "site-plans",
    name: "Development Site Plans",
    description:
      "Top-down site layouts that show plot boundaries, units, and amenities for development marketing.",
    href: "/contact",
    comingSoon: true,
  },
];

export default function ServiceGrid() {
  return (
    <section className="py-16 lg:py-28 bg-white">
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
  const isComingSoon = svc.comingSoon === true;
  const priceText = svc.price ?? (isComingSoon ? "Coming Soon · Request a quote" : "Request a quote");

  return (
    <Link
      href={svc.href}
      id={svc.id}
      className="group relative flex flex-col bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-1 hover:border-primary/40 transition-all duration-300 scroll-mt-32 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
      aria-label={`${svc.name} — ${priceText}`}
    >
      {/* Visual */}
      <div className="aspect-[4/3] md:aspect-[16/10] relative overflow-hidden bg-stone-100">
        <ServicePlaceholder variant={svc.variant} />
        {isComingSoon && (
          <span className="absolute top-4 right-4 inline-flex items-center px-3 py-1.5 rounded-full bg-white/95 backdrop-blur text-[10px] font-bold tracking-[0.18em] uppercase text-secondary-dark shadow-md">
            Coming Soon
          </span>
        )}
        {/* Hover overlay arrow */}
        <span
          aria-hidden
          className="absolute bottom-5 right-5 w-11 h-11 lg:w-12 lg:h-12 rounded-full bg-primary text-white flex items-center justify-center shadow-lg opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300"
        >
          <ArrowUpRight className="w-5 h-5 lg:w-6 lg:h-6" />
        </span>
      </div>

      {/* Content */}
      <div className="p-6 lg:p-10 flex-1 flex flex-col">
        <h3 className="text-2xl lg:text-3xl font-bold text-primary leading-tight tracking-tight group-hover:text-primary-light transition-colors">
          {svc.name}
        </h3>
        <p
          className={
            isComingSoon
              ? "mt-2 lg:mt-3 text-sm lg:text-base font-medium text-muted"
              : "mt-2 lg:mt-3 text-base lg:text-lg font-semibold text-secondary-dark"
          }
        >
          {priceText}
        </p>
        <p className="mt-3 lg:mt-4 text-sm lg:text-base text-muted leading-relaxed flex-1">
          {svc.description}
        </p>
      </div>
    </Link>
  );
}
