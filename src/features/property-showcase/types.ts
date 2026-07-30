export type PropertyStatus = "for-sale" | "reserved" | "sold" | "off-market";

export type PropertyTourProvider =
  | "kuula"
  | "matterport"
  | "cubiCasa"
  | "floorfy"
  | "nodalview"
  | "custom";

export type PropertyFactKey =
  | "bedrooms"
  | "bathrooms"
  | "built-area"
  | "plot-area"
  | "parking"
  | "year-built";

export interface LocalizedText {
  en: string;
  es?: string;
}

export interface PropertyFact {
  key: PropertyFactKey;
  value: string;
  label: LocalizedText;
}

export interface PropertyHighlight {
  title: LocalizedText;
  description: LocalizedText;
}

export interface PropertyGalleryImage {
  id: string;
  src: string;
  alt: LocalizedText;
  label: LocalizedText;
  roomId?: string;
  sortOrder: number;
}

export interface PropertyVirtualTour {
  provider: PropertyTourProvider;
  embedUrl?: string;
  externalUrl?: string;
  posterImage?: string;
}

export interface PropertyFloorPlan {
  id: string;
  title: LocalizedText;
  imageUrl: string;
  downloadUrl?: string;
  interactiveUrl?: string;
  sortOrder: number;
}

export interface PropertyAgent {
  agencyName: string;
  agentName?: string;
  role?: LocalizedText;
  logoUrl?: string;
  portraitUrl?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
}

export interface PropertyLocation {
  displayAddress: LocalizedText;
  latitude?: number;
  longitude?: number;
  privacyMode: "exact" | "approximate" | "hidden";
  airportTravelTime?: LocalizedText;
}

export interface PropertyShowcase {
  slug: string;
  reference: string;
  status: PropertyStatus;
  title: LocalizedText;
  summary: LocalizedText;
  description: LocalizedText[];
  priceLabel: LocalizedText;
  price: string;
  coverImage: string;
  languages: Array<"en" | "es">;
  facts: PropertyFact[];
  highlights: PropertyHighlight[];
  gallery: PropertyGalleryImage[];
  virtualTour?: PropertyVirtualTour;
  floorPlans: PropertyFloorPlan[];
  location: PropertyLocation;
  agent: PropertyAgent;
  publishedAt?: string;
}
