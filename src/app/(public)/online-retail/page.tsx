import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Container from "@/components/layout/Container";
import CategoryServiceList, {
  type CategoryServiceItem,
} from "@/components/home/CategoryServiceList";
import CtaSection from "@/components/sections/CtaSection";
import { absoluteUrl } from "@/lib/seo";

// ============================================================
// /online-retail — Online Retail Visuals
// Placeholder hub. Quote-based for now.
// ============================================================

export const metadata: Metadata = {
  title: "Online Retail — Product Visuals",
  description:
    "Product photo editing, background removal, lifestyle compositing, color variations, and marketplace-ready images.",
  alternates: {
    canonical: absoluteUrl("/online-retail"),
  },
};

const ITEMS: CategoryServiceItem[] = [
  {
    id: "product-photo-editing",
    variant: "product-edit",
    name: "Product Photo Editing",
    description:
      "Color, exposure, and clean-up work that makes product shots feel consistent across an entire catalog.",
  },
  {
    id: "background-removal",
    variant: "background-removal",
    name: "Background Removal",
    description:
      "Transparent or pure-white backgrounds with clean edges, ready for storefronts and marketplaces.",
  },
  {
    id: "lifestyle-compositing",
    variant: "lifestyle",
    name: "Lifestyle Compositing",
    description:
      "Place existing product shots into believable lifestyle scenes for ads, banners, and editorial pages.",
  },
  {
    id: "color-variations",
    variant: "color-variations",
    name: "Color Variations",
    description:
      "Generate accurate color variants from a single source shot so each SKU has matching hero imagery.",
  },
  {
    id: "marketplace-images",
    variant: "marketplace",
    name: "Marketplace Images",
    description:
      "Output sized and exported to the requirements of Amazon, Etsy, eBay, Shopify, and similar platforms.",
  },
];

export default function OnlineRetailPage() {
  return (
    <>
      <section className="bg-primary py-14 lg:py-20">
        <Container>
          <div className="max-w-3xl">
            <p className="text-secondary text-xs font-semibold tracking-[0.2em] uppercase mb-4">
              Online Retail
            </p>
            <h1 className="text-4xl lg:text-6xl font-bold text-white leading-[1.05] tracking-tight">
              Clean, consistent product visuals.
            </h1>
            <p className="mt-5 text-base lg:text-lg text-white/75 leading-relaxed">
              Photo editing, cut-outs, lifestyle composites, and
              marketplace-ready exports for storefronts, ads, and
              catalogs.
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
        eyebrow="Retail Visuals"
        heading="Product imagery that scales with your catalog"
        intro="Retail pricing depends on volume, output formats, and turnaround. Send a sample batch and we'll come back with a per-image rate."
        items={ITEMS}
      />

      <CtaSection
        title="Got a catalog to clean up?"
        subtitle="Tell us how many SKUs, what platforms you sell on, and the deadline. We'll quote the work and confirm a turnaround."
        primaryLabel="Request a Quote"
        primaryHref="/contact"
        secondaryLabel="Browse Remote Services"
        secondaryHref="/"
      />
    </>
  );
}
