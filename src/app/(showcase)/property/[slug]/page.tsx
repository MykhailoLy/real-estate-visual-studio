import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getPropertyShowcase,
  getPropertyShowcaseSlugs,
} from "@/features/property-showcase/registry";
import CostaBlancaDemoPage from "../costa-blanca-demo/page";

type PropertyPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return getPropertyShowcaseSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PropertyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const property = getPropertyShowcase(slug);

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
  const property = getPropertyShowcase(slug);

  if (!property) {
    notFound();
  }

  // The approved visual layout is reused while its sections are progressively
  // connected to PropertyShowcase data and, later, to Supabase records.
  return <CostaBlancaDemoPage />;
}
