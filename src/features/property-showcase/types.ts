export type PropertyStatus = "for-sale" | "reserved" | "sold" | "off-market";

export type PropertyTourProvider =
  | "kuula"
  | "matterport"
  | "cubiCasa"
  | "floorfy"
  | "nodalview"
  | "custom";

export type PropertyVideoProvider =
  | "youtube"
  | "vimeo"
  | "cloudflare-stream"
  | "mux"
  | "custom";

export type PropertySocialBrandingMode =
  | "picchuspot"
  | "agency"
  | "unbranded";

export type PropertySocialCardMode = "automatic" | "custom";

export type PropertySocialCardLayout =
  | "image-focused"
  | "balanced"
  | "minimal";

export type PropertySocialCardFactKey =
  | "listing-reference"
  | "bedrooms"
  | "bathrooms"
  | "parking"
  | "built-area"
  | "year-built"
  | "plot-area";

export interface PropertySocialCardConfig {
  mode: PropertySocialCardMode;
  layout: PropertySocialCardLayout;
  visibleFacts: PropertySocialCardFactKey[];
  factOrder: PropertySocialCardFactKey[];
  showLocation: boolean;
  showPrice: boolean;
  showBranding: boolean;
  showPoweredByPicchuSpot: boolean;
}

export type PropertyLanguageCode =
  | "en"
  | "es"
  | "de"
  | "fr"
  | "nl"
  | "pl"
  | "uk"
  | "ru";

export type PropertyBuiltInFactKey =
  | "price"
  | "listing-reference"
  | "bedrooms"
  | "bathrooms"
  | "built-area"
  | "plot-area"
  | "parking"
  | "year-built";

/**
 * Custom fact keys are deliberately data-driven. Their display label is stored
 * on the fact itself, so an administrator can add an ordered specification
 * without needing a release for every regional listing field.
 */
export type PropertyFactKey = PropertyBuiltInFactKey | `custom-${string}`;

export interface LocalizedText {
  en: string;
  es?: string;
  [language: string]: string | undefined;
}

export interface PropertyFact {
  key: PropertyFactKey;
  value: string;
  label: LocalizedText;
  sortOrder?: number;
  visible?: boolean;
}

export type ListingReferenceLabelMode =
  | "property-reference"
  | "mls-number"
  | "listing-number"
  | "custom";

export interface PropertyHighlight {
  id?: string;
  text?: LocalizedText;
  title?: LocalizedText;
  description?: LocalizedText;
  sortOrder?: number;
  visible?: boolean;
}

export interface PropertyHotspot {
  xPercent: number;
  yPercent: number;
}

export interface PropertyImageFocalPoint {
  x: number;
  y: number;
}

export interface PropertyGalleryImage {
  id: string;
  src: string;
  alt: LocalizedText;
  label: LocalizedText;
  featuredForSharing?: boolean;
  primarySocialPreview?: boolean;
  socialPreviewOrder?: number;
  note?: LocalizedText;
  roomId?: string;
  hotspot?: PropertyHotspot;
  focalPoint?: PropertyImageFocalPoint;
  sortOrder: number;
}

export type PropertyMarketingCopyMode =
  | "none"
  | "summary"
  | "highlights"
  | "custom";

export type PropertyMarketingLandscapeLayout =
  | "single-hero"
  | "hero-two-square"
  | "hero-four-grid";

export type PropertyMarketingPortraitLayout =
  | "a4-classic"
  | "a4-editorial";

export type PropertyMarketingBrochureOrientation = "portrait" | "landscape";

/** The public property-flyer workflow. Portrait rendering remains legacy-only. */
export type PropertyFlyerMode = "none" | "automatic-landscape" | "custom";

export interface PropertyCustomFlyerFiles {
  pdf?: string;
  jpg?: string;
  png?: string;
}

export type PropertyMarketingBrochureTemplate =
  | PropertyMarketingLandscapeLayout
  | PropertyMarketingPortraitLayout;

export interface PropertyMarketingBrochureConfig {
  orientation?: PropertyMarketingBrochureOrientation;
  template?: PropertyMarketingBrochureTemplate;
  primaryMediaId?: string;
  supportingMediaIds?: string[];
}

export interface PropertyMarketingLandscapeConfig {
  enabled?: boolean;
  layout?: PropertyMarketingLandscapeLayout;
  primaryMediaId?: string;
  secondaryMediaIds?: string[];
}

export interface PropertyMarketingPortraitConfig {
  enabled?: boolean;
  layout?: PropertyMarketingPortraitLayout;
  primaryMediaId?: string;
  secondaryMediaIds?: string[];
}

export interface PropertyMarketingMaterialsConfig {
  flyerMode?: PropertyFlyerMode;
  enabled?: boolean;
  brandingMode?: PropertySocialBrandingMode;
  includeAgent?: boolean;
  includeAgencyLogo?: boolean;
  includeQrCode?: boolean;
  includeDisclaimer?: boolean;
  marketingCopyMode?: PropertyMarketingCopyMode;
  customMarketingCopy?: LocalizedText;
  disclaimer?: LocalizedText;
  selectedFactKeys?: PropertySocialCardFactKey[];
  selectedHighlightIds?: string[];
  brochure?: PropertyMarketingBrochureConfig;
  customFlyer?: PropertyCustomFlyerFiles;
  /** Legacy dual-orientation configuration, normalized in code on read. */
  landscape?: PropertyMarketingLandscapeConfig;
  /** Legacy dual-orientation configuration, normalized in code on read. */
  portrait?: PropertyMarketingPortraitConfig;
}

export interface PropertyVirtualTour {
  enabled?: boolean;
  provider: PropertyTourProvider;
  embedUrl?: string;
  externalUrl?: string;
  posterImage?: string;
}

export interface PropertyInteractiveFloorPlanTour {
  enabled: boolean;
  provider: PropertyTourProvider;
  externalUrl?: string;
  embedUrl?: string;
  posterImage?: string;
}

export interface PropertyVideoItem {
  id: string;
  provider: PropertyVideoProvider;
  title?: LocalizedText;
  externalUrl?: string;
  embedUrl?: string;
  playbackId?: string;
  posterUrl?: string;
  enabled?: boolean;
  primary?: boolean;
  sortOrder: number;
}

export interface PropertyVideos {
  enabled?: boolean;
  items: PropertyVideoItem[];
}

export interface PropertySocialPreviewConfig {
  brandingMode?: PropertySocialBrandingMode;
}

export interface PropertyFloorPlan {
  id: string;
  title: LocalizedText;
  imageUrl: string;
  downloadUrl?: string;
  interactiveProvider?: PropertyTourProvider;
  interactiveExternalUrl?: string;
  interactiveEmbedUrl?: string;
  interactiveUrl?: string;
  sortOrder: number;
}

export type PropertyAgentSocialProvider =
  | "facebook"
  | "instagram"
  | "linkedin"
  | "youtube"
  | "tiktok"
  | "x"
  | "pinterest"
  | "custom";

export interface PropertyAgentSocialLink {
  provider: PropertyAgentSocialProvider;
  url: string;
  label?: LocalizedText;
  sortOrder?: number;
}

export interface PropertyAgent {
  agencyName: string;
  displayProfile?: boolean;
  agentName?: string;
  role?: LocalizedText;
  logoUrl?: string;
  portraitUrl?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  socialLinks?: PropertyAgentSocialLink[];
}

export interface PropertyLocation {
  displayAddress: LocalizedText;
  streetAddress?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  approximateLabel?: LocalizedText;
  latitude?: number;
  longitude?: number;
  approximateLatitude?: number;
  approximateLongitude?: number;
  approximateRadiusMeters?: number;
  allowApproximateAreaLink?: boolean;
  privacyMode: "exact" | "approximate" | "hidden";
  airportTravelTime?: LocalizedText;
  showMap?: boolean;
  mapExternalUrl?: string;
  mapEmbedUrl?: string;
  useCustomMapEmbed?: boolean;
  mapZoom?: number;
}

export interface PropertyTranslationContent {
  title?: string;
  summary?: string;
  description?: string[];
  highlights?: string[];
}

export interface PropertyShowcase {
  slug: string;
  reference: string;
  status: PropertyStatus;
  primaryLanguage?: PropertyLanguageCode;
  title: LocalizedText;
  summary: LocalizedText;
  description: LocalizedText[];
  priceLabel: LocalizedText;
  price: string;
  coverImage: string;
  brochureUrl?: string;
  languages: PropertyLanguageCode[];
  translations?: Partial<Record<PropertyLanguageCode, PropertyTranslationContent>>;
  facts: PropertyFact[];
  highlights: PropertyHighlight[];
  gallery: PropertyGalleryImage[];
  videos?: PropertyVideos;
  virtualTour?: PropertyVirtualTour;
  interactiveFloorPlanTour?: PropertyInteractiveFloorPlanTour;
  floorPlansEnabled?: boolean;
  floorPlans: PropertyFloorPlan[];
  socialPreview?: PropertySocialPreviewConfig;
  socialCard?: PropertySocialCardConfig;
  marketingMaterials?: PropertyMarketingMaterialsConfig;
  location: PropertyLocation;
  agent: PropertyAgent;
  publishedAt?: string;
}
