import { formatPriceLabel } from "./formatting.ts";
import { getPrimaryLanguage, localizedText } from "./localization.ts";
import type {
  PropertyGalleryImage,
  PropertyShowcase,
} from "./types.ts";

export interface PropertySocialPreview {
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
}

function sortedGallery(
  gallery: readonly PropertyGalleryImage[],
): PropertyGalleryImage[] {
  return [...gallery].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function selectPropertySocialImage(
  property: PropertyShowcase,
): Pick<PropertySocialPreview, "imageUrl" | "imageAlt"> {
  const primaryLanguage = getPrimaryLanguage(property);
  const gallery = sortedGallery(property.gallery);
  const featured = gallery.filter((image) => image.featuredForSharing === true);
  const selected =
    featured.find((image) => image.primarySocialPreview === true) ?? featured[0];
  const coverGalleryImage = gallery.find(
    (image) => image.src === property.coverImage,
  );
  const image = selected ?? coverGalleryImage;

  return {
    imageUrl: image?.src ?? property.coverImage,
    imageAlt:
      localizedText(image?.alt, primaryLanguage, primaryLanguage) ||
      localizedText(property.title, primaryLanguage, primaryLanguage),
  };
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
  const address =
    property.location.privacyMode === "exact"
      ? localizedText(
          property.location.displayAddress,
          primaryLanguage,
          primaryLanguage,
        )
      : "";
  const price = property.price.trim()
    ? formatPriceLabel(property.price)
    : "";
  const image = selectPropertySocialImage(property);

  return {
    title: [listingTitle, price].filter(Boolean).join(" | "),
    description: [address, summary].filter(Boolean).join(" | "),
    ...image,
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
