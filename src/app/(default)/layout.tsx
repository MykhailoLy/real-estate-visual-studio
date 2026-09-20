import type { Metadata, Viewport } from "next";
import DocumentRoot, {
  documentMetadata,
  documentViewport,
} from "@/components/layout/DocumentRoot";

export const metadata: Metadata = documentMetadata;
export const viewport: Viewport = documentViewport;

export default function DefaultRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <DocumentRoot lang="en">{children}</DocumentRoot>;
}
