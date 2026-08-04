import type { Metadata } from "next";
import { serializePublicPropertyShowcase } from "@/features/property-showcase/public-serialization";
import { costaBlancaDemo } from "@/features/property-showcase/registry";
import PropertyShowcaseView from "../PropertyShowcaseView";

export const metadata: Metadata = {
  title: "Sea View Residence - Costa Blanca",
  description:
    "A demonstration PicchuSpot property showcase with photography, floor plan, virtual tour and remote buyer contact options.",
  alternates: {
    canonical: "/property/sea-view-residence",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function CostaBlancaDemoPage() {
  return (
    <PropertyShowcaseView
      property={serializePublicPropertyShowcase(costaBlancaDemo)}
    />
  );
}
