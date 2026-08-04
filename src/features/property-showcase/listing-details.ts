import { formatPropertyFactValue } from "./formatting.ts";
import { extractIframeSrc } from "./provider-urls.ts";
import { getPropertyAddressView } from "./property-address.ts";
import {
  getPrimaryLanguage,
  highlightChecklistText,
  localizedText,
  PUBLIC_UI_LABELS,
} from "./localization.ts";
import type {
  ListingReferenceLabelMode,
  LocalizedText,
  PropertyAgent,
  PropertyAgentSocialLink,
  PropertyFact,
  PropertyFactKey,
  PropertyLanguageCode,
  PropertyLocation,
  PropertyShowcase,
} from "./types";

export interface ListingFactView {
  key: PropertyFactKey;
  label: string;
  value: string;
}

export interface PropertyMapView {
  mode: "hidden" | "fallback" | "embed";
  source:
    | "hidden"
    | "invalid-coordinates"
    | "generated-exact"
    | "generated-approximate"
    | "custom-embed";
  privacyMode: PropertyLocation["privacyMode"];
  address: string;
  label: string;
  externalUrl?: string;
  embedUrl?: string;
  markerMode?: "exact" | "approximate";
  centerLatitude?: number;
  mapZoom?: number;
  approximateRadiusMeters?: number;
}

export interface AgentProfileView {
  agencyName: string;
  displayName: string;
  role: string;
  logoUrl?: string;
  portraitUrl?: string;
  phone?: string;
  phoneHref?: string;
  whatsappHref?: string;
  email?: string;
  emailHref?: string;
  website?: string;
  socialLinks: Array<PropertyAgentSocialLink & { labelText: string }>;
}

export const LISTING_REFERENCE_LABEL_PRESETS: Record<
  Exclude<ListingReferenceLabelMode, "custom">,
  LocalizedText
> = {
  "property-reference": {
    en: "Property reference",
    es: "Referencia de la propiedad",
    de: "Objektreferenz",
    fr: "Référence du bien",
    nl: "Woningreferentie",
    pl: "Referencja nieruchomości",
    uk: "Референс об'єкта",
    ru: "Референс объекта",
  },
  "mls-number": {
    en: "MLS number",
    es: "Número MLS",
    de: "MLS-Nummer",
    fr: "Numéro MLS",
    nl: "MLS-nummer",
    pl: "Numer MLS",
    uk: "Номер MLS",
    ru: "Номер MLS",
  },
  "listing-number": {
    en: "Listing number",
    es: "Número de anuncio",
    de: "Angebotsnummer",
    fr: "Numéro d'annonce",
    nl: "Advertentienummer",
    pl: "Numer oferty",
    uk: "Номер оголошення",
    ru: "Номер объявления",
  },
};

export interface GoogleMapsNormalizationResult {
  externalUrl?: string;
  embedUrl?: string;
  canEmbed: boolean;
}

export const TRUSTED_GOOGLE_MAP_ORIGINS = [
  "https://www.google.com",
  "https://maps.google.com",
  "https://maps.app.goo.gl",
] as const;

export const TRUSTED_GOOGLE_MAP_FRAME_ORIGINS = [
  "https://www.google.com",
  "https://maps.google.com",
] as const;

const FACT_ORDER: readonly PropertyFactKey[] = [
  "price",
  "listing-reference",
  "bedrooms",
  "bathrooms",
  "parking",
  "built-area",
  "year-built",
  "plot-area",
];

const DEFAULT_FACT_LABELS: Record<PropertyFactKey, Record<PropertyLanguageCode, string>> = {
  price: {
    en: "Price",
    es: "Precio",
    de: "Preis",
    fr: "Prix",
    nl: "Prijs",
    pl: "Cena",
    uk: "Price",
    ru: "Price",
  },
  "listing-reference": {
    en: "Reference",
    es: "Referencia",
    de: "Referenz",
    fr: "Référence",
    nl: "Referentie",
    pl: "Numer oferty",
    uk: "Референс",
    ru: "Референс",
  },
  bedrooms: {
    en: "Bedrooms",
    es: "Dormitorios",
    de: "Schlafzimmer",
    fr: "Chambres",
    nl: "Slaapkamers",
    pl: "Sypialnie",
    uk: "Спальні",
    ru: "Спальни",
  },
  bathrooms: {
    en: "Bathrooms",
    es: "Baños",
    de: "Badezimmer",
    fr: "Salles de bain",
    nl: "Badkamers",
    pl: "Łazienki",
    uk: "Ванні кімнати",
    ru: "Ванные комнаты",
  },
  parking: {
    en: "Parking",
    es: "Aparcamiento",
    de: "Parking",
    fr: "Stationnement",
    nl: "Parkeren",
    pl: "Parking",
    uk: "Паркування",
    ru: "Парковка",
  },
  "built-area": {
    en: "Built area",
    es: "Superficie construida",
    de: "Wohnfläche",
    fr: "Surface construite",
    nl: "Woonoppervlakte",
    pl: "Powierzchnia",
    uk: "Площа",
    ru: "Площадь",
  },
  "plot-area": {
    en: "Lot size",
    es: "Parcela",
    de: "Grundstück",
    fr: "Terrain",
    nl: "Perceel",
    pl: "Działka",
    uk: "Ділянка",
    ru: "Участок",
  },
  "year-built": {
    en: "Year built",
    es: "Año de construcción",
    de: "Baujahr",
    fr: "Année",
    nl: "Bouwjaar",
    pl: "Rok budowy",
    uk: "Рік побудови",
    ru: "Год постройки",
  },
};

const SOCIAL_LABELS: Record<PropertyAgentSocialLink["provider"], string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X / Twitter",
  pinterest: "Pinterest",
  custom: "Website",
};

function defaultFactLabel(
  key: PropertyFactKey,
  language: PropertyLanguageCode,
): string {
  return DEFAULT_FACT_LABELS[key][language] ?? DEFAULT_FACT_LABELS[key].en;
}

function listingReferenceFact(
  property: PropertyShowcase,
): PropertyFact | undefined {
  return property.facts.find((fact) => fact.key === "listing-reference");
}

export function labelForListingReferenceMode(
  mode: ListingReferenceLabelMode,
  customLabel: string,
): LocalizedText {
  if (mode === "custom") {
    const trimmed = customLabel.trim();
    return { en: trimmed || LISTING_REFERENCE_LABEL_PRESETS["property-reference"].en };
  }

  return LISTING_REFERENCE_LABEL_PRESETS[mode];
}

export function getListingReferenceLabel(
  property: PropertyShowcase,
  language: PropertyLanguageCode,
): string {
  const primaryLanguage = getPrimaryLanguage(property);
  const fact = listingReferenceFact(property);
  return (
    localizedText(fact?.label, language, primaryLanguage) ||
    PUBLIC_UI_LABELS[language]?.reference ||
    PUBLIC_UI_LABELS.en.reference
  );
}

function factSortOrder(fact: PropertyFact, fallbackIndex: number): number {
  return fact.sortOrder ?? FACT_ORDER.indexOf(fact.key) * 10 + fallbackIndex;
}

function factLabel(
  fact: PropertyFact,
  language: PropertyLanguageCode,
  primaryLanguage: PropertyLanguageCode,
): string {
  return (
    localizedText(fact.label, language, primaryLanguage) ||
    defaultFactLabel(fact.key, language)
  );
}

export function normalizeListingFacts(
  property: PropertyShowcase,
  language: PropertyLanguageCode,
): ListingFactView[] {
  const primaryLanguage = getPrimaryLanguage(property);
  const explicitKeys = new Set(property.facts.map((fact) => fact.key));
  const generatedFacts: PropertyFact[] = [];

  if (property.price.trim() && !explicitKeys.has("price")) {
    generatedFacts.push({
      key: "price",
      value: property.price,
      label: { en: DEFAULT_FACT_LABELS.price.en },
      sortOrder: -20,
    });
  }

  if (property.reference.trim() && !explicitKeys.has("listing-reference")) {
    generatedFacts.push({
      key: "listing-reference",
      value: property.reference,
      label: {
        en:
          PUBLIC_UI_LABELS[primaryLanguage]?.reference ??
          DEFAULT_FACT_LABELS["listing-reference"].en,
      },
      sortOrder: -10,
    });
  }

  return [...generatedFacts, ...property.facts]
    .filter((fact) => fact.visible !== false && fact.value.trim())
    .sort((a, b) => factSortOrder(a, 0) - factSortOrder(b, 1))
    .map((fact) => ({
      key: fact.key,
      label: factLabel(fact, language, primaryLanguage),
      value: formatPropertyFactValue(fact),
    }))
    .filter((fact) => fact.label && fact.value);
}

export function normalizeChecklistHighlights(
  property: PropertyShowcase,
  language: PropertyLanguageCode,
): string[] {
  const primaryLanguage = getPrimaryLanguage(property);
  return property.highlights
    .filter((highlight) => highlight.visible !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((highlight) =>
      highlightChecklistText(highlight, language, primaryLanguage),
    )
    .filter(Boolean)
    .slice(0, 12);
}

function safeHttpsUrl(value: string | undefined): URL | null {
  const extracted = extractIframeSrc(value);
  if (!extracted) return null;

  try {
    const url = new URL(extracted);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (url.port) return null;
    return url;
  } catch {
    return null;
  }
}

function isTrustedGoogleMapUrl(url: URL): boolean {
  return (TRUSTED_GOOGLE_MAP_ORIGINS as readonly string[]).includes(
    url.origin.toLowerCase(),
  );
}

function isGoogleEmbedUrl(url: URL): boolean {
  return (
    (TRUSTED_GOOGLE_MAP_FRAME_ORIGINS as readonly string[]).includes(
      url.origin.toLowerCase(),
    ) && url.pathname.toLowerCase().startsWith("/maps/embed")
  );
}

export function normalizeGoogleMapsInput(
  value: string | undefined,
): GoogleMapsNormalizationResult | null {
  const url = safeHttpsUrl(value);
  if (!url || !isTrustedGoogleMapUrl(url)) return null;

  if (isGoogleEmbedUrl(url)) {
    return {
      embedUrl: url.toString(),
      canEmbed: true,
    };
  }

  return {
    externalUrl: url.toString(),
    canEmbed: false,
  };
}

export function hasValidPropertyCoordinates(
  location: Pick<PropertyLocation, "latitude" | "longitude">,
): location is { latitude: number; longitude: number } {
  return (
    typeof location.latitude === "number" &&
    Number.isFinite(location.latitude) &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    typeof location.longitude === "number" &&
    Number.isFinite(location.longitude) &&
    location.longitude >= -180 &&
    location.longitude <= 180
  );
}

function normalizedMapZoom(value: number | undefined): number {
  if (!Number.isFinite(value)) return 14;
  return Math.min(23, Math.max(1, Math.round(value ?? 14)));
}

function approximateMapCenter(location: PropertyLocation): {
  latitude: number;
  longitude: number;
} | null {
  const explicit = {
    latitude: location.approximateLatitude,
    longitude: location.approximateLongitude,
  };
  if (hasValidPropertyCoordinates(explicit)) return explicit;

  if (!hasValidPropertyCoordinates(location)) return null;
  return {
    latitude: Math.round(location.latitude * 10) / 10,
    longitude: Math.round(location.longitude * 10) / 10,
  };
}

export function googleMapsExternalUrlFromCoordinates(
  latitude: number,
  longitude: number,
): string {
  const query = encodeURIComponent(`${latitude},${longitude}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function googleMapsExternalUrlFromText(
  locationLabel: string,
): string | undefined {
  const trimmedLabel = locationLabel.trim();
  if (!trimmedLabel) return undefined;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmedLabel)}`;
}

export function googleMapsEmbedUrlFromCoordinates(
  latitude: number,
  longitude: number,
  zoom: number | undefined,
  markerMode: "exact" | "approximate",
): string {
  const url = new URL("https://maps.google.com/maps");
  const coordinateValue = `${latitude},${longitude}`;
  const requestedZoom = normalizedMapZoom(zoom);

  if (markerMode === "exact") {
    url.searchParams.set("q", coordinateValue);
    url.searchParams.set("z", String(requestedZoom));
  } else {
    url.searchParams.set("ll", coordinateValue);
    url.searchParams.set("z", String(Math.min(requestedZoom, 14)));
  }
  url.searchParams.set("output", "embed");
  return url.toString();
}

export function getPropertyLocationMapView(
  location: PropertyLocation,
  address: string,
): PropertyMapView {
  if (location.privacyMode === "hidden" || location.showMap === false) {
    return {
      mode: "hidden",
      source: "hidden",
      privacyMode: location.privacyMode,
      address: "",
      label: "Location is private",
    };
  }

  const coordinatesAreValid = hasValidPropertyCoordinates(location);
  const embedOverride = normalizeGoogleMapsInput(location.mapEmbedUrl);
  const externalOverride = normalizeGoogleMapsInput(location.mapExternalUrl);

  if (location.privacyMode === "approximate") {
    const center = approximateMapCenter(location);
    if (!center) {
      return {
        mode: "fallback",
        source: "invalid-coordinates",
        privacyMode: location.privacyMode,
        address: "",
        label: "Approximate location",
      };
    }

    return {
      mode: "embed",
      source: "generated-approximate",
      privacyMode: location.privacyMode,
      address: "",
      label: "Approximate location",
      externalUrl:
        location.allowApproximateAreaLink === true
          ? googleMapsExternalUrlFromText(address)
          : undefined,
      embedUrl: googleMapsEmbedUrlFromCoordinates(
        center.latitude,
        center.longitude,
        location.mapZoom,
        "approximate",
      ),
      markerMode: "approximate",
      centerLatitude: center.latitude,
      mapZoom: Math.min(normalizedMapZoom(location.mapZoom), 14),
      approximateRadiusMeters: location.approximateRadiusMeters ?? 1500,
    };
  }

  const generatedExternalUrl = coordinatesAreValid
    ? googleMapsExternalUrlFromCoordinates(
        location.latitude,
        location.longitude,
      )
    : undefined;
  const generatedEmbedUrl = coordinatesAreValid
    ? googleMapsEmbedUrlFromCoordinates(
        location.latitude,
        location.longitude,
        location.mapZoom,
        "exact",
      )
    : undefined;
  const useCustomEmbed = location.useCustomMapEmbed === true;
  const useGeneratedExactMap = Boolean(generatedEmbedUrl);
  const customEmbedUrl = useCustomEmbed ? embedOverride?.embedUrl : undefined;
  const embedUrl = customEmbedUrl ?? generatedEmbedUrl;
  const externalUrl =
    generatedExternalUrl ??
    externalOverride?.externalUrl ??
    customEmbedUrl;

  if (embedUrl) {
    return {
      mode: "embed",
      source: customEmbedUrl ? "custom-embed" : "generated-exact",
      privacyMode: location.privacyMode,
      address,
      label: address || "Location",
      externalUrl,
      embedUrl,
      markerMode:
        useGeneratedExactMap && !customEmbedUrl ? "exact" : undefined,
    };
  }

  return {
    mode: "fallback",
    source: "invalid-coordinates",
    privacyMode: location.privacyMode,
    address,
    label: address || "Location",
    externalUrl,
  };
}

export function getPropertyMapView(
  property: PropertyShowcase,
  language: PropertyLanguageCode,
): PropertyMapView {
  const primaryLanguage = getPrimaryLanguage(property);
  const location = property.location;
  const address = getPropertyAddressView(
    location,
    language,
    primaryLanguage,
  ).socialText;

  return getPropertyLocationMapView(location, address);
}

function normalizePhone(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function whatsappHref(value: string | undefined): string | undefined {
  const phone = value?.replace(/\D/g, "");
  return phone ? `https://wa.me/${phone}` : undefined;
}

function safeExternalHref(value: string | undefined): string | undefined {
  const url = safeHttpsUrl(value);
  return url?.toString();
}

function normalizeSocialLinks(
  agent: PropertyAgent,
  language: PropertyLanguageCode,
  primaryLanguage: PropertyLanguageCode,
): Array<PropertyAgentSocialLink & { labelText: string }> {
  const links: Array<PropertyAgentSocialLink & { labelText: string }> = [];

  (agent.socialLinks ?? []).forEach((link, index) => {
    const url = safeExternalHref(link.url);
    if (!url) return;
    links.push({
      ...link,
      url,
      sortOrder: link.sortOrder ?? index,
      labelText:
        localizedText(link.label, language, primaryLanguage) ||
        SOCIAL_LABELS[link.provider],
    });
  });

  return links.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function normalizeAgentProfile(
  property: PropertyShowcase,
  language: PropertyLanguageCode,
): AgentProfileView | null {
  const agent = property.agent;
  if (agent.displayProfile === false || !agent.agencyName.trim()) return null;

  const primaryLanguage = getPrimaryLanguage(property);
  const phone = normalizePhone(agent.phone);
  const email = agent.email?.trim();
  const website = safeExternalHref(agent.website);

  return {
    agencyName: agent.agencyName.trim(),
    displayName: agent.agentName?.trim() || agent.agencyName.trim(),
    role: localizedText(agent.role, language, primaryLanguage),
    logoUrl: agent.logoUrl?.trim() || undefined,
    portraitUrl: agent.portraitUrl?.trim() || undefined,
    phone,
    phoneHref: phone ? `tel:${phone}` : undefined,
    whatsappHref: whatsappHref(agent.whatsapp),
    email,
    emailHref: email ? `mailto:${email}` : undefined,
    website,
    socialLinks: normalizeSocialLinks(agent, language, primaryLanguage),
  };
}
