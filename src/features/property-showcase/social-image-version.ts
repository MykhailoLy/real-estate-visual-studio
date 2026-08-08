import { createHash } from "node:crypto";
import { normalizeListingFacts } from "./listing-details.ts";
import { getPrimaryLanguage } from "./localization.ts";
import { serializePublicPropertyShowcase } from "./public-serialization.ts";
import { normalizePropertySocialCardConfig } from "./social-card.ts";
import {
  getPropertySocialPreview,
  resolvePropertySocialImageUrl,
  selectPropertySocialGalleryImages,
} from "./social-preview.ts";
import type {
  PropertyGalleryImage,
  PropertyShowcase,
  PropertySocialCardFactKey,
  PropertySocialCardLayout,
} from "./types.ts";

export const PROPERTY_SOCIAL_CARD_VISUAL_SCHEMA_VERSION =
  "picchuspot-property-social-card-v3";

interface VersionedSocialPhoto {
  id: string;
  url: string | null;
  focalPoint: { x: number; y: number };
}

interface PublicSocialListingFacts {
  listingReference: string | null;
  bedrooms: string | null;
  bathrooms: string | null;
  builtArea: string | null;
  yearBuilt: string | null;
}

export interface PropertySocialImageVersionInput {
  branding: {
    agency: {
      logoUrl: string | null;
      name: string | null;
    } | null;
    accentColor: string;
    attribution: string | null;
    mode: "picchuspot" | "agency" | "unbranded";
    primaryColor: string;
  };
  card: {
    configuredFactKeys: PropertySocialCardFactKey[];
    effectiveFactKeys: PropertySocialCardFactKey[];
    layout: PropertySocialCardLayout;
    mode: "automatic" | "custom";
    visibility: {
      branding: boolean;
      location: boolean;
      poweredByPicchuSpot: boolean;
      price: boolean;
    };
  };
  content: {
    displayedPrice: string;
    facts: Array<{
      key: PropertySocialCardFactKey;
      label: string;
      value: string;
    }>;
    customFacts: Array<{
      key: string;
      label: string;
      value: string;
    }>;
    description: string;
    highlights: string[];
    location: string;
    listingFacts: PublicSocialListingFacts;
    title: string;
  };
  images: {
    coverFallbackUrl: string | null;
    featuredForSharing: VersionedSocialPhoto[];
    primarySocialPreview: VersionedSocialPhoto | null;
    selected: VersionedSocialPhoto[];
  };
  schemaVersion: string;
  slug: string;
}

function socialPhoto(
  property: Pick<PropertyShowcase, "slug">,
  image: PropertyGalleryImage,
): VersionedSocialPhoto {
  return {
    id: image.id,
    url: resolvePropertySocialImageUrl(property, image.src),
    focalPoint: {
      x: image.focalPoint?.x ?? 0.5,
      y: image.focalPoint?.y ?? 0.5,
    },
  };
}

export function createPropertySocialImageVersionInput(
  property: PropertyShowcase,
): PropertySocialImageVersionInput {
  const publicProperty = serializePublicPropertyShowcase(property);
  const primaryLanguage = getPrimaryLanguage(publicProperty);
  const preview = getPropertySocialPreview(publicProperty);
  const socialCard = normalizePropertySocialCardConfig(publicProperty.socialCard);
  const selectedImages = selectPropertySocialGalleryImages(publicProperty);
  const primaryImage = selectedImages.find(
    (image) => image.primarySocialPreview === true,
  );
  const facts = preview.facts.map(({ key, label, value }) => ({
    key,
    label,
    value,
  }));
  const publicListingFacts = normalizeListingFacts(
    publicProperty,
    primaryLanguage,
  );
  const publicListingFactValue = (key: PropertySocialCardFactKey) =>
    publicListingFacts.find((fact) => fact.key === key)?.value ?? null;
  const agency = preview.brandingMode === "agency"
    ? {
        logoUrl: resolvePropertySocialImageUrl(
          publicProperty,
          preview.brandingLogoUrl,
        ),
        name: preview.brandingName ?? null,
      }
    : null;

  return {
    branding: {
      agency,
      accentColor: preview.accentColor,
      attribution: preview.brandingAttribution ?? null,
      mode: preview.brandingMode,
      primaryColor: preview.primaryColor,
    },
    card: {
      configuredFactKeys: socialCard.factOrder.filter((key) =>
        socialCard.visibleFacts.includes(key),
      ),
      effectiveFactKeys: facts.map((fact) => fact.key),
      layout: socialCard.layout,
      mode: socialCard.mode,
      visibility: {
        branding: socialCard.showBranding,
        location: socialCard.showLocation,
        poweredByPicchuSpot: socialCard.showPoweredByPicchuSpot,
        price: socialCard.showPrice,
      },
    },
    content: {
      description: preview.description,
      displayedPrice: preview.price,
      facts,
      customFacts: preview.customFacts,
      highlights: preview.highlights,
      location: preview.location,
      listingFacts: {
        listingReference:
          publicListingFactValue("listing-reference") ?? preview.reference,
        bedrooms: publicListingFactValue("bedrooms"),
        bathrooms: publicListingFactValue("bathrooms"),
        builtArea: publicListingFactValue("built-area"),
        yearBuilt: publicListingFactValue("year-built"),
      },
      title: preview.title,
    },
    images: {
      coverFallbackUrl: resolvePropertySocialImageUrl(
        publicProperty,
        publicProperty.coverImage,
      ),
      featuredForSharing: selectedImages
        .filter((image) => image.featuredForSharing === true)
        .map((image) => socialPhoto(publicProperty, image)),
      primarySocialPreview: primaryImage
        ? socialPhoto(publicProperty, primaryImage)
        : null,
      selected: selectedImages.map((image) =>
        socialPhoto(publicProperty, image),
      ),
    },
    schemaVersion: PROPERTY_SOCIAL_CARD_VISUAL_SCHEMA_VERSION,
    slug: publicProperty.slug,
  };
}

export function stableSerializeSocialImageVersionInput(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? JSON.stringify(value) : "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerializeSocialImageVersionInput).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableSerializeSocialImageVersionInput(record[key])}`,
      )
      .join(",")}}`;
  }
  return "null";
}

export function computePropertySocialImageVersion(
  property: PropertyShowcase,
): string {
  return createHash("sha256")
    .update(
      stableSerializeSocialImageVersionInput(
        createPropertySocialImageVersionInput(property),
      ),
    )
    .digest("hex")
    .slice(0, 14);
}
