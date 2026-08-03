"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Bath,
  BedDouble,
  CalendarDays,
  Car,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  Home,
  LandPlot,
  Mail,
  MapPin,
  MessageCircle,
  MousePointer2,
  Ruler,
  Tag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { formatPriceLabel } from "@/features/property-showcase/formatting";
import {
  getPropertyMapView,
  normalizeAgentProfile,
  normalizeChecklistHighlights,
  normalizeListingFacts,
} from "@/features/property-showcase/listing-details";
import {
  getPrimaryLanguage,
  getPropertyLanguageOptions,
  localizedText,
  PROPERTY_LANGUAGE_LABELS,
  PUBLIC_UI_LABELS,
} from "@/features/property-showcase/localization";
import {
  getExternalInteractiveFloorPlan,
  getPropertyLevelInteractiveFloorPlanTour,
  hasExternalInteractiveFloorPlan,
  shouldRenderInteractiveFloorPlan,
  sortedPropertyFloorPlans,
} from "@/features/property-showcase/rendering";
import type {
  PropertyFactKey,
  PropertyLanguageCode,
  PropertyShowcase,
} from "@/features/property-showcase/types";
import ImmersivePropertyTour from "./ImmersivePropertyTour";
import InteractivePropertyFloorPlan from "./InteractivePropertyFloorPlan";
import PropertyFloorPlanViewer from "./PropertyFloorPlanViewer";
import PropertyShowcaseActions from "./PropertyShowcaseActions";
import PropertyGallery from "./costa-blanca-demo/PropertyGallery";
import PropertySectionNav from "./costa-blanca-demo/PropertySectionNav";

type PropertyShowcaseViewProps = {
  property: PropertyShowcase;
  locale?: PropertyLanguageCode;
};

const factIcons: Record<PropertyFactKey, LucideIcon> = {
  price: CircleDollarSign,
  "listing-reference": Tag,
  bedrooms: BedDouble,
  bathrooms: Bath,
  parking: Car,
  "built-area": Ruler,
  "plot-area": LandPlot,
  "year-built": CalendarDays,
};

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}

export default function PropertyShowcaseView({
  property,
  locale,
}: PropertyShowcaseViewProps) {
  const primaryLanguage = getPrimaryLanguage(property);
  const languages = getPropertyLanguageOptions(property);
  const initialLanguage = locale && languages.includes(locale)
    ? locale
    : primaryLanguage;
  const [language, setLanguage] =
    useState<PropertyLanguageCode>(initialLanguage);
  const ui = PUBLIC_UI_LABELS[language] ?? PUBLIC_UI_LABELS.en;
  const gallery = useMemo(
    () => [...property.gallery].sort((a, b) => a.sortOrder - b.sortOrder),
    [property.gallery],
  );
  const floorPlans = useMemo(
    () => sortedPropertyFloorPlans(property.floorPlans),
    [property.floorPlans],
  );
  const primaryFloorPlan = floorPlans[0];
  const propertyInteractiveTour = getPropertyLevelInteractiveFloorPlanTour(property);
  const legacyInteractiveFloorPlan = getExternalInteractiveFloorPlan(property);
  const interactiveFloorPlan = legacyInteractiveFloorPlan ?? primaryFloorPlan;
  const hasExternalInteractivePlan = hasExternalInteractiveFloorPlan(property);
  const showInteractivePlan = shouldRenderInteractiveFloorPlan(property);
  const title = localizedText(property.title, language, primaryLanguage);
  const summary = localizedText(property.summary, language, primaryLanguage);
  const address = localizedText(
    property.location.displayAddress,
    language,
    primaryLanguage,
  );
  const facts = normalizeListingFacts(property, language);
  const highlights = normalizeChecklistHighlights(property, language);
  const description = property.description
    .map((paragraph) => localizedText(paragraph, language, primaryLanguage))
    .filter(Boolean);
  const mapView = getPropertyMapView(property, language);
  const agent = normalizeAgentProfile(property, language);
  const contactHref =
    agent?.whatsappHref ?? agent?.emailHref ?? agent?.website ?? "/contact";
  const contactIsExternal = contactHref.startsWith("http");
  const showLanguageSwitcher = languages.length > 1;
  const showLocation =
    address || property.location.airportTravelTime || mapView.mode !== "hidden";

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

          <div className="flex min-w-0 items-center gap-2">
            {showLanguageSwitcher ? (
              <div
                aria-label={ui.language}
                className="hidden rounded-full border border-white/15 bg-white/8 p-1 sm:flex"
              >
                {languages.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setLanguage(item)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      item === language
                        ? "bg-white text-[#0f2440]"
                        : "text-white/70 hover:text-white"
                    }`}
                    aria-pressed={item === language}
                  >
                    {item.toUpperCase()}
                  </button>
                ))}
              </div>
            ) : null}
            <a
              href={contactHref}
              target={contactIsExternal ? "_blank" : undefined}
              rel={contactIsExternal ? "noreferrer" : undefined}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#0f2440] transition hover:bg-[#f2e8c7] sm:text-sm"
            >
              {ui.requestViewing}
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
              alt={gallery[0] ? localizedText(gallery[0].alt, language, primaryLanguage) : title}
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
                        {ui.status[property.status]}
                      </span>
                      <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1.5 text-xs font-medium text-white/85 backdrop-blur">
                        {ui.reference} {property.reference}
                      </span>
                    </div>
                    {address ? (
                      <p className="mb-3 flex items-center gap-2 text-sm font-medium text-white/75 sm:text-base">
                        <MapPin className="h-4 w-4" aria-hidden />
                        {address}
                      </p>
                    ) : null}
                    <h1 className="max-w-4xl text-4xl font-semibold leading-[0.98] text-white sm:text-6xl lg:text-7xl">
                      {title}
                    </h1>
                    <p className="mt-5 max-w-2xl text-base leading-7 text-white/72 sm:text-lg">
                      {summary}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-end justify-between gap-5 border-t border-white/20 pt-5 lg:block lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                    <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                      {localizedText(property.priceLabel, language, primaryLanguage)}
                    </span>
                    <span className="mt-2 block text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                      {formatPriceLabel(property.price)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <PropertyShowcaseActions title={title} brochureUrl={property.brochureUrl} />
          </div>
        </section>

        {showLanguageSwitcher ? (
          <section className="border-b border-black/8 bg-white sm:hidden">
            <div className="mx-auto flex max-w-[1480px] gap-2 overflow-x-auto px-4 py-3">
              {languages.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setLanguage(item)}
                  aria-pressed={item === language}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${
                    item === language
                      ? "bg-[#0f2440] text-white"
                      : "border border-[#0f2440]/15 text-[#0f2440]"
                  }`}
                >
                  {PROPERTY_LANGUAGE_LABELS[item]}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {facts.length > 0 ? (
          <section className="relative z-10 mx-auto -mt-px max-w-[1480px] px-4 sm:px-6 lg:px-10">
            <div
              data-testid="property-facts"
              className={`grid border-x border-b border-black/8 bg-white shadow-[0_24px_70px_rgba(15,36,64,0.08)] ${
                facts.length <= 4
                  ? "grid-cols-2 md:grid-cols-4"
                  : "grid-cols-2 md:grid-cols-4 xl:grid-cols-8"
              }`}
            >
              {facts.map((fact, index) => {
                const Icon = factIcons[fact.key] ?? Home;
                return (
                  <div
                    key={`${fact.key}-${index}`}
                    className="flex min-w-0 items-center gap-3 border-b border-r border-black/8 px-4 py-5 last:border-r-0 sm:px-5"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f2f0ea] text-[#1a365d]">
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <span className="block break-words text-base font-semibold leading-tight text-[#0f2440] sm:text-lg">
                        {fact.value}
                      </span>
                      <span className="mt-1 block text-xs font-medium text-slate-500">
                        {fact.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <section id="overview" className="mx-auto max-w-[1480px] scroll-mt-36 px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-[#a88b3a]">
                {ui.detailsEyebrow}
              </p>
              <h2 className="max-w-3xl text-3xl font-semibold leading-tight text-[#0f2440] sm:text-4xl">
                {ui.aboutHeading}
              </h2>
              {property.brochureUrl ? (
                <a
                  href={property.brochureUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-7 inline-flex items-center gap-2 rounded-full border border-[#0f2440]/20 px-5 py-3 text-sm font-bold text-[#0f2440] transition hover:border-[#0f2440]"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  {ui.brochure}
                </a>
              ) : null}
            </div>

            <div className="space-y-10">
              {highlights.length > 0 ? (
                <div data-testid="property-highlights">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a88b3a]">
                    {ui.highlightsEyebrow}
                  </p>
                  <ul className="mt-5 grid gap-3 md:grid-cols-2">
                    {highlights.map((highlight, index) => (
                      <li
                        key={`${highlight}-${index}`}
                        className="flex gap-3 text-sm font-semibold leading-6 text-[#0f2440]"
                      >
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#a88b3a]" aria-hidden />
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {description.length > 0 ? (
                <div className="max-w-3xl space-y-5 text-base leading-8 text-slate-600">
                  {description.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <div id="gallery" className="scroll-mt-36">
          <PropertyGallery
            images={gallery.map((image) => ({
              src: image.src,
              alt: localizedText(image.alt, language, primaryLanguage),
              label: localizedText(image.label, language, primaryLanguage),
            }))}
            eyebrow={ui.galleryEyebrow}
            title={title}
            description={`${gallery.length} images`}
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
            <div className="mx-auto grid max-w-[1480px] gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-20 lg:px-10 lg:py-24">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a88b3a]">
                  {ui.floorPlans}
                </p>
                <h2 className="mt-4 text-3xl font-semibold leading-tight text-[#0f2440] sm:text-4xl">
                  See how the spaces connect.
                </h2>
                {showInteractivePlan ? (
                  <a
                    href="#interactive-floor-plan"
                    className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#0f2440] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1a365d]"
                  >
                    <MousePointer2 className="h-4 w-4" aria-hidden />
                    {hasExternalInteractivePlan
                      ? "Interactive floor plan"
                      : "Room-by-room floor plan"}
                  </a>
                ) : null}
              </div>

              <PropertyFloorPlanViewer
                plans={floorPlans}
                propertyTitle={title}
                locale={language}
              />
            </div>
          </section>
        ) : null}

        {showInteractivePlan && (propertyInteractiveTour || interactiveFloorPlan) ? (
          <InteractivePropertyFloorPlan
            propertyTitle={title}
            floorPlan={interactiveFloorPlan}
            interactiveTour={propertyInteractiveTour}
            gallery={gallery}
          />
        ) : null}

        {showLocation ? (
          <section id="location" className="mx-auto max-w-[1480px] scroll-mt-36 px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:gap-16">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a88b3a]">
                  {ui.location}
                </p>
                <h2 className="mt-4 text-3xl font-semibold leading-tight text-[#0f2440] sm:text-4xl">
                  {mapView.privacyMode === "approximate"
                    ? ui.mapApproximate
                    : mapView.privacyMode === "hidden"
                      ? ui.mapHidden
                      : address}
                </h2>
                <div className="mt-8 space-y-3 text-sm text-slate-600">
                  {address ? (
                    <p className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-[#a88b3a]" aria-hidden />
                      {address}
                    </p>
                  ) : null}
                  {property.location.airportTravelTime ? (
                    <p className="flex items-center gap-3">
                      <Car className="h-4 w-4 text-[#a88b3a]" aria-hidden />
                      {localizedText(
                        property.location.airportTravelTime,
                        language,
                        primaryLanguage,
                      )}
                    </p>
                  ) : null}
                </div>
              </div>

              {mapView.mode === "embed" ? (
                <div className="overflow-hidden rounded-3xl border border-black/8 bg-white shadow-sm">
                  <div className="relative aspect-[16/10] min-h-[360px]">
                    <iframe
                      src={mapView.embedUrl}
                      title={`${ui.location}: ${title}`}
                      className="absolute inset-0 h-full w-full border-0"
                      loading="lazy"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  </div>
                  {mapView.externalUrl ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/8 px-5 py-4">
                      <span className="text-sm font-medium text-slate-600">
                        {ui.mapTrouble}
                      </span>
                      <a
                        href={mapView.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-[#0f2440] px-5 py-3 text-sm font-bold text-white"
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden />
                        {ui.mapOpen}
                      </a>
                    </div>
                  ) : null}
                </div>
              ) : mapView.mode === "fallback" ? (
                <div className="relative min-h-[360px] overflow-hidden rounded-3xl border border-black/8 bg-[#dce5df] shadow-sm">
                  <div
                    className="absolute inset-0 opacity-55"
                    style={{
                      backgroundImage:
                        "linear-gradient(rgba(15,36,64,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(15,36,64,0.12) 1px, transparent 1px)",
                      backgroundSize: "44px 44px",
                    }}
                  />
                  <div className="absolute inset-0 grid place-items-center px-5 text-center">
                    <div>
                      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#0f2440] text-white">
                        <MapPin className="h-8 w-8" aria-hidden />
                      </div>
                      <h3 className="mt-5 text-2xl font-semibold text-[#0f2440]">
                        {mapView.label}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {mapView.privacyMode === "approximate"
                          ? "Exact coordinates are not shown on this public page."
                          : address}
                      </p>
                      {mapView.externalUrl ? (
                        <a
                          href={mapView.externalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#0f2440] px-5 py-3 text-sm font-bold text-white"
                        >
                          <ExternalLink className="h-4 w-4" aria-hidden />
                          {ui.mapOpen}
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section id="contact" className="mx-auto max-w-[1480px] scroll-mt-36 px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24">
          <div className="overflow-hidden rounded-3xl border border-black/8 bg-[#e8e2d4]">
            <div className="grid lg:grid-cols-[1fr_0.9fr]">
              <div className="p-8 sm:p-12 lg:p-16">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8d7531]">
                  {ui.contactHeading}
                </p>
                <h2 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight text-[#0f2440] sm:text-5xl">
                  {title}
                </h2>
                <div className="mt-9 flex flex-wrap gap-3">
                  <a
                    href={contactHref}
                    target={contactIsExternal ? "_blank" : undefined}
                    rel={contactIsExternal ? "noreferrer" : undefined}
                    className="inline-flex items-center gap-2 rounded-full bg-[#0f2440] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#1a365d]"
                  >
                    <CalendarDays className="h-4 w-4" aria-hidden />
                    {ui.requestViewing}
                  </a>
                  {agent?.emailHref ? (
                    <a
                      href={`${agent.emailHref}?subject=${encodeURIComponent(`Question about ${title}`)}`}
                      className="inline-flex items-center gap-2 rounded-full border border-[#0f2440]/20 px-6 py-3.5 text-sm font-bold text-[#0f2440] transition hover:border-[#0f2440]"
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden />
                      Email
                    </a>
                  ) : null}
                </div>
              </div>

              {agent ? (
                <aside className="border-t border-black/8 bg-white/55 p-8 sm:p-12 lg:border-l lg:border-t-0 lg:p-14">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                    {ui.presentedBy}
                  </span>
                  <div className="mt-7 flex items-center gap-5">
                    {agent.portraitUrl || agent.logoUrl ? (
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-white shadow-lg">
                        <Image
                          src={agent.portraitUrl ?? agent.logoUrl ?? ""}
                          alt={agent.displayName}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-[#0f2440] text-xl font-bold text-white shadow-lg">
                        {initials(agent.displayName)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="break-words text-xl font-semibold text-[#0f2440]">
                        {agent.displayName}
                      </h3>
                      {agent.displayName !== agent.agencyName ? (
                        <p className="mt-1 text-sm font-medium text-slate-600">
                          {agent.agencyName}
                        </p>
                      ) : null}
                      {agent.role ? (
                        <p className="mt-1 text-sm text-slate-500">{agent.role}</p>
                      ) : null}
                    </div>
                  </div>

                  {agent.logoUrl && agent.logoUrl !== agent.portraitUrl ? (
                    <div className="relative mt-7 h-16 max-w-56">
                      <Image
                        src={agent.logoUrl}
                        alt={agent.agencyName}
                        fill
                        sizes="224px"
                        className="object-contain object-left"
                      />
                    </div>
                  ) : null}

                  <div className="mt-8 space-y-2 border-t border-black/8 pt-7 text-sm text-slate-600">
                    {agent.phoneHref && agent.phone ? (
                      <a href={agent.phoneHref} className="block break-all hover:text-[#0f2440]">
                        {agent.phone}
                      </a>
                    ) : null}
                    {agent.whatsappHref ? (
                      <a
                        href={agent.whatsappHref}
                        target="_blank"
                        rel="noreferrer"
                        className="block break-all hover:text-[#0f2440]"
                      >
                        WhatsApp
                      </a>
                    ) : null}
                    {agent.emailHref && agent.email ? (
                      <a
                        href={agent.emailHref}
                        className="flex min-w-0 items-center gap-2 break-all hover:text-[#0f2440]"
                      >
                        <Mail className="h-4 w-4 shrink-0" aria-hidden />
                        {agent.email}
                      </a>
                    ) : null}
                    {agent.website ? (
                      <a
                        href={agent.website}
                        target="_blank"
                        rel="noreferrer"
                        className="block break-all hover:text-[#0f2440]"
                      >
                        {agent.website}
                      </a>
                    ) : null}
                  </div>

                  {agent.socialLinks.length > 0 ? (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {agent.socialLinks.map((link) => (
                        <a
                          key={`${link.provider}-${link.url}`}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-[#0f2440]/15 px-3 py-1.5 text-xs font-bold text-[#0f2440] hover:border-[#0f2440]"
                        >
                          {link.labelText}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </aside>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#0f2440] text-white">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-5 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-10">
          <div>
            <p className="text-sm font-semibold">Property Showcase by PicchuSpot</p>
            <p className="mt-1 text-xs text-white/50">
              Photography {"\u00b7"} Floor plans {"\u00b7"} 360 tours{" "}
              {"\u00b7"} Digital presentation
            </p>
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
