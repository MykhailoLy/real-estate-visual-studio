import type { Metadata } from "next";
import { absoluteUrl, SITE_NAME } from "../../lib/seo.ts";
import { getPropertySocialPreview } from "./social-preview.ts";
import { getActivePropertyBranding } from "./branding.ts";
import type { PropertyShowcase } from "./types.ts";

export function propertySocialImageUrl(
  property: Pick<PropertyShowcase, "slug">,
  version: string,
): string {
  return absoluteUrl(
    `/property/${property.slug}/opengraph-image?v=${encodeURIComponent(version)}`,
  );
}

export function buildPropertyMetadata(
  property: PropertyShowcase,
  socialImageVersion: string,
): Metadata {
  const canonicalPath = `/property/${property.slug}`;
  const canonicalUrl = absoluteUrl(canonicalPath);
  const socialImageUrl = propertySocialImageUrl(property, socialImageVersion);
  const preview = getPropertySocialPreview(property);
  const branding = getActivePropertyBranding(property);

  return {
    title: preview.title,
    description: preview.description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: "website",
      url: canonicalUrl,
      siteName: branding?.brandName ?? SITE_NAME,
      title: preview.title,
      description: preview.description,
      images: [
        {
          url: socialImageUrl,
          secureUrl: socialImageUrl,
          width: 1200,
          height: 630,
          type: "image/png",
          alt: preview.imageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: preview.title,
      description: preview.description,
      images: [socialImageUrl],
    },
  };
}
