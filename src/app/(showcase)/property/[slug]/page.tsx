import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPropertyShowcase } from "@/features/property-showcase/registry";
import { getPublishedPropertyShowcase } from "@/features/property-showcase/server";
import PropertyShowcaseView from "../PropertyShowcaseView";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PropertyPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

async function resolveProperty(slug: string) {
  return (await getPublishedPropertyShowcase(slug)) ?? getPropertyShowcase(slug);
}

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

  return {
    title: property.title.en,
    description: property.summary.en,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      type: "website",
      url: canonicalPath,
      title: property.title.en,
      description: property.summary.en,
      images: [
        {
          url: property.coverImage,
          alt: property.gallery[0]?.alt.en ?? property.title.en,
        },
      ],
    },
  };
}

export default async function PropertyPage({ params }: PropertyPageProps) {
  const { slug } = await params;
  const property = await resolveProperty(slug);

  if (!property) {
    notFound();
  }

  return <PropertyShowcaseView property={property} />;
}
