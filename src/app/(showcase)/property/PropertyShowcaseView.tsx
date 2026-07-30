import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Bath,
  BedDouble,
  Building2,
  CalendarDays,
  Car,
  Download,
  Languages,
  LandPlot,
  Mail,
  MapPin,
  MapPinned,
  MessageCircle,
  MousePointer2,
  Ruler,
  Sun,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  LocalizedText,
  PropertyFactKey,
  PropertyShowcase,
} from "@/features/property-showcase/types";
import ImmersivePropertyTour from "./ImmersivePropertyTour";
import InteractivePropertyFloorPlan from "./InteractivePropertyFloorPlan";
import PropertyShowcaseActions from "./PropertyShowcaseActions";
import PropertyGallery from "./costa-blanca-demo/PropertyGallery";
import PropertySectionNav from "./costa-blanca-demo/PropertySectionNav";

type ShowcaseLocale = "en" | "es";

type PropertyShowcaseViewProps = {
  property: PropertyShowcase;
  locale?: ShowcaseLocale;
};

const factIcons: Record<PropertyFactKey, LucideIcon> = {
  bedrooms: BedDouble,
  bathrooms: Bath,
  "built-area": Ruler,
  "plot-area": LandPlot,
  parking: Car,
  "year-built": CalendarDays,
};

const highlightIcons = [Waves, Sun, Building2, Languages];

const statusLabels: Record<PropertyShowcase["status"], Record<ShowcaseLocale, string>> = {
  "for-sale": { en: "For sale", es: "En venta" },
  reserved: { en: "Reserved", es: "Reservado" },
  sold: { en: "Sold", es: "Vendido" },
  "off-market": { en: "Off market", es: "Fuera de mercado" },
};

function text(value: LocalizedText | undefined, locale: ShowcaseLocale): string {
  if (!value) return "";
  return value[locale] ?? value.en;
}

function whatsappUrl(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

export default function PropertyShowcaseView({
  property,
  locale = "en",
}: PropertyShowcaseViewProps) {
  const gallery = [...property.gallery].sort((a, b) => a.sortOrder - b.sortOrder);
  const floorPlans = [...property.floorPlans].sort((a, b) => a.sortOrder - b.sortOrder);
  const primaryFloorPlan = floorPlans[0];
  const title = text(property.title, locale);
  const summary = text(property.summary, locale);
  const address = text(property.location.displayAddress, locale);
  const agent = property.agent;
  const agentRole = text(agent.role, locale);
  const contactHref = agent.whatsapp
    ? whatsappUrl(agent.whatsapp)
    : agent.email
      ? `mailto:${agent.email}`
      : "/contact";
  const contactIsExternal = contactHref.startsWith("http");
  const agentInitials = (agent.agentName || agent.agencyName)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#f2f0ea] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0f2440]/95 text-white shadow-sm backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-3" aria-label="PicchuSpot home">
            <span className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-white/10 text-sm font-bold tracking-tight">
              PS
            </span>
            <span>
              <span className="block text-sm font-semibold leading-none">PicchuSpot</span>
              <span className="mt-1 block text-[10px] font-medium uppercase tracking-[0.2em] text-white/55">
                Property showcase
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-medium text-white/70 sm:inline-flex">
              {property.languages.map((language) => language.toUpperCase()).join(" · ")}
            </span>
            <a
              href={contactHref}
              target={contactIsExternal ? "_blank" : undefined}
              rel={contactIsExternal ? "noreferrer" : undefined}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#0f2440] transition hover:bg-[#f2e8c7] sm:text-sm"
            >
              Request a viewing
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </div>
      </header>

      <PropertySectionNav />

      <main>
        <section id="home" className="relative isolate scroll-mt-36 overflow-hidden bg-[#0f2440]">
          <div className="relative min-h-[620px] sm:min-h-[700px] lg:min-h-[780px]">
            <Image
              src={property.coverImage}
              alt={gallery[0] ? text(gallery[0].alt, locale) : title}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#071426]/10 via-[#071426]/5 to-[#071426]/90" />
            <div className="absolute inset-x-0 bottom-0">
              <div className="mx-auto max-w-[1480px] px-4 pb-8 sm:px-6 sm:pb-12 lg:px-10 lg:pb-16">
                <div className="flex max-w-5xl flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="mb-4 flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white backdrop-blur">
                        {statusLabels[property.status][locale]}
                      </span>
                      <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1.5 text-xs font-medium text-white/85 backdrop-blur">
                        Reference {property.reference}
                      </span>
                    </div>
                    <p className="mb-3 flex items-center gap-2 text-sm font-medium text-white/75 sm:text-base">
                      <MapPin className="h-4 w-4" aria-hidden />
                      {address}
                    </p>
                    <h1 className="max-w-4xl text-4xl font-semibold leading-[0.98] tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">
                      {title}
                    </h1>
                    <p className="mt-5 max-w-2xl text-base leading-7 text-white/72 sm:text-lg">
                      {summary}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-end justify-between gap-5 border-t border-white/20 pt-5 lg:block lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                    <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                      {text(property.priceLabel, locale)}
                    </span>
                    <span className="mt-2 block text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                      {property.price}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <PropertyShowcaseActions title={title} brochureUrl={property.brochureUrl} />
          </div>
        </section>

        <section className="relative z-10 mx-auto -mt-px max-w-[1480px] px-4 sm:px-6 lg:px-10">
          <div className={`grid border-x border-b border-black/8 bg-white shadow-[0_24px_70px_rgba(15,36,64,0.08)] ${property.facts.length <= 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"}`}>
            {property.facts.map((fact, index) => {
              const Icon = factIcons[fact.key];
              return (
                <div
                  key={`${fact.key}-${index}`}
                  className="flex items-center gap-4 border-b border-r border-black/8 px-5 py-6 last:border-r-0 sm:px-7 md:border-b-0"
                >
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f2f0ea] text-[#1a365d]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div>
                    <span className="block text-lg font-semibold leading-none text-[#0f2440] sm:text-xl">
                      {fact.value}
                    </span>
                    <span className="mt-1.5 block text-xs font-medium text-slate-500 sm:text-sm">
                      {text(fact.label, locale)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section id="overview" className="mx-auto max-w-[1480px] scroll-mt-36 px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-[#a88b3a]">
                The property
              </p>
              <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.03em] text-[#0f2440] sm:text-4xl lg:text-5xl">
                Understand the home before you book the flight.
              </h2>
              <div className="mt-8 max-w-3xl space-y-5 text-base leading-8 text-slate-600 sm:text-lg">
                {property.description.map((paragraph, index) => (
                  <p key={index}>{text(paragraph, locale)}</p>
                ))}
              </div>
            </div>

            <div className="grid gap-px overflow-hidden rounded-3xl border border-black/8 bg-black/8 sm:grid-cols-2">
              {property.highlights.map((highlight, index) => {
                const Icon = highlightIcons[index % highlightIcons.length];
                return (
                  <div key={`${text(highlight.title, locale)}-${index}`} className="bg-white p-6 sm:p-7">
                    <Icon className="h-6 w-6 text-[#a88b3a]" aria-hidden />
                    <h3 className="mt-5 text-base font-semibold text-[#0f2440]">
                      {text(highlight.title, locale)}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {text(highlight.description, locale)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <div id="gallery" className="scroll-mt-36">
          <PropertyGallery
            images={gallery.map((image) => ({
              src: image.src,
              alt: text(image.alt, locale),
              label: text(image.label, locale),
            }))}
            eyebrow="Photo gallery"
            title={`Explore ${title}.`}
            description={`${gallery.length} professionally prepared property images. Select any image to open the full-screen gallery.`}
          />
        </div>

        {property.virtualTour ? (
          <ImmersivePropertyTour
            propertyTitle={title}
            tour={property.virtualTour}
            posterAlt={`360 virtual tour of ${title}`}
          />
        ) : null}

        {primaryFloorPlan ? (
          <section id="floor-plan" className="scroll-mt-36 border-y border-black/8 bg-white">
            <div className="mx-auto grid max-w-[1480px] gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-20 lg:px-10 lg:py-28">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a88b3a]">
                  Floor plan
                </p>
                <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.03em] text-[#0f2440] sm:text-4xl">
                  See how the spaces connect.
                </h2>
                <p className="mt-6 text-base leading-7 text-slate-600">
                  A clear plan answers practical questions that photography cannot: room relationships, circulation, storage and outdoor access.
                </p>
                <div className="mt-9 flex flex-wrap gap-3">
                  {primaryFloorPlan.downloadUrl ? (
                    <a
                      href={primaryFloorPlan.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-[#0f2440]/15 px-5 py-3 text-sm font-bold text-[#0f2440] transition hover:border-[#0f2440]"
                    >
                      <Download className="h-4 w-4" aria-hidden />
                      Download floor plan
                    </a>
                  ) : null}
                  {gallery.some((image) => image.roomId) ? (
                    <a
                      href="#interactive-floor-plan"
                      className="inline-flex items-center gap-2 rounded-full bg-[#0f2440] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1a365d]"
                    >
                      <MousePointer2 className="h-4 w-4" aria-hidden />
                      Interactive floor plan
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="relative aspect-[16/10] overflow-hidden rounded-3xl border border-black/8 bg-[#f6f4ef] p-3 shadow-sm sm:p-6">
                <Image
                  src={primaryFloorPlan.imageUrl}
                  alt={`${text(primaryFloorPlan.title, locale)} for ${title}`}
                  fill
                  sizes="(min-width: 1024px) 58vw, 100vw"
                  className="object-contain p-5 sm:p-8"
                />
              </div>
            </div>
          </section>
        ) : null}

        {primaryFloorPlan && gallery.some((image) => image.roomId) ? (
          <InteractivePropertyFloorPlan
            propertyTitle={title}
            floorPlan={primaryFloorPlan}
            gallery={gallery}
          />
        ) : null}

        <section id="location" className="mx-auto max-w-[1480px] scroll-mt-36 px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:gap-16">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a88b3a]">
                Location
              </p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.03em] text-[#0f2440] sm:text-4xl">
                Understand the area as well as the home.
              </h2>
              <p className="mt-6 text-base leading-7 text-slate-600">
                The map can show the exact address, an approximate area or remain hidden according to the seller&apos;s privacy preference.
              </p>
              <div className="mt-8 space-y-3 text-sm text-slate-600">
                <p className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-[#a88b3a]" aria-hidden />
                  {address}
                </p>
                {property.location.airportTravelTime ? (
                  <p className="flex items-center gap-3">
                    <Car className="h-4 w-4 text-[#a88b3a]" aria-hidden />
                    {text(property.location.airportTravelTime, locale)}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="relative min-h-[430px] overflow-hidden rounded-[2rem] border border-black/8 bg-[#dce5df] shadow-sm">
              <div
                className="absolute inset-0 opacity-55"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(15,36,64,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(15,36,64,0.12) 1px, transparent 1px)",
                  backgroundSize: "44px 44px",
                }}
              />
              <div className="absolute left-[18%] top-[20%] h-28 w-72 rotate-[-18deg] rounded-full border-[18px] border-white/65" />
              <div className="absolute bottom-[18%] right-[8%] h-36 w-[68%] rotate-[10deg] rounded-full border-[22px] border-white/55" />
              <div className="absolute inset-0 grid place-items-center">
                <div className="grid h-20 w-20 place-items-center rounded-full bg-[#0f2440] text-white shadow-[0_18px_50px_rgba(15,36,64,0.35)]">
                  <MapPinned className="h-9 w-9" aria-hidden />
                </div>
              </div>
              <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/65 bg-white/88 p-5 shadow-lg backdrop-blur sm:inset-x-8 sm:bottom-8">
                <p className="text-sm font-semibold text-[#0f2440]">{title} · {address}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Location privacy: {property.location.privacyMode}. Coordinates can activate a live map later.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="contact" className="mx-auto max-w-[1480px] scroll-mt-36 px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-28">
          <div className="overflow-hidden rounded-[2rem] border border-black/8 bg-[#e8e2d4]">
            <div className="grid lg:grid-cols-[1fr_0.9fr]">
              <div className="p-8 sm:p-12 lg:p-16">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8d7531]">
                  Private online viewing
                </p>
                <h2 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.03em] text-[#0f2440] sm:text-5xl">
                  Interested, but not in Spain yet?
                </h2>
                <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                  Request a guided video call. The agent can walk you through the photography, floor plan and 360 tour and answer practical questions before your trip.
                </p>
                <div className="mt-9 flex flex-wrap gap-3">
                  <a
                    href={contactHref}
                    target={contactIsExternal ? "_blank" : undefined}
                    rel={contactIsExternal ? "noreferrer" : undefined}
                    className="inline-flex items-center gap-2 rounded-full bg-[#0f2440] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#1a365d]"
                  >
                    <CalendarDays className="h-4 w-4" aria-hidden />
                    Book a viewing
                  </a>
                  {agent.email ? (
                    <a
                      href={`mailto:${agent.email}?subject=${encodeURIComponent(`Question about ${title}`)}`}
                      className="inline-flex items-center gap-2 rounded-full border border-[#0f2440]/20 px-6 py-3.5 text-sm font-bold text-[#0f2440] transition hover:border-[#0f2440]"
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden />
                      Ask a question
                    </a>
                  ) : null}
                </div>
              </div>

              <aside className="border-t border-black/8 bg-white/55 p-8 sm:p-12 lg:border-l lg:border-t-0 lg:p-14">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                  Presented by
                </span>
                <div className="mt-7 flex items-center gap-5">
                  {agent.portraitUrl || agent.logoUrl ? (
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-white shadow-lg">
                      <Image
                        src={agent.portraitUrl ?? agent.logoUrl ?? ""}
                        alt={agent.agentName || agent.agencyName}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-[#0f2440] text-xl font-bold text-white shadow-lg">
                      {agentInitials}
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-semibold text-[#0f2440]">
                      {agent.agentName || agent.agencyName}
                    </h3>
                    {agent.agentName ? (
                      <p className="mt-1 text-sm font-medium text-slate-600">{agent.agencyName}</p>
                    ) : null}
                    {agentRole ? <p className="mt-1 text-sm text-slate-500">{agentRole}</p> : null}
                    <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-[#8d7531]">
                      {property.languages.map((language) => language === "en" ? "English" : "Español").join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="mt-8 space-y-2 border-t border-black/8 pt-7 text-sm text-slate-600">
                  {agent.phone ? <a href={`tel:${agent.phone}`} className="block hover:text-[#0f2440]">{agent.phone}</a> : null}
                  {agent.email ? <a href={`mailto:${agent.email}`} className="flex items-center gap-2 hover:text-[#0f2440]"><Mail className="h-4 w-4" aria-hidden />{agent.email}</a> : null}
                  {agent.website ? <a href={agent.website} target="_blank" rel="noreferrer" className="block hover:text-[#0f2440]">{agent.website}</a> : null}
                </div>
              </aside>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#0f2440] text-white">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-5 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-10">
          <div>
            <p className="text-sm font-semibold">Property Showcase by PicchuSpot</p>
            <p className="mt-1 text-xs text-white/50">Photography · Floor plans · 360 tours · Video · Digital presentation</p>
          </div>
          <Link href="/contact" className="inline-flex items-center gap-2 text-sm font-semibold text-[#d4bc6a] hover:text-white">
            Create a page for your listing
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </footer>
    </div>
  );
}
