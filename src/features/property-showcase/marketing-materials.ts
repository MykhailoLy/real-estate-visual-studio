import { formatPriceLabel } from "./formatting.ts";
import { normalizePropertyImageFocalPoint } from "./focal-point.ts";
import { normalizeListingFacts } from "./listing-details.ts";
import { getPrimaryLanguage, localizedText } from "./localization.ts";
import { getPropertyAddressView } from "./property-address.ts";
import { serializePublicPropertyShowcase } from "./public-serialization.ts";
import { resolvePropertySocialImageUrl } from "./social-preview.ts";
import type {
  LocalizedText,
  PropertyGalleryImage,
  PropertyHighlight,
  PropertyImageFocalPoint,
  PropertyMarketingLandscapeLayout,
  PropertyMarketingMaterialsConfig,
  PropertyMarketingPortraitLayout,
  PropertyLanguageCode,
  PropertyShowcase,
  PropertySocialBrandingMode,
  PropertySocialCardFactKey,
} from "./types.ts";

export const PROPERTY_MARKETING_DEFAULT_DISCLAIMER =
  "All information is provided for marketing purposes and should be independently verified.";
export const PROPERTY_MARKETING_MAX_COPY_LENGTH = 200;
export const PROPERTY_MARKETING_MAX_FACTS = 4;
export const PROPERTY_MARKETING_MAX_HIGHLIGHTS = 3;

export type PropertyMarketingAsset =
  | "landscape.png"
  | "landscape.jpg"
  | "flyer.png"
  | "flyer.jpg"
  | "flyer.pdf";

export interface NormalizedPropertyMarketingMaterialsConfig {
  enabled: boolean;
  brandingMode: PropertySocialBrandingMode;
  includeAgent: boolean;
  includeAgencyLogo: boolean;
  includeQrCode: boolean;
  includeDisclaimer: boolean;
  marketingCopyMode: "none" | "summary" | "highlights" | "custom";
  customMarketingCopy?: LocalizedText;
  disclaimer?: LocalizedText;
  selectedFactKeys: PropertySocialCardFactKey[];
  selectedHighlightIds: string[];
  landscape: {
    enabled: boolean;
    layout: PropertyMarketingLandscapeLayout;
    primaryMediaId?: string;
    secondaryMediaIds: string[];
  };
  portrait: {
    enabled: boolean;
    layout: PropertyMarketingPortraitLayout;
    primaryMediaId?: string;
    secondaryMediaIds: string[];
  };
}

export interface PropertyMarketingSelectedImage {
  id: string;
  imageUrl: string;
  imageAlt: string;
  focalPoint: PropertyImageFocalPoint;
}

export interface PropertyMarketingMaterialView {
  config: NormalizedPropertyMarketingMaterialsConfig;
  slug: string;
  canonicalUrl: string;
  title: string;
  location: string;
  price: string;
  facts: Array<{ key: PropertySocialCardFactKey; label: string; value: string }>;
  copy: string;
  highlights: string[];
  disclaimer: string;
  landscapeImages: PropertyMarketingSelectedImage[];
  portraitImages: PropertyMarketingSelectedImage[];
  agent: {
    agencyName: string;
    name: string;
    role: string;
    phone: string;
    logoUrl?: string;
    portraitUrl?: string;
  } | null;
}

export interface PropertyMarketingMaterialLinks {
  landscapePng?: string;
  landscapeJpg?: string;
  flyerPng?: string;
  flyerJpg?: string;
  flyerPdf?: string;
}

function unique(values: readonly string[] | undefined, max: number): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))]
    .slice(0, max);
}

export function normalizePropertyMarketingMaterialsConfig(
  value: PropertyMarketingMaterialsConfig | undefined,
  property?: Pick<PropertyShowcase, "agent">,
): NormalizedPropertyMarketingMaterialsConfig {
  const visibleAgent = property?.agent.displayProfile !== false;
  return {
    enabled: value?.enabled === true,
    brandingMode: value?.brandingMode ?? "picchuspot",
    includeAgent: value?.includeAgent ?? visibleAgent,
    includeAgencyLogo:
      value?.includeAgencyLogo ?? Boolean(property?.agent.logoUrl?.trim()),
    includeQrCode: value?.includeQrCode ?? true,
    includeDisclaimer: value?.includeDisclaimer ?? false,
    marketingCopyMode: value?.marketingCopyMode ?? "summary",
    customMarketingCopy: value?.customMarketingCopy,
    disclaimer: value?.disclaimer,
    selectedFactKeys: unique(
      value?.selectedFactKeys,
      PROPERTY_MARKETING_MAX_FACTS,
    ) as PropertySocialCardFactKey[],
    selectedHighlightIds: unique(
      value?.selectedHighlightIds,
      PROPERTY_MARKETING_MAX_HIGHLIGHTS,
    ),
    landscape: {
      enabled: value?.landscape?.enabled ?? true,
      layout: value?.landscape?.layout ?? "hero-two-square",
      primaryMediaId: value?.landscape?.primaryMediaId?.trim() || undefined,
      secondaryMediaIds: unique(value?.landscape?.secondaryMediaIds, 4),
    },
    portrait: {
      enabled: value?.portrait?.enabled ?? true,
      layout: value?.portrait?.layout ?? "a4-editorial",
      primaryMediaId: value?.portrait?.primaryMediaId?.trim() || undefined,
      secondaryMediaIds: unique(value?.portrait?.secondaryMediaIds, 5),
    },
  };
}

export function propertyHighlightId(
  highlight: PropertyHighlight,
  index: number,
): string {
  return highlight.id?.trim() || `highlight-${index + 1}`;
}

function normalizeMarketingText(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  const candidate = normalized.slice(0, max + 1);
  const boundary = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, boundary > max * 0.65 ? boundary : max).trim()}…`;
}

function localizedHighlight(
  highlight: PropertyHighlight,
  language: PropertyLanguageCode,
  fallbackLanguage: PropertyLanguageCode,
): string {
  return localizedText(
    highlight.text ?? highlight.title ?? { en: "" },
    language,
    fallbackLanguage,
  );
}

function selectedImages(
  property: PropertyShowcase,
  primaryMediaId: string | undefined,
  secondaryMediaIds: readonly string[],
  maxImages: number,
): PropertyMarketingSelectedImage[] {
  const orderedGallery = [...property.gallery].sort(
    (first, second) => first.sortOrder - second.sortOrder,
  );
  const byId = new Map(orderedGallery.map((image) => [image.id, image]));
  const cover = orderedGallery.find((image) => image.src === property.coverImage);
  const primary = (primaryMediaId && byId.get(primaryMediaId)) ?? cover ?? orderedGallery[0];
  const requested = secondaryMediaIds
    .map((id) => byId.get(id))
    .filter((image): image is PropertyGalleryImage => Boolean(image));
  const candidates = [
    primary,
    ...requested,
    ...orderedGallery,
  ].filter((image): image is PropertyGalleryImage => Boolean(image));
  const seen = new Set<string>();

  return candidates.flatMap((image) => {
    if (seen.has(image.id)) return [];
    const imageUrl = resolvePropertySocialImageUrl(property, image.src);
    if (!imageUrl) return [];
    seen.add(image.id);
    return [{
      id: image.id,
      imageUrl,
      imageAlt: localizedText(
        image.alt,
        getPrimaryLanguage(property),
        getPrimaryLanguage(property),
      ),
      focalPoint: normalizePropertyImageFocalPoint(image.focalPoint),
    }];
  }).slice(0, maxImages);
}

export function effectiveLandscapeLayout(
  requested: PropertyMarketingLandscapeLayout,
  imageCount: number,
): PropertyMarketingLandscapeLayout {
  if (imageCount <= 1) return "single-hero";
  if (requested === "hero-four-grid" && imageCount < 4) {
    return imageCount >= 3 ? "hero-two-square" : "single-hero";
  }
  if (requested === "hero-two-square" && imageCount < 3) {
    return imageCount === 2 ? "hero-two-square" : "single-hero";
  }
  return requested;
}

export function createPropertyMarketingMaterialView(
  property: PropertyShowcase,
  canonicalUrl: string,
): PropertyMarketingMaterialView {
  const publicProperty = serializePublicPropertyShowcase(property);
  const language = getPrimaryLanguage(publicProperty);
  const config = normalizePropertyMarketingMaterialsConfig(
    publicProperty.marketingMaterials,
    publicProperty,
  );
  const listingFacts = normalizeListingFacts(publicProperty, language);
  const selectedFactKeys = config.selectedFactKeys.length > 0
    ? config.selectedFactKeys
    : (["bedrooms", "bathrooms", "built-area", "plot-area"] satisfies PropertySocialCardFactKey[]);
  const facts = selectedFactKeys.flatMap((key) => {
    const fact = listingFacts.find((candidate) => candidate.key === key);
    return fact ? [{ key, label: fact.label, value: fact.value }] : [];
  }).slice(0, PROPERTY_MARKETING_MAX_FACTS);
  const visibleHighlights = publicProperty.highlights
    .map((highlight, index) => ({
      id: propertyHighlightId(highlight, index),
      value: localizedHighlight(highlight, language, language),
      visible: highlight.visible !== false,
    }))
    .filter((highlight) => highlight.visible && highlight.value);
  const selectedHighlights = config.selectedHighlightIds.length > 0
    ? config.selectedHighlightIds.flatMap((id) => {
        const match = visibleHighlights.find((highlight) => highlight.id === id);
        return match ? [match.value] : [];
      })
    : visibleHighlights.map((highlight) => highlight.value);
  const highlights = selectedHighlights.slice(0, PROPERTY_MARKETING_MAX_HIGHLIGHTS);
  const summary = localizedText(publicProperty.summary, language, language);
  const customCopy = config.customMarketingCopy
    ? localizedText(config.customMarketingCopy, language, language)
    : "";
  const copy = config.marketingCopyMode === "summary"
    ? normalizeMarketingText(summary, PROPERTY_MARKETING_MAX_COPY_LENGTH)
    : config.marketingCopyMode === "highlights"
      ? normalizeMarketingText(highlights.join(" · "), PROPERTY_MARKETING_MAX_COPY_LENGTH)
      : config.marketingCopyMode === "custom"
        ? normalizeMarketingText(customCopy, PROPERTY_MARKETING_MAX_COPY_LENGTH)
        : "";
  const disclaimerText = config.disclaimer
    ? localizedText(config.disclaimer, language, language)
    : PROPERTY_MARKETING_DEFAULT_DISCLAIMER;
  const address = getPropertyAddressView(
    publicProperty.location,
    language,
    language,
  );
  const profileVisible = publicProperty.agent.displayProfile !== false;
  const showAgent = config.includeAgent && profileVisible;
  const includeAgency =
    profileVisible &&
    (config.brandingMode === "agency" || config.includeAgencyLogo);

  return {
    config,
    slug: publicProperty.slug,
    canonicalUrl,
    title: localizedText(publicProperty.title, language, language),
    location: address.socialText,
    price: publicProperty.price.trim()
      ? formatPriceLabel(publicProperty.price)
      : "",
    facts,
    copy,
    highlights,
    disclaimer: config.includeDisclaimer ? disclaimerText : "",
    landscapeImages: selectedImages(
      publicProperty,
      config.landscape.primaryMediaId,
      config.landscape.secondaryMediaIds,
      5,
    ),
    portraitImages: selectedImages(
      publicProperty,
      config.portrait.primaryMediaId,
      config.portrait.secondaryMediaIds,
      6,
    ),
    agent: showAgent || includeAgency
      ? {
          agencyName: publicProperty.agent.agencyName.trim(),
          name: showAgent ? publicProperty.agent.agentName?.trim() ?? "" : "",
          role: showAgent && publicProperty.agent.role
            ? localizedText(publicProperty.agent.role, language, language)
            : "",
          phone: showAgent ? publicProperty.agent.phone?.trim() ?? "" : "",
          logoUrl:
            config.includeAgencyLogo
              ? resolvePropertySocialImageUrl(
                  publicProperty,
                  publicProperty.agent.logoUrl,
                ) ?? undefined
              : undefined,
          portraitUrl: showAgent
            ? resolvePropertySocialImageUrl(
                publicProperty,
                publicProperty.agent.portraitUrl,
              ) ?? undefined
            : undefined,
        }
      : null,
  };
}

export function propertyMarketingMaterialsSignature(
  value: PropertyMarketingMaterialsConfig | undefined,
): string {
  return JSON.stringify(normalizePropertyMarketingMaterialsConfig(value));
}

export function resetPropertyMarketingMaterialsConfig(): PropertyMarketingMaterialsConfig {
  return {
    enabled: false,
    brandingMode: "picchuspot",
    includeAgent: true,
    includeAgencyLogo: true,
    includeQrCode: true,
    includeDisclaimer: false,
    marketingCopyMode: "summary",
    selectedFactKeys: [],
    selectedHighlightIds: [],
    landscape: { enabled: true, layout: "hero-two-square", secondaryMediaIds: [] },
    portrait: { enabled: true, layout: "a4-editorial", secondaryMediaIds: [] },
  };
}

export function safePropertyMarketingFilename(
  slug: string,
  asset: PropertyMarketingAsset,
): string {
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "property";
  return `${safeSlug}-${asset.startsWith("flyer") ? "flyer" : "landscape"}.${asset.split(".").at(-1)}`;
}
