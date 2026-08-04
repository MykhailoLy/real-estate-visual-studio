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
import CookieSettingsButton from "@/components/privacy/CookieSettingsButton";
import { formatPriceLabel } from "@/features/property-showcase/formatting";
import {
  getPropertyMapView,
  getListingReferenceLabel,
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
import PropertyMapCanvas from "./PropertyMapCanvas";
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
  const listingReferenceLabel = getListingReferenceLabel(property, language);
  const highlights = normalizeChecklistHighlights(property, language);
  const description = property.description
    .map((paragraph) => localizedText(paragraph, language, primaryLanguage))
    .filter(Boolean);
  const mapView = getPropertyMapView(property, language);
  const agent = normalizeAgentProfile(property, language);
  const contactHref =
    agent?.whatsappHref ?? agent?.emailHref ?? agent?.website;
  const contactIsExternal = contactHref?.startsWith("http") ?? false;
  const showLanguageSwitcher = languages.length > 1;
  const showLocation = mapView.mode !== "hidden";
  const showContactSection = Boolean(contactHref || agent);

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
            {contactHref ? (
              <a
                href={contactHref}
                target={contactIsExternal ? "_blank" : undefined}
                rel={contactIsExternal ? "noreferrer" : undefined}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#0f2440] transition hover:bg-[#f2e8c7] sm:text-sm"
              >
                {ui.requestViewing}
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </a>
            ) : null}
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
                        {listingReferenceLabel} {property.reference}
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
          <section className="relative z-10 border-y border-black/8 bg-white">
            <div
              data-testid="property-facts"
              className="mx-auto grid max-w-[1480px] grid-cols-2 px-4 sm:px-6 md:grid-cols-4 lg:px-10 2xl:grid-cols-8"
            >
              {facts.map((fact, index) => {
                const Icon = factIcons[fact.key] ?? Home;
                const hasLongValue = fact.value.length > 18;
                return (
                  <div
                    key={`${fact.key}-${index}`}
                    data-testid={`property-fact-${fact.key}`}
                    className="flex min-h-40 min-w-0 flex-col items-center justify-center border-b border-r border-black/8 px-3 py-7 text-center sm:min-h-44 sm:px-5 sm:py-9"
                  >
                    <Icon
                      className="mb-4 h-8 w-8 shrink-0 stroke-[1.5] text-[#a88b3a] sm:h-9 sm:w-9"
                      aria-hidden
                    />
                    <div className="min-w-0 max-w-full">
                      <span
                        className={`block max-w-full font-semibold leading-snug tabular-nums ${
                          fact.key === "price" ? "text-[#8d7531]" : "text-[#0f2440]"
                        } ${
                          hasLongValue
                            ? "break-words text-base sm:text-lg"
                            : "text-xl sm:text-2xl"
                        }`}
                        title={fact.value}
                      >
                        {fact.value}
                      </span>
                      <span className="mt-2 block text-xs font-semibold leading-5 text-slate-500 sm:text-sm">
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
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
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

            <div>
              {description.length > 0 ? (
                <div className="max-w-3xl space-y-5 text-base leading-8 text-slate-600">
                  {description.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {highlights.length > 0 ? (
            <div
              data-testid="property-highlights"
              className="mt-14 border-y border-black/8 bg-white px-5 py-8 sm:mt-16 sm:px-8 sm:py-10 lg:mt-20 lg:px-10"
            >
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a88b3a]">
                {ui.highlightsEyebrow}
              </p>
              <ul className="mt-6 grid gap-x-10 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
                {highlights.map((highlight, index) => (
                  <li
                    key={`${highlight}-${index}`}
                    className="flex min-w-0 items-start gap-4 text-base font-semibold leading-7 text-[#0f2440] sm:text-lg"
                  >
                    <CheckCircle2
                      className="mt-0.5 h-6 w-6 shrink-0 stroke-[1.75] text-[#a88b3a]"
                      aria-hidden
                    />
                    <span className="min-w-0 break-words">{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
            description={ui.galleryImageCount(gallery.length)}
          />
        </div>

        {property.virtualTour ? (
          <ImmersivePropertyTour
            propertyTitle={title}
            tour={property.virtualTour}
            posterAlt={`360 virtual tour of ${title}`}
            locale={language}
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
                  {ui.floorPlansHeading}
                </h2>
                {showInteractivePlan ? (
                  <a
                    href="#interactive-floor-plan"
                    className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#0f2440] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1a365d]"
                  >
                    <MousePointer2 className="h-4 w-4" aria-hidden />
                    {hasExternalInteractivePlan
                      ? ui.interactiveFloorPlan
                      : ui.roomByRoomFloorPlan}
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
            locale={language}
            primaryLanguage={primaryLanguage}
          />
        ) : null}

        {showContactSection ? (
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
                {contactHref ? (
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
                      {ui.askQuestion}
                    </a>
                  ) : null}
                </div>
                ) : null}
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
                        {ui.whatsapp}
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
        ) : null}

        {showLocation ? (
          <section
            id="location"
            data-testid="property-location-section"
            className="scroll-mt-36 border-t border-black/8 bg-white/45"
          >
            <div className="mx-auto max-w-[1480px] px-4 pb-8 pt-14 sm:px-6 sm:pb-10 sm:pt-16 lg:px-10 lg:pt-20">
              <div className="mb-7 max-w-3xl sm:mb-9">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a88b3a]">
                  {ui.location}
                </p>
                <h2 className="mt-3 text-2xl font-semibold leading-tight text-[#0f2440] sm:text-3xl">
                  {mapView.privacyMode === "approximate"
                    ? ui.mapApproximate
                    : address || ui.location}
                </h2>
                {mapView.privacyMode === "approximate" ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {ui.mapExactCoordinatesHidden}
                  </p>
                ) : null}
                {property.location.airportTravelTime ? (
                  <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
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
              <PropertyMapCanvas
                mapView={mapView}
                title={`${ui.location}: ${title}`}
                openLabel={ui.mapOpen}
                troubleLabel={ui.mapTrouble}
              />
            ) : (
              <div className="mx-auto max-w-[1480px] px-4 pb-14 sm:px-6 sm:pb-16 lg:px-10 lg:pb-20">
                <div className="grid min-h-64 place-items-center rounded-lg border border-black/10 bg-[#e5ebe7] px-5 text-center">
                  <div>
                    <MapPin className="mx-auto h-7 w-7 text-[#a88b3a]" aria-hidden />
                    <p className="mt-3 font-semibold text-[#0f2440]">{mapView.label}</p>
                    <p className="mt-2 text-sm text-slate-600">
                      Map coordinates are unavailable for this listing.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : null}
      </main>

      <footer className="border-t border-white/10 bg-[#0f2440] text-white">
        <div className="mx-auto max-w-[1480px] px-4 py-10 text-center sm:px-6 sm:py-12 lg:px-10">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/90">
            Equal Housing Opportunity
          </p>
          <div className="mx-auto my-7 h-px max-w-2xl bg-white/12" />
          <div className="space-y-2 text-sm leading-6 text-white/65">
            <p className="font-semibold text-white/85">
              Proudly created by Full Frame Media
            </p>
            <p>All information deemed reliable but not guaranteed.</p>
            <p>© 2026 Full Frame Media — All rights reserved.</p>
          </div>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 border-t border-white/10 pt-7 text-sm text-white/60 sm:flex-row sm:gap-6">
            <span>
              Use of this website is subject to our{" "}
              <Link href="/terms" className="underline decoration-white/30 underline-offset-4 hover:text-white">
                terms of use
              </Link>
              .
            </span>
            <CookieSettingsButton />
          </div>
        </div>
      </footer>
    </div>
  );
}
