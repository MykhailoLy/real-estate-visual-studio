import { formatPriceLabel } from "./formatting.ts";
import { normalizePropertyImageFocalPoint } from "./focal-point.ts";
import { normalizeListingFacts } from "./listing-details.ts";
import { getPrimaryLanguage, localizedText } from "./localization.ts";
import { getPropertyAddressView } from "./property-address.ts";
import {
  getPropertySocialCardFacts,
  normalizePropertySocialCardConfig,
} from "./social-card.ts";
import { ownedPropertyShowcaseStoragePath } from "./storage-cleanup.ts";
import type {
  PropertyGalleryImage,
  PropertyImageFocalPoint,
  PropertyShowcase,
  PropertySocialCardFactKey,
  PropertySocialCardLayout,
} from "./types.ts";
import { SITE_URL } from "../../lib/seo.ts";

export interface PropertySocialPreviewImage {
  imageId?: string;
  imageUrl: string;
  imageAlt: string;
  focalPoint?: PropertyImageFocalPoint;
}

export interface PropertySocialPreview {
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  images: PropertySocialPreviewImage[];
  location: string;
  price: string;
  reference: string;
  referenceLabel: string;
  bedrooms?: string;
  bathrooms?: string;
  builtArea?: string;
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
  highlights: string[];
  layout: PropertySocialCardLayout;
  agencyName?: string;
  brandingMode: "picchuspot" | "agency" | "unbranded";
  brandingName?: string;
  brandingLogoUrl?: string;
  brandingAttribution?: string;
}

function sortedSocialGallery(
  gallery: readonly PropertyGalleryImage[],
): PropertyGalleryImage[] {
  return [...gallery].sort(
    (a, b) =>
      (a.socialPreviewOrder ?? a.sortOrder) -
        (b.socialPreviewOrder ?? b.sortOrder) ||
      a.sortOrder - b.sortOrder,
  );
}

export function selectPropertySocialGalleryImages(
  property: Pick<PropertyShowcase, "gallery">,
): PropertyGalleryImage[] {
  const gallery = sortedSocialGallery(property.gallery);
  const primary = gallery.find(
    (image) => image.primarySocialPreview === true,
  );
  const featured = gallery.filter(
    (image) => image.featuredForSharing === true && image.id !== primary?.id,
  );

  return primary ? [primary, ...featured] : featured;
}

export function selectPropertyHeroImages(
  property: PropertyShowcase,
): PropertySocialPreviewImage[] {
  const primaryLanguage = getPrimaryLanguage(property);
  const gallery = sortedSocialGallery(property.gallery);
  const selected = selectPropertySocialGalleryImages(property);
  const coverGalleryImage = gallery.find(
    (image) => image.src === property.coverImage,
  );
  const images = selected.length > 0
    ? selected
    : coverGalleryImage
      ? [coverGalleryImage]
      : [];

  if (images.length === 0 && property.coverImage.trim()) {
    return [
      {
        imageId: undefined,
        imageUrl: property.coverImage,
        imageAlt: localizedText(
          property.title,
          primaryLanguage,
          primaryLanguage,
        ),
      },
    ];
  }

  const seenUrls = new Set<string>();
  return images.flatMap((image) => {
    const imageUrl = image.src.trim();
    if (!imageUrl || seenUrls.has(imageUrl)) return [];
    seenUrls.add(imageUrl);
    return [{
      imageId: image.id,
      imageUrl,
      imageAlt:
        localizedText(image.alt, primaryLanguage, primaryLanguage) ||
        localizedText(property.title, primaryLanguage, primaryLanguage),
      focalPoint: normalizePropertyImageFocalPoint(image.focalPoint),
    }];
  });
}

export function selectPropertySocialImages(
  property: PropertyShowcase,
): PropertySocialPreviewImage[] {
  return selectPropertyHeroImages(property).slice(0, 3);
}

export function selectPropertySocialImageCandidates(
  property: PropertyShowcase,
): PropertySocialPreviewImage[] {
  const primaryLanguage = getPrimaryLanguage(property);
  const gallery = sortedSocialGallery(property.gallery);
  const selected = selectPropertySocialGalleryImages(property);
  const coverGalleryImage = gallery.find(
    (image) => image.src === property.coverImage,
  );
  const candidates = [...selected, coverGalleryImage].filter(
    (image): image is PropertyGalleryImage => Boolean(image),
  );

  const seenUrls = new Set<string>();
  const result: PropertySocialPreviewImage[] = candidates.flatMap((image) => {
    const imageUrl = image.src.trim();
    if (!imageUrl || seenUrls.has(imageUrl)) return [];
    seenUrls.add(imageUrl);
    return [
      {
        imageId: image.id,
        imageUrl,
        imageAlt:
          localizedText(image.alt, primaryLanguage, primaryLanguage) ||
          localizedText(property.title, primaryLanguage, primaryLanguage),
        focalPoint: normalizePropertyImageFocalPoint(image.focalPoint),
      },
    ];
  });
  const coverImageUrl = property.coverImage.trim();
  if (coverImageUrl && !seenUrls.has(coverImageUrl)) {
    result.push({
      imageId: undefined,
      imageUrl: coverImageUrl,
      imageAlt: localizedText(
        property.title,
        primaryLanguage,
        primaryLanguage,
      ),
    });
  }
  return result;
}

export function selectPropertySocialImage(
  property: PropertyShowcase,
): Pick<PropertySocialPreview, "imageUrl" | "imageAlt"> {
  const image = selectPropertySocialImages(property)[0];

  return {
    imageUrl: image?.imageUrl ?? "",
    imageAlt: image?.imageAlt ?? "",
  };
}

function hasEncodedPathControl(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.includes("%2e") || lower.includes("%2f") || lower.includes("%5c");
}

export function resolvePropertySocialImageUrl(
  property: Pick<PropertyShowcase, "slug">,
  value: string | undefined,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed || hasEncodedPathControl(trimmed)) return null;

  try {
    const siteOrigin = new URL(SITE_URL).origin;
    const url = new URL(trimmed, SITE_URL);
    if (url.protocol !== "https:" || url.username || url.password || url.port) {
      return null;
    }

    if (trimmed.startsWith("/")) {
      if (trimmed.startsWith("//") || url.origin !== siteOrigin) return null;
      return url.toString();
    }

    if (url.origin === siteOrigin) return url.toString();
    return ownedPropertyShowcaseStoragePath(url.toString(), property.slug)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function resolvedPropertySocialImages(
  property: PropertyShowcase,
): PropertySocialPreviewImage[] {
  return selectPropertySocialImageCandidates(property)
    .map((image) => {
      const imageUrl = resolvePropertySocialImageUrl(property, image.imageUrl);
      return imageUrl ? { ...image, imageUrl } : null;
    })
    .filter((image): image is PropertySocialPreviewImage => image !== null);
}

export function getPropertySocialPreview(
  property: PropertyShowcase,
): PropertySocialPreview {
  const primaryLanguage = getPrimaryLanguage(property);
  const listingTitle = localizedText(
    property.title,
    primaryLanguage,
    primaryLanguage,
  );
  const summary = localizedText(
    property.summary,
    primaryLanguage,
    primaryLanguage,
  );
  const location = getPropertyAddressView(
    property.location,
    primaryLanguage,
    primaryLanguage,
  ).socialText;
  const socialCard = normalizePropertySocialCardConfig(property.socialCard);
  const price = property.price.trim()
    ? formatPriceLabel(property.price)
    : "";
  const image = selectPropertySocialImage(property);
  const images = selectPropertySocialImages(property);
  const facts = normalizeListingFacts(property, primaryLanguage);
  const fact = (key: "listing-reference" | "bedrooms" | "bathrooms" | "built-area") =>
    facts.find((item) => item.key === key);
  const reference = fact("listing-reference");
  const bedrooms = fact("bedrooms");
  const bathrooms = fact("bathrooms");
  const builtArea = fact("built-area");
  const configuredBrandingMode =
    property.socialPreview?.brandingMode ?? "picchuspot";
  const brandingMode = socialCard.showBranding
    ? configuredBrandingMode
    : "unbranded";
  const socialFacts = getPropertySocialCardFacts(property, primaryLanguage);
  const customFacts = facts
    .filter((fact) => fact.key.startsWith("custom-"))
    .map((fact) => ({ key: fact.key, label: fact.label, value: fact.value }));
  const highlights = property.highlights
    .filter((highlight) => highlight.visible !== false)
    .slice()
    .sort((first, second) => (first.sortOrder ?? 0) - (second.sortOrder ?? 0))
    .map((highlight) => localizedText(
      highlight.text ?? highlight.title ?? highlight.description,
      primaryLanguage,
      primaryLanguage,
    ))
    .filter(Boolean);

  return {
    title: [listingTitle, socialCard.showPrice ? price : ""]
      .filter(Boolean)
      .join(" | "),
    description: [
      socialCard.showLocation ? location : "",
      ...socialFacts.map((item) => `${item.label} ${item.value}`),
    ].filter(Boolean).join(" \u00b7 ") || summary,
    ...image,
    images,
    location: socialCard.showLocation ? location : "",
    price: socialCard.showPrice ? price : "",
    reference: reference?.value ?? property.reference,
    referenceLabel: reference?.label ?? "Reference",
    bedrooms: bedrooms?.value,
    bathrooms: bathrooms?.value,
    builtArea: builtArea?.value,
    facts: socialFacts,
    customFacts,
    highlights,
    layout: socialCard.layout,
    agencyName: property.agent.displayProfile === false
      ? undefined
      : property.agent.agencyName,
    brandingMode,
    brandingName:
      brandingMode === "picchuspot"
        ? "PicchuSpot"
        : brandingMode === "agency"
          ? property.agent.agencyName.trim() || undefined
          : undefined,
    brandingLogoUrl:
      brandingMode === "agency" ? property.agent.logoUrl?.trim() : undefined,
    brandingAttribution:
      !socialCard.showPoweredByPicchuSpot
        ? undefined
        : brandingMode === "picchuspot"
          ? "Property Showcase by PicchuSpot"
          : brandingMode === "agency"
            ? "Powered by PicchuSpot"
            : undefined,
  };
}

export function updateGallerySocialPreview(
  gallery: readonly PropertyGalleryImage[],
  imageId: string,
  action:
    | "toggle-featured"
    | "set-primary"
    | "move-social-up"
    | "move-social-down",
): PropertyGalleryImage[] {
  const selectedCount = gallery.filter(
    (image) =>
      image.featuredForSharing === true || image.primarySocialPreview === true,
  ).length;
  const target = gallery.find((image) => image.id === imageId);
  if (!target) return [...gallery];
  if (
    (action === "toggle-featured" || action === "set-primary") &&
    target.featuredForSharing !== true &&
    selectedCount >= 3
  ) {
    return [...gallery];
  }

  if (action === "move-social-up" || action === "move-social-down") {
    const selected = sortedSocialGallery(gallery).filter(
      (image) =>
        image.featuredForSharing === true || image.primarySocialPreview === true,
    );
    const index = selected.findIndex((image) => image.id === imageId);
    const boundary = selected[0]?.primarySocialPreview === true ? 1 : 0;
    const nextIndex = index + (action === "move-social-up" ? -1 : 1);
    if (
      index < boundary ||
      nextIndex < boundary ||
      nextIndex >= selected.length
    ) {
      return [...gallery];
    }
    [selected[index], selected[nextIndex]] = [
      selected[nextIndex],
      selected[index],
    ];
    const orders = new Map(selected.map((image, index) => [image.id, index + 1]));
    return gallery.map((image) =>
      orders.has(image.id)
        ? { ...image, socialPreviewOrder: orders.get(image.id) }
        : image,
    );
  }

  const updated = gallery.map((image) => {
    if (action === "set-primary") {
      return image.id === imageId
        ? {
            ...image,
            featuredForSharing: true,
            primarySocialPreview: true,
          }
        : { ...image, primarySocialPreview: false };
    }

    if (image.id !== imageId) return image;
    const featuredForSharing = image.featuredForSharing !== true;
    return {
      ...image,
      featuredForSharing,
      primarySocialPreview: featuredForSharing
        ? image.primarySocialPreview
        : false,
    };
  });
  const selected = sortedSocialGallery(updated).filter(
    (image) =>
      image.featuredForSharing === true || image.primarySocialPreview === true,
  );
  const primary = selected.find((image) => image.primarySocialPreview === true);
  const ordered = primary
    ? [primary, ...selected.filter((image) => image.id !== primary.id)]
    : selected;
  const orders = new Map(ordered.map((image, index) => [image.id, index + 1]));
  return updated.map((image) => ({
    ...image,
    socialPreviewOrder: orders.get(image.id),
  }));
}
