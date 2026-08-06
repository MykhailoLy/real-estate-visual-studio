import { formatPriceLabel } from "./formatting.ts";
import { normalizePropertyImageFocalPoint } from "./focal-point.ts";
import { normalizeListingFacts } from "./listing-details.ts";
import { getPrimaryLanguage, localizedText } from "./localization.ts";
import { resolvePublicBrochureAddress } from "./property-address.ts";
import { serializePublicPropertyShowcase } from "./public-serialization.ts";
import { resolvePropertySocialImageUrl } from "./social-preview.ts";
import type {
  LocalizedText,
  PropertyGalleryImage,
  PropertyHighlight,
  PropertyImageFocalPoint,
  PropertyLanguageCode,
  PropertyMarketingBrochureOrientation,
  PropertyMarketingBrochureConfig,
  PropertyMarketingBrochureTemplate,
  PropertyMarketingLandscapeLayout,
  PropertyMarketingMaterialsConfig,
  PropertyMarketingPortraitLayout,
  PropertyShowcase,
  PropertySocialBrandingMode,
  PropertySocialCardFactKey,
} from "./types.ts";

export const PROPERTY_MARKETING_DEFAULT_DISCLAIMER =
  "All information is provided for marketing purposes and should be independently verified.";
export const PROPERTY_MARKETING_MAX_COPY_LENGTH = 200;
export const PROPERTY_MARKETING_MAX_FACTS = 6;
export const PROPERTY_MARKETING_MAX_HIGHLIGHTS = 12;

const PROPERTY_MARKETING_QR_LABELS: Record<PropertyLanguageCode, string> = {
  en: "Scan to view the full property",
  es: "Escanea para ver la propiedad completa",
  de: "Scannen Sie, um die vollständige Immobilie anzusehen",
  fr: "Scannez pour voir le bien dans son intégralité",
  nl: "Scan om de volledige woning te bekijken",
  pl: "Zeskanuj, aby zobaczyć pełną ofertę",
  uk: "Скануйте, щоб переглянути об’єкт повністю",
  ru: "Отсканируйте, чтобы посмотреть объект полностью",
};

export type PropertyMarketingAsset =
  | "brochure.png"
  | "brochure.jpg"
  | "brochure.pdf"
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
  brochure: {
    orientation: PropertyMarketingBrochureOrientation;
    template: PropertyMarketingBrochureTemplate;
    primaryMediaId?: string;
    supportingMediaIds: string[];
  };
  legacyNormalized: boolean;
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
  customFacts: Array<{ key: string; label: string; value: string }>;
  copy: string;
  highlights: string[];
  qrLabel: string;
  qrFeatures: string[];
  disclaimer: string;
  brochureImages: PropertyMarketingSelectedImage[];
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
  orientation?: PropertyMarketingBrochureOrientation;
  preview?: string;
  pdf?: string;
  jpg?: string;
  png?: string;
}

function unique(values: readonly string[] | undefined, max: number): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))]
    .slice(0, max);
}

export function isPortraitBrochureTemplate(
  template: PropertyMarketingBrochureTemplate,
): template is PropertyMarketingPortraitLayout {
  return template === "a4-classic" || template === "a4-editorial";
}

export function isLandscapeBrochureTemplate(
  template: PropertyMarketingBrochureTemplate,
): template is PropertyMarketingLandscapeLayout {
  return !isPortraitBrochureTemplate(template);
}

export function brochureSupportingImageLimit(
  template: PropertyMarketingBrochureTemplate,
): number {
  if (template === "single-hero") return 0;
  if (template === "hero-two-square") return 2;
  if (template === "hero-four-grid") return 4;
  if (template === "a4-classic" || template === "a4-editorial") return 2;
  return 5;
}

export function getPropertyMarketingRenderDimensions(
  orientation: PropertyMarketingBrochureOrientation,
  preview = false,
) {
  if (orientation === "portrait") {
    return preview ? { width: 620, height: 877 } : { width: 2480, height: 3508 };
  }
  return preview ? { width: 960, height: 540 } : { width: 1920, height: 1080 };
}

export function setBrochurePrimaryImage(
  brochure: PropertyMarketingBrochureConfig,
  mediaId: string,
): PropertyMarketingBrochureConfig {
  return {
    ...brochure,
    primaryMediaId: mediaId,
    supportingMediaIds: unique(
      brochure.supportingMediaIds?.filter((id) => id !== mediaId),
      5,
    ),
  };
}

export function toggleBrochureSupportingImage(
  brochure: PropertyMarketingBrochureConfig,
  mediaId: string,
): PropertyMarketingBrochureConfig {
  if (mediaId === brochure.primaryMediaId) return brochure;
  const current = unique(brochure.supportingMediaIds, 5);
  return {
    ...brochure,
    supportingMediaIds: current.includes(mediaId)
      ? current.filter((id) => id !== mediaId)
      : [...current, mediaId].slice(0, 5),
  };
}

export function moveBrochureSupportingImage(
  brochure: PropertyMarketingBrochureConfig,
  mediaId: string,
  direction: -1 | 1,
): PropertyMarketingBrochureConfig {
  const supportingMediaIds = unique(brochure.supportingMediaIds, 5);
  const index = supportingMediaIds.indexOf(mediaId);
  const destination = index + direction;
  if (index < 0 || destination < 0 || destination >= supportingMediaIds.length) {
    return brochure;
  }
  [supportingMediaIds[index], supportingMediaIds[destination]] = [
    supportingMediaIds[destination],
    supportingMediaIds[index],
  ];
  return { ...brochure, supportingMediaIds };
}

export function replaceBrochureSupportingImage(
  brochure: PropertyMarketingBrochureConfig,
  index: number,
  mediaId: string,
): PropertyMarketingBrochureConfig {
  if (mediaId === brochure.primaryMediaId || index < 0 || index >= 5) {
    return brochure;
  }
  const supportingMediaIds = unique(brochure.supportingMediaIds, 5)
    .filter((id) => id !== mediaId);
  if (index >= supportingMediaIds.length) supportingMediaIds.push(mediaId);
  else supportingMediaIds[index] = mediaId;
  return { ...brochure, supportingMediaIds: unique(supportingMediaIds, 5) };
}

function legacyBrochure(
  value: PropertyMarketingMaterialsConfig | undefined,
): NormalizedPropertyMarketingMaterialsConfig["brochure"] {
  const landscape = value?.landscape;
  const portrait = value?.portrait;
  const landscapeEnabled = Boolean(landscape) && landscape?.enabled !== false;
  const portraitEnabled = Boolean(portrait) && portrait?.enabled !== false;
  const landscapeHasPrimary = Boolean(landscape?.primaryMediaId?.trim());
  const portraitHasPrimary = Boolean(portrait?.primaryMediaId?.trim());

  let orientation: PropertyMarketingBrochureOrientation = "portrait";
  if (landscapeEnabled && !portraitEnabled) orientation = "landscape";
  else if (portraitEnabled && !landscapeEnabled) orientation = "portrait";
  else if (landscapeEnabled && portraitEnabled) {
    orientation = landscapeHasPrimary && !portraitHasPrimary ? "landscape" : "portrait";
  }

  if (orientation === "landscape") {
    return {
      orientation,
      template: landscape?.layout ?? "hero-two-square",
      primaryMediaId: landscape?.primaryMediaId?.trim() || undefined,
      supportingMediaIds: unique(landscape?.secondaryMediaIds, 5),
    };
  }
  return {
    orientation,
    template: portrait?.layout ?? "a4-editorial",
    primaryMediaId: portrait?.primaryMediaId?.trim() || undefined,
    supportingMediaIds: unique(portrait?.secondaryMediaIds, 5),
  };
}

export function normalizePropertyMarketingMaterialsConfig(
  value: PropertyMarketingMaterialsConfig | undefined,
  property?: Pick<PropertyShowcase, "agent">,
): NormalizedPropertyMarketingMaterialsConfig {
  const visibleAgent = property?.agent.displayProfile !== false;
  const canonical = value?.brochure;
  const orientation = canonical?.orientation ?? "portrait";
  const requestedTemplate = canonical?.template;
  const brochure = canonical
    ? {
        orientation,
        template:
          requestedTemplate &&
          ((orientation === "portrait" && isPortraitBrochureTemplate(requestedTemplate)) ||
            (orientation === "landscape" && isLandscapeBrochureTemplate(requestedTemplate)))
            ? requestedTemplate
            : orientation === "portrait"
              ? ("a4-editorial" as const)
              : ("hero-two-square" as const),
        primaryMediaId: canonical.primaryMediaId?.trim() || undefined,
        supportingMediaIds: unique(canonical.supportingMediaIds, 5),
      }
    : legacyBrochure(value);

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
    brochure,
    legacyNormalized: !canonical && Boolean(value?.landscape || value?.portrait),
  };
}

export function toCanonicalPropertyMarketingMaterialsConfig(
  value: PropertyMarketingMaterialsConfig | undefined,
  property?: Pick<PropertyShowcase, "agent">,
): PropertyMarketingMaterialsConfig {
  const normalized = normalizePropertyMarketingMaterialsConfig(value, property);
  return {
    enabled: normalized.enabled,
    brandingMode: normalized.brandingMode,
    includeAgent: normalized.includeAgent,
    includeAgencyLogo: normalized.includeAgencyLogo,
    includeQrCode: normalized.includeQrCode,
    includeDisclaimer: normalized.includeDisclaimer,
    marketingCopyMode: normalized.marketingCopyMode,
    customMarketingCopy: normalized.customMarketingCopy,
    disclaimer: normalized.disclaimer,
    selectedFactKeys: normalized.selectedFactKeys,
    selectedHighlightIds: normalized.selectedHighlightIds,
    brochure: {
      orientation: normalized.brochure.orientation,
      template: normalized.brochure.template,
      primaryMediaId: normalized.brochure.primaryMediaId,
      supportingMediaIds: normalized.brochure.supportingMediaIds,
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
  supportingMediaIds: readonly string[],
): PropertyMarketingSelectedImage[] {
  const orderedGallery = [...property.gallery].sort(
    (first, second) => first.sortOrder - second.sortOrder,
  );
  const byId = new Map(orderedGallery.map((image) => [image.id, image]));
  const cover = orderedGallery.find((image) => image.src === property.coverImage);
  const primary = (primaryMediaId && byId.get(primaryMediaId)) ?? cover ?? orderedGallery[0];
  const requested = supportingMediaIds
    .map((id) => byId.get(id))
    .filter((image): image is PropertyGalleryImage => Boolean(image));
  // Brochure photo selection is authoritative. Only the primary fallback may
  // be inferred from the cover/gallery; supporting slots must reflect the
  // administrator's explicit ordered selection.
  const candidates = [primary, ...requested].filter(
    (image): image is PropertyGalleryImage => Boolean(image),
  );
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
  }).slice(0, 6);
}

export function effectiveLandscapeLayout(
  requested: PropertyMarketingLandscapeLayout,
  imageCount: number,
): PropertyMarketingLandscapeLayout {
  if (imageCount <= 1 || requested === "single-hero") return "single-hero";
  if (requested === "hero-four-grid") {
    // Three supporting images still form a deliberate compact grid. Falling
    // back at five images previously discarded the third valid supporting
    // selection when four usable images were available.
    return imageCount >= 4 ? "hero-four-grid" : "hero-two-square";
  }
  return "hero-two-square";
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
    : (["bedrooms", "bathrooms", "parking", "built-area", "year-built", "plot-area"] satisfies PropertySocialCardFactKey[]);
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
  const customFacts = listingFacts
    .filter((fact) => fact.key.startsWith("custom-"))
    .map((fact) => ({ key: fact.key, label: fact.label, value: fact.value }));
  const summary = localizedText(publicProperty.summary, language, language);
  const customCopy = config.customMarketingCopy
    ? localizedText(config.customMarketingCopy, language, language)
    : "";
  const configuredCopy = config.marketingCopyMode === "summary"
    ? normalizeMarketingText(summary, PROPERTY_MARKETING_MAX_COPY_LENGTH)
    : config.marketingCopyMode === "custom"
      ? normalizeMarketingText(customCopy, PROPERTY_MARKETING_MAX_COPY_LENGTH)
      : "";
  const useHighlights = config.marketingCopyMode === "highlights" ||
    (config.marketingCopyMode !== "none" && !configuredCopy);
  const disclaimerText = config.disclaimer
    ? localizedText(config.disclaimer, language, language)
    : PROPERTY_MARKETING_DEFAULT_DISCLAIMER;
  const address = resolvePublicBrochureAddress(
    publicProperty.location,
    language,
    language,
  );
  const profileVisible = publicProperty.agent.displayProfile !== false;
  const showAgent = config.includeAgent && profileVisible;
  const includeAgency =
    profileVisible &&
    (config.brandingMode === "agency" || config.includeAgencyLogo);

  const qrFeatures = [
    publicProperty.gallery.length > 0 ? "Photos" : "",
    publicProperty.virtualTour?.enabled !== false &&
    Boolean(
      publicProperty.virtualTour?.embedUrl?.trim() ||
        publicProperty.virtualTour?.externalUrl?.trim(),
    )
      ? "360° Tour"
      : "",
    publicProperty.floorPlansEnabled !== false &&
    (publicProperty.floorPlans.length > 0 ||
      publicProperty.interactiveFloorPlanTour?.enabled === true)
      ? "Floor Plans"
      : "",
    profileVisible &&
    Boolean(
      publicProperty.agent.phone?.trim() ||
        publicProperty.agent.email?.trim() ||
        publicProperty.agent.whatsapp?.trim(),
    )
      ? "Contact"
      : "",
  ].filter(Boolean);

  return {
    config,
    slug: publicProperty.slug,
    canonicalUrl,
    title: localizedText(publicProperty.title, language, language),
    location: address,
    price: publicProperty.price.trim()
      ? formatPriceLabel(publicProperty.price)
      : "",
    facts,
    customFacts,
    copy: useHighlights ? "" : configuredCopy,
    highlights: config.marketingCopyMode === "none" ? [] : highlights,
    qrLabel: PROPERTY_MARKETING_QR_LABELS[language],
    qrFeatures,
    disclaimer: config.includeDisclaimer ? disclaimerText : "",
    brochureImages: selectedImages(
      publicProperty,
      config.brochure.primaryMediaId,
      config.brochure.supportingMediaIds,
    ).slice(0, brochureSupportingImageLimit(config.brochure.template) + 1),
    agent: showAgent || includeAgency
      ? {
          agencyName: publicProperty.agent.agencyName.trim(),
          name: showAgent ? publicProperty.agent.agentName?.trim() ?? "" : "",
          role: showAgent && publicProperty.agent.role
            ? localizedText(publicProperty.agent.role, language, language)
            : "",
          phone: showAgent ? publicProperty.agent.phone?.trim() ?? "" : "",
          logoUrl: config.includeAgencyLogo
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
  return JSON.stringify(toCanonicalPropertyMarketingMaterialsConfig(value));
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
    brochure: {
      orientation: "portrait",
      template: "a4-editorial",
      supportingMediaIds: [],
    },
  };
}

export function safePropertyMarketingFilename(
  slug: string,
  asset: PropertyMarketingAsset,
  orientation: PropertyMarketingBrochureOrientation =
    asset.startsWith("landscape") ? "landscape" : "portrait",
): string {
  const safeSlug = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "property";
  return `${safeSlug}-${orientation}-brochure.${asset.split(".").at(-1)}`;
}
