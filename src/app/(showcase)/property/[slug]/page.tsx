import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getPropertyShowcase } from "@/features/property-showcase/registry";
import { serializePublicPropertyShowcase } from "@/features/property-showcase/public-serialization";
import { getPublishedPropertyShowcase } from "@/features/property-showcase/server";
import { buildPropertyMetadata } from "@/features/property-showcase/property-metadata";
import { getPropertySocialImageVersion } from "@/features/property-showcase/social-image-version.server";
import { absoluteUrl } from "@/lib/seo";
import { getTurnstileSiteKeyFromEnv } from "@/components/auth/turnstile";
import PropertyShowcaseView from "../PropertyShowcaseView";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PropertyPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

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

export default async function PropertyPage({ params }: PropertyPageProps) {
  const { slug } = await params;
  const property = await resolveProperty(slug);

  if (!property) {
    notFound();
  }

  return (
    <PropertyShowcaseView
      property={serializePublicPropertyShowcase(property)}
      canonicalUrl={absoluteUrl(`/property/${property.slug}`)}
      turnstileSiteKey={getTurnstileSiteKeyFromEnv()}
    />
  );
}
