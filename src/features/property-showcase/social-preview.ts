import { formatPriceLabel } from "./formatting.ts";
import { normalizeListingFacts } from "./listing-details.ts";
import { getPrimaryLanguage, localizedText } from "./localization.ts";
import { getPropertyAddressView } from "./property-address.ts";
import { ownedPropertyShowcaseStoragePath } from "./storage-cleanup.ts";
import type {
  PropertyGalleryImage,
  PropertyShowcase,
} from "./types.ts";
import { SITE_URL } from "../../lib/seo.ts";

export interface PropertySocialPreviewImage {
  imageUrl: string;
  imageAlt: string;
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
  agencyName?: string;
  brandingMode: "picchuspot" | "agency" | "unbranded";
  brandingName?: string;
  brandingLogoUrl?: string;
  brandingAttribution?: string;
}

function sortedGallery(
  gallery: readonly PropertyGalleryImage[],
): PropertyGalleryImage[] {
  return [...gallery].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function selectPropertyHeroImages(
  property: PropertyShowcase,
): PropertySocialPreviewImage[] {
  const primaryLanguage = getPrimaryLanguage(property);
  const gallery = sortedGallery(property.gallery);
  const featured = gallery.filter((image) => image.featuredForSharing === true);
  const primary = gallery.find(
    (image) => image.primarySocialPreview === true,
  );
  const selected = primary
    ? [primary, ...featured.filter((image) => image.id !== primary.id)]
    : featured;
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
      imageUrl,
      imageAlt:
        localizedText(image.alt, primaryLanguage, primaryLanguage) ||
        localizedText(property.title, primaryLanguage, primaryLanguage),
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
  const gallery = sortedGallery(property.gallery);
  const primary = gallery.find(
    (image) => image.primarySocialPreview === true,
  );
  const featured = gallery.filter(
    (image) => image.featuredForSharing === true && image.id !== primary?.id,
  );
  const coverGalleryImage = gallery.find(
    (image) => image.src === property.coverImage,
  );
  const candidates = [primary, ...featured, coverGalleryImage].filter(
    (image): image is PropertyGalleryImage => Boolean(image),
  );

  const seenUrls = new Set<string>();
  const result = candidates.flatMap((image) => {
    const imageUrl = image.src.trim();
    if (!imageUrl || seenUrls.has(imageUrl)) return [];
    seenUrls.add(imageUrl);
    return [
      {
        imageUrl,
        imageAlt:
          localizedText(image.alt, primaryLanguage, primaryLanguage) ||
          localizedText(property.title, primaryLanguage, primaryLanguage),
      },
    ];
  });
  const coverImageUrl = property.coverImage.trim();
  if (coverImageUrl && !seenUrls.has(coverImageUrl)) {
    result.push({
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
  const brandingMode = property.socialPreview?.brandingMode ?? "picchuspot";
  const factPhrase = (item: typeof bedrooms) =>
    item ? `${item.value} ${item.label.toLocaleLowerCase(primaryLanguage)}` : "";

  return {
    title: [listingTitle, price].filter(Boolean).join(" | "),
    description: [
      location,
      reference ? `${reference.label} ${reference.value}` : "",
      factPhrase(bedrooms),
      factPhrase(bathrooms),
      factPhrase(builtArea),
    ].filter(Boolean).join(" \u00b7 ") || summary,
    ...image,
    images,
    location,
    price,
    reference: reference?.value ?? property.reference,
    referenceLabel: reference?.label ?? "Reference",
    bedrooms: bedrooms?.value,
    bathrooms: bathrooms?.value,
    builtArea: builtArea?.value,
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
      brandingMode === "picchuspot"
        ? "Property Showcase by PicchuSpot"
        : brandingMode === "agency"
          ? "Powered by PicchuSpot"
          : undefined,
  };
}

export function updateGallerySocialPreview(
  gallery: readonly PropertyGalleryImage[],
  imageId: string,
  action: "toggle-featured" | "set-primary",
): PropertyGalleryImage[] {
  return gallery.map((image) => {
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
}
