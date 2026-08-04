import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getPropertyShowcase } from "@/features/property-showcase/registry";
import { serializePublicPropertyShowcase } from "@/features/property-showcase/public-serialization";
import { getPublishedPropertyShowcase } from "@/features/property-showcase/server";
import { getPropertySocialPreview } from "@/features/property-showcase/social-preview";
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

  const canonicalPath = `/property/${property.slug}`;
  const preview = getPropertySocialPreview(property);

  return {
    title: preview.title,
    description: preview.description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      type: "website",
      url: canonicalPath,
      title: preview.title,
      description: preview.description,
      images: [
        {
          url: preview.imageUrl,
          alt: preview.imageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: preview.title,
      description: preview.description,
      images: [preview.imageUrl],
    },
  };
}

export default async function PropertyPage({ params }: PropertyPageProps) {
  const { slug } = await params;
  const property = await resolveProperty(slug);

  if (!property) {
    notFound();
  }

  return <PropertyShowcaseView property={serializePublicPropertyShowcase(property)} />;
}
