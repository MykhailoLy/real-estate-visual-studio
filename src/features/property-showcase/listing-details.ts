import { formatPropertyFactValue } from "./formatting.ts";
import { extractIframeSrc } from "./provider-urls.ts";
import {
  getPrimaryLanguage,
  highlightChecklistText,
  localizedText,
} from "./localization.ts";
import type {
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
  privacyMode: PropertyLocation["privacyMode"];
  address: string;
  label: string;
  externalUrl?: string;
  embedUrl?: string;
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

export interface GoogleMapsNormalizationResult {
  externalUrl?: string;
  embedUrl?: string;
  canEmbed: boolean;
}

export const TRUSTED_GOOGLE_MAP_ORIGINS = [
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
    en: "Listing ref",
    es: "Referencia",
    de: "Referenz",
    fr: "Reference",
    nl: "Referentie",
    pl: "Numer oferty",
    uk: "Listing ref",
    ru: "Listing ref",
  },
  bedrooms: {
    en: "Bedrooms",
    es: "Dormitorios",
    de: "Bedrooms",
    fr: "Chambres",
    nl: "Slaapkamers",
    pl: "Sypialnie",
    uk: "Bedrooms",
    ru: "Bedrooms",
  },
  bathrooms: {
    en: "Bathrooms",
    es: "Banos",
    de: "Bathrooms",
    fr: "Salles de bain",
    nl: "Badkamers",
    pl: "Lazienki",
    uk: "Bathrooms",
    ru: "Bathrooms",
  },
  parking: {
    en: "Parking",
    es: "Aparcamiento",
    de: "Parking",
    fr: "Stationnement",
    nl: "Parkeren",
    pl: "Parking",
    uk: "Parking",
    ru: "Parking",
  },
  "built-area": {
    en: "Built area",
    es: "Superficie construida",
    de: "Wohnflache",
    fr: "Surface construite",
    nl: "Woonoppervlakte",
    pl: "Powierzchnia",
    uk: "Built area",
    ru: "Built area",
  },
  "plot-area": {
    en: "Lot size",
    es: "Parcela",
    de: "Grundstuck",
    fr: "Terrain",
    nl: "Perceel",
    pl: "Dzialka",
    uk: "Lot size",
    ru: "Lot size",
  },
  "year-built": {
    en: "Year built",
    es: "Ano de construccion",
    de: "Baujahr",
    fr: "Annee",
    nl: "Bouwjaar",
    pl: "Rok budowy",
    uk: "Year built",
    ru: "Year built",
  },
};

const SOCIAL_LABELS: Record<PropertyAgentSocialLink["provider"], string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
  custom: "Website",
};

function defaultFactLabel(
  key: PropertyFactKey,
  language: PropertyLanguageCode,
): string {
  return DEFAULT_FACT_LABELS[key][language] ?? DEFAULT_FACT_LABELS[key].en;
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
      label: { en: DEFAULT_FACT_LABELS["listing-reference"].en },
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
  return url.pathname.toLowerCase().startsWith("/maps/embed");
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

function coordinatesMapUrl(location: PropertyLocation): string | undefined {
  if (
    typeof location.latitude !== "number" ||
    typeof location.longitude !== "number"
  ) {
    return undefined;
  }

  const query = encodeURIComponent(`${location.latitude},${location.longitude}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function getPropertyMapView(
  property: PropertyShowcase,
  language: PropertyLanguageCode,
): PropertyMapView {
  const primaryLanguage = getPrimaryLanguage(property);
  const location = property.location;
  const address = localizedText(
    location.displayAddress,
    language,
    primaryLanguage,
  );

  if (location.privacyMode === "hidden" || location.showMap === false) {
    return {
      mode: "hidden",
      privacyMode: location.privacyMode,
      address,
      label: "Location is private",
    };
  }

  const embed = normalizeGoogleMapsInput(location.mapEmbedUrl);
  const external = normalizeGoogleMapsInput(location.mapExternalUrl);
  const externalUrl =
    external?.externalUrl ??
    external?.embedUrl ??
    (location.privacyMode === "exact" ? coordinatesMapUrl(location) : undefined);

  if (location.privacyMode === "exact" && embed?.embedUrl) {
    return {
      mode: "embed",
      privacyMode: location.privacyMode,
      address,
      label: address,
      externalUrl,
      embedUrl: embed.embedUrl,
    };
  }

  return {
    mode: "fallback",
    privacyMode: location.privacyMode,
    address,
    label:
      location.privacyMode === "approximate"
        ? "Approximate location"
        : address || "Location",
    externalUrl,
  };
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
