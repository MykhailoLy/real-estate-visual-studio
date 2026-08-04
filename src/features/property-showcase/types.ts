export type PropertyStatus = "for-sale" | "reserved" | "sold" | "off-market";

export type PropertyTourProvider =
  | "kuula"
  | "matterport"
  | "cubiCasa"
  | "floorfy"
  | "nodalview"
  | "custom";

export type PropertyLanguageCode =
  | "en"
  | "es"
  | "de"
  | "fr"
  | "nl"
  | "pl"
  | "uk"
  | "ru";

export type PropertyFactKey =
  | "price"
  | "listing-reference"
  | "bedrooms"
  | "bathrooms"
  | "built-area"
  | "plot-area"
  | "parking"
  | "year-built";

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

export interface PropertyGalleryImage {
  id: string;
  src: string;
  alt: LocalizedText;
  label: LocalizedText;
  featuredForSharing?: boolean;
  primarySocialPreview?: boolean;
  note?: LocalizedText;
  roomId?: string;
  hotspot?: PropertyHotspot;
  sortOrder: number;
}

export interface PropertyVirtualTour {
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
  latitude?: number;
  longitude?: number;
  approximateLatitude?: number;
  approximateLongitude?: number;
  approximateRadiusMeters?: number;
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
  virtualTour?: PropertyVirtualTour;
  interactiveFloorPlanTour?: PropertyInteractiveFloorPlanTour;
  floorPlans: PropertyFloorPlan[];
  location: PropertyLocation;
  agent: PropertyAgent;
  publishedAt?: string;
}
