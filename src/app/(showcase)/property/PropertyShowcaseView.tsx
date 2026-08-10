"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Bath,
  BedDouble,
  CalendarDays,
  Car,
  Check,
  CircleDollarSign,
  ExternalLink,
  Globe2,
  Home,
  LandPlot,
  Mail,
  MapPin,
  MessageCircle,
  MousePointer2,
  Phone,
  Ruler,
  Tag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { BrandWordmark } from "@/components/brand";
import CookieSettingsButton from "@/components/privacy/CookieSettingsButton";
import { formatPriceLabel } from "@/features/property-showcase/formatting";
import { focalPointToObjectPosition } from "@/features/property-showcase/focal-point";
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
  PROPERTY_BRANDING_UI_LABELS,
  PUBLIC_UI_LABELS,
} from "@/features/property-showcase/localization";
import {
  getActivePropertyBranding,
  getPropertyBrandPalette,
} from "@/features/property-showcase/branding";
import { getPropertyAddressView } from "@/features/property-showcase/property-address";
import {
  getExternalInteractiveFloorPlan,
  getPropertyLevelInteractiveFloorPlanTour,
  getVisibleVirtualTour,
  hasExternalInteractiveFloorPlan,
  shouldRenderInteractiveFloorPlan,
  shouldRenderOrdinaryFloorPlans,
  sortedPropertyFloorPlans,
} from "@/features/property-showcase/rendering";
import {
  getPropertyShareMessage,
  selectPropertyHeroImages,
} from "@/features/property-showcase/social-preview";
import type {
  PropertyFactKey,
  PropertyLanguageCode,
  PropertyShowcase,
} from "@/features/property-showcase/types";
import { sortedUsablePropertyVideos } from "@/features/property-showcase/video-urls";
import { trackPropertyEvent } from "@/features/property-showcase/property-analytics-client";
import {
  shouldTrackPropertyAnalytics,
  type PropertyAnalyticsEvent,
} from "@/features/property-showcase/property-analytics";
import ImmersivePropertyTour from "./ImmersivePropertyTour";
import InteractivePropertyFloorPlan from "./InteractivePropertyFloorPlan";
import PropertyFloorPlanViewer from "./PropertyFloorPlanViewer";
import PropertyHeroSlideshow from "./PropertyHeroSlideshow";
import PropertyBrandLogo from "./PropertyBrandLogo";
import PropertyMarketingDownloads from "./PropertyMarketingDownloads";
import type { PropertyMarketingMaterialLinks } from "@/features/property-showcase/marketing-materials";
import PropertyMapCanvas from "./PropertyMapCanvas";
import PropertyShowcaseActions from "./PropertyShowcaseActions";
import PropertyVideoSection from "./PropertyVideoSection";
import PropertyViewingRequestDialog from "./PropertyViewingRequestDialog";
import PropertyGallery from "./costa-blanca-demo/PropertyGallery";
import PropertySectionNav from "./costa-blanca-demo/PropertySectionNav";
import PropertySocialBrandIcon from "./PropertySocialBrandIcon";

type PropertyShowcaseViewProps = {
  property: PropertyShowcase;
  locale?: PropertyLanguageCode;
  canonicalUrl: string;
  turnstileSiteKey?: string | null;
  previewMode?: boolean;
  marketingMaterialLinks?: PropertyMarketingMaterialLinks;
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

function keepFactValueTogether(key: PropertyFactKey): boolean {
  return (
    key === "price" ||
    key === "listing-reference" ||
    key === "built-area" ||
    key === "plot-area"
  );
}

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
  canonicalUrl,
  turnstileSiteKey,
  previewMode = false,
  marketingMaterialLinks = {},
}: PropertyShowcaseViewProps) {
  const primaryLanguage = getPrimaryLanguage(property);
  const languages = getPropertyLanguageOptions(property);
  const initialLanguage = locale && languages.includes(locale)
    ? locale
    : primaryLanguage;
  const [language, setLanguage] =
    useState<PropertyLanguageCode>(initialLanguage);
  const [viewingDialogOpen, setViewingDialogOpen] = useState(false);
  const ui = PUBLIC_UI_LABELS[language] ?? PUBLIC_UI_LABELS.en;
  const brandingUi =
    PROPERTY_BRANDING_UI_LABELS[language] ?? PROPERTY_BRANDING_UI_LABELS.en;
  const branding = getActivePropertyBranding(property);
  const brandPalette = getPropertyBrandPalette(branding);
  const brandThemeStyle = {
    "--property-brand-primary": brandPalette.primary,
    "--property-brand-accent": brandPalette.accent,
    "--property-brand-primary-foreground": brandPalette.primaryForeground,
  } as CSSProperties;
  const gallery = useMemo(
    () => [...property.gallery].sort((a, b) => a.sortOrder - b.sortOrder),
    [property.gallery],
  );
  const floorPlans = useMemo(
    () => sortedPropertyFloorPlans(property.floorPlans),
    [property.floorPlans],
  );
  const videos = useMemo(
    () => sortedUsablePropertyVideos(property),
    [property],
  );
  const primaryFloorPlan = floorPlans[0];
  const visibleVirtualTour = getVisibleVirtualTour(property);
  const propertyInteractiveTour = getPropertyLevelInteractiveFloorPlanTour(property);
  const legacyInteractiveFloorPlan = property.interactiveFloorPlanTour === undefined
    ? getExternalInteractiveFloorPlan(property)
    : undefined;
  const interactiveFloorPlan = legacyInteractiveFloorPlan ?? primaryFloorPlan;
  const hasExternalInteractivePlan = hasExternalInteractiveFloorPlan(property);
  const showInteractivePlan = shouldRenderInteractiveFloorPlan(property);
  const showFloorPlans = shouldRenderOrdinaryFloorPlans(property);
  const title = localizedText(property.title, language, primaryLanguage);
  const summary = localizedText(property.summary, language, primaryLanguage);
  const address = getPropertyAddressView(
    property.location,
    language,
    primaryLanguage,
  );
  const heroImages = useMemo(
    () => selectPropertyHeroImages(property),
    [property],
  );
  const facts = normalizeListingFacts(property, language);
  const highlights = normalizeChecklistHighlights(property, language);
  const description = property.description
    .map((paragraph) => localizedText(paragraph, language, primaryLanguage))
    .filter(Boolean);
  const mapView = getPropertyMapView(property, language);
  const agent = normalizeAgentProfile(property, language);
  const contactHref =
    agent?.whatsappHref ?? agent?.emailHref ?? agent?.website;
  const showLocation = mapView.mode !== "hidden";
  const showContactSection = Boolean(contactHref || agent || branding?.websiteUrl);
  const currentYear = new Date().getFullYear();
  const trackEvent = useCallback(
    (event: PropertyAnalyticsEvent) => {
      if (!shouldTrackPropertyAnalytics(previewMode)) return;
      trackPropertyEvent({ propertySlug: property.slug, event });
    },
    [previewMode, property.slug],
  );

  useEffect(() => {
    trackEvent("property_page_viewed");
  }, [trackEvent]);

  function openViewingDialog() {
    trackEvent("request_viewing_opened");
    setViewingDialogOpen(true);
  }

  return (
    <div className="min-h-screen bg-[#f2f0ea] text-slate-950" style={brandThemeStyle}>
      <PropertySectionNav
        showVideo={videos.length > 0}
        showVirtualTour={Boolean(visibleVirtualTour)}
        showFloorPlans={showFloorPlans}
        showInteractivePlan={showInteractivePlan}
        showContact={showContactSection}
        showLocation={showLocation}
        languages={languages}
        language={language}
        languageLabel={ui.language}
        onLanguageChange={setLanguage}
      />

      <main>
        <section id="home" className="relative isolate scroll-mt-24 overflow-hidden bg-[#0f2440]">
          <div
            data-testid="property-hero-composition"
            className="relative min-h-[max(540px,calc(100svh-4.5rem))] sm:min-h-[max(700px,calc(100svh-5rem))] lg:min-h-[max(780px,calc(100dvh-5rem))]"
          >
            <PropertyHeroSlideshow images={heroImages} />
            <div className="absolute inset-0 bg-gradient-to-b from-[#071426]/50 via-[#071426]/15 to-[#071426]/95" />
            {branding ? (
              <div
                data-testid="property-branding"
                className="absolute left-4 top-4 z-10 max-w-[calc(100%-5.75rem)] sm:left-6 sm:top-6 lg:left-10"
              >
                <div
                  className="flex min-h-12 w-fit max-w-full min-w-0 items-center gap-2.5 rounded-xl border border-white/25 border-l-4 bg-black/35 px-3 py-2 text-white shadow-lg backdrop-blur"
                  style={{ borderLeftColor: brandPalette.accent }}
                >
                  <PropertyBrandLogo
                    url={branding.logoUrl}
                    brandName={branding.brandName}
                    testId="property-branding-logo"
                    sizes="(max-width: 640px) 96px, 112px"
                    className="relative h-9 w-24 shrink-0 rounded-lg bg-white/95 p-1.5 shadow-sm sm:h-10 sm:w-28"
                  />
                  <div className="min-w-0 max-w-[15rem] sm:max-w-[22rem]">
                    {branding.websiteUrl ? (
                      <a
                        href={branding.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block break-words text-sm font-bold leading-5 text-white underline decoration-white/35 underline-offset-4 hover:decoration-white"
                      >
                        {branding.brandName}
                      </a>
                    ) : (
                      <span className="block break-words text-sm font-bold leading-5 text-white">
                        {branding.brandName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
            <div className="absolute inset-x-0 bottom-0">
              <div className="mx-auto max-w-[1480px] px-4 pb-8 sm:px-6 sm:pb-12 lg:px-10 lg:pb-16">
                <div className="flex max-w-5xl flex-col gap-4 sm:gap-6 lg:flex-row lg:items-end lg:justify-between">
                  <div className="min-w-0">
                    {address.primaryLine ? (
                      <div data-testid="property-hero-address" className="mb-4 max-w-2xl">
                        <p className="flex items-center gap-2 text-base font-medium leading-tight text-white/90 sm:text-xl">
                          <MapPin className="h-4 w-4" aria-hidden />
                          {address.primaryLine}
                        </p>
                        {address.secondaryLine ? (
                          <p className="mt-1 pl-6 text-[11px] font-semibold uppercase leading-4 tracking-[0.14em] text-white/65 sm:text-xs">
                            {address.secondaryLine}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    <h1 className="max-w-4xl text-3xl font-semibold leading-[0.98] text-white min-[390px]:text-4xl sm:text-6xl lg:text-7xl">
                      {title}
                    </h1>
                    <p className="mt-5 hidden max-w-2xl text-base leading-7 text-white/72 sm:block sm:text-lg">
                      {summary}
                    </p>
                  </div>

                  <div className="flex min-w-0 shrink-0 flex-col items-start gap-3 border-t border-white/20 pt-4 sm:gap-5 sm:pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                    <div className="hidden sm:block">
                      <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                        {localizedText(property.priceLabel, language, primaryLanguage)}
                      </span>
                      <span className="mt-2 block whitespace-nowrap text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                        {formatPriceLabel(property.price)}
                      </span>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        onClick={openViewingDialog}
                        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--property-brand-primary)] px-5 py-3 text-sm font-bold text-[var(--property-brand-primary-foreground)] shadow-lg transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white sm:w-auto"
                        data-testid="hero-request-viewing"
                      >
                        <CalendarDays className="h-4 w-4" aria-hidden />
                        {ui.requestViewing}
                      </button>
                      <PropertyMarketingDownloads
                        links={marketingMaterialLinks}
                        language={language}
                        onBrochureDownloaded={() =>
                          trackEvent("brochure_downloaded")
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <PropertyShowcaseActions
              title={title}
              text={getPropertyShareMessage(property, language)}
              canonicalUrl={canonicalUrl}
              brochureUrl={property.brochureUrl}
              showShare={!previewMode}
              onShare={() => trackEvent("property_shared")}
              onBrochureDownload={() => trackEvent("brochure_downloaded")}
            />
          </div>
        </section>

        {facts.length > 0 || highlights.length > 0 ? (
          <section
            data-testid="property-details-composition"
            className="border-b border-black/10"
          >
            <div className="mx-auto max-w-[1480px] px-4 sm:px-6 lg:px-10">
              {facts.length > 0 ? (
                <div
                  data-testid="property-facts"
                  className="grid grid-cols-2 gap-x-3 gap-y-5 py-7 min-[360px]:grid-cols-4 min-[360px]:gap-x-1 min-[360px]:py-6 sm:gap-x-4 sm:gap-y-9 sm:py-12 min-[900px]:grid-cols-4 min-[1400px]:grid-cols-8"
                >
                  {facts.map((fact, index) => {
                    const Icon = factIcons[fact.key] ?? Home;
                    const keepTogether = keepFactValueTogether(fact.key);
                    const compactValue = fact.value.length > 18;
                    return (
                      <div
                        key={`${fact.key}-${index}`}
                        data-testid={`property-fact-${fact.key}`}
                        className="flex min-w-0 flex-col items-center px-0.5 text-center sm:px-1"
                      >
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-slate-300/90 text-[#0f2440] min-[360px]:h-11 min-[360px]:w-11 sm:h-14 sm:w-14">
                          <Icon
                            className="h-5 w-5 stroke-[1.6] sm:h-6 sm:w-6"
                            aria-hidden
                          />
                        </span>
                        <span
                          data-testid={`property-fact-label-${fact.key}`}
                          className="mt-2 block max-w-full text-[8px] font-bold uppercase leading-3 tracking-normal text-slate-500 min-[360px]:text-[9px] sm:mt-4 sm:text-[11px] sm:leading-4"
                          title={fact.label}
                          aria-label={fact.label}
                        >
                          {fact.key === "listing-reference" ? (
                            <>
                              <span className="sm:hidden">Ref.</span>
                              <span className="hidden sm:inline">{fact.label}</span>
                            </>
                          ) : (
                            fact.label
                          )}
                        </span>
                        <span
                          data-testid={`property-fact-value-${fact.key}`}
                          className={`mt-1 block max-w-full font-semibold leading-5 tabular-nums lining-nums text-[#0f2440] sm:mt-1.5 sm:leading-6 ${
                            compactValue
                              ? "text-[11px] min-[360px]:text-[9px] sm:text-base"
                              : "text-[15px] min-[360px]:text-[15px] sm:text-xl"
                          } ${
                            keepTogether
                              ? "whitespace-nowrap"
                              : compactValue
                                ? "whitespace-nowrap min-[360px]:whitespace-normal sm:whitespace-nowrap"
                                : "break-words"
                          }`}
                          title={fact.value}
                        >
                          {fact.value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {highlights.length > 0 ? (
                <div
                  data-testid="property-highlights"
                  className="border-t border-black/10 py-6 sm:py-11"
                >
                  <h2 className="sr-only">{ui.checklistHeading}</h2>
                  <ul className="grid grid-cols-1 gap-x-5 gap-y-2.5 min-[380px]:grid-cols-2 sm:gap-x-8 sm:gap-y-4 xl:grid-cols-3">
                    {highlights.map((highlight, index) => (
                      <li
                        key={`${highlight}-${index}`}
                        className="flex min-w-0 items-start gap-2.5 text-[13px] font-medium leading-5 text-[#0f2440] sm:gap-3 sm:text-base sm:leading-6 xl:text-lg xl:leading-7"
                      >
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 stroke-[2] text-[#0f2440] sm:h-4.5 sm:w-4.5 xl:mt-1 xl:h-5 xl:w-5"
                          aria-hidden
                        />
                        <span className="min-w-0 break-words">{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
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

        </section>

        <div id="gallery" className="scroll-mt-36">
          <PropertyGallery
            images={gallery.map((image) => ({
              src: image.src,
              alt: localizedText(image.alt, language, primaryLanguage),
              label: localizedText(image.label, language, primaryLanguage),
              objectPosition: focalPointToObjectPosition(image.focalPoint),
            }))}
            eyebrow={ui.galleryEyebrow}
            title={title}
            description={ui.galleryImageCount(gallery.length)}
            showAllLabel={ui.galleryShowAll}
            showFewerLabel={ui.galleryShowFewer}
            onGalleryOpen={() => trackEvent("gallery_opened")}
          />
        </div>

        {videos.length > 0 ? (
          <PropertyVideoSection
            propertyTitle={title}
            videos={videos}
            posterFallback={property.coverImage}
            locale={language}
            primaryLanguage={primaryLanguage}
            onVideoStarted={() => trackEvent("video_started")}
          />
        ) : null}

        {visibleVirtualTour ? (
          <ImmersivePropertyTour
            propertyTitle={title}
            tour={visibleVirtualTour}
            posterAlt={`360 virtual tour of ${title}`}
            locale={language}
            onVirtualTourOpened={() => trackEvent("virtual_tour_opened")}
          />
        ) : null}

        {showFloorPlans && primaryFloorPlan ? (
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
                onFloorPlanDownload={() => trackEvent("floor_plan_downloaded")}
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
            onInteractiveFloorPlanOpened={() =>
              trackEvent("interactive_floor_plan_opened")
            }
          />
        ) : null}

        {showContactSection ? (
          <section
            id="contact"
            data-testid="property-contact-section"
            className="mx-auto max-w-[1480px] scroll-mt-36 px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-10"
          >
            <div className="overflow-hidden rounded-lg border border-black/8 bg-[#e8e2d4]">
              <div className="grid lg:grid-cols-[1fr_0.95fr]">
                <div className="p-6 sm:p-8 lg:p-10">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8d7531]">
                    {ui.contactHeading}
                  </p>
                  <h2 className="mt-3 max-w-2xl text-2xl font-semibold leading-tight text-[#0f2440] sm:text-3xl">
                    {title}
                  </h2>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      onClick={openViewingDialog}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--property-brand-primary)] px-5 py-3 text-sm font-bold text-[var(--property-brand-primary-foreground)] transition hover:brightness-110"
                    >
                      <CalendarDays className="h-4 w-4" aria-hidden />
                      {ui.requestViewing}
                    </button>
                    {agent?.emailHref ? (
                      <a
                        href={`${agent.emailHref}?subject=${encodeURIComponent(`Question about ${title}`)}`}
                        onClick={() => trackEvent("agent_email_clicked")}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#0f2440]/20 px-5 py-3 text-sm font-bold text-[#0f2440] transition hover:border-[#0f2440]"
                      >
                        <MessageCircle className="h-4 w-4" aria-hidden />
                        {ui.askQuestion}
                      </a>
                    ) : null}
                  </div>
                </div>

                {agent || branding ? (
                  <aside
                    data-testid="property-agent-profile"
                    className="border-t border-black/8 bg-white/55 p-6 sm:p-8 lg:border-l lg:border-t-0"
                  >
                    {branding ? (
                      <div
                        data-testid="property-branding-contact"
                        className="mb-5 border-b border-l-3 border-black/8 pb-5 pl-3"
                        style={{ borderLeftColor: brandPalette.accent }}
                      >
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                          {brandingUi.agency}
                        </p>
                        <div className="mt-2 flex min-w-0 items-center gap-3">
                          <PropertyBrandLogo
                            url={branding.logoUrl}
                            brandName={branding.brandName}
                            testId="property-branding-contact-logo"
                            sizes="112px"
                            className="relative h-11 w-28 shrink-0 rounded-lg border border-black/10 bg-white p-1.5"
                          />
                          <div className="min-w-0">
                            <p
                              data-testid="property-branding-contact-name"
                              className="break-words text-base font-bold leading-5 text-[#0f2440]"
                            >
                              {branding.brandName}
                            </p>
                            {branding.websiteUrl ? (
                              <a
                                href={branding.websiteUrl}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`${brandingUi.website}: ${branding.brandName}`}
                                className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-[#0f2440] underline underline-offset-4 hover:text-slate-600"
                              >
                                <Globe2 className="h-4 w-4" aria-hidden />
                                {brandingUi.website}
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {agent ? (
                      <>
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      {ui.presentedBy}
                    </span>
                    <div className="mt-4 flex items-center gap-4">
                      {agent.portraitUrl ? (
                        <div
                          data-testid="property-agent-portrait"
                          className="relative h-22 w-22 shrink-0 overflow-hidden rounded-full border border-black/8 bg-white"
                        >
                          <Image
                            src={agent.portraitUrl}
                            alt={agent.displayName}
                            fill
                            sizes="88px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div
                          data-testid="property-agent-initials"
                          className="grid h-22 w-22 shrink-0 place-items-center rounded-full bg-[#0f2440] text-lg font-bold text-white"
                        >
                          {initials(agent.displayName)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words text-xl font-semibold text-[#0f2440]">
                          {agent.displayName}
                        </h3>
                        {agent.role ? (
                          <p className="mt-1 text-sm text-slate-500">{agent.role}</p>
                        ) : null}
                        {!branding && agent.displayName !== agent.agencyName ? (
                          <p className="mt-1 text-sm font-medium text-slate-600">
                            {agent.agencyName}
                          </p>
                        ) : null}
                      </div>
                      {!branding && agent.logoUrl && agent.logoUrl !== agent.portraitUrl ? (
                        <div
                          data-testid="property-agent-agency-logo"
                          className="relative hidden h-10 w-28 shrink-0 sm:block"
                        >
                          <Image
                            src={agent.logoUrl}
                            alt={agent.agencyName}
                            fill
                            sizes="112px"
                            className="object-contain object-right"
                          />
                        </div>
                      ) : null}
                    </div>

                    {agent.phoneHref || agent.whatsappHref || agent.emailHref || agent.website ? (
                      <div className="mt-5 grid gap-2 border-t border-black/8 pt-5 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                        {agent.phoneHref && agent.phone ? (
                          <a
                            href={agent.phoneHref}
                            onClick={() => trackEvent("agent_phone_clicked")}
                            className="flex min-w-0 items-center gap-2 hover:text-[#0f2440]"
                          >
                            <Phone className="h-4 w-4 shrink-0" aria-hidden />
                            <span className="truncate">{agent.phone}</span>
                          </a>
                        ) : null}
                        {agent.whatsappHref ? (
                          <a
                            href={agent.whatsappHref}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => trackEvent("agent_whatsapp_clicked")}
                            className="flex items-center gap-2 hover:text-[#0f2440]"
                          >
                            <PropertySocialBrandIcon
                              provider="whatsapp"
                              className="h-4 w-4 shrink-0"
                            />
                            {ui.whatsapp}
                          </a>
                        ) : null}
                        {agent.emailHref && agent.email ? (
                          <a
                            href={agent.emailHref}
                            onClick={() => trackEvent("agent_email_clicked")}
                            className="flex min-w-0 items-center gap-2 hover:text-[#0f2440]"
                          >
                            <Mail className="h-4 w-4 shrink-0" aria-hidden />
                            <span className="truncate">{agent.email}</span>
                          </a>
                        ) : null}
                        {agent.website ? (
                          <a
                            href={agent.website}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 font-semibold text-[#0f2440] hover:underline"
                          >
                            <Globe2 className="h-4 w-4 shrink-0" aria-hidden />
                            Website
                          </a>
                        ) : null}
                      </div>
                    ) : null}

                    {agent.socialLinks.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {agent.socialLinks.map((link) => {
                          return (
                            <a
                              key={`${link.provider}-${link.url}`}
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={link.labelText}
                              title={link.labelText}
                              className="group grid h-11 w-11 place-items-center rounded-full border border-[#0f2440]/15 text-[#0f2440] transition hover:border-[#0f2440] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f2440]"
                            >
                              <PropertySocialBrandIcon
                                provider={link.provider}
                                className="h-4.5 w-4.5 transition-transform group-hover:scale-110"
                              />
                            </a>
                          );
                        })}
                      </div>
                    ) : null}
                      </>
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
                    : address.primaryLine || ui.location}
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
                openLabel={
                  mapView.privacyMode === "approximate"
                    ? ui.mapOpenApproximateArea
                    : ui.mapOpen
                }
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

      <footer className="border-t border-white/10 bg-[var(--property-brand-primary)] text-[var(--property-brand-primary-foreground)]">
        <div className="mx-auto max-w-[1480px] px-4 py-8 text-center sm:px-6 sm:py-10 lg:px-10">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] opacity-90">
            Equal Housing Opportunity
          </p>
          <div className="mx-auto my-5 h-px max-w-xl bg-white/12" />
          {branding ? (
            <div className="space-y-2 text-sm leading-6 opacity-65">
              {branding.showPicchuSpotCredit ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">
                    {brandingUi.poweredBy}
                  </p>
                  <BrandWordmark theme={brandPalette.primaryForeground === "#FFFFFF" ? "dark" : "light"} className="text-xl" />
                </>
              ) : (
                <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">
                  {branding.brandName}
                </p>
              )}
              <p>All information deemed reliable but not guaranteed.</p>
              <p>
                &copy; {currentYear} {branding.showPicchuSpotCredit ? "PicchuSpot" : branding.brandName} - All rights reserved.
              </p>
            </div>
          ) : (
            <div className="space-y-2 text-sm leading-6 opacity-65">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">
                Property showcase by
              </p>
              <BrandWordmark theme={brandPalette.primaryForeground === "#FFFFFF" ? "dark" : "light"} className="text-xl" />
              <p>All information deemed reliable but not guaranteed.</p>
              <p>&copy; {currentYear} PicchuSpot - All rights reserved.</p>
            </div>
          )}
          <div className="mt-5 flex flex-col items-center justify-center gap-3 border-t border-white/10 pt-5 text-sm opacity-60 sm:flex-row sm:gap-6">
            <span>
              Use of this website is subject to our{" "}
              <Link href="/terms" className="underline decoration-current/30 underline-offset-4 hover:opacity-100">
                terms of use
              </Link>
              .
            </span>
            <CookieSettingsButton />
          </div>
        </div>
      </footer>
      <PropertyViewingRequestDialog
        open={viewingDialogOpen}
        onOpenChange={setViewingDialogOpen}
        propertySlug={property.slug}
        propertyTitle={title}
        locale={language}
        turnstileSiteKey={turnstileSiteKey}
        submissionEnabled={!previewMode}
      />
    </div>
  );
}
