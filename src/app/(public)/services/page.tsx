import type { Metadata } from "next";
import Link from "next/link";
import { CatalogPriceText } from "@/components/pricing/currency-client";
import {
  formatLocalPricingRow,
  getLocalPricingPresentation,
  type LocalPricingServiceId,
} from "@/lib/pricing/local-catalog";
import type { PriceKey } from "@/lib/pricing/types";
import {
  ImagePlus,
  Paintbrush,
  LayoutGrid,
  SlidersHorizontal,
  Camera,
  View,
  Video,
  Plane,
  Upload,
  ListChecks,
  Download,
  MessageCircle,
  CheckCircle,
  Calendar,
  Check,
  ArrowRight,
  Play,
} from "lucide-react";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Services",
  description:
    "Remote digital editing services for real estate worldwide and on-location real estate media in Alicante & Costa Blanca. Virtual staging, renovation, floor plans, photo editing, photography, 360 tours, video.",
  canonicalPath: "/services",
  spanishPath: "/es/services",
});

// ============================================================
// LAYOUT HELPER — wider container than the default
// ============================================================

function Wide({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12 ${className}`}
    >
      {children}
    </div>
  );
}


// ============================================================
// SERVICE IMAGE PLACEHOLDER
// Each variant is designed to look like a future real image.
// Drop in real photos by swapping the inner content per variant.
// ============================================================

type PlaceholderVariant =
  | "staging"
  | "renovation"
  | "floor-plan"
  | "editing"
  | "photography"
  | "tour-360"
  | "video"
  | "drone";

function ServicePlaceholder({ variant }: { variant: PlaceholderVariant }) {
  switch (variant) {
    case "staging":
      return (
        <div className="absolute inset-0 flex">
          <div className="w-1/2 bg-gradient-to-br from-stone-200 via-stone-200 to-stone-300 flex items-end justify-center pb-4">
            <span className="text-xs font-bold tracking-[0.12em] text-stone-700 uppercase bg-white/85 backdrop-blur px-2.5 py-1 rounded-full">
              Before
            </span>
          </div>
          <div className="w-1/2 bg-gradient-to-br from-amber-50 via-orange-100 to-stone-200 flex items-end justify-center pb-4">
            <span className="text-xs font-bold tracking-[0.12em] text-primary uppercase bg-white/85 backdrop-blur px-2.5 py-1 rounded-full">
              After
            </span>
          </div>
        </div>
      );

    case "renovation":
      return (
        <div className="absolute inset-0 flex">
          <div className="w-1/2 bg-gradient-to-br from-stone-300 via-stone-300 to-stone-400 flex items-end justify-center pb-4">
            <span className="text-xs font-bold tracking-[0.12em] text-stone-800 uppercase bg-white/85 backdrop-blur px-2.5 py-1 rounded-full">
              Existing
            </span>
          </div>
          <div className="w-1/2 bg-gradient-to-br from-emerald-50 via-sky-50 to-stone-100 flex items-end justify-center pb-4">
            <span className="text-xs font-bold tracking-[0.12em] text-primary uppercase bg-white/85 backdrop-blur px-2.5 py-1 rounded-full">
              Renovated
            </span>
          </div>
        </div>
      );


    case "floor-plan":
      return (
        <div className="absolute inset-0 bg-slate-50">
          <div
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                "linear-gradient(rgba(15,36,64,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(15,36,64,0.12) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
          <div className="absolute inset-x-10 inset-y-8 lg:inset-x-16 lg:inset-y-12">
            <div className="relative h-full border-2 border-primary/40 rounded-sm bg-white/30">
              <div className="absolute top-1/2 left-0 right-1/3 h-0.5 bg-primary/30" />
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-primary/30" />
              <div className="absolute right-1/3 top-1/2 bottom-0 w-0.5 bg-primary/30" />
            </div>
          </div>
        </div>
      );

    case "editing":
      return (
        <div className="absolute inset-0 flex">
          <div className="w-1/2 bg-gradient-to-br from-stone-500 via-stone-400 to-stone-500 flex items-end justify-center pb-4 saturate-50">
            <span className="text-xs font-bold tracking-[0.12em] text-white uppercase bg-stone-900/60 backdrop-blur px-2.5 py-1 rounded-full">
              Original
            </span>
          </div>
          <div className="w-1/2 bg-gradient-to-br from-orange-100 via-amber-100 to-rose-100 flex items-end justify-center pb-4">
            <span className="text-xs font-bold tracking-[0.12em] text-primary uppercase bg-white/85 backdrop-blur px-2.5 py-1 rounded-full">
              Enhanced
            </span>
          </div>
        </div>
      );

    case "photography":
      return (
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-orange-100 to-rose-100">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.5)_0%,transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(15,36,64,0.15)_100%)]" />
        </div>
      );


    case "tour-360":
      return (
        <div className="absolute inset-0 bg-gradient-to-br from-sky-50 via-cyan-50 to-blue-100">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[72%] aspect-square rounded-full border-2 border-blue-400/40" />
            <div className="absolute w-[52%] aspect-square rounded-full border-2 border-blue-500/35" />
            <div className="absolute w-[32%] aspect-square rounded-full border border-blue-600/30" />
            <div className="absolute w-3 h-3 rounded-full bg-blue-600/60" />
          </div>
        </div>
      );

    case "video":
      return (
        <div className="absolute inset-0 bg-gradient-to-br from-stone-700 via-stone-600 to-[#0f2440]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.12)_0%,transparent_60%)]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-white/95 flex items-center justify-center shadow-2xl">
              <Play className="w-7 h-7 text-primary fill-primary translate-x-0.5" />
            </div>
          </div>
        </div>
      );

    case "drone":
      return (
        <div className="absolute inset-0 bg-gradient-to-b from-sky-300 via-sky-200 to-stone-200">
          <div className="absolute bottom-1/3 left-0 right-0 h-px bg-stone-500/40" />
          <div className="absolute bottom-1/3 left-[15%] right-[15%] h-[22%] flex items-end justify-center gap-1.5">
            <div className="w-4 h-1/2 bg-stone-500/50 rounded-t-sm" />
            <div className="w-5 h-3/4 bg-stone-500/50 rounded-t-sm" />
            <div className="w-3 h-2/3 bg-stone-500/50 rounded-t-sm" />
            <div className="w-6 h-full bg-stone-500/50 rounded-t-sm" />
            <div className="w-4 h-1/2 bg-stone-500/50 rounded-t-sm" />
          </div>
        </div>
      );
  }
}


// ============================================================
// REMOTE DIGITAL SERVICES
// ============================================================

type RemoteService = {
  variant: PlaceholderVariant;
  icon: typeof ImagePlus;
  title: string;
  priceKey?: PriceKey;
  priceLabel?: string;
  pricePrefix?: string;
  priceSuffix?: string;
  description: string;
  highlights: string[];
  pricingHref: string;
  orderHref: string;
};

function RemotePrice({ service }: { service: RemoteService }) {
  if (!service.priceKey) return service.priceLabel ?? "Option-based pricing";

  return (
    <CatalogPriceText
      priceKey={service.priceKey}
      prefix={service.pricePrefix}
      suffix={service.priceSuffix}
    />
  );
}

const remoteServices: RemoteService[] = [
  {
    variant: "staging",
    icon: ImagePlus,
    title: "Virtual Staging",
    priceKey: "virtual-staging",
    pricePrefix: "From ",
    priceSuffix: " / image",
    description:
      "Transform empty rooms into realistic, furnished spaces with professional styling and market-ready presentation.",
    highlights: [
      "Residential and commercial spaces",
      "Multiple furniture styles",
      "Optional add-ons",
      "Online order available",
    ],
    pricingHref: "/pricing/virtual-staging",
    orderHref: "/order/virtual-staging",
  },
  {
    variant: "renovation",
    icon: Paintbrush,
    title: "Virtual Renovation",
    priceLabel: "Option-based pricing",
    description:
      "Show renovation potential without construction. Update kitchens, bathrooms, flooring, walls, exteriors, pools, landscaping, and more.",
    highlights: [
      "Internal and external renovation options",
      "Item removal and virtual cleaning",
      "Kitchen and bathroom fit-outs",
      "Custom instructions per image",
    ],
    pricingHref: "/pricing/virtual-renovation",
    orderHref: "/order/virtual-renovation",
  },

  {
    variant: "floor-plan",
    icon: LayoutGrid,
    title: "2D / 3D Floor Plans",
    priceKey: "floor-plan-2d-bw",
    pricePrefix: "From ",
    priceSuffix: " / floor",
    description:
      "Convert sketches, existing plans, photos, or measurements into clean 2D and 3D floor plans for property marketing.",
    highlights: [
      "2D Black & White",
      "2D Full Colour",
      "3D Floor Plans",
      "2D + 3D Bundle",
    ],
    pricingHref: "/pricing/floor-plans",
    orderHref: "/order/3d-floor-plans",
  },
  {
    variant: "editing",
    icon: SlidersHorizontal,
    title: "Photo Editing & Virtual Cleaning",
    priceKey: "turn-on-lights",
    pricePrefix: "From ",
    priceSuffix: " / option",
    description:
      "Enhance listing images, remove unwanted objects, correct distractions, add dusk skies, turn on lights, change backgrounds, and clean up spaces.",
    highlights: [
      "Image enhancement",
      "Day to dusk",
      "Item removal",
      "Colour change",
      "Pool water effect",
    ],
    pricingHref: "/pricing/photo-editing",
    orderHref: "/order/photo-editing",
  },
];

// ============================================================
// LOCAL ALICANTE / COSTA BLANCA SERVICES
// ============================================================

type LocalService = {
  variant: PlaceholderVariant;
  icon: typeof Camera;
  title: string;
  price: string;
  additionalPricing: string[] | null;
  description: string;
  note: string | null;
};

function getLocalServicePriceLines(serviceId: LocalPricingServiceId) {
  const rows = getLocalPricingPresentation(serviceId, "en").rows;
  const [first, ...additional] = rows;

  return {
    price: formatLocalPricingRow(first),
    additionalPricing:
      additional.length > 0 ? additional.map(formatLocalPricingRow) : null,
  };
}

const photographyPricing = getLocalServicePriceLines("photography");
const tours360Pricing = getLocalServicePriceLines("360-tours");
const videoPricing = getLocalServicePriceLines("video-tours");
const dronePricing = getLocalServicePriceLines("drone-photography");

const localServices: LocalService[] = [
  {
    variant: "photography",
    icon: Camera,
    title: "Real Estate Photography",
    ...photographyPricing,
    description:
      "Professional photography for apartments, villas, rentals, and real estate listings.",
    note: null,
  },
  {
    variant: "tour-360",
    icon: View,
    title: "360 Virtual Tours",
    ...tours360Pricing,
    description:
      "Interactive 360 tours for property listings, rentals, and remote buyer previews. Final price depends on property size, number of scan points / panoramas, hosting period, and delivery platform.",
    note: null,
  },
  {
    variant: "video",
    icon: Video,
    title: "Property Video Tours",
    ...videoPricing,
    description:
      "Clean walkthrough videos for listings, social media, real estate agencies, and property marketing campaigns.",
    note: null,
  },
  {
    variant: "drone",
    icon: Plane,
    title: "Drone / Aerial Photography & Video",
    ...dronePricing,
    description:
      "Available through a licensed specialist where regulations permit. Final price depends on location, flight permissions, property type, scope, and specialist availability.",
    note: "Licensed specialist available by arrangement.",
  },
];


// ============================================================
// HOW IT WORKS STEPS
// ============================================================

const digitalSteps = [
  {
    icon: Upload,
    title: "Upload your files",
    description: "Submit your property photos through our online order form.",
  },
  {
    icon: ListChecks,
    title: "Choose service options",
    description: "Select styles, add-ons, and any specific instructions.",
  },
  {
    icon: Download,
    title: "Receive edited results",
    description: "Get your professionally edited files in 24-48 hours.",
  },
];

const localSteps = [
  {
    icon: MessageCircle,
    title: "Send property details",
    description:
      "Tell us about the property, location, and required deliverables.",
  },
  {
    icon: CheckCircle,
    title: "Confirm scope and availability",
    description: "We confirm the final quote and scheduling.",
  },
  {
    icon: Calendar,
    title: "Schedule the shoot or tour",
    description: "Our team arrives on-location and delivers within 24-48h.",
  },
];


// ============================================================
// PAGE
// ============================================================

export default function ServicesPage() {
  return (
    <>
      {/* ==================== HERO ==================== */}
      <section className="bg-stone-50 relative overflow-hidden">
        <Wide className="py-16 lg:py-24">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 xl:gap-16 items-center">
            {/* Left: text content */}
            <div className="lg:col-span-5">
              <p className="text-public-kicker font-semibold uppercase text-secondary-dark mb-5">
                PicchuSpot Services
              </p>
              <h1 className="text-4xl lg:text-5xl xl:text-[52px] font-bold text-primary mb-6 leading-[1.05] tracking-tight">
                Real Estate Visual Marketing Services
              </h1>
              <p className="text-base lg:text-lg text-muted leading-relaxed mb-10">
                Remote digital editing services for agents, photographers, and
                property teams worldwide — plus on-location real estate media in
                Alicante &amp; Costa Blanca.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/order"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary-light transition-colors text-public-copy-sm shadow-sm"
                >
                  Order Digital Services
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center px-7 py-3.5 border border-primary/25 text-primary font-semibold rounded-lg hover:bg-primary hover:text-white hover:border-primary transition-all text-public-copy-sm"
                >
                  Request Local Quote
                </Link>
              </div>
            </div>


            {/* Right: visual collage (desktop only) */}
            <div className="lg:col-span-7 hidden lg:block">
              <div className="relative h-[480px] xl:h-[560px]">
                {/* Virtual Staging — large, top-left */}
                <div
                  className="absolute top-0 left-0 w-[58%] z-20"
                  style={{ transform: "rotate(-1.5deg)" }}
                >
                  <div className="aspect-[4/3] bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden relative">
                    <ServicePlaceholder variant="staging" />
                  </div>
                  <div className="absolute -bottom-2.5 left-4 px-3 py-1 bg-white rounded-full shadow-md text-xs font-semibold tracking-[0.08em] text-primary border border-stone-200">
                    Virtual Staging
                  </div>
                </div>

                {/* Floor Plan — tall, top-right */}
                <div
                  className="absolute top-8 right-4 w-[42%] z-30"
                  style={{ transform: "rotate(2deg)" }}
                >
                  <div className="aspect-[3/4] bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden relative">
                    <ServicePlaceholder variant="floor-plan" />
                  </div>
                  <div className="absolute -bottom-2.5 left-4 px-3 py-1 bg-white rounded-full shadow-md text-xs font-semibold tracking-[0.08em] text-primary border border-stone-200">
                    Floor Plan
                  </div>
                </div>


                {/* Photography — bottom-left */}
                <div
                  className="absolute bottom-0 left-12 w-[44%] z-30"
                  style={{ transform: "rotate(1deg)" }}
                >
                  <div className="aspect-[4/3] bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden relative">
                    <ServicePlaceholder variant="photography" />
                  </div>
                  <div className="absolute -bottom-2.5 left-4 px-3 py-1 bg-white rounded-full shadow-md text-xs font-semibold tracking-[0.08em] text-primary border border-stone-200">
                    Photography
                  </div>
                </div>

                {/* Photo Editing — bottom-right */}
                <div
                  className="absolute bottom-16 right-0 w-[40%] z-10"
                  style={{ transform: "rotate(-2deg)" }}
                >
                  <div className="aspect-[4/3] bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden relative">
                    <ServicePlaceholder variant="editing" />
                  </div>
                  <div className="absolute -bottom-2.5 left-4 px-3 py-1 bg-white rounded-full shadow-md text-xs font-semibold tracking-[0.08em] text-primary border border-stone-200">
                    Photo Editing
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Wide>
      </section>


      {/* ==================== REMOTE DIGITAL SERVICES ==================== */}
      <section className="py-20 lg:py-28 bg-white">
        <Wide>
          <div className="max-w-3xl mb-14 lg:mb-16">
            <p className="text-public-kicker font-semibold uppercase text-secondary-dark mb-3">
              Worldwide
            </p>
            <h2 className="text-3xl lg:text-4xl font-bold text-primary mb-4 tracking-tight leading-[1.1]">
              Remote Digital Services
            </h2>
            <p className="text-base lg:text-lg text-muted leading-relaxed">
              Upload your files online and receive market-ready visuals for
              listings, campaigns, and property marketing.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
            {remoteServices.map((svc) => {
              const Icon = svc.icon;
              return (
                <article
                  key={svc.title}
                  className="group bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 flex flex-col"
                >
                  {/* Large image area (4:3) */}
                  <div className="aspect-[4/3] relative overflow-hidden">
                    <ServicePlaceholder variant={svc.variant} />
                    <div className="absolute top-5 left-5 z-10">
                      <div className="w-11 h-11 rounded-xl bg-white/95 backdrop-blur flex items-center justify-center shadow-sm">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                    </div>
                  </div>


                  {/* Content */}
                  <div className="p-7 lg:p-10 flex-1 flex flex-col">
                    <h3 className="text-2xl lg:text-3xl font-bold text-primary leading-tight mb-3 tracking-tight">
                      {svc.title}
                    </h3>
                    <p className="text-base lg:text-lg font-semibold text-secondary-dark mb-5">
                      <RemotePrice service={svc} />
                    </p>
                    <p className="text-public-copy-sm lg:text-base text-muted leading-relaxed mb-6">
                      {svc.description}
                    </p>
                    <ul className="space-y-2.5 mb-8">
                      {svc.highlights.map((point) => (
                        <li
                          key={point}
                          className="flex items-start gap-2.5 text-public-copy-sm lg:text-base text-foreground"
                        >
                          <Check className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-stone-100 mt-auto">
                      <Link
                        href={svc.pricingHref}
                        className="flex-1 inline-flex items-center justify-center px-5 py-3 border border-stone-300 text-foreground text-public-copy-sm font-semibold rounded-lg hover:border-primary hover:text-primary transition-colors"
                      >
                        View Pricing
                      </Link>
                      <Link
                        href={svc.orderHref}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-5 py-3 bg-primary text-white text-public-copy-sm font-semibold rounded-lg hover:bg-primary-light transition-colors"
                      >
                        Order Online
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </Wide>
      </section>


      {/* ==================== LOCAL SERVICES ==================== */}
      <section className="py-20 lg:py-28 bg-stone-50">
        <Wide>
          <div className="max-w-3xl mb-14 lg:mb-16">
            <p className="text-public-kicker font-semibold uppercase text-secondary-dark mb-3">
              Alicante &amp; Costa Blanca
            </p>
            <h2 className="text-3xl lg:text-4xl font-bold text-primary mb-4 tracking-tight leading-[1.1]">
              Local Real Estate Media in Alicante &amp; Costa Blanca
            </h2>
            <p className="text-base lg:text-lg text-muted leading-relaxed">
              On-location services are priced based on property size, location,
              scope, and required deliverables.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 mb-12">
            {localServices.map((svc) => {
              const Icon = svc.icon;
              return (
                <article
                  key={svc.title}
                  className="group bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 flex flex-col"
                >
                  {/* Large image area (4:3) */}
                  <div className="aspect-[4/3] relative overflow-hidden">
                    <ServicePlaceholder variant={svc.variant} />
                    <div className="absolute top-5 left-5 z-10">
                      <div className="w-11 h-11 rounded-xl bg-white/95 backdrop-blur flex items-center justify-center shadow-sm">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                    </div>
                    <div className="absolute top-5 right-5 z-10">
                      <span className="inline-flex items-center px-3 py-1.5 bg-white/95 backdrop-blur rounded-full text-xs font-semibold tracking-[0.08em] text-primary shadow-sm">
                        On-Location
                      </span>
                    </div>
                  </div>


                  {/* Content */}
                  <div className="p-7 lg:p-10 flex-1 flex flex-col">
                    <h3 className="text-2xl lg:text-3xl font-bold text-primary leading-tight mb-3 tracking-tight">
                      {svc.title}
                    </h3>
                    <p className="text-base lg:text-lg font-semibold text-secondary-dark mb-5">
                      {svc.price}
                    </p>

                    {svc.additionalPricing && (
                      <div className="mb-6 p-4 lg:p-5 bg-stone-50 border border-stone-200 rounded-xl">
                        <p className="text-public-kicker font-semibold uppercase text-muted mb-2.5">
                          Pricing Tiers
                        </p>
                        <ul className="space-y-2">
                          {svc.additionalPricing.map((tier) => (
                            <li
                              key={tier}
                              className="text-sm lg:text-public-copy-sm text-foreground leading-relaxed flex gap-2"
                            >
                              <span className="text-secondary-dark mt-0.5">•</span>
                              <span>{tier}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <p className="text-public-copy-sm lg:text-base text-muted leading-relaxed mb-5">
                      {svc.description}
                    </p>

                    {svc.note && (
                      <p className="text-public-copy-sm text-foreground bg-stone-100 border border-stone-200 rounded-lg px-4 py-3 mb-5 italic">
                        {svc.note}
                      </p>
                    )}

                    <div className="mt-auto pt-6 border-t border-stone-100">
                      <Link
                        href="/contact"
                        className="inline-flex items-center justify-center gap-1.5 w-full px-5 py-3 bg-primary text-white text-public-copy-sm font-semibold rounded-lg hover:bg-primary-light transition-colors"
                      >
                        Request Quote
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <p className="text-public-copy-sm text-muted max-w-3xl leading-relaxed">
            Local service prices are starting points. Final quotes are confirmed
            after reviewing the property details, location, required
            deliverables, and availability.
          </p>
        </Wide>
      </section>


      {/* ==================== HOW IT WORKS ==================== */}
      <section className="py-20 lg:py-28 bg-white">
        <Wide>
          <div className="max-w-3xl mx-auto text-center mb-14 lg:mb-16">
            <p className="text-public-kicker font-semibold uppercase text-secondary-dark mb-3">
              Process
            </p>
            <h2 className="text-3xl lg:text-4xl font-bold text-primary mb-4 tracking-tight">
              How It Works
            </h2>
            <p className="text-base lg:text-lg text-muted leading-relaxed">
              Simple steps from order to delivery — whether you&apos;re ordering
              remotely or booking on-location.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            <div className="bg-stone-50 rounded-2xl p-8 lg:p-12 border border-stone-200">
              <h3 className="text-sm font-semibold tracking-[0.15em] uppercase text-primary border-l-2 border-secondary pl-4 mb-10">
                For Digital Services
              </h3>
              <ol className="space-y-8">
                {digitalSteps.map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <li key={step.title} className="flex gap-5">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-base shadow-sm">
                          {i + 1}
                        </div>
                      </div>
                      <div className="pt-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Icon className="w-4 h-4 text-secondary-dark" />
                          <h4 className="font-semibold text-foreground text-base lg:text-lg">
                            {step.title}
                          </h4>
                        </div>
                        <p className="text-public-copy-sm lg:text-base text-muted leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>


            <div className="bg-stone-50 rounded-2xl p-8 lg:p-12 border border-stone-200">
              <h3 className="text-sm font-semibold tracking-[0.15em] uppercase text-primary border-l-2 border-secondary pl-4 mb-10">
                For Local Services
              </h3>
              <ol className="space-y-8">
                {localSteps.map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <li key={step.title} className="flex gap-5">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-base shadow-sm">
                          {i + 1}
                        </div>
                      </div>
                      <div className="pt-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Icon className="w-4 h-4 text-secondary-dark" />
                          <h4 className="font-semibold text-foreground text-base lg:text-lg">
                            {step.title}
                          </h4>
                        </div>
                        <p className="text-public-copy-sm lg:text-base text-muted leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </Wide>
      </section>


      {/* ==================== FINAL CTA ==================== */}
      <section className="bg-primary py-20 lg:py-28">
        <Wide>
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-public-kicker font-semibold uppercase text-secondary mb-5">
              Get Started
            </p>
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-5 tracking-tight">
              Ready to prepare your property visuals?
            </h2>
            <p className="text-white/70 text-base lg:text-xl mb-10 leading-relaxed">
              Whether you need digital editing or on-location media, we&apos;ll
              deliver market-ready visuals to help your listings stand out.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/order"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-secondary text-primary-dark font-semibold rounded-lg hover:bg-secondary-light transition-colors text-public-copy-sm shadow-sm"
              >
                Start Online Order
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-8 py-4 border border-white/40 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors text-public-copy-sm"
              >
                Request Local Quote
              </Link>
            </div>
          </div>
        </Wide>
      </section>
    </>
  );
}
