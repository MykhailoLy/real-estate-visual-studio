import type { ServiceVariant } from "@/components/home/ServicePlaceholder";
import { getSpanishPath } from "@/lib/localized-routes";
import {
  getPortfolioService,
  isPortfolioServiceSlug,
  type PortfolioServiceSlug,
} from "@/lib/portfolio-service-meta";
import type { PriceKey } from "@/lib/pricing/types";

export type RemoteServiceLocale = "en" | "es";
type RemoteServiceUnit = "image" | "floor" | "panorama";

export type RemoteServicePrice =
  | {
      kind: "catalog";
      priceKey: PriceKey;
      unit: RemoteServiceUnit;
    }
  | {
      kind: "label";
      label: Record<RemoteServiceLocale, string>;
    };

export interface RemoteServicePresentation {
  id: string;
  name: Record<RemoteServiceLocale, string>;
  href: string;
  price: RemoteServicePrice;
  mediaSlug: PortfolioServiceSlug;
  fallbackVariant: ServiceVariant;
}

export interface RemoteServiceGroup {
  title: string;
  services: readonly RemoteServicePresentation[];
}

const SERVICE_DISPLAY_NAMES: Record<
  PortfolioServiceSlug,
  Record<RemoteServiceLocale, string>
> = {
  "image-enhancement": { en: "Image Enhancement", es: "Mejora de imagen" },
  "day-to-dusk": { en: "Day to Dusk", es: "Day to Dusk" },
  "virtual-staging": { en: "Virtual Staging", es: "Virtual Staging" },
  "item-removal-virtual-cleaning": {
    en: "Item Removal & Virtual Cleaning",
    es: "Eliminación de objetos y limpieza virtual",
  },
  "floor-plans": { en: "2D / 3D Floor Plans", es: "Planos 2D y 3D" },
  "virtual-renovation": { en: "Virtual Renovation", es: "Renovación virtual" },
  "360-image-enhancement": {
    en: "360° Image Enhancement",
    es: "Mejora de imagen 360°",
  },
  "360-virtual-staging": {
    en: "360° Virtual Staging",
    es: "Virtual Staging 360°",
  },
  "aerial-editing": { en: "Aerial Editing", es: "Edición aérea" },
  "development-site-plans": {
    en: "Development Site Plans",
    es: "Planos de desarrollo",
  },
};

const SERVICE_PRICES: Record<PortfolioServiceSlug, RemoteServicePrice> = {
  "image-enhancement": {
    kind: "catalog",
    priceKey: "image-enhancement",
    unit: "image",
  },
  "day-to-dusk": {
    kind: "catalog",
    priceKey: "day-to-dusk",
    unit: "image",
  },
  "virtual-staging": {
    kind: "catalog",
    priceKey: "virtual-staging",
    unit: "image",
  },
  "item-removal-virtual-cleaning": {
    kind: "catalog",
    priceKey: "item-removal-virtual-cleaning",
    unit: "image",
  },
  "floor-plans": {
    kind: "catalog",
    priceKey: "floor-plan-2d-bw",
    unit: "floor",
  },
  "virtual-renovation": {
    kind: "label",
    label: { en: "Option-based pricing", es: "Precio por opciones" },
  },
  "360-image-enhancement": {
    kind: "catalog",
    priceKey: "360-image-enhancement",
    unit: "panorama",
  },
  "360-virtual-staging": {
    kind: "catalog",
    priceKey: "360-virtual-staging",
    unit: "panorama",
  },
  "aerial-editing": {
    kind: "catalog",
    priceKey: "aerial-colour-fade",
    unit: "image",
  },
  "development-site-plans": {
    kind: "label",
    label: { en: "Quote on request", es: "Presupuesto a medida" },
  },
};

const GROUPS: readonly { title: string; slugs: readonly PortfolioServiceSlug[] }[] = [
  {
    title: "Photo Editing",
    slugs: [
      "image-enhancement",
      "day-to-dusk",
      "item-removal-virtual-cleaning",
      "aerial-editing",
    ],
  },
  {
    title: "Staging & Renovation",
    slugs: [
      "virtual-staging",
      "virtual-renovation",
      "360-virtual-staging",
      "360-image-enhancement",
    ],
  },
  {
    title: "Plans & Property Visuals",
    slugs: ["floor-plans", "development-site-plans"],
  },
] as const;

function presentationForSlug(
  mediaSlug: PortfolioServiceSlug,
): RemoteServicePresentation {
  const portfolioService = getPortfolioService(mediaSlug);

  return {
    id: mediaSlug === "item-removal-virtual-cleaning" ? "item-removal" : mediaSlug,
    name: SERVICE_DISPLAY_NAMES[mediaSlug],
    href: portfolioService.pricingHref,
    price: SERVICE_PRICES[mediaSlug],
    mediaSlug,
    fallbackVariant: portfolioService.placeholderVariant,
  };
}

export const REMOTE_SERVICE_GROUPS: readonly RemoteServiceGroup[] = GROUPS.map(
  (group) => ({
    title: group.title,
    services: group.slugs.map(presentationForSlug),
  }),
);

export const REMOTE_SERVICE_PRESENTATIONS = REMOTE_SERVICE_GROUPS.flatMap(
  (group) => group.services,
);

const LEGACY_SLUG_ALIASES: Readonly<Record<string, PortfolioServiceSlug>> = {
  "item-removal": "item-removal-virtual-cleaning",
};

function resolveMediaSlug(
  serviceSlug: string | null | undefined,
): PortfolioServiceSlug | null {
  if (!serviceSlug) return null;
  if (isPortfolioServiceSlug(serviceSlug)) return serviceSlug;
  return LEGACY_SLUG_ALIASES[serviceSlug] ?? null;
}

/**
 * Resolves a homepage or site-media service slug through the same public
 * presentation data used by the pricing hub. Unknown media stays visual-only.
 */
export function getRemoteServicePresentation(
  serviceSlug: string | null | undefined,
): RemoteServicePresentation | null {
  const mediaSlug = resolveMediaSlug(serviceSlug);
  if (!mediaSlug) return null;

  return (
    REMOTE_SERVICE_PRESENTATIONS.find(
      (service) => service.mediaSlug === mediaSlug,
    ) ?? null
  );
}

export type HomeHeroServicePresentation = {
  name: string;
  ctaLabel: string;
  href: string;
  price:
    | {
        kind: "catalog";
        priceKey: PriceKey;
        prefix: string;
        suffix: string;
      }
    | {
        kind: "label";
        label: string;
      };
  mediaSlug: PortfolioServiceSlug;
};

const UNIT_LABELS: Record<RemoteServiceUnit, Record<RemoteServiceLocale, string>> = {
  image: { en: "image", es: "imagen" },
  floor: { en: "floor", es: "plano" },
  panorama: { en: "panorama", es: "panorama" },
};

export function getHomeHeroServicePresentation(
  serviceSlug: string | null | undefined,
  locale: RemoteServiceLocale,
): HomeHeroServicePresentation | null {
  const service = getRemoteServicePresentation(serviceSlug);
  if (!service) return null;

  const href =
    locale === "es" ? (getSpanishPath(service.href) ?? service.href) : service.href;

  if (service.price.kind === "label") {
    const name = service.name[locale];
    return {
      name,
      ctaLabel:
        locale === "es" ? `Ver precios de ${name}` : `View ${name} pricing`,
      href,
      price: { kind: "label", label: service.price.label[locale] },
      mediaSlug: service.mediaSlug,
    };
  }

  const name = service.name[locale];
  return {
    name,
    ctaLabel:
      locale === "es" ? `Ver precios de ${name}` : `View ${name} pricing`,
    href,
    price: {
      kind: "catalog",
      priceKey: service.price.priceKey,
      prefix: locale === "es" ? "Desde " : "From ",
      suffix: ` / ${UNIT_LABELS[service.price.unit][locale]}`,
    },
    mediaSlug: service.mediaSlug,
  };
}
