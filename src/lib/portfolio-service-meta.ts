import type { ServiceVariant } from "@/components/home/ServicePlaceholder";

/**
 * Canonical public service metadata shared by portfolio reads and presentation
 * layers. This module deliberately contains no Supabase imports so it is safe
 * for client components that need only labels, routes, or fallback variants.
 */
export const PORTFOLIO_SERVICE_SLUGS = [
  "image-enhancement",
  "day-to-dusk",
  "virtual-staging",
  "item-removal-virtual-cleaning",
  "floor-plans",
  "virtual-renovation",
  "360-image-enhancement",
  "360-virtual-staging",
  "aerial-editing",
  "development-site-plans",
] as const;

export type PortfolioServiceSlug = (typeof PORTFOLIO_SERVICE_SLUGS)[number];

export function isPortfolioServiceSlug(
  value: unknown,
): value is PortfolioServiceSlug {
  return (
    typeof value === "string" &&
    (PORTFOLIO_SERVICE_SLUGS as readonly string[]).includes(value)
  );
}

export interface PortfolioServiceMeta {
  slug: PortfolioServiceSlug;
  label: string;
  /** Public pricing page URL — note photo-editing legacy URL. */
  pricingHref: string;
  /** Variant used by ServicePlaceholder as fallback when no item exists. */
  placeholderVariant: ServiceVariant;
}

export const PORTFOLIO_SERVICES: PortfolioServiceMeta[] = [
  {
    slug: "image-enhancement",
    label: "Image Enhancement",
    pricingHref: "/pricing/image-enhancement",
    placeholderVariant: "image-enhancement",
  },
  {
    slug: "day-to-dusk",
    label: "Day to Dusk",
    pricingHref: "/pricing/day-to-dusk",
    placeholderVariant: "day-to-dusk",
  },
  {
    slug: "virtual-staging",
    label: "Virtual Staging",
    pricingHref: "/pricing/virtual-staging",
    placeholderVariant: "virtual-staging",
  },
  {
    slug: "item-removal-virtual-cleaning",
    label: "Item Removal & Virtual Cleaning",
    pricingHref: "/pricing/photo-editing",
    placeholderVariant: "item-removal",
  },
  {
    slug: "floor-plans",
    label: "Floor Plans",
    pricingHref: "/pricing/floor-plans",
    placeholderVariant: "floor-plans",
  },
  {
    slug: "virtual-renovation",
    label: "Virtual Renovation",
    pricingHref: "/pricing/virtual-renovation",
    placeholderVariant: "virtual-renovation",
  },
  {
    slug: "360-image-enhancement",
    label: "360° Image Enhancement",
    pricingHref: "/pricing/360-image-enhancement",
    placeholderVariant: "panorama-enhancement",
  },
  {
    slug: "360-virtual-staging",
    label: "360° Virtual Staging",
    pricingHref: "/pricing/360-virtual-staging",
    placeholderVariant: "panorama-staging",
  },
  {
    slug: "aerial-editing",
    label: "Aerial Editing",
    pricingHref: "/pricing/aerial-editing",
    placeholderVariant: "aerial-editing",
  },
  {
    slug: "development-site-plans",
    label: "Development Site Plans",
    pricingHref: "/pricing/development-site-plans",
    placeholderVariant: "site-plans",
  },
];

const SLUG_INDEX: Record<PortfolioServiceSlug, PortfolioServiceMeta> =
  Object.fromEntries(
    PORTFOLIO_SERVICES.map((service) => [service.slug, service]),
  ) as Record<PortfolioServiceSlug, PortfolioServiceMeta>;

export function getPortfolioService(
  slug: PortfolioServiceSlug,
): PortfolioServiceMeta {
  return SLUG_INDEX[slug];
}

export const ALL_PORTFOLIO_PRICING_PATHS = PORTFOLIO_SERVICES.map(
  (service) => service.pricingHref,
);
