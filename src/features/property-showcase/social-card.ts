import { normalizeListingFacts, type ListingFactView } from "./listing-details.ts";
import { getPrimaryLanguage } from "./localization.ts";
import type {
  PropertyLanguageCode,
  PropertyShowcase,
  PropertySocialCardConfig,
  PropertySocialCardFactKey,
  PropertySocialCardLayout,
} from "./types.ts";

export const PROPERTY_SOCIAL_CARD_MAX_FACTS = 4;

export const PROPERTY_SOCIAL_CARD_FACT_KEYS: readonly PropertySocialCardFactKey[] = [
  "listing-reference",
  "bedrooms",
  "bathrooms",
  "parking",
  "built-area",
  "year-built",
  "plot-area",
];

export const PROPERTY_SOCIAL_CARD_FACT_LABELS: Record<
  PropertySocialCardFactKey,
  string
> = {
  "listing-reference": "Reference",
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  parking: "Parking",
  "built-area": "Built area",
  "year-built": "Year built",
  "plot-area": "Lot size",
};

export const PROPERTY_SOCIAL_CARD_AUTOMATIC_PRIORITY: readonly PropertySocialCardFactKey[] = [
  "bedrooms",
  "bathrooms",
  "built-area",
  "parking",
  "plot-area",
  "year-built",
  "listing-reference",
];

export const DEFAULT_PROPERTY_SOCIAL_CARD_CONFIG: Readonly<PropertySocialCardConfig> = {
  mode: "automatic",
  layout: "balanced",
  visibleFacts: ["bedrooms", "bathrooms", "built-area", "parking"],
  factOrder: [...PROPERTY_SOCIAL_CARD_AUTOMATIC_PRIORITY],
  showLocation: true,
  showPrice: true,
  showBranding: true,
  showPoweredByPicchuSpot: true,
};

export interface PropertySocialCardLayoutDefinition {
  imageWidth: number;
  panelWidth: number;
  showSupportingImages: boolean;
  maxFacts: number;
}

export const PROPERTY_SOCIAL_CARD_LAYOUTS: Record<
  PropertySocialCardLayout,
  PropertySocialCardLayoutDefinition
> = {
  "image-focused": {
    imageWidth: 880,
    panelWidth: 320,
    showSupportingImages: true,
    maxFacts: 4,
  },
  balanced: {
    imageWidth: 760,
    panelWidth: 440,
    showSupportingImages: true,
    maxFacts: 4,
  },
  minimal: {
    imageWidth: 880,
    panelWidth: 320,
    showSupportingImages: false,
    maxFacts: 2,
  },
};

function uniqueFactKeys(
  keys: readonly PropertySocialCardFactKey[],
): PropertySocialCardFactKey[] {
  return [...new Set(keys)].filter((key) =>
    PROPERTY_SOCIAL_CARD_FACT_KEYS.includes(key),
  );
}

export function normalizePropertySocialCardConfig(
  config: PropertySocialCardConfig | null | undefined,
): PropertySocialCardConfig {
  const factOrder = uniqueFactKeys(
    config?.factOrder ?? DEFAULT_PROPERTY_SOCIAL_CARD_CONFIG.factOrder,
  );
  const missingFacts = PROPERTY_SOCIAL_CARD_AUTOMATIC_PRIORITY.filter(
    (key) => !factOrder.includes(key),
  );

  return {
    mode: config?.mode ?? DEFAULT_PROPERTY_SOCIAL_CARD_CONFIG.mode,
    layout: config?.layout ?? DEFAULT_PROPERTY_SOCIAL_CARD_CONFIG.layout,
    visibleFacts: uniqueFactKeys(
      config?.visibleFacts ?? DEFAULT_PROPERTY_SOCIAL_CARD_CONFIG.visibleFacts,
    ).slice(0, PROPERTY_SOCIAL_CARD_MAX_FACTS),
    factOrder: [...factOrder, ...missingFacts],
    showLocation:
      config?.showLocation ?? DEFAULT_PROPERTY_SOCIAL_CARD_CONFIG.showLocation,
    showPrice: config?.showPrice ?? DEFAULT_PROPERTY_SOCIAL_CARD_CONFIG.showPrice,
    showBranding:
      config?.showBranding ?? DEFAULT_PROPERTY_SOCIAL_CARD_CONFIG.showBranding,
    showPoweredByPicchuSpot:
      config?.showPoweredByPicchuSpot ??
      DEFAULT_PROPERTY_SOCIAL_CARD_CONFIG.showPoweredByPicchuSpot,
  };
}

export function resetPropertySocialCardConfig(): PropertySocialCardConfig {
  return normalizePropertySocialCardConfig(undefined);
}

export function socialCardConfigSignature(
  config: PropertySocialCardConfig | null | undefined,
): string {
  return JSON.stringify(normalizePropertySocialCardConfig(config));
}

export function setPropertySocialCardFactVisible(
  config: PropertySocialCardConfig,
  key: PropertySocialCardFactKey,
  visible: boolean,
): { config: PropertySocialCardConfig; error?: string } {
  const normalized = normalizePropertySocialCardConfig(config);
  if (!visible) {
    return {
      config: {
        ...normalized,
        visibleFacts: normalized.visibleFacts.filter((item) => item !== key),
      },
    };
  }
  if (normalized.visibleFacts.includes(key)) return { config: normalized };
  if (normalized.visibleFacts.length >= PROPERTY_SOCIAL_CARD_MAX_FACTS) {
    return {
      config: normalized,
      error: `Choose up to ${PROPERTY_SOCIAL_CARD_MAX_FACTS} facts.`,
    };
  }
  const visibleFacts = [...normalized.visibleFacts, key];
  const factOrder = normalized.factOrder.includes(key)
    ? normalized.factOrder
    : [...normalized.factOrder, key];
  return { config: { ...normalized, visibleFacts, factOrder } };
}

export function movePropertySocialCardFact(
  config: PropertySocialCardConfig,
  key: PropertySocialCardFactKey,
  direction: -1 | 1,
): PropertySocialCardConfig {
  const normalized = normalizePropertySocialCardConfig(config);
  const selectedOrder = normalized.factOrder.filter((item) =>
    normalized.visibleFacts.includes(item),
  );
  const index = selectedOrder.indexOf(key);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= selectedOrder.length) {
    return normalized;
  }
  const nextSelected = [...selectedOrder];
  [nextSelected[index], nextSelected[target]] = [
    nextSelected[target],
    nextSelected[index],
  ];
  const unselected = normalized.factOrder.filter(
    (item) => !normalized.visibleFacts.includes(item),
  );
  return { ...normalized, factOrder: [...nextSelected, ...unselected] };
}

function isSocialCardFact(
  fact: ListingFactView,
): fact is ListingFactView & { key: PropertySocialCardFactKey } {
  return PROPERTY_SOCIAL_CARD_FACT_KEYS.includes(
    fact.key as PropertySocialCardFactKey,
  );
}

export function getPropertySocialCardFacts(
  property: PropertyShowcase,
  language: PropertyLanguageCode = getPrimaryLanguage(property),
): Array<ListingFactView & { key: PropertySocialCardFactKey }> {
  const config = normalizePropertySocialCardConfig(property.socialCard);
  const available = new Map(
    normalizeListingFacts(property, language)
      .filter(isSocialCardFact)
      .map((fact) => [fact.key, fact]),
  );
  const requestedOrder =
    config.mode === "automatic"
      ? PROPERTY_SOCIAL_CARD_AUTOMATIC_PRIORITY
      : config.factOrder.filter((key) => config.visibleFacts.includes(key));
  const maxFacts = Math.min(
    PROPERTY_SOCIAL_CARD_MAX_FACTS,
    PROPERTY_SOCIAL_CARD_LAYOUTS[config.layout].maxFacts,
  );

  return requestedOrder
    .flatMap((key) => {
      const fact = available.get(key);
      return fact ? [fact] : [];
    })
    .slice(0, maxFacts);
}
