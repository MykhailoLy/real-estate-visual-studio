"use client";

import TrackedLink from "@/components/analytics/TrackedLink";
import { CatalogPriceText } from "@/components/pricing/currency-client";
import type {
  HeroServicePresentation,
  RemoteServiceLocale,
} from "@/lib/pricing/remote-service-presentation";
import { cn } from "@/lib/utils";

type HeroAnalyticsEvent = "order_intent" | "pricing_cta";

interface ComparisonHeroFooterProps {
  service: HeroServicePresentation | null;
  locale: RemoteServiceLocale;
  ctaHref?: string;
  ctaLabel?: string;
  analyticsLocation?: string;
  analyticsEvent?: HeroAnalyticsEvent;
  showComparisonLabels?: boolean;
  comparisonLabelsAriaHidden?: boolean;
}

export function ComparisonHeroFooter({
  service,
  locale,
  ctaHref,
  ctaLabel,
  analyticsLocation,
  analyticsEvent,
  showComparisonLabels = true,
  comparisonLabelsAriaHidden = false,
}: ComparisonHeroFooterProps) {
  const beforeLabel = locale === "es" ? "ANTES" : "BEFORE";
  const afterLabel = locale === "es" ? "DESPUÉS" : "AFTER";
  const serviceContent = service ? (
    <>
      <span className="min-w-0 text-center font-bold uppercase tracking-[0.04em] text-[#C7A94E] transition-colors group-hover:text-[#d8bf72]">
        {service.name}
      </span>
      <span className="inline-flex whitespace-nowrap items-baseline gap-1.5 font-bold text-white">
        <span aria-hidden className="ml-1.5 text-white/40">
          ·
        </span>
        {service.price.kind === "catalog" ? (
          <CatalogPriceText
            priceKey={service.price.priceKey}
            prefix={service.price.prefix}
            suffix={service.price.suffix}
            trimWholeCents
          />
        ) : (
          service.price.label
        )}
      </span>
    </>
  ) : null;
  const centerClassName = cn(
    "group inline-flex min-h-5 max-w-full flex-wrap items-center justify-center justify-self-center rounded-sm px-1 text-center text-[13px] leading-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C7A94E] md:text-[15px] 2xl:text-base",
    showComparisonLabels
      ? "col-span-2 col-start-1 row-start-2 md:col-span-1 md:col-start-2 md:row-start-1"
      : "col-span-2 col-start-1 row-start-1 md:col-span-3",
  );

  return (
    <div
      data-testid="hero-service-footer"
      className={cn(
        "grid w-full content-center items-center bg-[#071A2B] px-3 py-1 text-white md:min-h-14 md:grid-cols-[1fr_auto_1fr] md:grid-rows-1 md:px-4 md:py-2 lg:px-5",
        showComparisonLabels
          ? "min-h-[3.75rem] grid-cols-2 grid-rows-[auto_auto] gap-y-0.5 md:gap-y-0"
          : "min-h-14 grid-cols-2 grid-rows-1",
      )}
    >
      {showComparisonLabels && (
        <>
          <span
            aria-hidden={comparisonLabelsAriaHidden || undefined}
            className="col-start-1 row-start-1 justify-self-start text-sm font-bold uppercase leading-none tracking-[0.08em] text-white md:text-base"
          >
            {beforeLabel}
          </span>
          <span
            aria-hidden={comparisonLabelsAriaHidden || undefined}
            className="col-start-2 row-start-1 justify-self-end text-sm font-bold uppercase leading-none tracking-[0.08em] text-white md:col-start-3 md:text-base"
          >
            {afterLabel}
          </span>
        </>
      )}

      {service && ctaHref && ctaLabel && analyticsLocation ? (
        <TrackedLink
          href={ctaHref}
          prefetch={false}
          analyticsLabel={ctaLabel}
          analyticsLocation={analyticsLocation}
          analyticsEvent={analyticsEvent}
          serviceSlug={service.mediaSlug}
          className={centerClassName}
        >
          {serviceContent}
        </TrackedLink>
      ) : service ? (
        <span className={centerClassName}>{serviceContent}</span>
      ) : (
        <span aria-hidden className={centerClassName} />
      )}
    </div>
  );
}

interface HeroSlideIndicatorRailProps {
  slides: readonly { id: string }[];
  activeIndex: number;
  onSelect: (index: number) => void;
  locale?: RemoteServiceLocale;
}

export function HeroSlideIndicatorRail({
  slides,
  activeIndex,
  onSelect,
  locale = "en",
}: HeroSlideIndicatorRailProps) {
  const railLabel = locale === "es" ? "Indicador de diapositivas" : "Slide indicator";

  return (
    <div
      data-testid="hero-slide-dots"
      className="absolute top-1/2 left-3 z-20 flex -translate-y-1/2 flex-col items-center justify-center md:left-4 lg:left-5"
      role="tablist"
      aria-label={railLabel}
    >
      {slides.map((slide, index) => {
        const isActive = index === activeIndex;
        const buttonLabel =
          locale === "es"
            ? `Mostrar diapositiva ${index + 1} de ${slides.length}`
            : `Show slide ${index + 1} of ${slides.length}`;

        return (
          <button
            key={slide.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={buttonLabel}
            onClick={() => onSelect(index)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(index);
              }
            }}
            className="group flex h-5 w-7 items-center justify-center rounded-full focus:outline-none md:h-[26px] md:w-8 xl:h-8"
          >
            <span
              aria-hidden
              className={cn(
                "rounded-full border shadow-[0_1px_4px_rgba(0,0,0,0.4)] transition-all duration-200 group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-[#C7A94E]",
                isActive
                  ? "h-3 w-3 border-white/90 bg-[#C7A94E] ring-1 ring-[#071A2B]/35"
                  : "h-2.5 w-2.5 border-white/70 bg-primary/50 group-hover:bg-primary/65",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

export function ComparisonHeroDivider() {
  return (
    <div
      data-testid="hero-comparison-divider"
      aria-hidden
      className="absolute top-0 bottom-0 left-1/2 z-10 w-[2px] -translate-x-1/2 bg-white/85 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]"
    />
  );
}
