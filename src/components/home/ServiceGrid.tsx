import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  type ServiceVariant,
} from "./ServicePlaceholder";
import BeforeAfterFrame from "@/components/portfolio/BeforeAfterFrame";
import {
  getFeaturedHomeItems,
  getPortfolioPublicUrl,
  type PortfolioServiceSlug,
} from "@/lib/portfolio";
import { CatalogPriceText } from "@/components/pricing/currency-client";
import { getSpanishPath } from "@/lib/localized-routes";
import type { PriceKey } from "@/lib/pricing/types";

// ============================================================
// REMOTE DIGITAL SERVICES — "This is what we do" grid
//
// Server component. For each service card we look up the first
// admin-curated portfolio item flagged `featured_home` (falling
// back to the first published item by sort_order). When found,
// the card renders the real before/after pair via
// BeforeAfterFrame; otherwise it renders the original
// CSS placeholder. Either way the grid layout, typography,
// and 2-cards-per-row desktop rhythm are unchanged.
// ============================================================

interface ServiceEntry {
  /** Anchor used for `id=...` so deep-links from elsewhere keep
   *  working; not used by the second-row sub-nav anymore. */
  id: string;
  variant: ServiceVariant;
  /** Canonical portfolio slug — bridges the legacy URL/id to the
   *  10 slugs in lib/portfolio.ts (e.g. "item-removal" -> the
   *  full "item-removal-virtual-cleaning"). */
  portfolioSlug: PortfolioServiceSlug;
  name: string;
  description: string;
  priceKey?: PriceKey;
  pricePrefix?: string;
  priceSuffix?: string;
  customPriceLabel?: string;
  /** Single destination for the whole card. */
  href: string;
}

export type ServiceGridCopy = {
  eyebrow: string;
  title: string;
  description: string;
  requestQuoteLabel: string;
  beforeLabel?: string;
  afterLabel?: string;
  services: Record<
    string,
    {
      name: string;
      description: string;
      pricePrefix?: string;
      priceSuffix?: string;
      customPriceLabel?: string;
    }
  >;
};

const SERVICES: ServiceEntry[] = [
  {
    id: "image-enhancement",
    variant: "image-enhancement",
    portfolioSlug: "image-enhancement",
    name: "Image Enhancement",
    description:
      "Color, exposure, and window correction so listing photos look bright, crisp, and natural.",
    priceKey: "image-enhancement",
    pricePrefix: "From ",
    priceSuffix: " / image",
    href: "/pricing/image-enhancement",
  },
  {
    id: "day-to-dusk",
    variant: "day-to-dusk",
    portfolioSlug: "day-to-dusk",
    name: "Day to Dusk",
    description:
      "Turn a daytime exterior into a warm dusk shot — perfect for the hero photo of a listing.",
    priceKey: "day-to-dusk",
    pricePrefix: "From ",
    priceSuffix: " / image",
    href: "/pricing/day-to-dusk",
  },
  {
    id: "virtual-staging",
    variant: "virtual-staging",
    portfolioSlug: "virtual-staging",
    name: "Virtual Staging",
    description:
      "Furnish empty rooms with realistic, market-aware styling so buyers can picture the space.",
    priceKey: "virtual-staging",
    pricePrefix: "From ",
    priceSuffix: " / image",
    href: "/pricing/virtual-staging",
  },
  {
    id: "item-removal",
    variant: "item-removal",
    portfolioSlug: "item-removal-virtual-cleaning",
    name: "Item Removal & Virtual Cleaning",
    description:
      "Remove distracting clutter, personal items, or stray objects so the room itself is the star.",
    priceKey: "item-removal-virtual-cleaning",
    pricePrefix: "From ",
    priceSuffix: " / image",
    href: "/pricing/photo-editing",
  },
  {
    id: "floor-plans",
    variant: "floor-plans",
    portfolioSlug: "floor-plans",
    name: "Floor Plans",
    description:
      "Sketches, existing plans, or photos converted into clean 2D and 3D floor plans for marketing.",
    priceKey: "floor-plan-2d-bw",
    pricePrefix: "From ",
    priceSuffix: " / floor",
    href: "/pricing/floor-plans",
  },
  {
    id: "virtual-renovation",
    variant: "virtual-renovation",
    portfolioSlug: "virtual-renovation",
    name: "Virtual Renovation",
    description:
      "Show how a kitchen, bathroom, or facade could look after renovation — without lifting a hammer.",
    priceKey: "renovation-replace-walls",
    pricePrefix: "From ",
    href: "/pricing/virtual-renovation",
  },
  {
    id: "360-image-enhancement",
    variant: "panorama-enhancement",
    portfolioSlug: "360-image-enhancement",
    name: "360° Image Enhancement",
    description:
      "Enhance equirectangular panoramas so every direction reads as listing-quality.",
    priceKey: "360-image-enhancement",
    pricePrefix: "From ",
    priceSuffix: " / panorama",
    href: "/pricing/360-image-enhancement",
  },
  {
    id: "360-virtual-staging",
    variant: "panorama-staging",
    portfolioSlug: "360-virtual-staging",
    name: "360° Virtual Staging",
    description:
      "Stage furniture inside a 360 panorama so virtual tours show furnished, lived-in spaces.",
    priceKey: "360-virtual-staging",
    pricePrefix: "From ",
    priceSuffix: " / panorama",
    href: "/pricing/360-virtual-staging",
  },
  {
    id: "aerial-editing",
    variant: "aerial-editing",
    portfolioSlug: "aerial-editing",
    name: "Aerial Editing",
    description:
      "Cleaner skies, sharper detail, and balanced color for drone exteriors and listing aerials.",
    customPriceLabel: "Request a quote",
    href: "/pricing/aerial-editing",
  },
  {
    id: "development-site-plans",
    variant: "site-plans",
    portfolioSlug: "development-site-plans",
    name: "Development Site Plans",
    description:
      "Top-down site layouts that show plot boundaries, units, and amenities for development marketing.",
    href: "/pricing/development-site-plans",
  },
];

const DEFAULT_COPY: ServiceGridCopy = {
  eyebrow: "What We Do",
  title: "Remote digital services for property listings.",
  description: "Tap any service to see pricing, browse styles, and start an order.",
  requestQuoteLabel: "Request a quote",
  beforeLabel: "Before",
  afterLabel: "After",
  services: Object.fromEntries(
    SERVICES.map((service) => [
      service.id,
      {
        name: service.name,
        description: service.description,
        pricePrefix: service.pricePrefix,
        priceSuffix: service.priceSuffix,
        customPriceLabel: service.customPriceLabel,
      },
    ]),
  ),
};

/** Card-level data resolved on the server before render. */
interface ResolvedCard {
  svc: ServiceEntry;
  name: string;
  description: string;
  priceKey?: PriceKey;
  pricePrefix?: string;
  priceSuffix?: string;
  customPriceLabel?: string;
  href: string;
  beforeUrl: string | null;
  afterUrl: string | null;
  beforeAlt: string;
  afterAlt: string;
}

export default async function ServiceGrid({
  copy = DEFAULT_COPY,
  locale = "en",
}: {
  copy?: ServiceGridCopy;
  locale?: "en" | "es";
}) {
  // Single DB round trip for all 10 cards. Helper returns an
  // empty Map (not an error) when Supabase isn't configured, so
  // the marketing site builds cleanly in sandbox/preview without
  // secrets — the placeholders stay in place.
  const featured = await getFeaturedHomeItems();

  const cards: ResolvedCard[] = SERVICES.map((svc) => {
    const localized = copy.services[svc.id] ?? {
      name: svc.name,
      description: svc.description,
      pricePrefix: svc.pricePrefix,
      priceSuffix: svc.priceSuffix,
      customPriceLabel: svc.customPriceLabel,
    };
    const href =
      locale === "es" ? (getSpanishPath(svc.href) ?? svc.href) : svc.href;
    const item = featured.get(svc.portfolioSlug);
    if (!item) {
      return {
        svc,
        name: localized.name,
        description: localized.description,
        priceKey: svc.priceKey,
        pricePrefix: localized.pricePrefix ?? svc.pricePrefix,
        priceSuffix: localized.priceSuffix ?? svc.priceSuffix,
        customPriceLabel:
          localized.customPriceLabel ?? svc.customPriceLabel,
        href,
        beforeUrl: null,
        afterUrl: null,
        beforeAlt: `${localized.name} ${copy.beforeLabel ?? "before"}`,
        afterAlt: `${localized.name} ${copy.afterLabel ?? "after"}`,
      };
    }
    return {
      svc,
      name: localized.name,
      description: localized.description,
      priceKey: svc.priceKey,
      pricePrefix: localized.pricePrefix ?? svc.pricePrefix,
      priceSuffix: localized.priceSuffix ?? svc.priceSuffix,
      customPriceLabel: localized.customPriceLabel ?? svc.customPriceLabel,
      href,
      beforeUrl: getPortfolioPublicUrl(item.before_image_path),
      afterUrl: getPortfolioPublicUrl(item.after_image_path),
      beforeAlt: item.before_alt || `${localized.name} ${copy.beforeLabel ?? "before"}`,
      afterAlt: item.after_alt || `${localized.name} ${copy.afterLabel ?? "after"}`,
    };
  });

  return (
    <section className="py-16 lg:py-28 bg-surface">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="max-w-3xl mb-12 lg:mb-16">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-4">
            {copy.eyebrow}
          </p>
          <h2 className="text-4xl lg:text-6xl font-bold text-primary tracking-tight leading-[1.02]">
            {copy.title}
          </h2>
          <p className="mt-6 text-base lg:text-xl text-muted leading-relaxed">
            {copy.description}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10">
          {cards.map((card) => (
            <ServiceCard key={card.svc.id} card={card} copy={copy} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ServiceCard({
  card,
  copy,
}: {
  card: ResolvedCard;
  copy: ServiceGridCopy;
}) {
  const {
    svc,
    name,
    description,
    priceKey,
    pricePrefix,
    priceSuffix,
    customPriceLabel,
    href,
    beforeUrl,
    afterUrl,
    beforeAlt,
    afterAlt,
  } = card;
  const hasCatalogPrice = Boolean(priceKey);
  const priceText = customPriceLabel ?? copy.requestQuoteLabel;

  return (
    <Link
      href={href}
      id={svc.id}
      className="group relative flex flex-col bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-1 hover:border-primary/40 transition-all duration-300 scroll-mt-32 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
      aria-label={name}
    >
      {/* Visual — wide before/after comparison frame.
          Aspect 5:2 gives each side roughly 5:4, suitable for two
          listing photos placed side by side once real before/after
          imagery replaces the placeholder. Keeps the cards compact
          (not tall) while still showing the transformation clearly. */}
      <div className="aspect-[5/2] relative overflow-hidden bg-stone-100">
        <BeforeAfterFrame
          beforeUrl={beforeUrl}
          afterUrl={afterUrl}
          beforeAlt={beforeAlt}
          afterAlt={afterAlt}
          placeholderVariant={svc.variant}
          beforeLabel={copy.beforeLabel}
          afterLabel={copy.afterLabel}
          placeholderLabels={{
            left: copy.beforeLabel,
            right: copy.afterLabel,
          }}
        />
        {/* Hover overlay arrow */}
        <span
          aria-hidden
          className="absolute bottom-4 right-4 w-10 h-10 lg:w-11 lg:h-11 rounded-full bg-primary text-white flex items-center justify-center shadow-lg opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 z-10"
        >
          <ArrowUpRight className="w-5 h-5" />
        </span>
      </div>

      {/* Content */}
      <div className="p-6 lg:p-8 flex-1 flex flex-col">
        <h3 className="text-xl lg:text-2xl font-bold text-primary leading-tight tracking-tight group-hover:text-primary-light transition-colors">
          {name}
        </h3>
        <p
          className={
            hasCatalogPrice || customPriceLabel
              ? "mt-2 text-sm lg:text-base font-semibold text-secondary-dark"
              : "mt-2 text-sm font-medium text-muted"
          }
        >
          {priceKey ? (
            <CatalogPriceText
              priceKey={priceKey}
              prefix={pricePrefix}
              suffix={priceSuffix}
            />
          ) : (
            priceText
          )}
        </p>
        <p className="mt-3 text-sm lg:text-base text-muted leading-relaxed flex-1">
          {description}
        </p>
      </div>
    </Link>
  );
}
