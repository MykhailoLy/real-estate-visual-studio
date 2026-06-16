import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Container from "@/components/layout/Container";
import CategoryServiceList, {
  type CategoryServiceItem,
} from "@/components/home/CategoryServiceList";
import CtaSection from "@/components/sections/CtaSection";
import { canonicalAlternates } from "@/lib/seo";

// ============================================================
// /renders — Renders / Architectural Visualization
// Placeholder hub. Quote-based for now.
// ============================================================

export const metadata: Metadata = {
  title: "Renders — Architectural Visualization",
  description:
    "Exterior and interior renders, 360 renders, virtual tours, and development marketing visuals.",
  alternates: canonicalAlternates("/renders"),
  openGraph: {
    title: "Renders - Architectural Visualization",
    description:
      "Exterior and interior renders, 360 renders, virtual tours, and development marketing visuals.",
    url: "/renders",
  },
};

const ITEMS: CategoryServiceItem[] = [
  {
    id: "exterior-renders",
    variant: "exterior-render",
    name: "Exterior Renders",
    description:
      "Photorealistic exterior visualizations for unbuilt projects, facade refurbishments, and listing covers.",
  },
  {
    id: "interior-renders",
    variant: "interior-render",
    name: "Interior Renders",
    description:
      "Interior scenes that show layout, finishes, and atmosphere — useful for off-plan units and renovation pitches.",
  },
  {
    id: "360-renders",
    variant: "render-360",
    name: "360° Renders",
    description:
      "Single-spot panoramic renders that let viewers look around an unbuilt space.",
  },
  {
    id: "360-virtual-tours-renders",
    variant: "render-tour",
    name: "360° Virtual Tours",
    description:
      "Multiple 360 renders linked into a connected walkthrough of an off-plan property.",
  },
  {
    id: "development-marketing",
    variant: "development-marketing",
    name: "Development Marketing",
    description:
      "Brochure-ready visuals, hero shots, and lifestyle scenes that support full development marketing campaigns.",
  },
];

export default function RendersPage() {
  return (
    <>
      <section className="bg-primary py-14 lg:py-20">
        <Container>
          <div className="max-w-3xl">
            <p className="text-secondary text-xs font-semibold tracking-[0.2em] uppercase mb-4">
              Renders
            </p>
            <h1 className="text-4xl lg:text-6xl font-bold text-white leading-[1.05] tracking-tight">
              Architectural visualization for projects that don&apos;t exist
              yet.
            </h1>
            <p className="mt-5 text-base lg:text-lg text-white/75 leading-relaxed">
              Exterior and interior renders, 360 panoramas, connected
              virtual tours, and full development-marketing visuals built
              from your plans, sketches, or moodboards.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-secondary text-primary-dark font-semibold rounded-lg hover:bg-secondary-light transition-colors text-sm"
              >
                Request a Quote
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center px-7 py-3.5 border border-white/40 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors text-sm"
              >
                See All Services
              </Link>
            </div>
          </div>
        </Container>
      </section>

      <CategoryServiceList
        eyebrow="Visualization"
        heading="From plans to listing-ready renders"
        intro="Render pricing depends on scope, scene complexity, and the deliverables you need. Send the project brief and we'll come back with a quote."
        items={ITEMS}
      />

      <CtaSection
        title="Have a development to visualize?"
        subtitle="Share the brief, the floor plans, and the look you have in mind. We will scope the work and reply with a quote."
        primaryLabel="Request a Quote"
        primaryHref="/contact"
        secondaryLabel="Browse Remote Services"
        secondaryHref="/"
      />
    </>
  );
}
