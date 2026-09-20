import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import DocumentRoot, {
  documentMetadata,
  documentViewport,
} from "@/components/layout/DocumentRoot";

export const metadata: Metadata = documentMetadata;
export const viewport: Viewport = documentViewport;

// Only the existing Spanish page tree is published. No request-time locale lookup.
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ locale: "es" }];
}

export default async function LocalizedRootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (locale !== "es") notFound();

  return <DocumentRoot lang={locale}>{children}</DocumentRoot>;
}
