import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/layout/Container";
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
} from "lucide-react";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Remote digital editing services for real estate worldwide and on-location real estate media in Alicante & Costa Blanca. Virtual staging, renovation, floor plans, photo editing, photography, 360 tours, video.",
};

// ============================================================
// REMOTE DIGITAL SERVICES
// ============================================================

const remoteServices = [
  {
    icon: ImagePlus,
    title: "Virtual Staging",
    price: "From US$19 / image",
    description:
      "Transform empty rooms into realistic, furnished spaces with professional styling and market-ready presentation.",
    highlights: [
      "Residential and commercial spaces",
      "Multiple furniture styles",
      "Optional add-ons",
      "Online order available",
    ],
    pricingHref: "/pricing#virtual-staging",
    orderHref: "/order/virtual-staging",
    visualGradient: "from-amber-50 via-stone-50 to-rose-50",
    visualAccent: "text-amber-700/30",
  },
  {
    icon: Paintbrush,
    title: "Virtual Renovation",
    price: "Option-based pricing",
    description:
      "Show renovation potential without construction. Update kitchens, bathrooms, flooring, walls, exteriors, pools, landscaping, and more.",
    highlights: [
      "Internal and external renovation options",
      "Item removal and virtual cleaning",
      "Kitchen and bathroom fit-outs",
      "Custom instructions per image",
    ],
    pricingHref: "/pricing#virtual-renovation",
    orderHref: "/order/virtual-renovation",
    visualGradient: "from-sky-50 via-stone-50 to-emerald-50",
    visualAccent: "text-sky-700/30",
  },
  {
    icon: LayoutGrid,
    title: "2D / 3D Floor Plans",
    price: "From US$16 / floor",
    description:
      "Convert sketches, existing plans, photos, or measurements into clean 2D and 3D floor plans for property marketing.",
    highlights: [
      "2D Black & White",
      "2D Full Colour",
      "3D Floor Plans",
      "2D + 3D Bundle",
    ],
    pricingHref: "/pricing#floor-plans",
    orderHref: "/order/3d-floor-plans",
    visualGradient: "from-slate-50 via-stone-50 to-blue-50",
    visualAccent: "text-slate-700/30",
  },
  {
    icon: SlidersHorizontal,
    title: "Photo Editing & Virtual Cleaning",
    price: "From US$1 / option",
    description:
      "Enhance listing images, remove unwanted objects, correct distractions, add dusk skies, turn on lights, change backgrounds, and clean up spaces.",
    highlights: [
      "Image enhancement",
      "Day to dusk",
      "Item removal",
      "Colour change",
      "Pool water effect",
    ],
    pricingHref: "/pricing#photo-editing",
    orderHref: "/order/photo-editing",
    visualGradient: "from-orange-50 via-stone-50 to-amber-50",
    visualAccent: "text-orange-700/30",
  },
];

// ============================================================
// LOCAL ALICANTE / COSTA BLANCA SERVICES
// ============================================================

const localServices = [
  {
    icon: Camera,
    title: "Real Estate Photography",
    price: "From €129 / 15 edited photos",
    additionalPricing: [
      "From €179 / 25 edited photos",
      "From €239 / 35 edited photos",
      "Custom quote for 50+ photos, villas, luxury properties, exterior-heavy shoots, or urgent delivery.",
    ],
    description:
      "Professional photography for apartments, villas, rentals, and real estate listings.",
    note: null,
    visualGradient: "from-stone-100 via-stone-50 to-amber-50",
    visualAccent: "text-stone-700/30",
  },
  {
    icon: View,
    title: "360 Virtual Tours",
    price: "From €120 / small apartment",
    additionalPricing: null,
    description:
      "Interactive 360 tours for property listings, rentals, and remote buyer previews. Final price depends on property size, number of scan points / panoramas, hosting period, and delivery platform.",
    note: null,
    visualGradient: "from-blue-50 via-stone-50 to-cyan-50",
    visualAccent: "text-blue-700/30",
  },
  {
    icon: Video,
    title: "Property Video Tours",
    price: "From €250 / short walkthrough",
    additionalPricing: null,
    description:
      "Clean walkthrough videos for listings, social media, real estate agencies, and property marketing campaigns. Custom quote for cinematic edits, drone integration, longer videos, or social media versions.",
    note: null,
    visualGradient: "from-rose-50 via-stone-50 to-orange-50",
    visualAccent: "text-rose-700/30",
  },
  {
    icon: Plane,
    title: "Drone / Aerial Photography & Video",
    price: "Quote on request",
    additionalPricing: null,
    description:
      "Available through a licensed specialist where regulations permit. Final price depends on location, flight permissions, property type, scope, and specialist availability.",
    note: "Licensed specialist available by arrangement.",
    visualGradient: "from-indigo-50 via-stone-50 to-sky-50",
    visualAccent: "text-indigo-700/30",
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
      <section className="bg-stone-50 py-20 lg:py-28">
        <Container>
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-5">
              RE Visual Studio Services
            </p>
            <h1 className="text-4xl lg:text-6xl font-bold text-primary mb-6 leading-[1.1] tracking-tight">
              Real Estate Visual Marketing Services
            </h1>
            <p className="text-base lg:text-xl text-muted leading-relaxed mb-10 max-w-3xl mx-auto">
              Remote digital editing services for agents, photographers, and
              property teams worldwide — plus on-location real estate media in
              Alicante &amp; Costa Blanca.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/order"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary-light transition-colors text-sm shadow-sm"
              >
                Order Digital Services
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-7 py-3.5 border border-primary/25 text-primary font-semibold rounded-lg hover:bg-primary hover:text-white hover:border-primary transition-all text-sm"
              >
                Request Local Quote
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* ==================== REMOTE DIGITAL SERVICES ==================== */}
      <section className="py-20 lg:py-28 bg-white">
        <Container>
          <div className="max-w-3xl mx-auto text-center mb-14 lg:mb-16">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
              Worldwide
            </p>
            <h2 className="text-3xl lg:text-4xl font-bold text-primary mb-4 tracking-tight">
              Remote Digital Services
            </h2>
            <p className="text-base lg:text-lg text-muted leading-relaxed">
              Upload your files online and receive market-ready visuals for
              listings, campaigns, and property marketing.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {remoteServices.map((svc) => {
              const Icon = svc.icon;
              return (
                <article
                  key={svc.title}
                  className="group bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 flex flex-col"
                >
                  {/* Image placeholder area */}
                  <div
                    className={`aspect-[16/10] bg-gradient-to-br ${svc.visualGradient} relative overflow-hidden`}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Icon
                        className={`w-28 h-28 ${svc.visualAccent}`}
                        strokeWidth={1.25}
                      />
                    </div>
                    <div className="absolute top-4 left-4">
                      <div className="w-10 h-10 rounded-full bg-white/95 backdrop-blur flex items-center justify-center shadow-sm border border-white">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6 lg:p-8 flex-1 flex flex-col">
                    <h3 className="text-xl lg:text-2xl font-bold text-primary leading-tight mb-2 tracking-tight">
                      {svc.title}
                    </h3>
                    <p className="text-sm font-semibold text-secondary-dark mb-4">
                      {svc.price}
                    </p>
                    <p className="text-sm text-muted leading-relaxed mb-5">
                      {svc.description}
                    </p>
                    <ul className="space-y-2 mb-7">
                      {svc.highlights.map((point) => (
                        <li
                          key={point}
                          className="flex items-start gap-2 text-sm text-foreground"
                        >
                          <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="flex flex-col sm:flex-row gap-3 pt-5 border-t border-stone-100 mt-auto">
                      <Link
                        href={svc.pricingHref}
                        className="flex-1 inline-flex items-center justify-center px-4 py-2.5 border border-stone-200 text-foreground text-sm font-semibold rounded-lg hover:border-primary hover:text-primary transition-colors"
                      >
                        View Pricing
                      </Link>
                      <Link
                        href={svc.orderHref}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-light transition-colors"
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
        </Container>
      </section>

      {/* ==================== LOCAL SERVICES ==================== */}
      <section className="py-20 lg:py-28 bg-stone-50">
        <Container>
          <div className="max-w-3xl mx-auto text-center mb-14 lg:mb-16">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
              Alicante &amp; Costa Blanca
            </p>
            <h2 className="text-3xl lg:text-4xl font-bold text-primary mb-4 tracking-tight">
              Local Real Estate Media in Alicante &amp; Costa Blanca
            </h2>
            <p className="text-base lg:text-lg text-muted leading-relaxed">
              On-location services are priced based on property size, location,
              scope, and required deliverables.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 mb-10">
            {localServices.map((svc) => {
              const Icon = svc.icon;
              return (
                <article
                  key={svc.title}
                  className="group bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 flex flex-col"
                >
                  {/* Image placeholder area */}
                  <div
                    className={`aspect-[16/10] bg-gradient-to-br ${svc.visualGradient} relative overflow-hidden`}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Icon
                        className={`w-28 h-28 ${svc.visualAccent}`}
                        strokeWidth={1.25}
                      />
                    </div>
                    <div className="absolute top-4 left-4">
                      <div className="w-10 h-10 rounded-full bg-white/95 backdrop-blur flex items-center justify-center shadow-sm border border-white">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                    </div>
                    <div className="absolute top-4 right-4">
                      <span className="inline-flex items-center px-2.5 py-1 bg-white/95 backdrop-blur rounded-full text-[11px] font-semibold tracking-wide text-primary border border-white shadow-sm">
                        On-Location
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6 lg:p-8 flex-1 flex flex-col">
                    <h3 className="text-xl lg:text-2xl font-bold text-primary leading-tight mb-2 tracking-tight">
                      {svc.title}
                    </h3>
                    <p className="text-sm font-semibold text-secondary-dark mb-4">
                      {svc.price}
                    </p>

                    {svc.additionalPricing && (
                      <div className="mb-5 p-4 bg-stone-50 border border-stone-200 rounded-lg">
                        <p className="text-[11px] font-semibold tracking-wide uppercase text-muted mb-2">
                          Pricing Tiers
                        </p>
                        <ul className="space-y-1.5">
                          {svc.additionalPricing.map((tier) => (
                            <li
                              key={tier}
                              className="text-xs text-foreground leading-relaxed"
                            >
                              • {tier}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <p className="text-sm text-muted leading-relaxed mb-5">
                      {svc.description}
                    </p>

                    {svc.note && (
                      <p className="text-xs text-foreground bg-stone-100 border border-stone-200 rounded-lg px-3 py-2.5 mb-5 italic">
                        {svc.note}
                      </p>
                    )}

                    <div className="mt-auto pt-5 border-t border-stone-100">
                      <Link
                        href="/contact"
                        className="inline-flex items-center justify-center gap-1.5 w-full px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-light transition-colors"
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

          <p className="text-center text-sm text-muted max-w-3xl mx-auto leading-relaxed">
            Local service prices are starting points. Final quotes are confirmed
            after reviewing the property details, location, required
            deliverables, and availability.
          </p>
        </Container>
      </section>

      {/* ==================== HOW IT WORKS ==================== */}
      <section className="py-20 lg:py-28 bg-white">
        <Container>
          <div className="max-w-3xl mx-auto text-center mb-14 lg:mb-16">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 max-w-5xl mx-auto">
            {/* Digital steps */}
            <div className="bg-stone-50 rounded-2xl p-8 lg:p-10 border border-stone-200">
              <h3 className="text-sm font-semibold tracking-[0.15em] uppercase text-primary border-l-2 border-secondary pl-4 mb-8">
                For Digital Services
              </h3>
              <ol className="space-y-7">
                {digitalSteps.map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <li key={step.title} className="flex gap-5">
                      <div className="flex-shrink-0">
                        <div className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shadow-sm">
                          {i + 1}
                        </div>
                      </div>
                      <div className="pt-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Icon className="w-4 h-4 text-secondary-dark" />
                          <h4 className="font-semibold text-foreground text-base">
                            {step.title}
                          </h4>
                        </div>
                        <p className="text-sm text-muted leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Local steps */}
            <div className="bg-stone-50 rounded-2xl p-8 lg:p-10 border border-stone-200">
              <h3 className="text-sm font-semibold tracking-[0.15em] uppercase text-primary border-l-2 border-secondary pl-4 mb-8">
                For Local Services
              </h3>
              <ol className="space-y-7">
                {localSteps.map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <li key={step.title} className="flex gap-5">
                      <div className="flex-shrink-0">
                        <div className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shadow-sm">
                          {i + 1}
                        </div>
                      </div>
                      <div className="pt-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Icon className="w-4 h-4 text-secondary-dark" />
                          <h4 className="font-semibold text-foreground text-base">
                            {step.title}
                          </h4>
                        </div>
                        <p className="text-sm text-muted leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </Container>
      </section>

      {/* ==================== FINAL CTA ==================== */}
      <section className="bg-primary py-16 lg:py-24">
        <Container>
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary mb-5">
              Get Started
            </p>
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-5 tracking-tight">
              Ready to prepare your property visuals?
            </h2>
            <p className="text-white/70 text-base lg:text-lg mb-10 leading-relaxed">
              Whether you need digital editing or on-location media, we&apos;ll
              deliver market-ready visuals to help your listings stand out.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/order"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-secondary text-primary-dark font-semibold rounded-lg hover:bg-secondary-light transition-colors text-sm shadow-sm"
              >
                Start Online Order
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-7 py-3.5 border border-white/40 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors text-sm"
              >
                Request Local Quote
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
