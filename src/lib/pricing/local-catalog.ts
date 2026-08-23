export const LOCAL_PRICING_SERVICE_IDS = [
  "photography",
  "360-tours",
  "video-tours",
  "drone-photography",
  "floor-plan-2d",
] as const;

export type LocalPricingServiceId =
  (typeof LOCAL_PRICING_SERVICE_IDS)[number];
export type LocalPricingLocale = "en" | "es";

type LocalPackageLabel = "start" | "standard" | "villa" | "large-villa";

type LocalPackageScope =
  | { kind: "edited-photos"; maximum: number }
  | {
      kind: "property-size";
      size: "small-apartment" | "medium-large-property";
    }
  | {
      kind: "video-duration";
      minimumSeconds: number;
      maximumSeconds: number;
      includesVerticalReel: boolean;
    }
  | { kind: "floor-plan"; format: "2d" };

export interface LocalPricingPackage {
  id: string;
  label?: LocalPackageLabel;
  priceCents: number;
  priceQualifier: "fixed" | "from";
  scope: LocalPackageScope;
}

export interface LocalExtraUnitPrice {
  id: string;
  priceCents: number;
  unit: "edited-photo";
}

type PackagedLocalPricing = {
  kind: "packages";
  packages: readonly [LocalPricingPackage, ...LocalPricingPackage[]];
  extraUnit?: LocalExtraUnitPrice;
};

type QuoteOnlyLocalPricing = {
  kind: "quote-only";
};

export type LocalPricingEntry = PackagedLocalPricing | QuoteOnlyLocalPricing;

/**
 * Canonical Alicante / Costa Blanca pricing.
 *
 * This catalog is deliberately separate from PRICE_CATALOG: local services are
 * quoted in EUR and remain unavailable through transactional checkout.
 */
export const LOCAL_PRICE_CATALOG = {
  photography: {
    kind: "packages",
    packages: [
      {
        id: "start",
        label: "start",
        priceCents: 9_900,
        priceQualifier: "fixed",
        scope: { kind: "edited-photos", maximum: 15 },
      },
      {
        id: "standard",
        label: "standard",
        priceCents: 12_900,
        priceQualifier: "fixed",
        scope: { kind: "edited-photos", maximum: 25 },
      },
      {
        id: "villa",
        label: "villa",
        priceCents: 16_900,
        priceQualifier: "fixed",
        scope: { kind: "edited-photos", maximum: 40 },
      },
      {
        id: "large-villa",
        label: "large-villa",
        priceCents: 21_900,
        priceQualifier: "fixed",
        scope: { kind: "edited-photos", maximum: 60 },
      },
    ],
    extraUnit: {
      id: "extra-edited-photo",
      priceCents: 500,
      unit: "edited-photo",
    },
  },
  "360-tours": {
    kind: "packages",
    packages: [
      {
        id: "small-apartment",
        priceCents: 12_900,
        priceQualifier: "from",
        scope: { kind: "property-size", size: "small-apartment" },
      },
      {
        id: "medium-large-property",
        priceCents: 16_900,
        priceQualifier: "from",
        scope: { kind: "property-size", size: "medium-large-property" },
      },
    ],
  },
  "video-tours": {
    kind: "packages",
    packages: [
      {
        id: "walkthrough-45-60",
        priceCents: 10_000,
        priceQualifier: "from",
        scope: {
          kind: "video-duration",
          minimumSeconds: 45,
          maximumSeconds: 60,
          includesVerticalReel: false,
        },
      },
      {
        id: "video-60-90-reel",
        priceCents: 29_900,
        priceQualifier: "from",
        scope: {
          kind: "video-duration",
          minimumSeconds: 60,
          maximumSeconds: 90,
          includesVerticalReel: true,
        },
      },
    ],
  },
  "drone-photography": {
    kind: "quote-only",
  },
  "floor-plan-2d": {
    kind: "packages",
    packages: [
      {
        id: "floor-plan-2d",
        priceCents: 3_900,
        priceQualifier: "from",
        scope: { kind: "floor-plan", format: "2d" },
      },
    ],
  },
} as const satisfies Record<LocalPricingServiceId, LocalPricingEntry>;

const LOCAL_LABELS = {
  en: {
    from: "From",
    quoteOnly: "Quote on request",
    services: {
      photography: "Real Estate Photography",
      "360-tours": "360° Virtual Tours",
      "video-tours": "Property Video",
      "drone-photography": "Drone / Aerial",
      "floor-plan-2d": "2D Floor Plan",
    },
    packages: {
      start: "Start",
      standard: "Standard",
      villa: "Villa",
      "large-villa": "Large / Villa",
    },
    smallApartment: "small apartment",
    mediumLargeProperty: "medium / large property",
    editedPhotos: (maximum: number) => `up to ${maximum} edited photos`,
    videoWalkthrough: (minimum: number, maximum: number) =>
      `${minimum}–${maximum} sec walkthrough`,
    videoWithReel: (minimum: number, maximum: number) =>
      `${minimum}–${maximum} sec video + vertical Reel`,
    floorPlan2d: "2D floor plan",
    extraEditedPhoto: "extra edited photo",
  },
  es: {
    from: "Desde",
    quoteOnly: "Presupuesto bajo petición",
    services: {
      photography: "Fotografía inmobiliaria",
      "360-tours": "Tours virtuales 360°",
      "video-tours": "Vídeo de propiedad",
      "drone-photography": "Dron / Aéreo",
      "floor-plan-2d": "Plano 2D",
    },
    packages: {
      start: "Inicial",
      standard: "Estándar",
      villa: "Villa",
      "large-villa": "Grande / Villa",
    },
    smallApartment: "apartamento pequeño",
    mediumLargeProperty: "propiedad mediana / grande",
    editedPhotos: (maximum: number) => `hasta ${maximum} fotos editadas`,
    videoWalkthrough: (minimum: number, maximum: number) =>
      `recorrido de ${minimum}–${maximum} s`,
    videoWithReel: (minimum: number, maximum: number) =>
      `vídeo de ${minimum}–${maximum} s + Reel vertical`,
    floorPlan2d: "plano 2D",
    extraEditedPhoto: "foto editada adicional",
  },
} as const;

export interface LocalPricingDisplayRow {
  id: string;
  packageLabel: string | null;
  priceLabel: string;
  detailLabel: string | null;
}

export interface LocalPricingPresentation {
  serviceLabel: string;
  overviewPriceLabel: string;
  rows: readonly LocalPricingDisplayRow[];
}

export function getLocalPricingEntry(
  serviceId: LocalPricingServiceId,
): LocalPricingEntry {
  return LOCAL_PRICE_CATALOG[serviceId];
}

export function formatLocalEuro(
  priceCents: number,
  locale: LocalPricingLocale,
  includeMinorUnits = false,
): string {
  const amount = priceCents / 100;
  const value = new Intl.NumberFormat(locale === "es" ? "es-ES" : "en-IE", {
    minimumFractionDigits: includeMinorUnits ? 2 : 0,
    maximumFractionDigits: includeMinorUnits ? 2 : 0,
  }).format(amount);

  return locale === "es" ? `${value} €` : `€${value}`;
}

function getScopeLabel(
  scope: LocalPackageScope,
  locale: LocalPricingLocale,
): string {
  const labels = LOCAL_LABELS[locale];

  switch (scope.kind) {
    case "edited-photos":
      return labels.editedPhotos(scope.maximum);
    case "property-size":
      return scope.size === "small-apartment"
        ? labels.smallApartment
        : labels.mediumLargeProperty;
    case "video-duration":
      return scope.includesVerticalReel
        ? labels.videoWithReel(scope.minimumSeconds, scope.maximumSeconds)
        : labels.videoWalkthrough(scope.minimumSeconds, scope.maximumSeconds);
    case "floor-plan":
      return labels.floorPlan2d;
  }
}

function getPackagePriceLabel(
  item: LocalPricingPackage,
  locale: LocalPricingLocale,
  includeMinorUnits = false,
): string {
  const amount = formatLocalEuro(item.priceCents, locale, includeMinorUnits);
  return item.priceQualifier === "from"
    ? `${LOCAL_LABELS[locale].from} ${amount}`
    : amount;
}

export function getLocalPricingPresentation(
  serviceId: LocalPricingServiceId,
  locale: LocalPricingLocale = "en",
  includeMinorUnits = false,
): LocalPricingPresentation {
  const entry = getLocalPricingEntry(serviceId);
  const labels = LOCAL_LABELS[locale];

  if (entry.kind === "quote-only") {
    return {
      serviceLabel: labels.services[serviceId],
      overviewPriceLabel: labels.quoteOnly,
      rows: [
        {
          id: "quote-only",
          packageLabel: null,
          priceLabel: labels.quoteOnly,
          detailLabel: null,
        },
      ],
    };
  }

  const rows: LocalPricingDisplayRow[] = entry.packages.map((item) => ({
    id: item.id,
    packageLabel: item.label ? labels.packages[item.label] : null,
    priceLabel: getPackagePriceLabel(item, locale, includeMinorUnits),
    detailLabel: getScopeLabel(item.scope, locale),
  }));

  if (entry.extraUnit) {
    rows.push({
      id: entry.extraUnit.id,
      packageLabel: null,
      priceLabel: formatLocalEuro(
        entry.extraUnit.priceCents,
        locale,
        includeMinorUnits,
      ),
      detailLabel: labels.extraEditedPhoto,
    });
  }

  return {
    serviceLabel: labels.services[serviceId],
    overviewPriceLabel: `${labels.from} ${formatLocalEuro(
      entry.packages[0].priceCents,
      locale,
      includeMinorUnits,
    )}`,
    rows,
  };
}

export function formatLocalPricingRow(row: LocalPricingDisplayRow): string {
  const packagePrefix = row.packageLabel ? `${row.packageLabel} — ` : "";
  const detailSuffix = row.detailLabel ? ` / ${row.detailLabel}` : "";
  return `${packagePrefix}${row.priceLabel}${detailSuffix}`;
}
