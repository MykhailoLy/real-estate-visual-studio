import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/layout/Container";
import SectionHeader from "@/components/sections/SectionHeader";
import CtaSection from "@/components/sections/CtaSection";
import {
  ImagePlus,
  Paintbrush,
  LayoutGrid,
  SlidersHorizontal,
  Eraser,
  Camera,
  View,
  Video,
  Plane,
  MapPin,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Virtual staging, photo editing, 3D floor plans, professional photography, drone video & 360 tours for real estate agents and developers.",
};

const remoteServices = [
  {
    icon: ImagePlus,
    title: "Virtual Staging",
    description:
      "Transform empty rooms into beautifully furnished spaces. Choose from 9 interior styles including Modern, Scandinavian, Hamptons, and more. Help buyers visualize their future home.",
    deliverables: [
      "Photorealistic furnished renders",
      "9 furniture style options",
      "Optional add-ons (day to dusk, item removal, etc.)",
      "1 revision included",
      "High-resolution JPG delivery",
    ],
    price: "US$19.00 / image",
    href: "/order/virtual-staging",
    ctaLabel: "Order Virtual Staging",
  },
  {
    icon: Paintbrush,
    title: "Virtual Renovation",
    description:
      "Show buyers the potential of outdated properties. Digitally renovate kitchens, bathrooms, flooring, walls, and exteriors. Add pools, landscaping, or complete fit-outs.",
    deliverables: [
      "12 internal renovation options",
      "15 external renovation options",
      "Presentation style selection",
      "1 revision included",
      "High-resolution JPG delivery",
    ],
    price: "From US$3.00 / option",
    href: "/order/virtual-renovation",
    ctaLabel: "Order Virtual Renovation",
  },
  {
    icon: LayoutGrid,
    title: "2D / 3D Floor Plans",
    description:
      "Help buyers understand property layout and flow. We create accurate, professionally styled floor plans from your sketches, photos, or existing plans.",
    deliverables: [
      "2D Black & White or Full Colour",
      "3D photorealistic floor plans",
      "2D + 3D bundle option",
      "Custom flooring & finishes per room",
      "PDF + JPG delivery",
    ],
    price: "From US$16.00 / floor",
    href: "/order/3d-floor-plans",
    ctaLabel: "Order Floor Plans",
  },
  {
    icon: SlidersHorizontal,
    title: "Real Estate Photo Editing",
    description:
      "Professional image enhancement, sky replacement, HDR blending, and color correction. Make every listing photo look its best before publishing.",
    deliverables: [
      "Image enhancement & color correction",
      "Sky replacement",
      "Day to dusk conversion",
      "Turn on lights effect",
      "High-resolution delivery",
    ],
    price: "From US$1.00 / option",
    href: "/order/photo-editing",
    ctaLabel: "Order Photo Editing",
  },
  {
    icon: Eraser,
    title: "Decluttering / Object Removal",
    description:
      "Remove furniture, personal items, clutter, and distractions from property photos. Clean images help buyers focus on the space itself.",
    deliverables: [
      "Objects removed cleanly",
      "Realistic background reconstruction",
      "Works with any room type",
      "High-resolution JPG delivery",
      "24-48h turnaround",
    ],
    price: "US$8.00 / image",
    href: "/order/photo-editing",
    ctaLabel: "Order Decluttering",
  },
];

const localServices = [
  {
    icon: Camera,
    title: "Real Estate Photography",
    description:
      "Professional HDR real estate photography that makes every listing shine. We capture interiors, exteriors, and detail shots with calibrated lighting and wide-angle lenses.",
    deliverables: [
      "Professional HDR photos",
      "Interior + exterior coverage",
      "Color-corrected and edited",
      "Delivered within 24-48h",
      "Commercial usage rights",
    ],
    price: "From €129 / 15 photos",
  },
  {
    icon: View,
    title: "360 Virtual Tours",
    description:
      "Immersive 360° property tours that let buyers explore remotely. Perfect for international buyers, premium listings, and off-plan developments.",
    deliverables: [
      "Full 360° interactive tour",
      "Hosted online with shareable link",
      "Embeddable on listing portals",
      "Mobile-friendly viewer",
      "Multi-room navigation",
    ],
    price: "From €120 / property",
  },
  {
    icon: Video,
    title: "Property Video Tours",
    description:
      "Cinematic walkthrough videos that bring listings to life. Professional editing, smooth movement, and background music create an emotional connection with buyers.",
    deliverables: [
      "1-2 minute cinematic video",
      "Professional color grading",
      "Licensed background music",
      "Multiple formats (web, social, portal)",
      "4K resolution available",
    ],
    price: "From €250 / property",
  },
  {
    icon: Plane,
    title: "Drone / Aerial Photography & Video",
    description:
      "Stunning aerial perspectives that showcase properties and their surroundings. Ideal for villas, estates, developments, and properties with views or large plots.",
    deliverables: [
      "Aerial photos + video",
      "Property & neighborhood context",
      "4K resolution",
      "Licensed drone operator",
      "Available where regulations permit",
    ],
    price: "Quote on request",
    note: "Available through a licensed specialist where regulations permit. Price depends on location, flight permissions, and scope.",
  },
];

const serviceAreaCities = [
  "Alicante",
  "Benidorm",
  "Torrevieja",
  "Javea",
  "Denia",
  "Calpe",
  "Orihuela Costa",
  "Elche",
  "Santa Pola",
  "Villajoyosa",
  "Altea",
  "Moraira",
  "Guardamar del Segura",
  "Campello",
  "San Juan",
];

export default function ServicesPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-primary py-16 lg:py-24">
        <Container>
          <div className="max-w-3xl">
            <h1 className="text-3xl lg:text-5xl font-bold text-white mb-4">
              Complete Visual Marketing for Real Estate
            </h1>
            <p className="text-lg text-white/75 leading-relaxed">
              Digital editing services for agents worldwide. Professional
              on-location photography and video in Alicante & Costa Blanca.
            </p>
          </div>
        </Container>
      </section>

      {/* Remote Digital Services */}
      <section className="py-16 lg:py-24">
        <Container>
          <SectionHeader
            title="Remote Digital Services — Order from Anywhere"
            subtitle="Upload your property photos, select your preferences, and receive professionally edited results in 24-48 hours. Available worldwide."
            align="left"
          />

          <div className="space-y-8">
            {remoteServices.map((service) => {
              const Icon = service.icon;
              return (
                <div
                  key={service.title}
                  className="bg-white border border-border rounded-2xl p-6 lg:p-8 flex flex-col lg:flex-row gap-6"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <h3 className="text-lg font-bold text-foreground">
                        {service.title}
                      </h3>
                    </div>
                    <p className="text-sm text-muted leading-relaxed mb-4">
                      {service.description}
                    </p>
                    <ul className="space-y-1.5 mb-5">
                      {service.deliverables.map((item) => (
                        <li
                          key={item}
                          className="text-sm text-foreground flex items-start gap-2"
                        >
                          <span className="text-primary mt-1">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={service.href}
                      className="inline-flex px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-light transition-colors"
                    >
                      {service.ctaLabel} →
                    </Link>
                  </div>
                  <div className="lg:w-48 flex-shrink-0 flex items-start justify-end">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">
                        {service.price.split(" / ")[0]}
                      </p>
                      <p className="text-xs text-muted">
                        / {service.price.split(" / ")[1]}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* Local Services */}
      <section className="py-16 lg:py-24 bg-surface">
        <Container>
          <SectionHeader
            title="On-Location Services — Alicante & Costa Blanca"
            subtitle="Our professional team comes to your property with top equipment. Covering all of Alicante province from Denia to Torrevieja."
            align="left"
          />

          <div className="space-y-8 mb-16">
            {localServices.map((service) => {
              const Icon = service.icon;
              return (
                <div
                  key={service.title}
                  className="bg-white border border-border rounded-2xl p-6 lg:p-8 flex flex-col lg:flex-row gap-6"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <h3 className="text-lg font-bold text-foreground">
                        {service.title}
                      </h3>
                    </div>
                    <p className="text-sm text-muted leading-relaxed mb-4">
                      {service.description}
                    </p>
                    <ul className="space-y-1.5 mb-5">
                      {service.deliverables.map((item) => (
                        <li
                          key={item}
                          className="text-sm text-foreground flex items-start gap-2"
                        >
                          <span className="text-primary mt-1">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                    {service.note && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 inline-block">
                        ⚠️ {service.note}
                      </p>
                    )}
                    <div>
                      <Link
                        href="/contact"
                        className="inline-flex px-5 py-2.5 border border-primary text-primary text-sm font-semibold rounded-lg hover:bg-primary hover:text-white transition-colors"
                      >
                        Request a Quote →
                      </Link>
                    </div>
                  </div>
                  <div className="lg:w-48 flex-shrink-0 flex items-start justify-end">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">
                        {service.price.split(" / ")[0]}
                      </p>
                      <p className="text-xs text-muted">
                        / {service.price.split(" / ")[1]}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Service Area */}
          <div className="bg-white border border-border rounded-2xl p-6 lg:p-8">
            <div className="flex items-center gap-3 mb-4">
              <MapPin className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-bold text-foreground">
                Service Area
              </h3>
            </div>
            <p className="text-sm text-muted mb-4">
              We cover all of Alicante province and Costa Blanca for on-location
              services. Travel fee may apply for properties beyond 30km from
              Alicante city.
            </p>
            <div className="flex flex-wrap gap-2">
              {serviceAreaCities.map((city) => (
                <span
                  key={city}
                  className="px-3 py-1 bg-surface border border-border rounded-full text-xs text-foreground"
                >
                  {city}
                </span>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* CTA */}
      <CtaSection
        title="Not Sure What You Need?"
        subtitle="Contact us for a free consultation. We'll recommend the right services for your properties."
        primaryLabel="Order Online"
        primaryHref="/order"
        secondaryLabel="Get in Touch"
        secondaryHref="/contact"
      />
    </>
  );
}
