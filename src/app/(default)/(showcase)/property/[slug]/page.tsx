import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getPropertyShowcase } from "@/features/property-showcase/registry";
import { serializePublicPropertyShowcase } from "@/features/property-showcase/public-serialization";
import { getPublishedPropertyShowcase } from "@/features/property-showcase/server";
import { buildPropertyMetadata } from "@/features/property-showcase/property-metadata";
import { getPropertySocialImageVersion } from "@/features/property-showcase/social-image-version.server";
import { absoluteUrl } from "@/lib/seo";
import { getPropertyMarketingMaterialLinks } from "@/features/property-showcase/marketing-material-version";
import { getTurnstileSiteKeyFromEnv } from "@/components/auth/turnstile";
import type { PropertyShowcase } from "@/features/property-showcase/types";
import PropertyShowcaseView from "../PropertyShowcaseView";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PropertyPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    galleryFixture?: string | string[];
  }>;
};

const E2E_GALLERY_FIXTURE_COUNTS = new Set([1, 2, 5, 6, 48]);
const E2E_RASTER_GALLERY_SOURCES = [
  "/brand/property-social-emergency.png",
  "/brand/picchuspot-mark-1200.png",
  "/brand/picchuspot-logo-800.png",
] as const;

function galleryFixtureCount(value: string | string[] | undefined): number | null {
  if (process.env.PLAYWRIGHT_PROPERTY_GALLERY_FIXTURES !== "1") return null;
  if (typeof value !== "string") return null;

  const count = Number(value);
  return E2E_GALLERY_FIXTURE_COUNTS.has(count) ? count : null;
}

function propertyWithGalleryFixture(
  property: PropertyShowcase,
  imageCount: number,
): PropertyShowcase {
  if (property.gallery.length === 0) return property;

  return {
    ...property,
    gallery: Array.from({ length: imageCount }, (_, index) => {
      const source = property.gallery[index % property.gallery.length];
      const position = index + 1;
      return {
        ...source,
        id: `${source.id}-e2e-${position}`,
        // The 48-image fixture intentionally uses rasters so the browser test
        // exercises Next's optimizer rather than the demo listing's SVGs.
        src: imageCount === 48
          ? E2E_RASTER_GALLERY_SOURCES[index % E2E_RASTER_GALLERY_SOURCES.length]
          : source.src,
        sortOrder: position,
        label: {
          en: `Gallery image ${position}`,
          es: `Imagen de galeria ${position}`,
        },
      };
    }),
  };
}

const resolveProperty = cache(async (slug: string) => {
  return (await getPublishedPropertyShowcase(slug)) ?? getPropertyShowcase(slug);
});

export async function generateMetadata({
  params,
}: PropertyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const property = await resolveProperty(slug);

  if (!property) {
    return {
      title: "Property not found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return buildPropertyMetadata(
    property,
    getPropertySocialImageVersion(property),
  );
}

export default async function PropertyPage({
  params,
  searchParams,
}: PropertyPageProps) {
  const { slug } = await params;
  const property = await resolveProperty(slug);

  if (!property) {
    notFound();
  }

  const fixtureImageCount = galleryFixtureCount((await searchParams).galleryFixture);
  const displayedProperty = fixtureImageCount
    ? propertyWithGalleryFixture(property, fixtureImageCount)
    : property;

  return (
    <PropertyShowcaseView
      property={serializePublicPropertyShowcase(displayedProperty)}
      canonicalUrl={absoluteUrl(`/property/${property.slug}`)}
      marketingMaterialLinks={getPropertyMarketingMaterialLinks(
        property,
        absoluteUrl(`/property/${property.slug}`),
      )}
      turnstileSiteKey={getTurnstileSiteKeyFromEnv()}
    />
  );
}
